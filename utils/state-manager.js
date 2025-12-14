/**
 * Conversation State Manager
 * 
 * Manages conversation states for WhatsApp chatbot in a serverless environment.
 * Uses in-memory storage with automatic expiration and cleanup.
 */

// In-memory storage: Map<phoneNumber, state>
/** @type {Map<string, any>} */
const stateStore = new Map();

// State expiry duration: 5 minutes
const STATE_EXPIRY_MS = 300000;

// Cleanup interval: 60 seconds
const CLEANUP_INTERVAL_MS = 60000;

/**
 * Normalize phone number for consistent storage
 * @param {string} phoneNumber - Raw phone number
 * @returns {string} - Normalized phone number
 */
function normalizePhoneNumber(phoneNumber) {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return '';
  }
  // Remove all non-digit characters
  return phoneNumber.replace(/\D/g, '');
}

/**
 * Save conversation state for a phone number
 * Automatically sets expiry timestamp
 * @param {string} phoneNumber - User's phone number
 * @param {any} stateData - State data object (intent, vesselName, etc.)
 * @returns {boolean} - True if saved successfully
 */
function saveState(phoneNumber, stateData) {
  if (!phoneNumber) {
    console.warn('Cannot save state: phone number is required');
    return false;
  }

  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  if (!normalizedPhone) {
    console.warn('Cannot save state: invalid phone number format');
    return false;
  }

  const now = Date.now();
  const state = {
    ...stateData,
    timestamp: now,
    expiresAt: now + STATE_EXPIRY_MS,
  };

  stateStore.set(normalizedPhone, state);
  console.log(`State saved for phone: ${normalizedPhone.substring(0, 4)}****`);
  return true;
}

/**
 * Get conversation state for a phone number
 * Returns null if state doesn't exist or has expired
 * @param {string} phoneNumber - User's phone number
 * @returns {any|null} - State object or null if not found/expired
 */
function getState(phoneNumber) {
  if (!phoneNumber) {
    return null;
  }

  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  if (!normalizedPhone) {
    return null;
  }

  const state = stateStore.get(normalizedPhone);
  if (!state) {
    return null;
  }

  // Check if state has expired
  const now = Date.now();
  if (now > state.expiresAt) {
    // State expired, remove it
    stateStore.delete(normalizedPhone);
    console.log(`State expired for phone: ${normalizedPhone.substring(0, 4)}****`);
    return null;
  }

  return state;
}

/**
 * Clear conversation state for a phone number
 * @param {string} phoneNumber - User's phone number
 * @returns {boolean} - True if state was removed, false if not found
 */
function clearState(phoneNumber) {
  if (!phoneNumber) {
    return false;
  }

  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  if (!normalizedPhone) {
    return false;
  }

  const deleted = stateStore.delete(normalizedPhone);
  if (deleted) {
    console.log(`State cleared for phone: ${normalizedPhone.substring(0, 4)}****`);
  }
  return deleted;
}

/**
 * Cleanup all expired states
 * Removes states that have passed their expiry time
 * @returns {number} - Number of expired states removed
 */
function cleanupExpiredStates() {
  const now = Date.now();
  let removedCount = 0;
  /** @type {string[]} */
  const expiredPhones = [];

  // Find all expired states
  stateStore.forEach((state, phoneNumber) => {
    if (now > state.expiresAt) {
      expiredPhones.push(phoneNumber);
    }
  });

  // Remove expired states
  expiredPhones.forEach(phoneNumber => {
    stateStore.delete(phoneNumber);
    removedCount++;
  });

  if (removedCount > 0) {
    console.log(`Cleaned up ${removedCount} expired conversation state(s)`);
  }

  return removedCount;
}

/**
 * Get all active states (for debugging/monitoring)
 * @returns {number} - Number of active states
 */
function getActiveStateCount() {
  return stateStore.size;
}

// Auto-cleanup: Run cleanup every 60 seconds
/** @type {NodeJS.Timeout | null} */
let cleanupInterval = null;

/**
 * Start automatic cleanup of expired states
 */
function startAutoCleanup() {
  if (cleanupInterval !== null) {
    // Already running
    return;
  }

  cleanupInterval = setInterval(() => {
    cleanupExpiredStates();
  }, CLEANUP_INTERVAL_MS);

  console.log('State manager: Auto-cleanup started (every 60 seconds)');
}

/**
 * Stop automatic cleanup
 */
function stopAutoCleanup() {
  if (cleanupInterval !== null) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log('State manager: Auto-cleanup stopped');
  }
}

// Start auto-cleanup when module loads
startAutoCleanup();

module.exports = {
  saveState,
  getState,
  clearState,
  cleanupExpiredStates,
  getActiveStateCount,
  startAutoCleanup,
  stopAutoCleanup,
  // Export constants for testing
  STATE_EXPIRY_MS,
  CLEANUP_INTERVAL_MS,
};

