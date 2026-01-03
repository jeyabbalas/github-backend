/**
 * Main Entry Point
 *
 * This module loads Octokit from esm.sh CDN and initializes the application.
 * ES modules are used to ensure proper loading order and modern JavaScript support.
 */

// Import Octokit from esm.sh CDN
import { Octokit } from 'https://esm.sh/@octokit/rest@21';

// Make Octokit available globally for other modules
window.Octokit = Octokit;

// Import application modules
import { CONFIG } from './config.js';
import { Auth } from './auth.js';
import { GitHubAPI } from './github-api.js';
import { UI } from './ui.js';
import { App } from './app.js';

// Make modules available globally (for debugging and cross-module access)
window.CONFIG = CONFIG;
window.Auth = Auth;
window.GitHubAPI = GitHubAPI;
window.UI = UI;
window.App = App;

// Initialize the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.init());
} else {
  App.init();
}
