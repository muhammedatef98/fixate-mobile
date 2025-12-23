import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system';
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

// Authentication API
export const auth = {
  // Get current user
  getCurrentUser: async (): Promise<User | null> => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      console.error('Error getting current user:', error);
      return null;
    }
    return user;
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
  create: async (orderData: {
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
  }): Promise<Order | null> => {
    const { data, error } = await supabase
      .from('orders')
      .insert([{
        user_id: orderData.user_id,
        service_id: orderData.service_id,
        service_type: orderData.service_type,
        device_brand: orderData.device_brand,
        device_model: orderData.device_model,
        issue_description: orderData.issue_description,
        estimated_price: orderData.estimated_price,
        location: orderData.location,
        latitude: orderData.latitude,
        longitude: orderData.longitude,
        media_urls: orderData.media_urls,
        status: 'pending',
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating order:', error);
      throw error;
    }

    return data;
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
      .select('*')
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
      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert base64 to array buffer
      const arrayBuffer = decode(base64);

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
