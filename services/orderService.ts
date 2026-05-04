import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';
import { validatePrice, validateCoordinates, validateDescription } from '../utils/validation';
import type { Order, CreateOrderData, OrderStatus } from '../types/order';

export type { Order, CreateOrderData, OrderStatus } from '../types/order';

// Hard timeout so a wedged Supabase request can never trap the UI.
// Without this a flaky network silently hangs the submit button forever.
const withTimeout = <T>(p: PromiseLike<T>, ms: number, label: string): Promise<T> =>
  Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${ms / 1000}s — check your connection`)),
        ms
      )
    ),
  ]);

// Read queries are idempotent — retry once on timeout before giving up so
// flaky networks don't surface as red error overlays for the user.
const withRetry = async <T>(
  fn: () => PromiseLike<T>,
  ms: number,
  label: string
): Promise<T> => {
  try {
    return await withTimeout(fn(), ms, label);
  } catch (err: any) {
    if (/timed out/i.test(err?.message || '')) {
      logger.warn(`${label} timed out, retrying once`);
      return await withTimeout(fn(), ms, label);
    }
    throw err;
  }
};

export const createOrder = async (userId: string, orderData: CreateOrderData): Promise<Order> => {
  if (!userId) {
    throw new Error('User ID is required');
  }
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

  // Strip any keys whose values are undefined so the insert payload stays clean
  const cleanData: Record<string, any> = {};
  for (const [k, v] of Object.entries(orderData)) {
    if (v !== undefined) cleanData[k] = v;
  }

  try {
    const insertPromise = supabase
      .from('orders')
      .insert({
        user_id: userId,
        ...cleanData,
        status: 'pending' as OrderStatus,
      })
      .select()
      .single();

    const { data, error } = await withTimeout(insertPromise, 15000, 'Create order');

    if (error) {
      logger.error('Create order DB error', error);
      throw new Error(error.message || 'Database error');
    }
    if (!data) throw new Error('Order was not created (empty response)');
    return data;
  } catch (error: any) {
    logger.error('Create order error', error);
    throw error;
  }
};

export const getMyOrders = async (userId: string): Promise<Order[]> => {
  try {
    const { data, error } = await withRetry(
      () => supabase.from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      20000,
      'Get my orders'
    );
    if (error) throw error;
    return data || [];
  } catch (error: any) {
    // Read failures are non-fatal — return empty list and warn (not error)
    // so the dev-overlay doesn't show a red box for a recoverable timeout.
    logger.warn('Get my orders failed', error);
    return [];
  }
};

export const getAvailableOrders = async (): Promise<Order[]> => {
  try {
    logger.debug('Fetching available orders');
    const { data, error } = await withRetry(
      () =>
        supabase
          .from('orders')
          .select('*')
          .eq('status', 'pending')
          .is('technician_id', null)
          .order('created_at', { ascending: false }),
      20000,
      'Get available orders'
    );

    logger.debug('Available orders query result', { count: data?.length, error });
    if (error) throw error;
    return data || [];
  } catch (error: any) {
    logger.warn('Get available orders failed', error);
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
        status: 'accepted' as OrderStatus,
      })
      .eq('id', orderId)
      .eq('status', 'pending')
      .is('technician_id', null)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      throw new Error('Order is no longer available');
    }
    return data;
  } catch (error: any) {
    logger.error('Assign order to technician error', error);
    throw error;
  }
};

export const updateOrderStatus = async (
  orderId: string,
  status: OrderStatus
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
  const priceCheck = validatePrice(price);
  if (!priceCheck.valid) {
    throw new Error(priceCheck.message);
  }

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
    const { data, error } = await withRetry(
      () =>
        supabase
          .from('orders')
          .select('*')
          .eq('technician_id', technicianId)
          .order('created_at', { ascending: false }),
      20000,
      'Get technician orders'
    );

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    logger.warn('Get technician orders failed', error);
    return [];
  }
};
