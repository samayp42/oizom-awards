// Vote service layer
// Handles vote submission, duplicate prevention, and real-time updates

import { supabase } from './supabaseClient.js';
import { getDeviceIdentifiers, hasVotedForCategory, markCategoryAsVoted } from './deviceId.js';

/**
 * Submit a vote for a category
 * Validates category is unlocked, checks for duplicates, and submits with device fingerprinting
 * Includes comprehensive error handling with retry logic for connection errors
 * @param {number} categoryId - The ID of the category to vote for
 * @param {string} option - The vote option ('A', 'B', 'C', or 'D')
 * @returns {Promise<Object>} The submitted vote record
 * @throws {Error} If category is locked, already voted, or submission fails
 */
export async function submitVote(categoryId, option) {
  try {
    // Client-side check first (fast feedback)
    if (await hasVotedForCategory(categoryId)) {
      const error = new Error('You have already voted for this category');
      error.code = 'DUPLICATE_VOTE';
      console.error('Duplicate vote attempt:', { categoryId, option });
      throw error;
    }
    
    // Get device identifiers with retry logic
    let identifiers;
    try {
      identifiers = await retryOperation(() => getDeviceIdentifiers(), 2);
    } catch (error) {
      console.error('Failed to get device identifiers:', error);
      const err = new Error('Unable to identify device. Please try again.');
      err.code = 'DEVICE_ID_ERROR';
      throw err;
    }
    
    // Check if category is unlocked with retry logic
    let category;
    try {
      const { data, error: categoryError } = await retryOperation(
        () => supabase
          .from('categories')
          .select('unlocked')
          .eq('id', categoryId)
          .single(),
        3
      );
      
      if (categoryError) {
        console.error('Category lookup error:', categoryError);
        throw categoryError;
      }
      
      category = data;
    } catch (error) {
      console.error('Failed to check category status:', error);
      const err = new Error('Unable to verify category status. Please try again.');
      err.code = 'CATEGORY_LOOKUP_ERROR';
      throw err;
    }
    
    // Validate category exists
    if (!category) {
      const error = new Error('Category not found');
      error.code = 'INVALID_CATEGORY';
      console.error('Invalid category ID:', categoryId);
      throw error;
    }
    
    // Validate category is unlocked
    if (!category.unlocked) {
      const error = new Error('This category is not currently accepting votes');
      error.code = 'CATEGORY_LOCKED';
      console.error('Vote attempt on locked category:', categoryId);
      throw error;
    }
    
    // Validate option
    if (!['A', 'B', 'C', 'D'].includes(option)) {
      const error = new Error('Invalid vote option. Must be A, B, C, or D.');
      error.code = 'INVALID_OPTION';
      console.error('Invalid vote option:', option);
      throw error;
    }
    
    // Submit vote with retry logic for connection errors
    let data;
    try {
      const result = await retryOperation(
        () => supabase
          .from('votes')
          .insert({
            category_id: categoryId,
            option: option,
            device_id: identifiers.deviceId,
            browser_fingerprint: identifiers.browserFingerprint,
            session_id: identifiers.sessionId,
            user_agent: identifiers.userAgent,
            ip_address: null
          })
          .select()
          .single(),
        3
      );
      
      if (result.error) {
        // Handle duplicate vote error (23505 = unique constraint violation)
        if (result.error.code === '23505') {
          markCategoryAsVoted(categoryId);
          const error = new Error('You have already voted for this category');
          error.code = 'DUPLICATE_VOTE';
          console.error('Duplicate vote detected by database:', { categoryId, deviceId: identifiers.deviceId });
          throw error;
        }
        
        // Handle foreign key violation (invalid category)
        if (result.error.code === '23503') {
          const error = new Error('Invalid category');
          error.code = 'INVALID_CATEGORY';
          console.error('Foreign key violation:', result.error);
          throw error;
        }
        
        // Handle check constraint violation (invalid option)
        if (result.error.code === '23514') {
          const error = new Error('Invalid vote option');
          error.code = 'INVALID_OPTION';
          console.error('Check constraint violation:', result.error);
          throw error;
        }
        
        console.error('Vote insertion error:', result.error);
        throw result.error;
      }
      
      data = result.data;
    } catch (error) {
      // If it's already one of our custom errors, re-throw it
      if (error.code && ['DUPLICATE_VOTE', 'INVALID_CATEGORY', 'INVALID_OPTION'].includes(error.code)) {
        throw error;
      }
      
      console.error('Failed to submit vote after retries:', error);
      const err = new Error('Unable to submit vote. Please check your connection and try again.');
      err.code = 'SUBMISSION_ERROR';
      throw err;
    }
    
    // Mark as voted locally
    markCategoryAsVoted(categoryId);
    console.log('Vote submitted successfully:', { categoryId, option, voteId: data.id });
    
    return data;
  } catch (error) {
    // Log all errors to console for debugging
    console.error('Vote submission error:', {
      code: error.code,
      message: error.message,
      categoryId,
      option,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

/**
 * Retry an async operation with exponential backoff
 * Used for handling transient network errors
 * @param {Function} operation - Async function to retry
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} baseDelay - Base delay in milliseconds (default 1000)
 * @returns {Promise<any>} Result of the operation
 */
async function retryOperation(operation, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry on validation errors or business logic errors
      if (error.code && ['DUPLICATE_VOTE', 'CATEGORY_LOCKED', 'INVALID_OPTION', 'INVALID_CATEGORY'].includes(error.code)) {
        throw error;
      }
      
      // Don't retry on database constraint violations
      if (error.code && ['23505', '23503', '23514'].includes(error.code)) {
        throw error;
      }
      
      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        console.error(`Operation failed after ${maxRetries + 1} attempts:`, error);
        throw error;
      }
      
      // Calculate exponential backoff delay
      const delay = baseDelay * Math.pow(2, attempt);
      console.warn(`Operation failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`, error.message);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Check if user has voted for a specific category
 * Queries the database for existing votes matching device ID and category
 * Includes retry logic for connection errors
 * @param {number} categoryId - The ID of the category to check
 * @param {string} deviceId - The device ID to check
 * @returns {Promise<boolean>} True if user has voted, false otherwise
 */
export async function hasUserVoted(categoryId, deviceId) {
  try {
    // Validate inputs
    if (!categoryId || !deviceId) {
      console.error('Invalid parameters for hasUserVoted:', { categoryId, deviceId });
      return false; // Fail gracefully
    }
    
    const { data, error } = await retryOperation(
      () => supabase
        .from('votes')
        .select('id')
        .eq('category_id', categoryId)
        .eq('device_id', deviceId)
        .maybeSingle(),
      3
    );
    
    if (error) {
      console.error('Error checking if user voted:', error);
      // Return false on error to allow voting attempt (server will validate)
      return false;
    }
    
    return data !== null;
  } catch (error) {
    console.error('Failed to check vote status after retries:', {
      error: error.message,
      categoryId,
      deviceId
    });
    // Return false to allow voting attempt (server-side validation will catch duplicates)
    return false;
  }
}

/**
 * Get all votes submitted by a specific device
 * Returns array of vote records for the given device ID
 * Includes retry logic for connection errors
 * @param {string} deviceId - The device ID to fetch votes for
 * @returns {Promise<Array>} Array of vote records
 */
export async function getUserVotes(deviceId) {
  try {
    // Validate input
    if (!deviceId) {
      console.error('Invalid deviceId for getUserVotes');
      return [];
    }
    
    const { data, error } = await retryOperation(
      () => supabase
        .from('votes')
        .select('*')
        .eq('device_id', deviceId)
        .order('timestamp', { ascending: false }),
      3
    );
    
    if (error) {
      console.error('Error fetching user votes:', error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('Failed to fetch user votes after retries:', {
      error: error.message,
      deviceId
    });
    // Return empty array on error to allow app to continue
    return [];
  }
}

/**
 * Subscribe to real-time vote changes
 * Calls callback function whenever a new vote is inserted
 * Includes automatic reconnection on channel errors
 * @param {Function} callback - Function to call when votes change
 * @returns {Object} Subscription object with unsubscribe method
 */
export function subscribeToVotes(callback) {
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  
  const createSubscription = () => {
    const channel = supabase
      .channel('votes-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'votes' },
        (payload) => {
          try {
            console.log('Vote update received:', payload);
            callback(payload);
          } catch (error) {
            console.error('Error in vote subscription callback:', error);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('Connected to vote real-time updates');
          reconnectAttempts = 0; // Reset counter on successful connection
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Vote subscription error:', err);
          
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
            console.warn(`Reconnecting to vote updates (attempt ${reconnectAttempts}/${maxReconnectAttempts}) in ${delay}ms...`);
            
            setTimeout(() => {
              supabase.removeChannel(channel);
              createSubscription();
            }, delay);
          } else {
            console.error('Max reconnection attempts reached for vote subscription');
          }
        } else if (status === 'CLOSED') {
          console.log('Vote subscription closed');
        } else if (status === 'TIMED_OUT') {
          console.error('Vote subscription timed out, reconnecting...');
          setTimeout(() => {
            supabase.removeChannel(channel);
            createSubscription();
          }, 5000);
        }
      });
    
    return channel;
  };
  
  const channel = createSubscription();
  
  return {
    unsubscribe: () => {
      console.log('Unsubscribing from vote updates');
      supabase.removeChannel(channel);
    }
  };
}
