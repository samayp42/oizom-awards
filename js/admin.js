// Admin panel logic
// Handles category display, unlock/lock controls, and real-time vote updates

import { getAllCategoriesWithVotes, unlockCategory, lockCategory, subscribeToCategories, getVoteCounts } from './categoryService.js';
import { subscribeToVotes } from './voteService.js';
import { logger } from './logger.js';

// State management
let categories = [];
let categorySubscription = null;
let voteSubscription = null;
let autoReloadInterval = null; // Auto-reload timer

// DOM elements
const categoriesGrid = document.getElementById('categories-grid');
const connectionStatus = document.getElementById('connection-status');
const totalVotesCount = document.getElementById('total-votes-count');
const lockAllBtn = document.getElementById('lock-all-btn');
const refreshBtn = document.getElementById('refresh-btn');
const categoryCardTemplate = document.getElementById('category-card-template');

/**
 * Initialize the admin panel
 * Loads categories and sets up real-time subscriptions
 */
async function init() {
  try {
    // Check authentication first
    const isAuthenticated = sessionStorage.getItem('adminAuthenticated') === 'true';

    if (!isAuthenticated) {
      showPasswordModal();
    } else {
      revealAdminPanel();
      // Proceed with normal initialization
      await initializeAdminPanel();
    }

    // Setup password modal listeners
    setupPasswordListeners();

  } catch (error) {
    logger.error('Error initializing admin panel:', error);
    updateConnectionStatus('error', 'Connection Error');
    // Don't show generic error if it's just auth flow
  }
}

async function initializeAdminPanel() {
  try {
    // Show loading state
    updateConnectionStatus('connecting', 'Connecting...');

    // Load all categories with vote counts
    await loadCategories();

    // Subscribe to real-time updates
    setupRealtimeSubscriptions();

    // Set up event listeners
    setupEventListeners();

    // Set up auto-reload every 30 seconds
    setupAutoReload();

    // Initialize Theme
    initializeTheme();

    // Update connection status
    updateConnectionStatus('connected', 'Connected');
  } catch (error) {
    console.error('Error loading admin data:', error);
    showError('Failed to load admin data.');
  }
}

/**
 * Handle password protection
 */
function setupPasswordListeners() {
  const modal = document.getElementById('password-modal');
  const input = document.getElementById('password-input');
  const btn = document.getElementById('login-btn');
  const errorMsg = document.getElementById('login-error');

  async function attemptLogin() {
    const password = input.value;
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Hash of 'awards4932'
    const targetHash = 'e616d63d63309a093755498a44265777492a08899882942478f2e51927c31754';

    if (hashHex === targetHash) {
      sessionStorage.setItem('adminAuthenticated', 'true');
      hidePasswordModal();
      revealAdminPanel();
      initializeAdminPanel();
    } else {
      errorMsg.textContent = 'Incorrect password';
      errorMsg.classList.add('visible');
      input.classList.add('shake');
      setTimeout(() => input.classList.remove('shake'), 500);
    }
  }

  btn.addEventListener('click', attemptLogin);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') attemptLogin();
  });

  // Clear error on input
  input.addEventListener('input', () => {
    errorMsg.classList.remove('visible');
  });
}

function showPasswordModal() {
  const modal = document.getElementById('password-modal');
  modal.classList.add('visible');
  document.getElementById('password-input').focus();
}

function hidePasswordModal() {
  const modal = document.getElementById('password-modal');
  modal.classList.remove('visible');
  // Remove from DOM after transition to prevent interaction
  setTimeout(() => modal.style.display = 'none', 500);
}

function revealAdminPanel() {
  const header = document.getElementById('admin-header');
  const content = document.getElementById('admin-content');

  header.style.filter = 'none';
  header.style.pointerEvents = 'auto';
  header.style.transition = 'filter 0.5s ease';

  content.style.filter = 'none';
  content.style.pointerEvents = 'auto';
  content.style.transition = 'filter 0.5s ease';
}

/**
 * Load all categories with their vote counts
 */
async function loadCategories() {
  try {
    categories = await getAllCategoriesWithVotes();
    renderCategories();
    updateTotalVotes();
  } catch (error) {
    console.error('Error loading categories:', error);
    throw error;
  }
}

/**
 * Render all categories in the grid
 */
