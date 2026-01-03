/**
 * Configuration for GitHub Document Manager
 *
 * IMPORTANT: Update these values with your own configuration before deploying.
 *
 * 1. CLIENT_ID: Get this from your GitHub OAuth App settings
 *    (GitHub → Settings → Developer settings → OAuth Apps)
 *
 * 2. WORKER_URL: Your Cloudflare Worker URL
 *    (e.g., https://github-oauth-proxy.your-subdomain.workers.dev)
 *
 * 3. REDIRECT_URI: Your GitHub Pages URL (must match OAuth App callback URL)
 *    (e.g., https://your-username.github.io/github-backend/)
 */

export const CONFIG = {
  // GitHub OAuth App Client ID
  // Get this from: https://github.com/settings/developers
  CLIENT_ID: 'Ov23liDU8NltDFxZJN6N',

  // Cloudflare Worker URL for OAuth token exchange
  // Deploy the worker from worker/oauth-proxy.js
  WORKER_URL: 'https://github-oauth-proxy.jeyabbalas.workers.dev/',

  // Your GitHub Pages URL (authorization callback URL)
  // This must exactly match the callback URL in your OAuth App settings
  REDIRECT_URI: 'https://jeyabbalas.github.io/github-backend/',

  // OAuth scope - 'repo' gives access to private and public repositories
  // Use 'public_repo' if you only want access to public repositories
  OAUTH_SCOPE: 'repo',

  // Session storage keys
  STORAGE_KEYS: {
    ACCESS_TOKEN: 'github_access_token',
    CODE_VERIFIER: 'oauth_code_verifier',
    OAUTH_STATE: 'oauth_state',
  },
};

// Freeze the config to prevent accidental modifications
Object.freeze(CONFIG);
Object.freeze(CONFIG.STORAGE_KEYS);
