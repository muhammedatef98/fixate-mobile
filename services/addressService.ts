import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

export interface UserAddress {
  id: string;
  user_id: string;
  label: string;
  address: string;
  city?: string;
  district?: string;
  latitude?: number;
  longitude?: number;
  // Saudi National Address fields (all optional)
  short_code?: string;     // 4-letter city code (RUH, JED, DMM, ...)
  building_no?: string;    // 4-digit building number
  postal_code?: string;    // 5-digit postal code
  additional_no?: string;  // 4-digit additional number
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}

export const getMyAddresses = async (userId: string): Promise<UserAddress[]> => {
  try {
    const { data, error } = await supabase
      .from('user_addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (error: any) {
    logger.error('getMyAddresses error', error);
    return [];
  }
};

export const createAddress = async (
  userId: string,
  payload: Omit<UserAddress, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<UserAddress> => {
  if (!payload.label?.trim() || !payload.address?.trim()) {
    throw new Error('Label and address are required');
  }
  const { data, error } = await supabase
    .from('user_addresses')
    .insert({ user_id: userId, ...payload })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateAddress = async (
  id: string,
  updates: Partial<UserAddress>
): Promise<UserAddress> => {
  const { data, error } = await supabase
    .from('user_addresses')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteAddress = async (id: string): Promise<void> => {
  const { error } = await supabase.from('user_addresses').delete().eq('id', id);
  if (error) throw error;
};

export const setDefaultAddress = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('user_addresses')
    .update({ is_default: true })
    .eq('id', id);
  if (error) throw error;
};
