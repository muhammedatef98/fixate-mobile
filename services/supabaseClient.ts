import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Fallback to hardcoded values if env variables are not available
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://gpucisjxecupcyosumgy.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwdWNpc2p4ZWN1cGN5b3N1bWd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NjY1NTEsImV4cCI6MjA4MTE0MjU1MX0.dPN6rdv6R5DF_8GdeP5DmNvoj0tecFAcfqVFgN68QkE';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
