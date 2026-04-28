import { supabase } from './supabaseClient';
import { getTechnicianOrders } from './orderService';
import { logger } from '../utils/logger';

export interface TechnicianDashboardData {
  totalJobs: number;
  completedJobs: number;
  pendingJobs: number;
  rating: number;
  earnings: number;
}

/**
 * Get technician dashboard data
 */
export const getTechnicianDashboardData = async (
  technicianId: string
): Promise<TechnicianDashboardData> => {
  try {
    // Get technician profile
    const { data: techProfile, error: techError } = await supabase
      .from('technicians')
      .select('*')
      .eq('user_id', technicianId)
      .single();

    if (techError) throw techError;

    // Get orders
    const orders = await getTechnicianOrders(technicianId);

    const completedJobs = orders.filter((o) => o.status === 'completed').length;
    const pendingJobs = orders.filter(
      (o) => o.status !== 'completed' && o.status !== 'cancelled'
    ).length;

    // Calculate earnings (sum of completed orders)
    const earnings = orders
      .filter((o) => o.status === 'completed' && o.estimated_price)
      .reduce((sum, o) => sum + (o.estimated_price || 0), 0);

    return {
      totalJobs: techProfile?.total_jobs || 0,
      completedJobs,
      pendingJobs,
      rating: techProfile?.rating || 5.0,
      earnings,
    };
  } catch (error: any) {
    logger.error('Get technician dashboard data error', error);
    return {
      totalJobs: 0,
      completedJobs: 0,
      pendingJobs: 0,
      rating: 5.0,
      earnings: 0,
    };
  }
};

/**
 * Toggle technician availability
 */
export const toggleTechnicianAvailability = async (
  userId: string,
  available: boolean
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('technicians')
      .update({ available })
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  } catch (error: any) {
    logger.error('Toggle technician availability error', error);
    return false;
  }
};

/**
 * Get all available technicians
 */
export const getAvailableTechnicians = async () => {
  try {
    const { data, error } = await supabase
      .from('technicians')
      .select('*, users(*)')
      .eq('available', true)
      .order('rating', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    logger.error('Get available technicians error', error);
    return [];
  }
};
