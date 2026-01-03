/**
 * GitHub API Module
 *
 * Provides a high-level interface for GitHub operations using Octokit.
 * All methods use the authenticated Octokit instance from the Auth module.
 */

import { Auth } from './auth.js';

export const GitHubAPI = (function () {
  /**
   * Get the authenticated user's information
   * @returns {Promise<Object>} User object with login, name, avatar_url, etc.
   */
  async function getUser() {
    const octokit = Auth.getOctokit();
    if (!octokit) throw new Error('Not authenticated');

    const { data } = await octokit.users.getAuthenticated();
    return data;
  }

  /**
   * List all repositories for the authenticated user
   * @param {Object} options - Optional parameters
   * @param {string} options.sort - Sort by: created, updated, pushed, full_name (default: updated)
   * @param {number} options.per_page - Results per page (default: 100)
   * @returns {Promise<Array>} Array of repository objects
   */
  async function listRepositories(options = {}) {
    const octokit = Auth.getOctokit();
    if (!octokit) throw new Error('Not authenticated');

    const { data } = await octokit.repos.listForAuthenticatedUser({
      sort: options.sort || 'updated',
      per_page: options.per_page || 100,
      affiliation: 'owner', // Only repos owned by the user
    });

    return data;
  }

  /**
   * Create a new repository
   * @param {string} name - Repository name
   * @param {Object} options - Optional parameters
   * @param {string} options.description - Repository description
   * @param {boolean} options.private - Whether the repo should be private (default: true)
   * @param {boolean} options.auto_init - Initialize with a README (default: true)
   * @returns {Promise<Object>} Created repository object
   */
  async function createRepository(name, options = {}) {
    const octokit = Auth.getOctokit();
    if (!octokit) throw new Error('Not authenticated');

    const { data } = await octokit.repos.createForAuthenticatedUser({
      name: name,
      description: options.description || '',
      private: options.private === true, // Default to public
      auto_init: options.auto_init !== false, // Default to auto-init
    });

    return data;
  }

  /**
   * Get contents of a path in a repository (file or directory)
   * @param {string} owner - Repository owner (username)
   * @param {string} repo - Repository name
   * @param {string} path - Path to file or directory (empty string for root)
   * @param {string} ref - Git reference (branch, tag, or SHA) - optional
   * @returns {Promise<Object|Array>} File object or array of content objects
   */
  async function getContents(owner, repo, path = '', ref = null) {
    const octokit = Auth.getOctokit();
    if (!octokit) throw new Error('Not authenticated');

    const params = {
      owner,
      repo,
      path,
    };

    if (ref) {
      params.ref = ref;
    }

    const { data } = await octokit.repos.getContent(params);
    return data;
  }

  /**
   * Get the content of a file, decoded from base64
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} path - Path to the file
   * @param {string} ref - Git reference (optional)
   * @returns {Promise<Object>} Object with content, sha, and metadata
   */
  async function getFileContent(owner, repo, path, ref = null) {
    const data = await getContents(owner, repo, path, ref);

    if (Array.isArray(data)) {
      throw new Error('Path is a directory, not a file');
    }

    if (data.type !== 'file') {
      throw new Error(`Expected file but got ${data.type}`);
    }

    // Decode base64 content
    const content = atob(data.content);

    return {
      content,
      sha: data.sha,
      name: data.name,
      path: data.path,
      size: data.size,
    };
  }

  /**
   * Create or update a file in the repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} path - Path for the file
   * @param {string} content - File content (plain text, will be base64 encoded)
   * @param {string} message - Commit message
   * @param {string} sha - SHA of the file being replaced (required for updates, null for creates)
   * @returns {Promise<Object>} Commit object with sha and other metadata
   */
  async function createOrUpdateFile(owner, repo, path, content, message, sha = null) {
    const octokit = Auth.getOctokit();
    if (!octokit) throw new Error('Not authenticated');

    // Encode content to base64
    const encodedContent = btoa(unescape(encodeURIComponent(content)));

    const params = {
      owner,
      repo,
      path,
      message,
      content: encodedContent,
    };

    if (sha) {
      params.sha = sha;
    }

    const { data } = await octokit.repos.createOrUpdateFileContents(params);
    return data;
  }

  /**
   * Delete a file from the repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} path - Path to the file
   * @param {string} message - Commit message
   * @param {string} sha - SHA of the file to delete
   * @returns {Promise<Object>} Commit object
   */
  async function deleteFile(owner, repo, path, message, sha) {
    const octokit = Auth.getOctokit();
    if (!octokit) throw new Error('Not authenticated');

    const { data } = await octokit.repos.deleteFile({
      owner,
      repo,
      path,
      message,
      sha,
    });

    return data;
  }

  /**
   * Get commit history for a file
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} path - Path to the file
   * @param {Object} options - Optional parameters
   * @param {number} options.per_page - Number of commits to fetch (default: 30)
   * @returns {Promise<Array>} Array of commit objects
   */
  async function getFileHistory(owner, repo, path, options = {}) {
    const octokit = Auth.getOctokit();
    if (!octokit) throw new Error('Not authenticated');

    const { data } = await octokit.repos.listCommits({
      owner,
      repo,
      path,
      per_page: options.per_page || 30,
    });

    return data.map((commit) => ({
      sha: commit.sha,
      shortSha: commit.sha.substring(0, 7),
      message: commit.commit.message,
      date: new Date(commit.commit.author.date),
      author: commit.commit.author.name,
    }));
  }

  /**
   * Get file content at a specific commit
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} path - Path to the file
   * @param {string} sha - Commit SHA
   * @returns {Promise<Object>} File content object
   */
  async function getFileAtCommit(owner, repo, path, sha) {
    return getFileContent(owner, repo, path, sha);
  }

  /**
   * Create a folder by creating a .gitkeep file inside it
   * GitHub doesn't support empty folders, so we need a placeholder file
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} folderPath - Path for the new folder
   * @returns {Promise<Object>} Commit object
   */
  async function createFolder(owner, repo, folderPath) {
    // Ensure path ends without trailing slash
    const cleanPath = folderPath.replace(/\/+$/, '');
    const gitkeepPath = `${cleanPath}/.gitkeep`;

    return createOrUpdateFile(
      owner,
      repo,
      gitkeepPath,
      '', // Empty content
      `Create folder: ${cleanPath}`
    );
  }

  // Public API
  return {
    getUser,
    listRepositories,
    createRepository,
    getContents,
    getFileContent,
    createOrUpdateFile,
    deleteFile,
    getFileHistory,
    getFileAtCommit,
    createFolder,
  };
})();
