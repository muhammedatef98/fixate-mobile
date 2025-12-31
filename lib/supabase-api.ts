import { supabase } from './supabase';
import { File } from 'expo-file-system/next';
import { decode } from 'base64-arraybuffer';

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
      if (error) {
        // Silently return null if no session
        return null;
      }
      return user;
    } catch (error) {
      // Handle any exceptions (like AuthSessionMissingError)
      return null;
    }
  },

  // Get user profile
  getUserProfile: async (): Promise<User | null> => {
    return await auth.getCurrentUser();
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
    return await requests.createRequest(orderData);
  },

  createRequest: async (orderData: any): Promise<Order | null> => {
    // 1. Create the main order
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

    if (orderError) {
      console.error('Error creating order:', orderError);
      throw orderError;
    }

    // 2. Create order items if present
    if (orderData.items && orderData.items.length > 0) {
      const itemsToInsert = orderData.items.map(item => ({
        order_id: order.id,
        device_type: item.deviceType,
        device_brand: item.brand.name,
        device_model: item.model,
        issue_id: item.issue.id,
        issue_description: item.description,
        estimated_price: item.issue.priceRange.min,
        // Store media files for this specific item if needed, or rely on main order media
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(itemsToInsert);

      if (itemsError) {
        console.error('Error creating order items:', itemsError);
        // We don't throw here to avoid failing the whole order, but log it
      }
    }

    return order;
  },

  // Get all orders
  getAll: async (): Promise<Order[]> => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error getting all orders:', error);
      return [];
    }

    return data || [];
  },

  // Get user orders
  getUserRequests: async (userId: string): Promise<Order[]> => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error getting user orders:', error);
      return [];
    }

    return data || [];
  },

  // Get order by ID
  getById: async (id: string): Promise<Order | null> => {
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error getting order:', error);
      return null;
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

    if (error) {
      console.error('Error updating order status:', error);
      throw error;
    }

    return data;
  },

  // Get available orders (for technicians)
  getAvailable: async (): Promise<Order[]> => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error getting available orders:', error);
      return [];
    }

    return data || [];
  },

  // Accept order (for technicians)
  acceptRequest: async (orderId: string, technicianId: string): Promise<Order | null> => {
    const { data, error } = await supabase
      .from('orders')
      .update({ 
        status: 'accepted', 
        technician_id: technicianId,
        updated_at: new Date().toISOString() 
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      console.error('Error accepting order:', error);
      throw error;
    }

    return data;
  },

  // Get technician's orders
  getTechnicianRequests: async (technicianId: string): Promise<Order[]> => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('technician_id', technicianId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error getting technician orders:', error);
      return [];
    }

    return data || [];
  },

  // Subscribe to new orders (real-time)
  subscribeToNew: (callback: (order: Order) => void) => {
    const subscription = supabase
      .channel('orders-new')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: 'status=eq.pending'
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

  // Subscribe to order updates (real-time)
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

  // Get user orders (gets current user automatically)
  getUserOrders: async (): Promise<Order[]> => {
    try {
      const user = await auth.getCurrentUser();
      if (!user) {
        // Return empty array silently for guests
        return [];
      }
      return await requests.getUserRequests(user.id);
    } catch (error) {
      console.error('Error getting user orders:', error);
      return [];
    }
  },

  // Assign order to technician
  assignToTechnician: async (orderId: string, technicianId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'accepted', 
          technician_id: technicianId,
          updated_at: new Date().toISOString() 
        })
        .eq('id', orderId);

      if (error) {
        console.error('Error assigning order to technician:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in assignToTechnician:', error);
      return false;
    }
  },

  // Update order
  update: async (orderId: string, updates: Partial<Order>): Promise<Order | null> => {
    const { data, error } = await supabase
      .from('orders')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      console.error('Error updating order:', error);
      throw error;
    }

    return data;
  },
};

// Technicians API
export const technicians = {
  // Get all available technicians
  getAvailable: async (): Promise<Technician[]> => {
    const { data, error } = await supabase
      .from('technicians')
      .select('*')
      .eq('is_available', true);

    if (error) {
      console.error('Error getting available technicians:', error);
      return [];
    }

    return data || [];
  },

  // Get technician by user ID
  getByUserId: async (userId: string): Promise<Technician | null> => {
    const { data, error } = await supabase
      .from('technicians')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error getting technician:', error);
      return null;
    }

    return data;
  },

  // Create technician profile
  create: async (technicianData: {
    user_id: string;
    phone: string;
    specialty: string;
    years_of_experience: number;
  }): Promise<Technician | null> => {
    const { data, error } = await supabase
      .from('technicians')
      .insert([{
        user_id: technicianData.user_id,
        phone: technicianData.phone,
        specialty: technicianData.specialty,
        years_of_experience: technicianData.years_of_experience,
        is_available: true,
        completed_jobs: 0,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating technician:', error);
      throw error;
    }

    return data;
  },
};

// Services API
// Chat API
export const chat = {
  // Send message
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

    if (error) {
      console.error('Error sending message:', error);
      throw error;
    }

    return data;
  },

  // Get messages for an order
  getMessages: async (orderId: string): Promise<Message[]> => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error getting messages:', error);
      return [];
    }

    return data || [];
  },

  // Subscribe to new messages
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

export const services = {
  // Get all services
  getAll: async (): Promise<Service[]> => {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error getting services:', error);
      return [];
    }

    return data || [];
  },

  // Get service by ID
  getById: async (id: string): Promise<Service | null> => {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error getting service:', error);
      return null;
    }

    return data;
  },

  // Get services by category
  getByCategory: async (category: string): Promise<Service[]> => {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('category', category)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error getting services by category:', error);
      return [];
    }

    return data || [];
  },
};

// Storage API
export const storage = {
  // Upload image from URI
  uploadImageFromUri: async (bucket: string, uri: string, fileName: string): Promise<string> => {
    try {
      // Use new File API
      const file = new File(uri);
      const arrayBuffer = await file.arrayBuffer();

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (error) {
        console.error('Error uploading image:', error);
        throw error;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error in uploadImageFromUri:', error);
      throw error;
    }
  },

  // Upload image (alternative method)
  uploadImage: async (bucket: string, file: File, fileName: string): Promise<string> => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error('Error uploading image:', error);
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  },
};

export default {
  auth,
  requests,
  technicians,
  services,
  storage,
};