function renderCategories() {
  // Clear loading state
  categoriesGrid.innerHTML = '';

  // Render each category
  categories.forEach(category => {
    const card = createCategoryCard(category);
    categoriesGrid.appendChild(card);
  });
}

/**
 * Create a category card element
 * @param {Object} category - Category data with vote counts
 * @returns {HTMLElement} The category card element
 */
function createCategoryCard(category) {
  // Clone template
  const template = categoryCardTemplate.content.cloneNode(true);
  const card = template.querySelector('.category-card');

  // Set category ID and unlocked state
  card.dataset.categoryId = category.id;
  card.dataset.unlocked = category.unlocked ? 'true' : 'false';

  // Set category number and title
  card.querySelector('.category-number').textContent = `#${category.id}`;
  card.querySelector('.category-title').textContent = category.title;

  // Set status badge with simplified structure
  const statusBadge = card.querySelector('.status-badge');
  statusBadge.innerHTML = ''; // Clear existing content
  statusBadge.className = 'status-badge'; // Reset classes

  const dot = document.createElement('span');
  dot.textContent = '●';

  const text = document.createElement('span');

  if (category.unlocked) {
    statusBadge.classList.add('unlocked');
    text.textContent = 'Unlocked';
  } else {
    statusBadge.classList.add('locked');
    text.textContent = 'Locked';
  }

  statusBadge.appendChild(dot);
  statusBadge.appendChild(text);

  // Set nominees
  const nominees = category.nominees;
  ['A', 'B', 'C', 'D'].forEach(option => {
    const nomineeItem = card.querySelector(`.nominee-item[data-option="${option}"]`);
    nomineeItem.querySelector('.nominee-name').textContent = nominees[option];
  });

  // Set vote counts
  updateCardVoteCounts(card, category.voteCounts);

  // Set up button event listeners
  const unlockBtn = card.querySelector('.unlock-btn');
  const lockBtn = card.querySelector('.lock-btn');

  unlockBtn.addEventListener('click', () => handleUnlock(category.id));
  lockBtn.addEventListener('click', () => handleLock(category.id));

  // Show/hide buttons based on unlock status
  if (category.unlocked) {
    unlockBtn.style.display = 'none';
    lockBtn.style.display = 'flex';
  } else {
    unlockBtn.style.display = 'flex';
    lockBtn.style.display = 'none';
  }

  return card;
}

/**
 * Update vote counts display in a category card
 * @param {HTMLElement} card - The category card element
 * @param {Object} voteCounts - Vote counts object {A, B, C, D, total}
 */
function updateCardVoteCounts(card, voteCounts) {
  const total = voteCounts.total || 0;

  // Update each option's vote count and bar
  ['A', 'B', 'C', 'D'].forEach(option => {
    const voteBar = card.querySelector(`.vote-bar[data-option="${option}"]`);
    const voteCount = voteBar.querySelector('.vote-count');
    const voteBarFill = voteBar.querySelector('.vote-bar-fill');

    const count = voteCounts[option] || 0;
    voteCount.textContent = count;

    // Calculate percentage for bar width
    const percentage = total > 0 ? (count / total) * 100 : 0;
    voteBarFill.style.width = `${percentage}%`;

    // Reset winner class
    voteBar.classList.remove('winner');
  });

  // Highlight winner if total > 0
  if (total > 0) {
    // Find max votes
    const maxVotes = Math.max(...['A', 'B', 'C', 'D'].map(opt => voteCounts[opt] || 0));

    if (maxVotes > 0) {
      // Find all options that have maxVotes (handling ties)
      ['A', 'B', 'C', 'D'].forEach(option => {
        const count = voteCounts[option] || 0;
        const currentVoteBar = card.querySelector(`.vote-bar[data-option="${option}"]`);

        if (count === maxVotes) {
          currentVoteBar.classList.add('winner');
          logger.info(`Winner: Category ${card.dataset.categoryId} - Option ${option} (${count})`);
        } else {
          currentVoteBar.classList.remove('winner');
        }
      });
    }
  }

  // Update total votes
  card.querySelector('.total-votes-count').textContent = total;
}

/**
 * Handle unlock button click
 * @param {number} categoryId - The ID of the category to unlock
 */
