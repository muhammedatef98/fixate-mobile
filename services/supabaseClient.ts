/**
 * supabaseClient.ts — re-export the shared supabase client.
 * Some screens import from '../services/supabaseClient';
 * this file simply re-exports from the canonical location.
 */
export { supabase } from '../lib/supabase';
