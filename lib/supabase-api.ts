import { supabase } from './supabase';
import { logger } from '../utils/logger';
import { subscribeUnique } from '../utils/realtimeChannel';
import { notifyUsers, notifyAudience } from '../services/notifyService';

// Arabic labels for the push body when an order status changes (FEAT-01).
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

// Database Types (matching Supabase schema)
export interface User {
  id: string;
  email?: string;
  user_metadata?: {
    name?: string;
    phone?: string;
    user_type?: 'customer' | 'technician';
  };
}

import type { OrderStatus } from '../types/order';
export type { OrderStatus } from '../types/order';

export interface Order {
  id: string;
  user_id: string;
  service_id: string;
  service_type: string;
  device_brand: string;
  device_model: string;
  issue_description: string;
  estimated_price: number;
  // Technician inspection quote (set after the device is inspected). The
  // customer accepts/rejects this before repair work proceeds.
  final_price?: number | null;
  quote_notes?: string | null;
  quoted_at?: string | null;
  location: string;
  latitude: number;
  longitude: number;
  media_urls?: string[];
  status: OrderStatus;
  technician_id?: string;
  customer_city?: string;
  customer_phone?: string;
  technician_phone?: string;
  created_at: string;
  updated_at: string;
}

export interface Technician {
  id: string;
  user_id: string;
  phone: string;
  specialty: string;
  years_of_experience: number;
  rating?: number;
  completed_jobs: number;
  is_available: boolean;
  created_at: string;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  category: string;
  icon?: string;
  price_range?: string;
  created_at: string;
}

export interface Message {
  id: string;
  order_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  attachment_type?: 'image' | 'location' | null;
  attachment_url?: string | null;
  attachment_lat?: number | null;
  attachment_lng?: number | null;
}

// Authentication API
export const auth = {
  // Get current user
  getCurrentUser: async (): Promise<User | null> => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) return null;
      return user as User | null;
    } catch (error) {
      return null;
    }
  },

  // Sign out (idempotent, local-only — never throws even if server session is gone)
  signOut: async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // swallow — local AsyncStorage will be cleared regardless
    }
  },

  // Get user profile from metadata or database
  getUserProfile: async (userId: string): Promise<any> => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) return null;
      
      return {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
        phone: user.user_metadata?.phone || '',
        user_type: user.user_metadata?.user_type || 'customer',
      };
    } catch (error) {
      return null;
    }
  },

  // Update user profile metadata
  updateProfile: async (userId: string, updates: { name?: string; phone?: string }): Promise<any> => {
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: {
          name: updates.name,
          phone: updates.phone,
        }
      });
      if (error) throw error;
      return data.user;
    } catch (error) {
      throw error;
    }
  },
};

