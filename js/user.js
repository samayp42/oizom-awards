// User interface logic for Oizom Awards Night voting system
// Handles device fingerprinting, real-time category updates, vote submission, and UI state management

import { getDeviceIdentifiers, hasVotedForCategory } from './deviceId.js';
import { getUnlockedCategory, subscribeToCategories } from './categoryService.js';
import { submitVote, getUserVotes } from './voteService.js';
import { logger } from './logger.js';
import confetti from 'canvas-confetti';

// Global state
let currentCategory = null;
let deviceId = null;
let categorySubscription = null;
let votedCategories = new Set();
let selectedOption = null; // Track currently selected option
let autoReloadTimer = null; // Timer for auto-reload

/**
 * Initialize the application on page load
 */
async function init() {
  try {
    // Initialize device fingerprinting
    await initializeDevice();

    // Initialize Theme
    initializeTheme();

    // Load user's voting history
    await loadVotingHistory();

    // Fetch and display current unlocked category
    await loadCurrentCategory();

    // Subscribe to real-time category changes
    subscribeToRealTimeUpdates();

    // Set up event listeners
    setupEventListeners();

  } catch (error) {
    logger.error('Initialization error:', error);
    showError('Connection error. Please refresh the page.');
  }
}

/**
 * Initialize device fingerprinting
 */
async function initializeDevice() {
  try {
    const identifiers = await getDeviceIdentifiers();
    deviceId = identifiers.deviceId;
    console.log('Device initialized:', deviceId);
  } catch (error) {
    console.error('Device initialization error:', error);
    throw new Error('Failed to initialize device fingerprinting');
  }
}

/**
 * Load user's voting history from the database
 */
async function loadVotingHistory() {
  try {
    const votes = await getUserVotes(deviceId);
    votedCategories = new Set(votes.map(vote => vote.category_id));
    updateProgressIndicator();
  } catch (error) {
    console.error('Error loading voting history:', error);
    // Non-critical error, continue with empty history
  }
}

/**
 * Load and display the currently unlocked category
 */
async function loadCurrentCategory() {
  try {
    const category = await getUnlockedCategory();

    if (category) {
      currentCategory = category;
      await renderCategory(category);
    } else {
      showWaitingState();
    }
  } catch (error) {
    console.error('Error loading category:', error);
    showError('Failed to load category. Please refresh the page.');
  }
}

/**
 * Subscribe to real-time category changes via Supabase
 */
function subscribeToRealTimeUpdates() {
  categorySubscription = subscribeToCategories((payload) => {
    console.log('Category change detected:', payload);

    if (payload.eventType === 'UPDATE') {
      const updatedCategory = payload.new;

      if (updatedCategory.unlocked) {
        // A category was unlocked - reload to show it
        currentCategory = updatedCategory;
        reloadCurrentState();
      } else if (payload.old?.unlocked && !updatedCategory.unlocked) {
        // Category was locked - reload to show waiting state
        if (currentCategory?.id === updatedCategory.id) {
          currentCategory = null;
          reloadCurrentState();
        }
      }
    }
  });
}

/**
 * Render a category on the screen
 * @param {Object} category - The category to render
 */
async function renderCategory(category) {
  // Hide waiting state and error messages
  document.getElementById('waiting-state').style.display = 'none';
  document.getElementById('error-message').style.display = 'none';
  document.getElementById('confirmation-message').style.display = 'none';

  // Show category container
  const categoryContainer = document.getElementById('category-container');
  categoryContainer.style.display = 'block';

  // Set category number badge
  const categoryNumberBadge = document.getElementById('category-number');
  if (categoryNumberBadge) {
    categoryNumberBadge.textContent = `Category #${category.id}`;
  }

  // Set category title
  document.getElementById('category-title').textContent = category.title;

  // Set nominee names
  const nominees = category.nominees;
  document.getElementById('nominee-a').textContent = nominees.A;
  document.getElementById('nominee-b').textContent = nominees.B;
  document.getElementById('nominee-c').textContent = nominees.C;
  document.getElementById('nominee-d').textContent = nominees.D;

  // Check if user has already voted for this category
  const hasVoted = await hasVotedForCategory(category.id);

  if (hasVoted || votedCategories.has(category.id)) {
    // Show already voted indicator
    showAlreadyVoted();
  } else {
    // Enable voting buttons
    enableVoting();
  }
}

/**
 * Show the waiting state when no category is unlocked
 */
function showWaitingState() {
  document.getElementById('category-container').style.display = 'none';
  document.getElementById('confirmation-message').style.display = 'none';
  document.getElementById('error-message').style.display = 'none';
  document.getElementById('waiting-state').style.display = 'block';
}

/**
 * Enable voting buttons
 */
function enableVoting() {
  const alreadyVotedDiv = document.getElementById('already-voted');
  const submitSection = document.getElementById('submit-section');
  alreadyVotedDiv.style.display = 'none';
  submitSection.style.display = 'none';

  const buttons = document.querySelectorAll('.nominee-button');
  buttons.forEach(button => {
    button.disabled = false;
    button.classList.remove('disabled', 'selected');
  });

  // Reset selected option
  selectedOption = null;
}

/**
 * Show already voted indicator and disable buttons
 */
function showAlreadyVoted() {
  const alreadyVotedDiv = document.getElementById('already-voted');
  alreadyVotedDiv.style.display = 'block';

  const buttons = document.querySelectorAll('.nominee-button');
  buttons.forEach(button => {
    button.disabled = true;
    button.classList.add('disabled');
  });
}

