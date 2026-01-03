/**
 * Main Application Module
 *
 * Orchestrates the application by connecting Auth, GitHubAPI, and UI modules.
 * Handles application state and coordinates user actions.
 */

import { Auth } from './auth.js';
import { GitHubAPI } from './github-api.js';
import { UI } from './ui.js';

export const App = (function () {
  // Application state
  const state = {
    user: null,
    repositories: [],
    currentRepo: null, // { owner, name, fullName }
    currentPath: '',
    currentFile: null, // { path, sha, content, originalContent }
    contents: [],
    fileHistory: [],
    isModified: false,
  };

  /**
   * Handler for beforeunload event - warns user about unsaved changes
   */
  function handleBeforeUnload(e) {
    if (state.isModified) {
      // Standard way to trigger the browser's "unsaved changes" dialog
      e.preventDefault();
      e.returnValue = ''; // Required for Chrome
      return ''; // Required for some browsers
    }
  }

  /**
   * Initialize the application
   */
  async function init() {
    // Initialize UI with event callbacks
    UI.init({
      onLogin: handleLogin,
      onLogout: handleLogout,
      onRepoSelect: handleRepoSelect,
      onCreateRepo: handleCreateRepo,
      onNavigate: handleNavigate,
      onCreateFolder: handleCreateFolder,
      onCreateFile: handleCreateFile,
      onFileSelect: handleFileSelect,
      onFileDelete: handleFileDeleteRequest,
      onEditorChange: handleEditorChange,
      onSaveFile: handleSaveFile,
      onConfirmDelete: handleConfirmDelete,
      onVersionSelect: handleVersionSelect,
      onRefresh: handleRefresh,
    });

    // Add warning when leaving page with unsaved changes
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Check for OAuth callback
    try {
      UI.showLoading('Authenticating...');
      const isCallback = await Auth.handleCallback();

      if (isCallback) {
        // Successfully authenticated from callback
        await loadDashboard();
        return;
      }
    } catch (error) {
      console.error('OAuth callback error:', error);
      UI.showToast(error.message || 'Authentication failed', 'error');
    }

    // Check if already authenticated
    if (Auth.isAuthenticated()) {
      await loadDashboard();
    } else {
      UI.hideLoading();
      UI.showLoginView();
    }
  }

  /**
   * Load the dashboard after authentication
   */
  async function loadDashboard() {
    try {
      UI.showLoading('Loading your data...');

      // Get user info
      state.user = await GitHubAPI.getUser();
      UI.showUserInfo(state.user);

      // Get repositories
      state.repositories = await GitHubAPI.listRepositories();
      UI.renderRepositories(state.repositories);

      UI.showDashboardView();
      UI.hideLoading();
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      UI.hideLoading();
      UI.showToast('Failed to load data. Please try logging in again.', 'error');
      handleLogout();
    }
  }

  // ===== Event Handlers =====

  /**
   * Handle login button click
   */
  function handleLogin() {
    Auth.initiateLogin();
  }

  /**
   * Handle logout button click
   */
  function handleLogout() {
    // Remove beforeunload listener since we're logging out
    window.removeEventListener('beforeunload', handleBeforeUnload);
    Auth.logout();
    resetState();
    UI.showLoginView();
    UI.hideEditor();
  }

  /**
   * Handle repository selection
   * @param {string} fullName - Full repository name (owner/repo)
   */
  async function handleRepoSelect(fullName) {
    if (!fullName) return;

    // Check for unsaved changes
    if (state.isModified) {
      if (!confirm('You have unsaved changes. Are you sure you want to switch repositories?')) {
        UI.selectRepository(state.currentRepo?.fullName || '');
        return;
      }
    }

    const [owner, name] = fullName.split('/');
    state.currentRepo = { owner, name, fullName };
    state.currentPath = '';
    state.currentFile = null;
    state.isModified = false;

    UI.selectRepository(fullName);
    UI.hideEditor();

    await loadContents();
  }

  /**
   * Handle create repository
   * @param {string} name - Repository name
   * @param {string} description - Repository description
   */
  async function handleCreateRepo(name, description, isPrivate = false) {
    try {
      UI.showLoading('Creating repository...');

      const repo = await GitHubAPI.createRepository(name, { description, private: isPrivate });

      // Optimistically add the new repo to state if not already there
      // (GitHub API may have latency before it appears in listRepositories)
      const existingIndex = state.repositories.findIndex((r) => r.full_name === repo.full_name);
      if (existingIndex === -1) {
        state.repositories.unshift(repo); // Add to beginning (most recent)
      }
      UI.renderRepositories(state.repositories);

      // Select the new repository
      await handleRepoSelect(repo.full_name);

      UI.hideLoading();
      UI.showToast(`Repository "${name}" created successfully!`, 'success');
    } catch (error) {
      console.error('Failed to create repository:', error);
      UI.hideLoading();
      UI.showToast(error.message || 'Failed to create repository', 'error');
    }
  }

  /**
   * Handle folder navigation
   * @param {string} path - Path to navigate to
   */
  async function handleNavigate(path) {
    // Check for unsaved changes
    if (state.isModified) {
      if (!confirm('You have unsaved changes. Are you sure you want to navigate away?')) {
        return;
      }
    }

    state.currentPath = path;
    state.currentFile = null;
    state.isModified = false;
    UI.hideEditor();

    await loadContents();
  }

  /**
   * Handle create folder
   * @param {string} name - Folder name
   */
  async function handleCreateFolder(name) {
    if (!state.currentRepo) return;

    try {
      UI.showLoading('Creating folder...');

      const folderPath = state.currentPath ? `${state.currentPath}/${name}` : name;

      await GitHubAPI.createFolder(state.currentRepo.owner, state.currentRepo.name, folderPath);

      // Optimistically add the folder to state.contents
      // (GitHub API may have latency before it appears in getContents)
      const newFolder = {
        name: name,
        path: folderPath,
        type: 'dir',
        sha: null, // SHA not needed for display
      };
      state.contents.push(newFolder);
      UI.renderFileList(state.contents, state.currentFile?.path);

      UI.hideLoading();
      UI.showToast(`Folder "${name}" created!`, 'success');
    } catch (error) {
      console.error('Failed to create folder:', error);
      UI.hideLoading();
      UI.showToast(error.message || 'Failed to create folder', 'error');
    }
  }

  /**
   * Handle create file
   * @param {string} name - File name
   */
  async function handleCreateFile(name) {
    if (!state.currentRepo) return;

    try {
      UI.showLoading('Creating document...');

      const filePath = state.currentPath ? `${state.currentPath}/${name}` : name;

      const result = await GitHubAPI.createOrUpdateFile(
        state.currentRepo.owner,
        state.currentRepo.name,
        filePath,
        `# ${name.replace('.md', '')}\n\nStart writing here...\n`,
        `Create ${name}`
      );

      // Optimistically add the file to state.contents
      // (GitHub API may have latency before it appears in getContents)
      const newFile = {
        name: name,
        path: filePath,
        type: 'file',
        sha: result.content.sha,
      };
      state.contents.push(newFile);
      UI.renderFileList(state.contents, filePath);

      // Open the new file in editor
      await handleFileSelect(filePath);

      UI.hideLoading();
      UI.showToast(`Document "${name}" created!`, 'success');
    } catch (error) {
      console.error('Failed to create document:', error);
      UI.hideLoading();
      UI.showToast(error.message || 'Failed to create document', 'error');
    }
  }

  /**
   * Handle file selection
   * @param {string} path - Path to the file
   */
  async function handleFileSelect(path) {
    if (!state.currentRepo) return;

    // Check for unsaved changes
    if (state.isModified && state.currentFile) {
      if (!confirm('You have unsaved changes. Are you sure you want to open another file?')) {
        return;
      }
    }

    try {
      UI.showLoading('Loading document...');

      const file = await GitHubAPI.getFileContent(state.currentRepo.owner, state.currentRepo.name, path);

      state.currentFile = {
        path: file.path,
        name: file.name,
        sha: file.sha,
        content: file.content,
        originalContent: file.content,
      };
      state.isModified = false;

      UI.showEditor(file.name, file.content);

      // Load version history
      await loadFileHistory(path);

      // Update file list to highlight current file
      UI.renderFileList(state.contents, path);

      UI.hideLoading();
    } catch (error) {
      console.error('Failed to load file:', error);
      UI.hideLoading();
      UI.showToast(error.message || 'Failed to load document', 'error');
    }
  }

  /**
   * Handle file delete request (shows confirmation)
   * @param {string} path - Path to the file
   * @param {string} sha - File SHA
   */
  function handleFileDeleteRequest(path, sha) {
    // Store the file to delete for confirmation
    state.pendingDelete = { path, sha };

    UI.showModal(
      'Delete Document',
      `<p>Are you sure you want to delete "<strong>${path.split('/').pop()}</strong>"?</p>
       <p style="color: #d73a49;">This action cannot be undone.</p>`,
      [
        { text: 'Cancel', className: 'btn btn-secondary', onClick: () => UI.hideModal() },
        {
          text: 'Delete',
          className: 'btn btn-danger',
          onClick: async () => {
            UI.hideModal();
            await handleDeleteFile(path, sha);
          },
        },
      ]
    );
  }

  /**
   * Handle file deletion
   * @param {string} path - Path to the file
   * @param {string} sha - File SHA
   */
  async function handleDeleteFile(path, sha) {
    if (!state.currentRepo) return;

    try {
      UI.showLoading('Deleting document...');

      await GitHubAPI.deleteFile(
        state.currentRepo.owner,
        state.currentRepo.name,
        path,
        `Delete ${path.split('/').pop()}`,
        sha
      );

      // Optimistically remove the file from state.contents
      // (GitHub API may have latency before it disappears from getContents)
      state.contents = state.contents.filter((item) => item.path !== path);

      // If we deleted the currently open file, close the editor
      if (state.currentFile && state.currentFile.path === path) {
        state.currentFile = null;
        state.isModified = false;
        UI.hideEditor();
      }

      UI.renderFileList(state.contents, state.currentFile?.path);

      UI.hideLoading();
      UI.showToast('Document deleted', 'success');
    } catch (error) {
      console.error('Failed to delete file:', error);
      UI.hideLoading();
      UI.showToast(error.message || 'Failed to delete document', 'error');
    }
  }

  /**
   * Handle confirmation of delete from editor delete button
   */
  async function handleConfirmDelete() {
    if (!state.currentFile || !state.currentRepo) return;

    await handleDeleteFile(state.currentFile.path, state.currentFile.sha);
  }

  /**
   * Handle editor content change
   */
  function handleEditorChange() {
    if (!state.currentFile) return;

    const currentContent = UI.getEditorContent();
    const isModified = currentContent !== state.currentFile.originalContent;

    if (isModified !== state.isModified) {
      state.isModified = isModified;
      if (isModified) {
        UI.setEditorModified();
      } else {
        UI.setEditorSaved();
      }
    }
  }

  /**
   * Handle save file
   * @param {string} message - Commit message
   */
  async function handleSaveFile(message) {
    if (!state.currentFile || !state.currentRepo) return;

    try {
      UI.showLoading('Saving document...');

      const content = UI.getEditorContent();

      const result = await GitHubAPI.createOrUpdateFile(
        state.currentRepo.owner,
        state.currentRepo.name,
        state.currentFile.path,
        content,
        message,
        state.currentFile.sha
      );

      // Update state with new SHA
      state.currentFile.sha = result.content.sha;
      state.currentFile.content = content;
      state.currentFile.originalContent = content;
      state.isModified = false;

      UI.setEditorSaved();

      // Reload file history
      await loadFileHistory(state.currentFile.path);

      // Reload contents (to update any file list data)
      await loadContents();

      UI.hideLoading();
      UI.showToast('Document saved!', 'success');
    } catch (error) {
      console.error('Failed to save file:', error);
      UI.hideLoading();
      UI.showToast(error.message || 'Failed to save document', 'error');
    }
  }

  /**
   * Handle version selection from history
   * @param {string} sha - Commit SHA to view
   */
  async function handleVersionSelect(sha) {
    if (!state.currentFile || !state.currentRepo) return;

    try {
      UI.showLoading('Loading version...');

      const file = await GitHubAPI.getFileAtCommit(
        state.currentRepo.owner,
        state.currentRepo.name,
        state.currentFile.path,
        sha
      );

      // Update editor with historical content
      // Note: we keep the original SHA for potential restore
      state.currentFile.content = file.content;

      UI.showEditor(state.currentFile.name, file.content);
      UI.renderVersionHistory(state.fileHistory, sha);

      // Mark as modified if content differs from latest
      const isModified = file.content !== state.currentFile.originalContent;
      state.isModified = isModified;
      if (isModified) {
        UI.setEditorModified();
      }

      UI.hideLoading();
    } catch (error) {
      console.error('Failed to load version:', error);
      UI.hideLoading();
      UI.showToast(error.message || 'Failed to load version', 'error');
    }
  }

  /**
   * Handle refresh button click
   */
  async function handleRefresh() {
    if (!state.currentRepo) return;

    try {
      UI.showLoading('Refreshing...');
      await loadContents();
      UI.hideLoading();
      UI.showToast('Refreshed', 'success');
    } catch (error) {
      console.error('Failed to refresh:', error);
      UI.hideLoading();
      UI.showToast('Failed to refresh', 'error');
    }
  }

  // ===== Helper Functions =====

  /**
   * Load contents of the current path
   */
  async function loadContents() {
    if (!state.currentRepo) return;

    try {
      let contents = [];

      try {
        contents = await GitHubAPI.getContents(
          state.currentRepo.owner,
          state.currentRepo.name,
          state.currentPath
        );

        // Handle case where getContents returns a file instead of array
        if (!Array.isArray(contents)) {
          contents = [];
        }
      } catch (error) {
        // Empty repository or folder
        if (error.status === 404) {
          contents = [];
        } else {
          throw error;
        }
      }

      state.contents = contents;

      UI.renderBreadcrumb(state.currentRepo.name, state.currentPath);
      UI.renderFileList(contents, state.currentFile?.path);
    } catch (error) {
      console.error('Failed to load contents:', error);
      UI.showToast('Failed to load folder contents', 'error');
    }
  }

  /**
   * Load file history
   * @param {string} path - Path to the file
   */
  async function loadFileHistory(path) {
    if (!state.currentRepo) return;

    try {
      const history = await GitHubAPI.getFileHistory(state.currentRepo.owner, state.currentRepo.name, path);

      state.fileHistory = history;
      UI.renderVersionHistory(history);
    } catch (error) {
      console.error('Failed to load file history:', error);
      // Don't show error toast for history - it's not critical
    }
  }

  /**
   * Reset application state
   */
  function resetState() {
    state.user = null;
    state.repositories = [];
    state.currentRepo = null;
    state.currentPath = '';
    state.currentFile = null;
    state.contents = [];
    state.fileHistory = [];
    state.isModified = false;
  }

  // Public API
  return {
    init,
  };
})();