// Orders/Requests API
export const requests = {
  // Create new order
  create: async (orderData: any): Promise<Order | null> => {
    const user = await auth.getCurrentUser();
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([{
        user_id: orderData.user_id,
        customer_phone: user?.user_metadata?.phone || '',
        service_id: orderData.service_id || 'general',
        service_type: orderData.service_type,
        device_brand: orderData.device_brand,
        device_model: orderData.device_model,
        issue_description: orderData.issue_description,
        estimated_price: orderData.price || orderData.estimated_price,
        location: typeof orderData.location === 'string' ? orderData.location : (orderData.location?.address || 'Location'),
        latitude: orderData.latitude || orderData.location?.latitude || 0,
        longitude: orderData.longitude || orderData.location?.longitude || 0,
        media_urls: orderData.media_urls || orderData.images || [],
        status: 'pending',
        technician_id: null, // Ensure it's available to all technicians
      }])
      .select()
      .single();

    if (orderError) throw orderError;

    // Notify all technicians that a new request is available (FEAT-01).
    if (order) {
      void notifyAudience('technicians', {
        title: 'طلب صيانة جديد 🛠️',
        body: `${order.device_brand || 'جهاز'} ${order.device_model || ''} — ${order.issue_description || 'طلب صيانة جديد'}`.trim(),
        data: { screen: 'available-orders', orderId: order.id },
      });
    }
    return order;
  },

  // Get order by ID with retry logic
  getById: async (id: string, retries = 2): Promise<Order | null> => {
    for (let i = 0; i <= retries; i++) {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('id', id)
          .single();
        
        if (!error) return data;
        
        if (i === retries) {
          logger.error(`Error fetching order by ID after ${retries} retries`, error);
          return null;
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      } catch (err) {
        if (i === retries) {
          logger.error('Unexpected error in getById', err);
          return null;
        }
      }
    }
    return null;
  },

  // Get available orders (for technicians)
  getAvailableOrders: async (city?: string): Promise<Order[]> => {
    let query = supabase
      .from('orders')
      .select('*')
      .eq('status', 'pending');
    
    if (city) {
      query = query.ilike('location', `%${city}%`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return [];
    return data || [];
  },

  // Get current user's orders (customer)
  getUserOrders: async (): Promise<Order[]> => {
    const user = await auth.getCurrentUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) return [];
    return data || [];
  },

  // Get all orders (helper used by FloatingOrderStatus)
  getAll: async (): Promise<Order[]> => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return [];
    return data || [];
  },

  // Get technician's orders
  getMyOrders: async (): Promise<Order[]> => {
    const user = await auth.getCurrentUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('technician_id', user.id)
      .order('created_at', { ascending: false });
    if (error) return [];
    return data || [];
  },

  // Accept order
  acceptOrder: async (orderId: string): Promise<Order | null> => {
    const user = await auth.getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('orders')
      .update({
        status: 'accepted',
        technician_id: user.id,
        technician_phone: user.user_metadata?.phone || '',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .eq('status', 'pending')
      .is('technician_id', null)
      .select()
      .single();

    if (error) throw error;

    // Notify the client that a technician accepted their request (FEAT-01).
    if (data) {
      pushOrderToClient(
        data.user_id,
        'تم قبول طلبك ✅',
        'قام أحد الفنيين بقبول طلب الصيانة الخاص بك.',
        data.id
      );
    }
    return data;
  },

  // Update order status
  updateStatus: async (id: string, status: Order['status']): Promise<Order | null> => {
    const { data, error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    // Notify the client whenever the technician advances the status (FEAT-01).
    if (data) {
      pushOrderToClient(
        data.user_id,
        'تحديث حالة الطلب',
        STATUS_LABEL_AR[status as string] ?? 'تم تحديث حالة طلبك',
        data.id
      );
    }
    return data;
  },

  // Technician submits the inspection quote -> order becomes 'quoted'.
  // Multiple progressive fallbacks so the call succeeds even when the
  // production DB hasn't been migrated yet (missing column / outdated
  // status CHECK). The last fallback stores the quote in estimated_price
  // so the customer can still see and respond.
  setQuote: async (id: string, price: number, notes?: string): Promise<Order | null> => {
    const ts = new Date().toISOString();
    const attempts: any[] = [
      { final_price: price, status: 'quoted', quote_notes: notes ?? null, quoted_at: ts, updated_at: ts },
      { final_price: price, status: 'quoted', updated_at: ts },
      { final_price: price, updated_at: ts },
      // Final fallback: pre-migration DB. We at least update the visible
      // estimated price + notes so the customer sees the new number.
      { estimated_price: price, issue_description_extra: notes ?? null, updated_at: ts },
      { estimated_price: price, updated_at: ts },
    ];
    let lastError: any = null;
    for (const payload of attempts) {
      const { data, error } = await supabase
        .from('orders')
        .update(payload)
        .eq('id', id)
        .select()
        .maybeSingle();
      if (!error && data) {
        // Notify the client that a price quote is ready (FEAT-01).
        pushOrderToClient(
          data.user_id,
          'عرض سعر جديد 💰',
          `تم إرسال عرض سعر بقيمة ${price} ر.س لطلبك. بانتظار موافقتك.`,
          data.id
        );
        return data;
      }
      lastError = error;
      logger.warn('setQuote attempt failed, falling back', { payload: Object.keys(payload), error });
    }
    throw lastError ?? new Error('Failed to send quote');
  },

  // Customer accepts/rejects the technician quote. On accept the order
  // becomes payment-ready ('awaiting_payment') — the customer is then sent
  // to the real payment page, which advances it to 'accepted' once paid /
  // cash-on-delivery is confirmed.
  respondToQuote: async (id: string, accept: boolean): Promise<Order | null> => {
    const { data, error } = await supabase
      .from('orders')
      .update({
        status: accept ? 'awaiting_payment' : 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Subscribe to orders (real-time). subscribeUnique avoids the
  // realtime race on re-mount.
  subscribeToOrders: (callback: (payload: any) => void) => {
    const cleanup = subscribeUnique('orders-all-changes', (ch) =>
      ch.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => callback(payload)
      )
    );
    return { unsubscribe: cleanup };
  },

  // Subscribe to specific order updates
  subscribeToUpdates: (orderId: string, callback: (order: Order) => void) => {
    const cleanup = subscribeUnique(`order-${orderId}`, (ch) =>
      ch.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => callback(payload.new as Order)
      )
    );
    return { unsubscribe: cleanup };
  },
};

// Chat API
export const chat = {
  sendMessage: async (
    orderId: string,
    content: string,
    attachment?: { type: 'image' | 'location'; url?: string; lat?: number; lng?: number }
  ): Promise<Message | null> => {
    const user = await auth.getCurrentUser();
    if (!user) return null;

    const payload: any = {
      order_id: orderId,
      sender_id: user.id,
      content,
    };
    if (attachment) {
      payload.attachment_type = attachment.type;
      if (attachment.url !== undefined) payload.attachment_url = attachment.url;
      if (attachment.lat !== undefined) payload.attachment_lat = attachment.lat;
      if (attachment.lng !== undefined) payload.attachment_lng = attachment.lng;
    }

    const { data, error } = await supabase
      .from('messages')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;

    // Notify the other party of the new message (FEAT-01). Resolve who the
    // recipient is from the order (customer vs technician) and exclude the
    // sender so they never get a push for their own message.
    void (async () => {
      try {
        const { data: order } = await supabase
          .from('orders')
          .select('user_id, technician_id')
          .eq('id', orderId)
          .single();
        if (!order) return;
        const recipient =
          order.user_id === user.id ? order.technician_id : order.user_id;
        if (!recipient) return;
        const preview = attachment
          ? attachment.type === 'image'
            ? '📷 صورة'
            : '📍 موقع'
          : content;
        await notifyUsers(
          recipient,
          {
            title: 'رسالة جديدة 💬',
            body: preview || 'لديك رسالة جديدة',
            data: { screen: 'chat', orderId },
          },
          user.id
        );
      } catch (e) {
        logger.warn('chat push notify failed', e);
      }
    })();

    return data;
  },

  getMessages: async (orderId: string): Promise<Message[]> => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });
    if (error) return [];
    return data || [];
  },

  subscribeToMessages: (orderId: string, callback: (message: Message) => void) => {
    const cleanup = subscribeUnique(`chat-${orderId}`, (ch) =>
      ch.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => callback(payload.new as Message)
      )
    );
    return {
      unsubscribe: cleanup as any,
    };
  }
};

export default {
  auth,
  requests,
  chat,
};