/**
 * Set up event listeners for vote buttons
 */
function setupEventListeners() {
  const buttons = document.querySelectorAll('.nominee-button');

  buttons.forEach(button => {
    button.addEventListener('click', async (e) => {
      const option = button.getAttribute('data-option');
      handleOptionSelect(option);
    });
  });

  // Submit button listener
  const submitBtn = document.getElementById('submit-vote-btn');
  if (submitBtn) {
    submitBtn.addEventListener('click', handleSubmitVote);
  }
}

/**
 * Handle option selection (not submission yet)
 * @param {string} option - The selected option ('A', 'B', 'C', or 'D')
 */
function handleOptionSelect(option) {
  if (!currentCategory) {
    showError('No category is currently available for voting.');
    return;
  }

  // Update selected option
  selectedOption = option;

  // Update UI to show selection
  const buttons = document.querySelectorAll('.nominee-button');
  buttons.forEach(btn => {
    const btnOption = btn.getAttribute('data-option');
    if (btnOption === option) {
      btn.classList.add('selected');
    } else {
      btn.classList.remove('selected');
    }
  });

  // Show submit section
  const submitSection = document.getElementById('submit-section');
  submitSection.style.display = 'flex';
}

/**
 * Handle submit vote button click
 */
async function handleSubmitVote() {
  if (!selectedOption) {
    showError('Please select an option first.');
    return;
  }

  if (!currentCategory) {
    showError('No category is currently available for voting.');
    return;
  }

  // Disable submit button and all nominee buttons
  const submitBtn = document.getElementById('submit-vote-btn');
  const buttons = document.querySelectorAll('.nominee-button');

  submitBtn.disabled = true;
  buttons.forEach(btn => btn.disabled = true);

  try {
    await submitVoteWithConfirmation(currentCategory.id, selectedOption);
  } catch (error) {
    // Re-enable buttons on error
    submitBtn.disabled = false;
    buttons.forEach(btn => btn.disabled = false);
  }
}

/**
 * Submit vote with error handling and confirmation
 * @param {number} categoryId - The category ID
 * @param {string} option - The selected option
 */
async function submitVoteWithConfirmation(categoryId, option) {
  try {
    // Submit the vote
    await submitVote(categoryId, option);

    // Add to voted categories set
    votedCategories.add(categoryId);

    // Update progress indicator
    updateProgressIndicator();

    // Show confirmation with celebration
    showVoteConfirmation();

    // Trigger confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#D4AF37', '#FFD700', '#F4C430'] // Gold colors
    });

  } catch (error) {
    console.error('Vote submission error:', error);
    handleVoteError(error);
  }
}

/**
 * Show vote confirmation with clean animation
 */
function showVoteConfirmation() {
  // Hide category container
  document.getElementById('category-container').style.display = 'none';

  // Show confirmation message
  const confirmationDiv = document.getElementById('confirmation-message');
  confirmationDiv.style.display = 'block';

  // After 3 seconds, reload to show next category or waiting state
  autoReloadTimer = setTimeout(() => {
    reloadCurrentState();
  }, 3000);
}

/**
 * Reload current state - check for unlocked category or show waiting
 */
async function reloadCurrentState() {
  try {
    // Clear any existing auto-reload timer
    if (autoReloadTimer) {
      clearTimeout(autoReloadTimer);
      autoReloadTimer = null;
    }

    // Reset selected option
    selectedOption = null;

    // Load current category
    await loadCurrentCategory();
  } catch (error) {
    console.error('Error reloading state:', error);
    showError('Failed to reload. Please refresh the page.');
  }
}

/**
 * Update progress indicator (X/27 voted) with circular progress ring
 */
function updateProgressIndicator() {
  const progressText = document.getElementById('progress-text');
  const progressCircle = document.getElementById('progress-circle');

  const total = 27;
  const voted = votedCategories.size;

  // Update text
  progressText.textContent = `${voted}/${total}`;

  // Update circular progress
  if (progressCircle) {
    const circumference = 2 * Math.PI * 14; // radius is 14
    const progress = (voted / total) * circumference;
    const offset = circumference - progress;
    progressCircle.style.strokeDashoffset = offset;
  }
}

/**
 * Handle vote submission errors
 * @param {Error} error - The error object
 */
function handleVoteError(error) {
  let errorMessage = 'Something went wrong. Please try again.';

  if (error.message.includes('already voted')) {
    errorMessage = 'You have already voted for this category.';
    // Mark as voted locally
    if (currentCategory) {
      votedCategories.add(currentCategory.id);
      updateProgressIndicator();
      showAlreadyVoted();
    }
  } else if (error.message.includes('not currently accepting votes')) {
    errorMessage = 'This category is not currently accepting votes.';
  } else if (error.message.includes('network') || error.message.includes('connection')) {
    errorMessage = 'Connection error. Please check your internet and try again.';
  }

  showError(errorMessage);
}

/**
 * Show error message
 * @param {string} message - The error message to display
 */
function showError(message) {
  const errorDiv = document.getElementById('error-message');
  const errorText = document.getElementById('error-text');

  errorText.textContent = message;
  errorDiv.style.display = 'block';

  // Auto-hide error after 5 seconds
  setTimeout(() => {
    errorDiv.style.display = 'none';
  }, 5000);
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
 * Clean up subscriptions when page unloads
 */
window.addEventListener('beforeunload', () => {
  if (categorySubscription) {
    categorySubscription.unsubscribe();
  }
  if (autoReloadTimer) {
    clearTimeout(autoReloadTimer);
  }
});

// Initialize the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
