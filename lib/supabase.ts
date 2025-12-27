import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Supabase Configuration
// Get these from: https://supabase.com/dashboard/project/_/settings/api
const SUPABASE_URL = Constants.expoConfig?.extra?.supabaseUrl || 'https://gpucisjxecupcyosumgy.supabase.co';
const SUPABASE_ANON_KEY = Constants.expoConfig?.extra?.supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwdWNpc2p4ZWN1cGN5b3N1bWd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NjY1NTEsImV4cCI6MjA4MTE0MjU1MX0.dPN6rdv6R5DF_8GdeP5DmNvoj0tecFAcfqVFgN68QkE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

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

export interface Order {
  id: string;
  user_id: string;
  service_id: string;
  technician_id?: string;
  device_brand: string;
  device_model: string;
  issue_description: string;
  estimated_price: number;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  scheduled_date?: string;
  address?: string;
  notes?: string;
  media_urls?: string[];
  created_at: string;
  updated_at: string;
}

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
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          role,
        },
      },
    });
    
    if (error) throw error;
    
    // User profile is stored in auth.users metadata
    // No need to insert into custom users table
    
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
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // Get current user
  getCurrentUser: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  // Get user profile
  getUserProfile: async (userId: string) => {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) throw error;
    if (!user) throw new Error('User not found');
    
    // Return user data from auth metadata
    return {
      id: user.id,
      email: user.email!,
      name: user.user_metadata.name || '',
      role: user.user_metadata.role || 'customer',
      created_at: user.created_at,
    } as User;
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
        status: 'confirmed',
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
      console.error('Error uploading image:', error);
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
