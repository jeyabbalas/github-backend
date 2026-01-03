/**
 * Authentication Module
 *
 * Handles GitHub OAuth with PKCE (Proof Key for Code Exchange).
 * PKCE is required for public clients (browser apps) that cannot securely store
 * a client secret.
 *
 * Flow:
 * 1. Generate random code_verifier
 * 2. Create code_challenge = SHA256(code_verifier)
 * 3. Redirect to GitHub with code_challenge
 * 4. GitHub redirects back with authorization code
 * 5. Exchange code + code_verifier for access token via Cloudflare Worker
 * 6. Store token in sessionStorage
 */

const Auth = (function () {
  // Private: Octokit instance (created after authentication)
  let octokitInstance = null;

  /**
   * Generate a cryptographically secure random string for PKCE
   * @param {number} length - Length of the string (default: 64)
   * @returns {string} Random string
   */
  function generateRandomString(length = 64) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);
    return Array.from(randomValues)
      .map((v) => charset[v % charset.length])
      .join('');
  }

  /**
   * Generate SHA-256 hash of the code verifier for PKCE
   * @param {string} verifier - The code verifier
   * @returns {Promise<string>} Base64-URL encoded hash
   */
  async function generateCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);

    // Convert to base64-url encoding (no padding, URL-safe characters)
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Generate a random state parameter for CSRF protection
   * @returns {string} Random state string
   */
  function generateState() {
    return generateRandomString(32);
  }

  /**
   * Check if user is currently authenticated
   * @returns {boolean} True if access token exists in sessionStorage
   */
  function isAuthenticated() {
    return sessionStorage.getItem(CONFIG.STORAGE_KEYS.ACCESS_TOKEN) !== null;
  }

  /**
   * Get the stored access token
   * @returns {string|null} Access token or null if not authenticated
   */
  function getAccessToken() {
    return sessionStorage.getItem(CONFIG.STORAGE_KEYS.ACCESS_TOKEN);
  }

  /**
   * Get or create an authenticated Octokit instance
   * @returns {Octokit|null} Octokit instance or null if not authenticated
   */
  function getOctokit() {
    const token = getAccessToken();
    if (!token) {
      return null;
    }

    // Reuse existing instance if token hasn't changed
    if (!octokitInstance) {
      octokitInstance = new Octokit({ auth: token });
    }

    return octokitInstance;
  }

  /**
   * Start the OAuth login flow
   * Generates PKCE values and redirects to GitHub authorization page
   */
  async function initiateLogin() {
    // Generate PKCE values
    const codeVerifier = generateRandomString(64);
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateState();

    // Store verifier and state in sessionStorage for later verification
    sessionStorage.setItem(CONFIG.STORAGE_KEYS.CODE_VERIFIER, codeVerifier);
    sessionStorage.setItem(CONFIG.STORAGE_KEYS.OAUTH_STATE, state);

    // Build the authorization URL
    const params = new URLSearchParams({
      client_id: CONFIG.CLIENT_ID,
      redirect_uri: CONFIG.REDIRECT_URI,
      scope: CONFIG.OAUTH_SCOPE,
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    // Redirect to GitHub's authorization page
    window.location.href = `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  /**
   * Handle the OAuth callback after user authorizes the app
   * Exchanges authorization code for access token
   * @returns {Promise<boolean>} True if authentication was successful
   */
  async function handleCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const returnedState = urlParams.get('state');
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');

    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error, errorDescription);
      throw new Error(errorDescription || error);
    }

    // No code means this isn't a callback
    if (!code) {
      return false;
    }

    // Verify state to prevent CSRF attacks
    const savedState = sessionStorage.getItem(CONFIG.STORAGE_KEYS.OAUTH_STATE);
    if (returnedState !== savedState) {
      throw new Error('State mismatch - possible CSRF attack');
    }

    // Get the code verifier we saved earlier
    const codeVerifier = sessionStorage.getItem(CONFIG.STORAGE_KEYS.CODE_VERIFIER);
    if (!codeVerifier) {
      throw new Error('Code verifier not found - please try logging in again');
    }

    // Exchange the code for an access token via our Cloudflare Worker
    const response = await fetch(CONFIG.WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: code,
        client_id: CONFIG.CLIENT_ID,
        code_verifier: codeVerifier,
        redirect_uri: CONFIG.REDIRECT_URI,
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error_description || data.error);
    }

    if (!data.access_token) {
      throw new Error('No access token received');
    }

    // Store the access token
    sessionStorage.setItem(CONFIG.STORAGE_KEYS.ACCESS_TOKEN, data.access_token);

    // Clean up temporary OAuth values
    sessionStorage.removeItem(CONFIG.STORAGE_KEYS.CODE_VERIFIER);
    sessionStorage.removeItem(CONFIG.STORAGE_KEYS.OAUTH_STATE);

    // Clear the URL parameters (clean up the address bar)
    window.history.replaceState({}, document.title, CONFIG.REDIRECT_URI);

    // Reset octokit instance so it gets recreated with new token
    octokitInstance = null;

    return true;
  }

  /**
   * Log out the current user
   * Clears all stored authentication data
   */
  function logout() {
    sessionStorage.removeItem(CONFIG.STORAGE_KEYS.ACCESS_TOKEN);
    sessionStorage.removeItem(CONFIG.STORAGE_KEYS.CODE_VERIFIER);
    sessionStorage.removeItem(CONFIG.STORAGE_KEYS.OAUTH_STATE);
    octokitInstance = null;
  }

  // Public API
  return {
    isAuthenticated,
    getAccessToken,
    getOctokit,
    initiateLogin,
    handleCallback,
    logout,
  };
})();
