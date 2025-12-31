import { supabase } from './supabase';

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

export interface Order {
  id: string;
  user_id: string;
  service_id: string;
  service_type: string; // 'mobile' or 'pickup'
  device_brand: string;
  device_model: string;
  issue_description: string;
  estimated_price: number;
  location: string;
  latitude: number;
  longitude: number;
  media_urls?: string[];
  status: 'pending' | 'accepted' | 'picking_up' | 'diagnosing' | 'repairing' | 'delivering' | 'completed' | 'cancelled';
  technician_id?: string;
  customer_city?: string;
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
};

// Orders/Requests API
export const requests = {
  // Create new order
  create: async (orderData: any): Promise<Order | null> => {
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([{
        user_id: orderData.user_id,
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
      }])
      .select()
      .single();

    if (orderError) throw orderError;
    return order;
  },

  // Get order by ID
  getById: async (id: string): Promise<Order | null> => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return data;
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
  subscribeToOrders: (callback: () => void) => {
    const subscription = supabase
      .channel('orders-all-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        () => {
          callback();
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
