import { supabase } from './supabaseClient';

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

/**
 * Get user profile by ID
 */
export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('Get user profile error:', error);
    return null;
  }
};

/**
 * Create or update user profile
 */
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
    console.error('Create/update user profile error:', error);
    throw error;
  }
};

/**
 * Get technician profile by user ID
 */
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
        // No technician profile found
        return null;
      }
      throw error;
    }

    return data;
  } catch (error: any) {
    console.error('Get technician profile error:', error);
    return null;
  }
};

/**
 * Create technician profile
 */
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
    console.error('Create technician profile error:', error);
    throw error;
  }
};

/**
 * Update technician profile
 */
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
    console.error('Update technician profile error:', error);
    throw error;
  }
};
