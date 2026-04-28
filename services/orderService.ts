import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

export interface Order {
  id: string;
  user_id: string;
  service_id?: string;
  technician_id?: string;
  device_brand: string;
  device_model: string;
  issue_description?: string;
  estimated_price?: number;
  status: 'pending' | 'confirmed' | 'accepted' | 'picking_up' | 'diagnosing' | 'repairing' | 'delivering' | 'completed' | 'cancelled';
  scheduled_date?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  service_type?: 'mobile' | 'pickup';
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateOrderData {
  device_brand: string;
  device_model: string;
  issue_description?: string;
  service_type?: 'mobile' | 'pickup';
  address?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  service_id?: string;
}

export const createOrder = async (userId: string, orderData: CreateOrderData): Promise<Order> => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        ...orderData,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    logger.error('Create order error', error);
    throw error;
  }
};

export const getMyOrders = async (userId: string): Promise<Order[]> => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    logger.error('Get my orders error', error);
    return [];
  }
};

export const getAvailableOrders = async (): Promise<Order[]> => {
  try {
    logger.debug('Fetching available orders');
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('status', 'pending')
      .is('technician_id', null)
      .order('created_at', { ascending: false });

    logger.debug('Available orders query result', { count: data?.length, error });
    if (error) throw error;
    return data || [];
  } catch (error: any) {
    logger.error('Get available orders error', error);
    return [];
  }
};

export const getOrderById = async (orderId: string): Promise<Order | null> => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    logger.error('Get order by ID error', error);
    return null;
  }
};

export const assignOrderToTechnician = async (
  orderId: string,
  technicianId: string
): Promise<Order | null> => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .update({
        technician_id: technicianId,
        status: 'confirmed',
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    logger.error('Assign order to technician error', error);
    throw error;
  }
};

export const updateOrderStatus = async (
  orderId: string,
  status: Order['status']
): Promise<Order | null> => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    logger.error('Update order status error', error);
    throw error;
  }
};

export const addPriceToOrder = async (
  orderId: string,
  price: number
): Promise<Order | null> => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .update({ estimated_price: price })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    logger.error('Add price to order error', error);
    throw error;
  }
};

export const getTechnicianOrders = async (technicianId: string): Promise<Order[]> => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('technician_id', technicianId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    logger.error('Get technician orders error', error);
    return [];
  }
};
