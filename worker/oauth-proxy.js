/**
 * Cloudflare Worker: GitHub OAuth Token Exchange Proxy
 *
 * This worker proxies requests to GitHub's OAuth token endpoint because
 * GitHub doesn't include CORS headers in their response, which prevents
 * browser-based applications from making direct requests.
 *
 * SECURITY:
 * - Validates the Origin header to ensure only requests from your GitHub Pages domain are accepted
 * - Stores the client_secret securely as an environment variable (not in browser code)
 *
 * DEPLOYMENT:
 * 1. Go to https://dash.cloudflare.com
 * 2. Navigate to Compute & AI → Workers & Pages → Create application → Start with Hello World!
 * 3. Worker name: `github-oauth-proxy.jeyabbalas.workers.dev`
 * 4. Click Deploy
 * 5. Click Edit code → Copy code below → Deploy
 *    - Update ALLOWED_ORIGINS below with your GitHub Pages domain
 *    - Add CLIENT_SECRET as an environment variable:
 *      - Go to Worker Settings → Variables and Secrets → +Add
 *      - Type: Secret
 *      - Name: CLIENT_SECRET
 *      - Value: (your GitHub OAuth App client secret)
 */

// =============================================================================
// CONFIGURATION - UPDATE THIS WITH YOUR GITHUB PAGES DOMAIN
// =============================================================================

const ALLOWED_ORIGINS = [
  'https://jeyabbalas.github.io',  // Replace with your actual GitHub Pages domain
  // Add additional origins if needed (e.g., for local development):
  // 'http://localhost:3000',
  // 'http://127.0.0.1:5500',
];

// =============================================================================
// WORKER CODE
// =============================================================================

const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';

/**
 * Handle incoming requests
 */
export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return handleCORS(request);
    }

    // Only accept POST requests for token exchange
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          ...getCORSHeaders(request),
        },
      });
    }

    // Validate origin
    const origin = request.headers.get('Origin');
    if (!isOriginAllowed(origin)) {
      return new Response(JSON.stringify({
        error: 'Origin not allowed',
        message: 'This worker only accepts requests from configured origins. Check ALLOWED_ORIGINS in the worker code.'
      }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    try {
      // Get client_secret from environment variable
      const clientSecret = env.CLIENT_SECRET;
      if (!clientSecret) {
        return new Response(JSON.stringify({
          error: 'Server configuration error',
          message: 'CLIENT_SECRET environment variable is not configured in the worker.'
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...getCORSHeaders(request),
          },
        });
      }

      // Parse the request body
      const body = await request.json();

      // Validate required fields
      const { code, client_id, code_verifier, redirect_uri } = body;

      if (!code || !client_id) {
        return new Response(JSON.stringify({
          error: 'Missing required fields',
          message: 'Request must include: code, client_id'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...getCORSHeaders(request),
          },
        });
      }

      // Build the request to GitHub (including client_secret from env)
      const githubParams = new URLSearchParams({
        client_id,
        client_secret: clientSecret,
        code,
        redirect_uri: redirect_uri || '',
      });

      // Add code_verifier for PKCE flow (additional security)
      if (code_verifier) {
        githubParams.append('code_verifier', code_verifier);
      }

      // Make request to GitHub's token endpoint
      const githubResponse = await fetch(GITHUB_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: githubParams.toString(),
      });

      // Get the response from GitHub
      const githubData = await githubResponse.json();

      // Check for errors from GitHub
      if (githubData.error) {
        return new Response(JSON.stringify({
          error: githubData.error,
          error_description: githubData.error_description,
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...getCORSHeaders(request),
          },
        });
      }

      // Return the successful response with CORS headers
      return new Response(JSON.stringify(githubData), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCORSHeaders(request),
        },
      });

    } catch (error) {
      // Handle any errors
      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: error.message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...getCORSHeaders(request),
        },
      });
    }
  },
};

/**
 * Check if the origin is in the allowed list
 */
function isOriginAllowed(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed));
}

/**
 * Get CORS headers for the response
 */
function getCORSHeaders(request) {
  const origin = request.headers.get('Origin');

  // Only set Access-Control-Allow-Origin if the origin is allowed
  if (isOriginAllowed(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    };
  }

  return {};
}

/**
 * Handle CORS preflight requests
 */
function handleCORS(request) {
  const origin = request.headers.get('Origin');

  if (!isOriginAllowed(origin)) {
    return new Response(null, { status: 403 });
  }

  return new Response(null, {
    status: 204,
    headers: getCORSHeaders(request),
  });
}
