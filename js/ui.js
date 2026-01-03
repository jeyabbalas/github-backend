/**
 * UI Module
 *
 * Handles all DOM manipulation, rendering, and user interactions.
 * Provides a clean interface for the main app to update the UI.
 */

export const UI = (function () {
  // DOM element references (cached for performance)
  const elements = {
    // Views
    loginView: document.getElementById('login-view'),
    dashboardView: document.getElementById('dashboard-view'),

    // Login
    loginBtn: document.getElementById('login-btn'),

    // Header
    userInfo: document.getElementById('user-info'),
    logoutBtn: document.getElementById('logout-btn'),

    // Repository
    repoSelect: document.getElementById('repo-select'),
    createRepoBtn: document.getElementById('create-repo-btn'),

    // Navigation
    breadcrumb: document.getElementById('breadcrumb'),
    createFolderBtn: document.getElementById('create-folder-btn'),

    // File list
    fileList: document.getElementById('file-list'),
    createFileBtn: document.getElementById('create-file-btn'),

    // Editor
    editorPlaceholder: document.getElementById('editor-placeholder'),
    editorContainer: document.getElementById('editor-container'),
    editorFilename: document.getElementById('editor-filename'),
    editorStatus: document.getElementById('editor-status'),
    editor: document.getElementById('editor'),
    saveBtn: document.getElementById('save-btn'),
    deleteBtn: document.getElementById('delete-btn'),

    // Version history
    versionBtn: document.getElementById('version-btn'),
    versionMenu: document.getElementById('version-menu'),
    versionList: document.getElementById('version-list'),

    // Loading
    loadingOverlay: document.getElementById('loading-overlay'),
    loadingMessage: document.getElementById('loading-message'),

    // Modal
    modalOverlay: document.getElementById('modal-overlay'),
    modal: document.getElementById('modal'),
    modalTitle: document.getElementById('modal-title'),
    modalContent: document.getElementById('modal-content'),
    modalFooter: document.getElementById('modal-footer'),
    modalClose: document.getElementById('modal-close'),

    // Toast
    toastContainer: document.getElementById('toast-container'),
  };

  // Event callbacks (set by app.js)
  let callbacks = {};

  /**
   * Initialize UI event listeners
   * @param {Object} eventCallbacks - Object containing callback functions
   */
  function init(eventCallbacks) {
    callbacks = eventCallbacks;

    // Login button
    elements.loginBtn.addEventListener('click', () => {
      if (callbacks.onLogin) callbacks.onLogin();
    });

    // Logout button
    elements.logoutBtn.addEventListener('click', () => {
      if (callbacks.onLogout) callbacks.onLogout();
    });

    // Repository selection
    elements.repoSelect.addEventListener('change', (e) => {
      if (callbacks.onRepoSelect && e.target.value) {
        callbacks.onRepoSelect(e.target.value);
      }
    });

    // Create repository
    elements.createRepoBtn.addEventListener('click', () => {
      showCreateRepoModal();
    });

    // Create folder
    elements.createFolderBtn.addEventListener('click', () => {
      showCreateFolderModal();
    });

    // Create file
    elements.createFileBtn.addEventListener('click', () => {
      showCreateFileModal();
    });

    // Save file
    elements.saveBtn.addEventListener('click', () => {
      showSaveModal();
    });

    // Delete file
    elements.deleteBtn.addEventListener('click', () => {
      showDeleteConfirmModal();
    });

    // Editor changes
    elements.editor.addEventListener('input', () => {
      if (callbacks.onEditorChange) callbacks.onEditorChange();
    });

    // Version dropdown toggle
    elements.versionBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      elements.versionMenu.classList.toggle('hidden');
    });

    // Close version dropdown when clicking outside
    document.addEventListener('click', () => {
      elements.versionMenu.classList.add('hidden');
    });

    // Modal close button
    elements.modalClose.addEventListener('click', hideModal);

    // Close modal on overlay click
    elements.modalOverlay.addEventListener('click', (e) => {
      if (e.target === elements.modalOverlay) hideModal();
    });

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hideModal();
    });
  }

  // ===== View Management =====

  /**
   * Show the login view
   */
  function showLoginView() {
    elements.loginView.classList.remove('hidden');
    elements.dashboardView.classList.add('hidden');
  }

  /**
   * Show the dashboard view
   */
  function showDashboardView() {
    elements.loginView.classList.add('hidden');
    elements.dashboardView.classList.remove('hidden');
  }

  // ===== User Info =====

  /**
   * Display the authenticated user's information
   * @param {Object} user - User object with login and avatar_url
   */
  function showUserInfo(user) {
    elements.userInfo.innerHTML = `
      <img src="${user.avatar_url}" alt="${user.login}">
      <span>${user.login}</span>
    `;
  }

  // ===== Repository Management =====

  /**
   * Populate the repository dropdown
   * @param {Array} repos - Array of repository objects
   */
  function renderRepositories(repos) {
    elements.repoSelect.innerHTML = '<option value="">Select a repository...</option>';
    repos.forEach((repo) => {
      const option = document.createElement('option');
      option.value = repo.full_name;
      option.textContent = repo.name + (repo.private ? ' (private)' : '');
      elements.repoSelect.appendChild(option);
    });
  }

  /**
   * Select a repository in the dropdown
   * @param {string} fullName - Full repository name (owner/repo)
   */
  function selectRepository(fullName) {
    elements.repoSelect.value = fullName;
    elements.createFolderBtn.disabled = false;
    elements.createFileBtn.disabled = false;
  }

  // ===== Breadcrumb Navigation =====

  /**
   * Render the breadcrumb navigation
   * @param {string} repoName - Repository name
   * @param {string} currentPath - Current path in the repository
   */
  function renderBreadcrumb(repoName, currentPath) {
    elements.breadcrumb.innerHTML = '';

    // Repository root
    const rootItem = document.createElement('span');
    rootItem.className = 'breadcrumb-item clickable';
    rootItem.textContent = repoName;
    rootItem.addEventListener('click', () => {
      if (callbacks.onNavigate) callbacks.onNavigate('');
    });
    elements.breadcrumb.appendChild(rootItem);

    // Path segments
    if (currentPath) {
      const segments = currentPath.split('/').filter(Boolean);
      let accumulatedPath = '';

      segments.forEach((segment, index) => {
        // Separator
        const separator = document.createElement('span');
        separator.className = 'breadcrumb-separator';
        separator.textContent = ' / ';
        elements.breadcrumb.appendChild(separator);

        accumulatedPath += (accumulatedPath ? '/' : '') + segment;

        const item = document.createElement('span');
        item.className = 'breadcrumb-item';

        // Last segment is not clickable (current location)
        if (index < segments.length - 1) {
          item.classList.add('clickable');
          const pathToNavigate = accumulatedPath;
          item.addEventListener('click', () => {
            if (callbacks.onNavigate) callbacks.onNavigate(pathToNavigate);
          });
        }

        item.textContent = segment;
        elements.breadcrumb.appendChild(item);
      });
    }
  }

  // ===== File List =====

  /**
   * Render the file list
   * @param {Array} contents - Array of file/folder objects from GitHub API
   * @param {string} currentFile - Path of currently open file (to highlight)
   */
  function renderFileList(contents, currentFile = null) {
    elements.fileList.innerHTML = '';

    if (!contents || contents.length === 0) {
      elements.fileList.innerHTML = '<li class="file-list-empty">No files in this folder</li>';
      return;
    }

    // Sort: folders first, then files alphabetically
    const sorted = [...contents].sort((a, b) => {
      if (a.type === 'dir' && b.type !== 'dir') return -1;
      if (a.type !== 'dir' && b.type === 'dir') return 1;
      return a.name.localeCompare(b.name);
    });

    sorted.forEach((item) => {
      // Skip .gitkeep files (used to preserve empty folders)
      if (item.name === '.gitkeep') return;

      const li = document.createElement('li');
      li.className = 'file-item';

      if (item.path === currentFile) {
        li.classList.add('active');
      }

      // Icon
      const icon = document.createElement('span');
      icon.className = 'file-item-icon';
      icon.innerHTML = item.type === 'dir' ? getFolderIcon() : getFileIcon();

      // Name
      const name = document.createElement('span');
      name.className = 'file-item-name';
      name.textContent = item.name;

      li.appendChild(icon);
      li.appendChild(name);

      // Click handler
      li.addEventListener('click', () => {
        if (item.type === 'dir') {
          if (callbacks.onNavigate) callbacks.onNavigate(item.path);
        } else if (item.name.endsWith('.md')) {
          if (callbacks.onFileSelect) callbacks.onFileSelect(item.path);
        }
      });

      // Delete button (only for .md files)
      if (item.type === 'file' && item.name.endsWith('.md')) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'file-item-delete';
        deleteBtn.innerHTML = getTrashIcon();
        deleteBtn.title = 'Delete file';
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (callbacks.onFileDelete) callbacks.onFileDelete(item.path, item.sha);
        });
        li.appendChild(deleteBtn);
      }

      elements.fileList.appendChild(li);
    });
  }

  // ===== Editor =====

  /**
   * Show the editor with file content
   * @param {string} filename - Name of the file
   * @param {string} content - File content
   */
  function showEditor(filename, content) {
    elements.editorPlaceholder.classList.add('hidden');
    elements.editorContainer.classList.remove('hidden');
    elements.editorFilename.textContent = filename;
    elements.editor.value = content;
    elements.editorStatus.textContent = '';
    elements.editorStatus.classList.remove('modified');
    elements.saveBtn.disabled = true;
  }

  /**
   * Hide the editor
   */
  function hideEditor() {
    elements.editorPlaceholder.classList.remove('hidden');
    elements.editorContainer.classList.add('hidden');
    elements.editor.value = '';
  }

  /**
   * Get the current editor content
   * @returns {string} Editor content
   */
  function getEditorContent() {
    return elements.editor.value;
  }

  /**
   * Mark the editor as modified
   */
  function setEditorModified() {
    elements.editorStatus.textContent = '(unsaved changes)';
    elements.editorStatus.classList.add('modified');
    elements.saveBtn.disabled = false;
  }

  /**
   * Mark the editor as saved
   */
  function setEditorSaved() {
    elements.editorStatus.textContent = '(saved)';
    elements.editorStatus.classList.remove('modified');
    elements.saveBtn.disabled = true;
  }

  // ===== Version History =====

  /**
   * Render the version history dropdown
   * @param {Array} commits - Array of commit objects
   * @param {string} currentSha - SHA of currently viewed version
   */
  function renderVersionHistory(commits, currentSha = null) {
    elements.versionList.innerHTML = '';

    if (!commits || commits.length === 0) {
      elements.versionList.innerHTML = '<li class="version-item">No history available</li>';
      return;
    }

    commits.forEach((commit, index) => {
      const li = document.createElement('li');
      li.className = 'version-item';

      if (commit.sha === currentSha || (index === 0 && !currentSha)) {
        li.classList.add('active');
      }

      li.innerHTML = `
        <div class="version-message">${escapeHtml(commit.message.split('\n')[0])}</div>
        <div class="version-meta">
          <span>${formatDate(commit.date)}</span>
          <span>${commit.shortSha}</span>
        </div>
      `;

      li.addEventListener('click', () => {
        if (callbacks.onVersionSelect) callbacks.onVersionSelect(commit.sha);
        elements.versionMenu.classList.add('hidden');
      });

      elements.versionList.appendChild(li);
    });
  }

  // ===== Loading =====

  /**
   * Show the loading overlay
   * @param {string} message - Loading message to display
   */
  function showLoading(message = 'Loading...') {
    elements.loadingMessage.textContent = message;
    elements.loadingOverlay.classList.remove('hidden');
  }

  /**
   * Hide the loading overlay
   */
  function hideLoading() {
    elements.loadingOverlay.classList.add('hidden');
  }

  // ===== Modal =====

  /**
   * Show a modal dialog
   * @param {string} title - Modal title
   * @param {string} content - Modal content HTML
   * @param {Array} buttons - Array of button configs: { text, className, onClick }
   */
  function showModal(title, content, buttons = []) {
    elements.modalTitle.textContent = title;
    elements.modalContent.innerHTML = content;
    elements.modalFooter.innerHTML = '';

    buttons.forEach((btn) => {
      const button = document.createElement('button');
      button.className = btn.className || 'btn btn-secondary';
      button.textContent = btn.text;
      button.addEventListener('click', () => {
        if (btn.onClick) btn.onClick();
      });
      elements.modalFooter.appendChild(button);
    });

    elements.modalOverlay.classList.remove('hidden');

    // Focus first input if present
    const firstInput = elements.modalContent.querySelector('input, textarea');
    if (firstInput) firstInput.focus();
  }

  /**
   * Hide the modal
   */
  function hideModal() {
    elements.modalOverlay.classList.add('hidden');
  }

  /**
   * Show create repository modal
   */
  function showCreateRepoModal() {
    showModal(
      'Create Repository',
      `
        <div class="form-group">
          <label for="repo-name">Repository Name</label>
          <input type="text" id="repo-name" class="input" placeholder="my-documents">
        </div>
        <div class="form-group">
          <label for="repo-description">Description (optional)</label>
          <input type="text" id="repo-description" class="input" placeholder="My document storage">
        </div>
      `,
      [
        { text: 'Cancel', className: 'btn btn-secondary', onClick: hideModal },
        {
          text: 'Create',
          className: 'btn btn-primary',
          onClick: () => {
            const name = document.getElementById('repo-name').value.trim();
            const description = document.getElementById('repo-description').value.trim();
            if (name && callbacks.onCreateRepo) {
              callbacks.onCreateRepo(name, description);
              hideModal();
            }
          },
        },
      ]
    );
  }

  /**
   * Show create folder modal
   */
  function showCreateFolderModal() {
    showModal(
      'Create Folder',
      `
        <div class="form-group">
          <label for="folder-name">Folder Name</label>
          <input type="text" id="folder-name" class="input" placeholder="my-folder">
        </div>
      `,
      [
        { text: 'Cancel', className: 'btn btn-secondary', onClick: hideModal },
        {
          text: 'Create',
          className: 'btn btn-primary',
          onClick: () => {
            const name = document.getElementById('folder-name').value.trim();
            if (name && callbacks.onCreateFolder) {
              callbacks.onCreateFolder(name);
              hideModal();
            }
          },
        },
      ]
    );
  }

  /**
   * Show create file modal
   */
  function showCreateFileModal() {
    showModal(
      'Create Document',
      `
        <div class="form-group">
          <label for="file-name">Document Name</label>
          <input type="text" id="file-name" class="input" placeholder="my-document">
          <small style="color: #6a737d;">.md extension will be added automatically</small>
        </div>
      `,
      [
        { text: 'Cancel', className: 'btn btn-secondary', onClick: hideModal },
        {
          text: 'Create',
          className: 'btn btn-primary',
          onClick: () => {
            let name = document.getElementById('file-name').value.trim();
            if (name) {
              // Add .md extension if not present
              if (!name.endsWith('.md')) name += '.md';
              if (callbacks.onCreateFile) {
                callbacks.onCreateFile(name);
                hideModal();
              }
            }
          },
        },
      ]
    );
  }

  /**
   * Show save file modal (for commit message)
   */
  function showSaveModal() {
    showModal(
      'Save Document',
      `
        <div class="form-group">
          <label for="commit-message">Commit Message</label>
          <input type="text" id="commit-message" class="input" placeholder="Describe your changes">
        </div>
      `,
      [
        { text: 'Cancel', className: 'btn btn-secondary', onClick: hideModal },
        {
          text: 'Save',
          className: 'btn btn-primary',
          onClick: () => {
            const message = document.getElementById('commit-message').value.trim() || 'Update document';
            if (callbacks.onSaveFile) {
              callbacks.onSaveFile(message);
              hideModal();
            }
          },
        },
      ]
    );
  }

  /**
   * Show delete confirmation modal
   */
  function showDeleteConfirmModal() {
    showModal(
      'Delete Document',
      '<p>Are you sure you want to delete this document? This action cannot be undone.</p>',
      [
        { text: 'Cancel', className: 'btn btn-secondary', onClick: hideModal },
        {
          text: 'Delete',
          className: 'btn btn-danger',
          onClick: () => {
            if (callbacks.onConfirmDelete) {
              callbacks.onConfirmDelete();
              hideModal();
            }
          },
        },
      ]
    );
  }

  // ===== Toast Notifications =====

  /**
   * Show a toast notification
   * @param {string} message - Message to display
   * @param {string} type - Type: 'success', 'error', or 'info'
   * @param {number} duration - Duration in ms (default: 3000)
   */
  function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-message">${escapeHtml(message)}</span>
      <button class="toast-close">&times;</button>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => {
      toast.remove();
    });

    elements.toastContainer.appendChild(toast);

    // Auto-remove after duration
    setTimeout(() => {
      toast.remove();
    }, duration);
  }

  // ===== Helper Functions =====

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Format a date for display
   * @param {Date} date - Date object
   * @returns {string} Formatted date string
   */
  function formatDate(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString();
  }

  /**
   * Get folder icon SVG
   */
  function getFolderIcon() {
    return `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
      <path d="M1.75 1A1.75 1.75 0 000 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0016 13.25v-8.5A1.75 1.75 0 0014.25 3H7.5a.25.25 0 01-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75z"/>
    </svg>`;
  }

  /**
   * Get file icon SVG
   */
  function getFileIcon() {
    return `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
      <path d="M3.75 1.5a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25V6h-2.75A1.75 1.75 0 018 4.25V1.5H3.75zm5.75.56v2.19c0 .138.112.25.25.25h2.19L9.5 2.06zM2 1.75C2 .784 2.784 0 3.75 0h5.086c.464 0 .909.184 1.237.513l3.414 3.414c.329.328.513.773.513 1.237v8.086A1.75 1.75 0 0112.25 15h-8.5A1.75 1.75 0 012 13.25V1.75z"/>
    </svg>`;
  }

  /**
   * Get trash icon SVG
   */
  function getTrashIcon() {
    return `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
      <path d="M6.5 1.75a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3V1.75zm4.5 0V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675a.75.75 0 10-1.492.15l.66 6.6A1.75 1.75 0 005.405 15h5.19a1.75 1.75 0 001.741-1.575l.66-6.6a.75.75 0 00-1.492-.15l-.66 6.6a.25.25 0 01-.249.225h-5.19a.25.25 0 01-.249-.225l-.66-6.6z"/>
    </svg>`;
  }

  // Public API
  return {
    init,
    showLoginView,
    showDashboardView,
    showUserInfo,
    renderRepositories,
    selectRepository,
    renderBreadcrumb,
    renderFileList,
    showEditor,
    hideEditor,
    getEditorContent,
    setEditorModified,
    setEditorSaved,
    renderVersionHistory,
    showLoading,
    hideLoading,
    showModal,
    hideModal,
    showToast,
  };
})();
