// Device fingerprinting and identification module
// Implements multi-layer duplicate prevention using:
// - Device fingerprinting (FingerprintJS)
// - Browser fingerprinting (custom hash)
// - Session tracking (sessionStorage)
// - localStorage caching

import FingerprintJS from '@fingerprintjs/fingerprintjs';

let deviceId = null;
let browserFingerprint = null;
let sessionId = null;

/**
 * Initialize device fingerprinting
 * Generates device ID, browser fingerprint, and session ID
 * Caches results in localStorage for persistence
 * @returns {Promise<Object>} Object containing all identifiers
 */
async function initializeDeviceId() {
  // Get device fingerprint (most reliable)
  const fp = await FingerprintJS.load();
  const result = await fp.get();
  deviceId = result.visitorId;
  
  // Generate browser fingerprint (secondary)
  browserFingerprint = generateBrowserFingerprint();
  
  // Get or create session ID
  sessionId = getSessionId();
  
  // Store in localStorage for persistence
  localStorage.setItem('oizom_device_id', deviceId);
  localStorage.setItem('oizom_browser_fp', browserFingerprint);
  
  return { deviceId, browserFingerprint, sessionId };
}

/**
 * Generate browser fingerprint based on browser characteristics
 * Creates a hash of various browser properties
 * @returns {string} Browser fingerprint hash
 */
function generateBrowserFingerprint() {
  const data = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    screenResolution: `${screen.width}x${screen.height}`,
    colorDepth: screen.colorDepth,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    touchSupport: 'ontouchstart' in window,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: navigator.deviceMemory
  };
  
  // Create hash of browser characteristics
  const str = JSON.stringify(data);
  return simpleHash(str);
}

/**
 * Get or create session ID
 * Uses sessionStorage for persistence across page reloads
 * @returns {string} Session ID
 */
function getSessionId() {
  let sid = sessionStorage.getItem('oizom_session_id');
  if (!sid) {
    sid = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('oizom_session_id', sid);
  }
  return sid;
}

/**
 * Simple hash function for creating fingerprints
 * @param {string} str - String to hash
 * @returns {string} Hash in base36 format
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Get device identifiers
 * Returns all identifiers (device ID, browser fingerprint, session ID, user agent)
 * Initializes fingerprinting if not already done
 * @returns {Promise<Object>} Object containing all identifiers
 */
export async function getDeviceIdentifiers() {
  if (!deviceId) {
    await initializeDeviceId();
  }
  return {
    deviceId,
    browserFingerprint,
    sessionId,
    userAgent: navigator.userAgent
  };
}

/**
 * Check if device has voted for category (client-side check)
 * Provides fast feedback before server validation
 * @param {number} categoryId - Category ID to check
 * @returns {Promise<boolean>} True if already voted
 */
export async function hasVotedForCategory(categoryId) {
  const voted = localStorage.getItem(`oizom_voted_${categoryId}`);
  return voted === 'true';
}

/**
 * Mark category as voted (client-side)
 * Stores vote status in localStorage for persistence
 * @param {number} categoryId - Category ID to mark as voted
 */
export function markCategoryAsVoted(categoryId) {
  localStorage.setItem(`oizom_voted_${categoryId}`, 'true');
}
