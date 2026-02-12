// Category service layer
// Handles category operations and real-time updates

import { supabase } from './supabaseClient.js';

/**
 * Get the single unlocked category (for user interface)
 * Returns null if no category is unlocked
 * Includes retry logic for connection errors
 * @returns {Promise<Object|null>} The unlocked category or null
 * @throws {Error} If connection fails after retries
 */
export async function getUnlockedCategory() {
  try {
    const { data, error } = await retryOperation(
      () => supabase
        .from('categories')
        .select('*')
        .eq('unlocked', true)
        .maybeSingle(),
      3
    );
    
    if (error) {
      console.error('Error fetching unlocked category:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Failed to fetch unlocked category after retries:', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

/**
 * Get all categories with their vote counts (for admin panel)
 * Includes retry logic for connection errors
 * @returns {Promise<Array>} Array of categories with vote counts
 * @throws {Error} If connection fails after retries
 */
export async function getAllCategoriesWithVotes() {
  try {
    // Fetch all categories with retry logic
    const { data: categories, error: categoriesError } = await retryOperation(
      () => supabase
        .from('categories')
        .select('*')
        .order('id'),
      3
    );
    
    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
      throw categoriesError;
    }
    
    // Fetch vote counts for each category
    const categoriesWithVotes = await Promise.all(
      categories.map(async (category) => {
        try {
          const voteCounts = await getVoteCounts(category.id);
          return {
            ...category,
            voteCounts
          };
        } catch (error) {
          console.error(`Error fetching vote counts for category ${category.id}:`, error);
          // Return category with zero counts on error
          return {
            ...category,
            voteCounts: { A: 0, B: 0, C: 0, D: 0, total: 0 }
          };
        }
      })
    );
    
    return categoriesWithVotes;
  } catch (error) {
    console.error('Failed to fetch categories with votes after retries:', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

/**
 * Unlock a category with single-unlock enforcement
 * Locks all other categories before unlocking the specified one
 * Includes retry logic for connection errors
 * @param {number} categoryId - The ID of the category to unlock
 * @returns {Promise<Object>} The unlocked category
 * @throws {Error} If category not found or connection fails
 */
export async function unlockCategory(categoryId) {
  try {
    // Validate input
    if (!categoryId || typeof categoryId !== 'number') {
      const error = new Error('Invalid category ID');
      error.code = 'INVALID_CATEGORY_ID';
      console.error('Invalid category ID provided:', categoryId);
      throw error;
    }
    
    // First, lock all categories with retry logic
    const { error: lockError } = await retryOperation(
      () => supabase
        .from('categories')
        .update({ unlocked: false })
        .neq('id', 0), // Update all rows
      3
    );
    
    if (lockError) {
      console.error('Error locking all categories:', lockError);
      throw lockError;
    }
    
    // Then unlock the selected category with retry logic
    const { data, error } = await retryOperation(
      () => supabase
        .from('categories')
        .update({ unlocked: true })
        .eq('id', categoryId)
        .select()
        .single(),
      3
    );
    
    if (error) {
      // Handle case where category doesn't exist
      if (error.code === 'PGRST116') {
        const err = new Error('Category not found');
        err.code = 'CATEGORY_NOT_FOUND';
        console.error('Category not found:', categoryId);
        throw err;
      }
      console.error('Error unlocking category:', error);
      throw error;
    }
    
    console.log('Category unlocked successfully:', { categoryId, title: data.title });
    return data;
  } catch (error) {
    console.error('Failed to unlock category after retries:', {
      error: error.message,
      code: error.code,
      categoryId,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

/**
 * Lock a category
 * Includes retry logic for connection errors
 * @param {number} categoryId - The ID of the category to lock
 * @returns {Promise<Object>} The locked category
 * @throws {Error} If category not found or connection fails
 */
export async function lockCategory(categoryId) {
  try {
    // Validate input
    if (!categoryId || typeof categoryId !== 'number') {
      const error = new Error('Invalid category ID');
      error.code = 'INVALID_CATEGORY_ID';
      console.error('Invalid category ID provided:', categoryId);
      throw error;
    }
    
    const { data, error } = await retryOperation(
      () => supabase
        .from('categories')
        .update({ unlocked: false })
        .eq('id', categoryId)
        .select()
        .single(),
      3
    );
    
    if (error) {
      // Handle case where category doesn't exist
      if (error.code === 'PGRST116') {
        const err = new Error('Category not found');
        err.code = 'CATEGORY_NOT_FOUND';
        console.error('Category not found:', categoryId);
        throw err;
      }
      console.error('Error locking category:', error);
      throw error;
    }
    
    console.log('Category locked successfully:', { categoryId, title: data.title });
    return data;
  } catch (error) {
    console.error('Failed to lock category after retries:', {
      error: error.message,
      code: error.code,
      categoryId,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

/**
 * Get vote counts for a specific category
 * Includes retry logic for connection errors
 * @param {number} categoryId - The ID of the category
 * @returns {Promise<Object>} Vote counts object with A, B, C, D, and total
 * @throws {Error} If connection fails after retries
 */
export async function getVoteCounts(categoryId) {
  try {
    // Validate input
    if (!categoryId || typeof categoryId !== 'number') {
      console.error('Invalid category ID for getVoteCounts:', categoryId);
      // Return zero counts for invalid input
      return { A: 0, B: 0, C: 0, D: 0, total: 0 };
    }
    
    const { data, error } = await retryOperation(
      () => supabase
        .from('votes')
        .select('option')
        .eq('category_id', categoryId),
      3
    );
    
    if (error) {
      console.error('Error fetching vote counts:', error);
      throw error;
    }
    
    // Initialize counts
    const counts = { A: 0, B: 0, C: 0, D: 0, total: 0 };
    
    // Count votes for each option
    data.forEach(vote => {
      if (counts.hasOwnProperty(vote.option)) {
        counts[vote.option]++;
        counts.total++;
      }
    });
    
    return counts;
  } catch (error) {
    console.error('Failed to fetch vote counts after retries:', {
      error: error.message,
      categoryId,
      timestamp: new Date().toISOString()
    });
    // Return zero counts on error to allow app to continue
    return { A: 0, B: 0, C: 0, D: 0, total: 0 };
  }
}

/**
 * Subscribe to real-time category changes
 * Includes automatic reconnection on channel errors with exponential backoff
 * @param {Function} callback - Function to call when categories change
 * @returns {Object} Subscription object with unsubscribe method
 */
export function subscribeToCategories(callback) {
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  
  const createSubscription = () => {
    const channel = supabase
      .channel('categories-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'categories' },
        (payload) => {
          try {
            console.log('Category update received:', payload);
            callback(payload);
          } catch (error) {
            console.error('Error in category subscription callback:', error);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('Connected to category real-time updates');
          reconnectAttempts = 0; // Reset counter on successful connection
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Category subscription error:', err);
          
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
            console.warn(`Reconnecting to category updates (attempt ${reconnectAttempts}/${maxReconnectAttempts}) in ${delay}ms...`);
            
            setTimeout(() => {
              supabase.removeChannel(channel);
              createSubscription();
            }, delay);
          } else {
            console.error('Max reconnection attempts reached for category subscription');
          }
        } else if (status === 'CLOSED') {
          console.log('Category subscription closed');
        } else if (status === 'TIMED_OUT') {
          console.error('Category subscription timed out, reconnecting...');
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
      console.log('Unsubscribing from category updates');
      supabase.removeChannel(channel);
    }
  };
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
      if (error.code && ['INVALID_CATEGORY_ID', 'CATEGORY_NOT_FOUND'].includes(error.code)) {
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
