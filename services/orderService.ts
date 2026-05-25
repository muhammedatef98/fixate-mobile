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
  if (
    orderData.latitude !== undefined &&
    orderData.longitude !== undefined &&
    orderData.latitude !== null &&
    orderData.longitude !== null
  ) {
    const coordCheck = validateCoordinates(orderData.latitude, orderData.longitude);
    // Only block when the coords aren't a real point on Earth. The
    // outside-Saudi case is now logged (so we can see it in telemetry / dev
    // logs) but doesn't reject the order — the customer's explicit city
    // selection upstream is the authoritative country anchor.
    if (!coordCheck.valid) {
      logger.warn('createOrder: invalid coordinates', {
        latitude: orderData.latitude,
        longitude: orderData.longitude,
        message: coordCheck.message,
      });
      throw new Error(coordCheck.message);
    }
    if (!coordCheck.insideSaudi) {
      logger.warn('createOrder: coordinates outside Saudi bbox (allowed; city is the anchor)', {
        latitude: orderData.latitude,
        longitude: orderData.longitude,
      });
    }
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

// Technician submits the final price after inspecting the device. This moves
// the order into `quoted` so the customer can accept or reject it before any
// repair work proceeds. `final_price` holds the quoted amount.
export const setTechnicianQuote = async (
  orderId: string,
  price: number,
  notes?: string
): Promise<Order | null> => {
  const priceCheck = validatePrice(price);
  if (!priceCheck.valid) throw new Error(priceCheck.message);

  // Best-effort wide payload; columns that don't exist yet are stripped by a
  // retry with the minimal guaranteed set so the flow never hard-fails during
  // the backend rollout.
  const wide = {
    final_price: price,
    status: 'quoted' as OrderStatus,
    quote_notes: notes ?? null,
    quoted_at: new Date().toISOString(),
  };
  let res = await supabase.from('orders').update(wide).eq('id', orderId).select().maybeSingle();
  if (res.error) {
    logger.warn('setTechnicianQuote wide update failed, retrying minimal', res.error);
    res = await supabase
      .from('orders')
      .update({ final_price: price, status: 'quoted' as OrderStatus })
      .eq('id', orderId)
      .select()
      .maybeSingle();
  }
  if (res.error) {
    logger.warn('setTechnicianQuote error', res.error);
    throw res.error;
  }
  return res.data;
};

// Customer accepts or rejects the technician's quote. Accept resumes the
// normal flow (status -> accepted, ready for the technician to continue);
// reject closes the request (status -> cancelled).
export const respondToQuote = async (
  orderId: string,
  accept: boolean
): Promise<Order | null> => {
  const nextStatus: OrderStatus = accept ? 'accepted' : 'cancelled';
  const { data, error } = await supabase
    .from('orders')
    .update({ status: nextStatus })
    .eq('id', orderId)
    .eq('status', 'quoted')
    .select()
    .maybeSingle();
  if (error) {
    logger.warn('respondToQuote error', error);
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
