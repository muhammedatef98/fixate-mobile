import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';
import { validatePrice, validateCoordinates, validateDescription } from '../utils/validation';
import type { Order, CreateOrderData, OrderStatus } from '../types/order';
import { notifyAudience, notifyUsers } from './notifyService';

export type { Order, CreateOrderData, OrderStatus } from '../types/order';

// Arabic labels for the push body when an order status changes (FEAT-01).
// Mirrors STATUS_LABEL_AR in lib/supabase-api.ts so both order paths notify
// the customer with the same wording.
const STATUS_LABEL_AR: Record<string, string> = {
  accepted: 'تم قبول طلبك',
  picking_up: 'الفني في طريقه لاستلام جهازك',
  diagnosing: 'جاري فحص جهازك',
  quoted: 'تم إرسال عرض السعر',
  awaiting_payment: 'بإنتظار الدفع',
  waiting_parts: 'بانتظار قطع الغيار',
  repairing: 'جاري إصلاح جهازك',
  testing: 'جاري اختبار جهازك',
  delivering: 'جاري توصيل جهازك',
  completed: 'تم اكتمال طلبك',
  cancelled: 'تم إلغاء طلبك',
  rejected: 'تم رفض طلبك',
};

// Fire-and-forget push helper — never let a push failure block the action.
// Same pattern as pushOrderToClient in lib/supabase-api.ts.
const pushOrderToClient = (
  clientId: string | null | undefined,
  title: string,
  body: string,
  orderId: string,
  screen: 'order-details' | 'chat' = 'order-details'
) => {
  if (!clientId) return;
  void notifyUsers(clientId, { title, body, data: { screen, orderId } });
};

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

  // Notify all technicians that a new request is open for offers (FEAT-01).
  // Fire-and-forget: a push failure must never fail order creation.
  void notifyAudience('technicians', {
    title: 'طلب جديد متاح للعروض 🛠️',
    body: `${data.device_brand || 'جهاز'} ${data.device_model || ''} — قدّم عرض سعرك الآن`.trim(),
    data: { screen: 'available-orders', orderId: data.id },
  });

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

/**
 * @deprecated Direct claiming was replaced by the offer marketplace
 * (2026-07). Assignment now happens ONLY via the customer accepting an offer
 * (accept_order_offer RPC). The RLS policy that allowed technicians to update
 * open orders has been dropped, so this call will fail server-side for
 * technician sessions — it is kept only so old code paths fail loudly instead
 * of vanishing. Do not add new callers.
 */
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

  // Notify the customer that a technician accepted their request (FEAT-01).
  pushOrderToClient(
    data.user_id,
    'تم قبول طلبك ✅',
    'قام أحد الفنيين بقبول طلب الصيانة الخاص بك.',
    data.id
  );
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

  // Notify the customer whenever the status advances (FEAT-01).
  if (data) {
    pushOrderToClient(
      data.user_id,
      'تحديث حالة الطلب',
      STATUS_LABEL_AR[status as string] ?? 'تم تحديث حالة طلبك',
      data.id
    );
  }
  return data;
};

/**
 * Technician sets/updates the estimated repair time on their assigned order.
 * `key` is a canonical bucket (see utils/estimatedRepair.ts) or null to clear.
 * Notifies the customer so it surfaces immediately in their order view.
 */
export const setEstimatedRepair = async (
  orderId: string,
  key: string | null
): Promise<Order | null> => {
  const { data, error } = await supabase
    .from('orders')
    .update({ estimated_repair: key })
    .eq('id', orderId)
    .select()
    .maybeSingle();
  if (error) {
    logger.warn('setEstimatedRepair error', error);
    throw error;
  }
  if (data && key) {
    pushOrderToClient(
      data.user_id,
      'المدة المتوقعة للإصلاح',
      'حدّد الفني المدة المتوقعة لإصلاح جهازك',
      data.id
    );
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

// Payment architecture v2: the post-inspection quote flow
// (setTechnicianQuote / respondToQuote) was removed. The accepted marketplace
// offer is the customer-facing price basis, and money collection goes through
// recordOrderPayment below.

/**
 * Record money actually collected on an order via the record_order_payment
 * RPC (customer confirming an upfront payment, or the technician confirming
 * a cash collection). Server-side it writes a payments row and bumps
 * orders.amount_paid / payment_status atomically.
 */
export const recordOrderPayment = async (
  orderId: string,
  amount: number,
  method: string = 'cash',
  note?: string
): Promise<Order | null> => {
  const priceCheck = validatePrice(amount);
  if (!priceCheck.valid) throw new Error(priceCheck.message);

  const { data, error } = await supabase.rpc('record_order_payment', {
    p_order_id: orderId,
    p_amount: amount,
    p_method: method,
    p_note: note ?? null,
  });
  if (error) {
    logger.warn('recordOrderPayment failed', error);
    throw error;
  }
  return (data as Order) ?? null;
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