async function handleUnlock(categoryId) {
  try {
    // Disable all unlock/lock buttons during operation
    disableAllButtons();

    await unlockCategory(categoryId);

    // Success feedback
    logger.info(`Category ${categoryId} unlocked successfully`);
  } catch (error) {
    logger.error('Error unlocking category:', error);
    showError('Failed to unlock category. Please try again.');
  } finally {
    // Re-enable buttons
    enableAllButtons();
  }
}

/**
 * Handle lock button click
 * @param {number} categoryId - The ID of the category to lock
 */
async function handleLock(categoryId) {
  try {
    // Disable all unlock/lock buttons during operation
    disableAllButtons();

    await lockCategory(categoryId);

    // Success feedback
    console.log(`Category ${categoryId} locked successfully`);
  } catch (error) {
    console.error('Error locking category:', error);
    showError('Failed to lock category. Please try again.');
  } finally {
    // Re-enable buttons
    enableAllButtons();
  }
}

/**
 * Handle lock all button click
 */
async function handleLockAll() {
  try {
    disableAllButtons();

    // Lock all categories by locking each unlocked one
    const unlockedCategory = categories.find(c => c.unlocked);
    if (unlockedCategory) {
      await lockCategory(unlockedCategory.id);
    }

    logger.info('All categories locked successfully');
  } catch (error) {
    logger.error('Error locking all categories:', error);
    showError('Failed to lock all categories. Please try again.');
  } finally {
    enableAllButtons();
  }
}

/**
 * Set up real-time subscriptions for categories and votes
 */
function setupRealtimeSubscriptions() {
  // Subscribe to category changes
  categorySubscription = subscribeToCategories(handleCategoryChange);

  // Subscribe to vote changes
  voteSubscription = subscribeToVotes(handleVoteChange);
}

/**
 * Handle real-time category change
 * @param {Object} payload - Supabase realtime payload
 */
async function handleCategoryChange(payload) {
  console.log('Category change detected:', payload);

  const { eventType, new: newRecord, old: oldRecord } = payload;

  if (eventType === 'UPDATE') {
    // Find the category in our local state
    const categoryIndex = categories.findIndex(c => c.id === newRecord.id);
    if (categoryIndex !== -1) {
      // Update local state
      categories[categoryIndex] = {
        ...categories[categoryIndex],
        ...newRecord
      };

      // Update the card in the DOM
      const card = categoriesGrid.querySelector(`[data-category-id="${newRecord.id}"]`);
      if (card) {
        updateCategoryCard(card, categories[categoryIndex]);
      }
    }
  }
}

/**
 * Handle real-time vote change
 * @param {Object} payload - Supabase realtime payload
 */
async function handleVoteChange(payload) {
  console.log('Vote change detected:', payload);

  const { new: newVote } = payload;
  const categoryId = newVote.category_id;

  // Fetch updated vote counts for this category
  try {
    const voteCounts = await getVoteCounts(categoryId);

    // Update local state
    const categoryIndex = categories.findIndex(c => c.id === categoryId);
    if (categoryIndex !== -1) {
      categories[categoryIndex].voteCounts = voteCounts;

      // Update the card in the DOM
      const card = categoriesGrid.querySelector(`[data-category-id="${categoryId}"]`);
      if (card) {
        updateCardVoteCounts(card, voteCounts);
      }

      // Update total votes
      updateTotalVotes();
    }
  } catch (error) {
    console.error('Error updating vote counts:', error);
  }
}

/**
 * Update a category card with new data
 * @param {HTMLElement} card - The category card element
 * @param {Object} category - Updated category data
 */
function updateCategoryCard(card, category) {
  // Update unlocked state attribute
  card.dataset.unlocked = category.unlocked ? 'true' : 'false';

  // Update status badge with simplified structure
  const statusBadge = card.querySelector('.status-badge');
  statusBadge.className = 'status-badge'; // Reset classes
  statusBadge.innerHTML = ''; // Clear existing content

  const dot = document.createElement('span');
  dot.textContent = '●';

  const text = document.createElement('span');

  if (category.unlocked) {
    statusBadge.classList.add('unlocked');
    text.textContent = 'Unlocked';
  } else {
    statusBadge.classList.add('locked');
    text.textContent = 'Locked';
  }

  statusBadge.appendChild(dot);
  statusBadge.appendChild(text);

  // Update buttons visibility
  const unlockBtn = card.querySelector('.unlock-btn');
  const lockBtn = card.querySelector('.lock-btn');

  if (category.unlocked) {
    unlockBtn.style.display = 'none';
    lockBtn.style.display = 'flex';
  } else {
    unlockBtn.style.display = 'flex';
    lockBtn.style.display = 'none';
  }
}

