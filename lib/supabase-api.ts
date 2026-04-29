import { supabase } from './supabase';
import { logger } from '../utils/logger';

// Database Types (matching Supabase schema)
export interface User {
  id: string;
  email: string;
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
}

// Authentication API
export const auth = {
  // Get current user
  getCurrentUser: async (): Promise<User | null> => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) return null;
      return user;
    } catch (error) {
      return null;
    }
  },

  // Sign out
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
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
      .select()
      .single();

    if (error) throw error;
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
    return data;
  },

  // Subscribe to orders (real-time)
  subscribeToOrders: (callback: (payload: any) => void) => {
    const subscription = supabase
      .channel('orders-all-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          callback(payload);
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(subscription);
      }
    };
  },

  // Subscribe to specific order updates
  subscribeToUpdates: (orderId: string, callback: (order: Order) => void) => {
    const subscription = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`
        },
        (payload) => {
          callback(payload.new as Order);
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(subscription);
      }
    };
  },
};

// Chat API
export const chat = {
  sendMessage: async (orderId: string, content: string): Promise<Message | null> => {
    const user = await auth.getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('messages')
      .insert([{
        order_id: orderId,
        sender_id: user.id,
        content: content,
      }])
      .select()
      .single();

    if (error) throw error;
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
    const subscription = supabase
      .channel(`chat-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `order_id=eq.${orderId}`
        },
        (payload) => {
          callback(payload.new as Message);
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(subscription);
      }
    };
  }
};

export default {
  auth,
  requests,
  chat,
};

// Helper function for getting user orders
requests.getUserOrders = async (): Promise<Order[]> => {
  const user = await auth.getCurrentUser();
  if (!user) return [];
  
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  
  if (error) return [];
  return data || [];
};
