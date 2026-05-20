import 'react-native-url-polyfill/auto';
import { logger } from '../utils/logger';
// Single shared Supabase client — re-export so existing imports keep working
// while only one auth listener / one in-memory session exists app-wide.
export { supabase } from '../services/supabaseClient';
import { supabase } from '../services/supabaseClient';
import { callEdgeFunction } from '../services/edgeInvoke';

// Database Types
export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: 'customer' | 'technician';
  avatar_url?: string;
  created_at: string;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  price_range: string;
  created_at: string;
}

import type { Order, OrderStatus, ServiceType, CreateOrderData } from '../types/order';
export type { Order, OrderStatus, ServiceType, CreateOrderData };

export interface Technician {
  id: string;
  user_id: string;
  specialization: string[];
  rating: number;
  total_jobs: number;
  available: boolean;
  location?: string;
  created_at: string;
}

// Helper Functions
export const auth = {
  // Sign up with email and password
  signUp: async (email: string, password: string, name: string, role: 'customer' | 'technician') => {
    // Route through the auto-confirming `signup` Edge Function so we don't
    // depend on Supabase project SMTP. The function uses the service-role
    // admin API to create a confirmed account, then we sign the user in.
    const cleanEmail = email.trim().toLowerCase();
    // Plain fetch via callEdgeFunction — supabase.functions.invoke can
    // hit the RN blob-resolution bug on this body shape.
    const { errorMessage } = await callEdgeFunction('signup', {
      email: cleanEmail, password, name: name.trim(), role,
    });
    if (errorMessage) throw new Error(errorMessage);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });
    if (error) throw error;
    return data;
  },

  // Sign in with email and password
  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    return data;
  },

  // Sign out
  signOut: async () => {
    // scope:'local' clears the local session without requiring the server
    // session to still exist. This avoids "Auth session missing" errors
    // when the server-side row was already revoked.
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // Even if Supabase fails, force-clear local state by signing out without scope
      await supabase.auth.signOut().catch(() => undefined);
    }
  },

  // Get current user
  getCurrentUser: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  // Get user profile by ID
  getUserProfile: async (userId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    if (!data) throw new Error('User not found');

    return data as User;
  },
};

export const services = {
  // Get all services
  getAll: async () => {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data as Service[];
  },

  // Get service by ID
  getById: async (id: string) => {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as Service;
  },

  // Get services by category
  getByCategory: async (category: string) => {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('category', category)
      .order('name');
    
    if (error) throw error;
    return data as Service[];
  },
};

export const orders = {
  // Get all orders
  getAll: async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as Order[];
  },

  // Create new order
  create: async (orderData: Omit<Order, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single();
    
    if (error) throw error;
    return data as Order;
  },

  // Get user orders
  getUserOrders: async (userId: string) => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        service:services(*),
        technician:technicians(*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // Get order by ID
  getById: async (id: string) => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        service:services(*),
        technician:technicians(*)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Update order
  update: async (id: string, updates: Partial<Order>) => {
    const { data, error } = await supabase
      .from('orders')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as Order;
  },

  // Update order status
  updateStatus: async (id: string, status: Order['status']) => {
    const { data, error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as Order;
  },

  // Get available orders (for technicians)
  getAvailable: async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .is('technician_id', null)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // Assign order to technician
  assignToTechnician: async (orderId: string, technicianId: string) => {
    const { data, error } = await supabase
      .from('orders')
      .update({
        technician_id: technicianId,
        status: 'accepted' as OrderStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .is('technician_id', null) // Only if not already assigned
      .select()
      .single();
    
    if (error) throw error;
    return data ? true : false;
  },

  // Subscribe to new orders (real-time)
  subscribeToNew: (callback: (order: any) => void) => {
    const subscription = supabase
      .channel('new-orders')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          callback(payload.new);
        }
      )
      .subscribe();

    return subscription;
  },
};

export const storage = {
  // Upload file to Supabase Storage
  uploadFile: async (bucket: string, path: string, file: Blob | File) => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw error;
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    return publicUrl;
  },

  // Upload image from URI (React Native)
  uploadImageFromUri: async (bucket: string, uri: string, fileName: string) => {
    try {
      // Fetch the image as a blob
      const response = await fetch(uri);
      const blob = await response.blob();

      // Generate unique file path
      const timestamp = Date.now();
      const filePath = `${timestamp}-${fileName}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, blob, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      logger.error('Error uploading image', error);
      throw error;
    }
  },

  // Delete file from storage
  deleteFile: async (bucket: string, path: string) => {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);

    if (error) throw error;
    return true;
  },
};

export const technicians = {
  // Get all available technicians
  getAvailable: async () => {
    const { data, error } = await supabase
      .from('technicians')
      .select('*, user:users(*)')
      .eq('available', true)
      .order('rating', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // Get technician by user ID
  getByUserId: async (userId: string) => {
    const { data, error } = await supabase
      .from('technicians')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error) throw error;
    return data as Technician;
  },
};