/**
 * Update the total votes count display
 */
function updateTotalVotes() {
  const total = categories.reduce((sum, category) => {
    return sum + (category.voteCounts?.total || 0);
  }, 0);

  totalVotesCount.textContent = total;
}

/**
 * Update connection status indicator
 * @param {string} status - Status type: 'connecting', 'connected', 'error'
 * @param {string} text - Status text to display
 */
function updateConnectionStatus(status, text) {
  const statusDot = connectionStatus.querySelector('.status-dot');
  const statusText = connectionStatus.querySelector('.status-text');

  // Reset classes
  connectionStatus.className = 'status-indicator';

  // Add status class
  connectionStatus.classList.add(status);

  // Update text
  statusText.textContent = text;
}

/**
 * Show error message to user
 * @param {string} message - Error message to display
 */
function showError(message) {
  const errorTemplate = document.getElementById('error-message-template');
  const errorElement = errorTemplate.content.cloneNode(true);

  errorElement.querySelector('.error-text').textContent = message;

  const errorContainer = errorElement.querySelector('.error-message');
  const closeBtn = errorElement.querySelector('.error-close');

  closeBtn.addEventListener('click', () => {
    errorContainer.remove();
  });

  // Add to page
  document.body.appendChild(errorElement);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (errorContainer.parentNode) {
      errorContainer.remove();
    }
  }, 5000);
}

/**
 * Disable all unlock/lock buttons
 */
function disableAllButtons() {
  const buttons = categoriesGrid.querySelectorAll('.unlock-btn, .lock-btn');
  buttons.forEach(btn => {
    btn.disabled = true;
  });
  lockAllBtn.disabled = true;
}

/**
 * Enable all unlock/lock buttons
 */
function enableAllButtons() {
  const buttons = categoriesGrid.querySelectorAll('.unlock-btn, .lock-btn');
  buttons.forEach(btn => {
    btn.disabled = false;
  });
  lockAllBtn.disabled = false;
}

/**
 * Set up event listeners for global controls
 */
function setupEventListeners() {
  lockAllBtn.addEventListener('click', handleLockAll);

  if (refreshBtn) {
    refreshBtn.addEventListener('click', handleRefresh);
  }
}

/**
 * Set up auto-reload functionality
 */
function setupAutoReload() {
  // Reload data every 30 seconds
  autoReloadInterval = setInterval(async () => {
    console.log('Auto-reloading categories...');
    await loadCategories();
  }, 30000); // 30 seconds
}

/**
 * Handle manual refresh button click
 */
async function handleRefresh() {
  try {
    console.log('Manual refresh triggered');
    await loadCategories();

    // Visual feedback - spin the icon
    const icon = refreshBtn.querySelector('.btn-icon');
    if (icon) {
      icon.style.animation = 'spinOnce 0.6s ease-in-out';
      setTimeout(() => {
        icon.style.animation = '';
      }, 600);
    }
  } catch (error) {
    console.error('Error refreshing:', error);
    showError('Failed to refresh data. Please try again.');
  }
}

/**
 * Initialize theme from localStorage or system preference
 */
function initializeTheme() {
  const themeToggle = document.getElementById('theme-toggle');
  if (!themeToggle) return;

  // Check localStorage first
  const savedTheme = localStorage.getItem('theme');

  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  } else {
    // Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }

  // Add event listener
  themeToggle.addEventListener('click', toggleTheme);
}

/**
 * Toggle between light and dark theme
 */
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
}

/**
 * Clean up subscriptions on page unload
 */
window.addEventListener('beforeunload', () => {
  if (categorySubscription) {
    categorySubscription.unsubscribe();
  }
  if (voteSubscription) {
    voteSubscription.unsubscribe();
  }
  if (autoReloadInterval) {
    clearInterval(autoReloadInterval);
  }
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);
