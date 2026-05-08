import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';
import { validatePrice, validateCoordinates, validateDescription } from '../utils/validation';
import type { Order, CreateOrderData, OrderStatus } from '../types/order';

export type { Order, CreateOrderData, OrderStatus } from '../types/order';

export const createOrder = async (userId: string, orderData: CreateOrderData): Promise<Order> => {
  if (!userId) throw new Error('User ID is required');
  if (!orderData.device_brand?.trim() || !orderData.device_model?.trim()) {
    throw new Error('Device brand and model are required');
  }
  if (orderData.issue_description) {
    const descCheck = validateDescription(orderData.issue_description, 5, 1000);
    if (!descCheck.valid) throw new Error(descCheck.message);
  }
  if (orderData.latitude !== undefined && orderData.longitude !== undefined) {
    const coordCheck = validateCoordinates(orderData.latitude, orderData.longitude);
    if (!coordCheck.valid) throw new Error(coordCheck.message);
  }

  const cleanData: Record<string, any> = {};
  for (const [k, v] of Object.entries(orderData)) {
    if (v !== undefined) cleanData[k] = v;
  }

  // The supabase client (services/supabaseClient.ts) wraps fetch with a 12s
  // AbortController timeout, so a wedged request will reject with AbortError
  // here naturally — no extra Promise.race needed.
  const { data, error } = await supabase
    .from('orders')
    .insert({ user_id: userId, ...cleanData, status: 'pending' as OrderStatus })
    .select()
    .single();

  if (error) {
    logger.warn('Create order DB error', error);
    throw new Error(error.message || 'Database error');
  }
  if (!data) throw new Error('Order was not created (empty response)');
  return data;
};

export const getMyOrders = async (userId: string): Promise<Order[]> => {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.warn('Get my orders failed', error);
    return [];
  }
  return data || [];
};

export const getAvailableOrders = async (): Promise<Order[]> => {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('status', 'pending')
    .is('technician_id', null)
    .order('created_at', { ascending: false });

  if (error) {
    logger.warn('Get available orders failed', error);
    return [];
  }
  return data || [];
};

export const getOrderById = async (orderId: string): Promise<Order | null> => {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();
  if (error) {
    logger.warn('Get order by ID failed', error);
    return null;
  }
  return data;
};

export const assignOrderToTechnician = async (
  orderId: string,
  technicianId: string
): Promise<Order | null> => {
  const { data, error } = await supabase
    .from('orders')
    .update({ technician_id: technicianId, status: 'accepted' as OrderStatus })
    .eq('id', orderId)
    .eq('status', 'pending')
    .is('technician_id', null)
    .select()
    .maybeSingle();

  if (error) {
    logger.warn('Assign order to technician error', error);
    throw error;
  }
  if (!data) throw new Error('Order is no longer available');
  return data;
};

export const updateOrderStatus = async (
  orderId: string,
  status: OrderStatus
): Promise<Order | null> => {
  const { data, error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId)
    .select()
    .maybeSingle();
  if (error) {
    logger.warn('Update order status error', error);
    throw error;
  }
  return data;
};

export const addPriceToOrder = async (
  orderId: string,
  price: number
): Promise<Order | null> => {
  const priceCheck = validatePrice(price);
  if (!priceCheck.valid) throw new Error(priceCheck.message);

  const { data, error } = await supabase
    .from('orders')
    .update({ estimated_price: price })
    .eq('id', orderId)
    .select()
    .maybeSingle();
  if (error) {
    logger.warn('Add price to order error', error);
    throw error;
  }
  return data;
};

export const getTechnicianOrders = async (technicianId: string): Promise<Order[]> => {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('technician_id', technicianId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.warn('Get technician orders failed', error);
    return [];
  }
  return data || [];
};
