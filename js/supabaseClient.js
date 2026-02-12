import { createClient } from '@supabase/supabase-js';

// Get Supabase credentials from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file');
}

// Create and export Supabase client
let supabaseInstance;

try {
  if (supabaseUrl && supabaseKey) {
    supabaseInstance = createClient(supabaseUrl, supabaseKey);
  } else {
    console.warn('Supabase credentials missing. Client will be dysfunctional.');
    // Create detailed mock for debugging
    const mockQuery = () => {
      const q = {};
      const methods = ['select', 'insert', 'update', 'eq', 'neq', 'order', 'gte', 'lte', 'limit'];
      methods.forEach(m => q[m] = () => q);

      q.single = () => Promise.reject(new Error('Supabase credentials missing'));
      q.maybeSingle = () => Promise.resolve({ data: null, error: new Error('Supabase credentials missing') });
      q.then = (resolve, reject) => resolve({ data: [], error: new Error('Supabase credentials missing') });

      return q;
    };

    supabaseInstance = {
      from: () => mockQuery(),
      channel: () => {
        const ch = {
          on: () => ch,
          subscribe: (cb) => { if (cb) cb('CHANNEL_ERROR', new Error('No properties')); return ch; },
          unsubscribe: () => { }
        };
        return ch;
      },
      removeChannel: () => { }
    };
  }
} catch (error) {
  console.error('Failed to initialize Supabase client:', error);
}

export const supabase = supabaseInstance;
