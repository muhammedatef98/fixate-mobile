import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: 'customer' | 'technician';
  avatar_url?: string;
  created_at?: string;
}

export interface TechnicianProfile {
  id: string;
  user_id: string;
  specialization: string[];
  rating: number;
  total_jobs: number;
  available: boolean;
  location?: string;
  created_at?: string;
}

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    // maybeSingle() returns null when the row is missing instead of throwing
    // PGRST116. That happens with a stale JWT after a DB wipe (auth.users
    // is empty but the client still has a valid token in AsyncStorage), and
    // briefly between auth signUp and the handle_new_user trigger firing.
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      logger.warn('Get user profile non-fatal error', error);
      return null;
    }
    return data;
  } catch (error: any) {
    logger.warn('Get user profile failed', error);
    return null;
  }
};

export const createOrUpdateUserProfile = async (
  userId: string,
  profileData: Partial<UserProfile>
): Promise<UserProfile | null> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .upsert({ id: userId, ...profileData })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    logger.error('Create/update user profile error', error);
    throw error;
  }
};

export const getTechnicianProfileByUserId = async (
  userId: string
): Promise<TechnicianProfile | null> => {
  try {
    const { data, error } = await supabase
      .from('technicians')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data;
  } catch (error: any) {
    logger.error('Get technician profile error', error);
    return null;
  }
};

export const createTechnicianProfile = async (
  userId: string,
  technicianData: Partial<TechnicianProfile>
): Promise<TechnicianProfile | null> => {
  try {
    const { data, error } = await supabase
      .from('technicians')
      .insert({ user_id: userId, ...technicianData })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    logger.error('Create technician profile error', error);
    throw error;
  }
};

export const updateTechnicianProfile = async (
  userId: string,
  updates: Partial<TechnicianProfile>
): Promise<TechnicianProfile | null> => {
  try {
    const { data, error } = await supabase
      .from('technicians')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    logger.error('Update technician profile error', error);
    throw error;
  }
};
