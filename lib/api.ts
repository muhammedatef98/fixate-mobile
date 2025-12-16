import AsyncStorage from '@react-native-async-storage/async-storage';

// API Configuration
const API_URL = 'http://72.61.241.131/api'; // Your VPS backend
const AUTH_TOKEN_KEY = '@fixate_auth_token';

// Helper function to get auth token
const getAuthToken = async () => {
  return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
};

// Helper function to make API requests
const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const token = await getAuthToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
};

// Database Types (matching backend schema)
export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  userType: 'client' | 'technician';
  role: string;
  createdAt: string;
}

export interface Service {
  id: number;
  nameEn: string;
  nameAr: string;
  descriptionEn?: string;
  descriptionAr?: string;
  category: string;
  iconUrl?: string;
  basePrice?: number;
}

export interface ServiceRequest {
  id: number;
  userId: number;
  deviceModelId: number;
  serviceTypeId: number;
  serviceMode: 'express' | 'pickup';
  issueDescription?: string;
  address: string;
  city: string;
  phoneNumber: string;
  preferredDate?: string;
  preferredTimeSlot?: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  technicianId?: number;
  totalAmount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Technician {
  id: number;
  userId: number;
  nameAr: string;
  nameEn: string;
  phoneNumber: string;
  specialization?: string;
  city: string;
  rating?: number;
  completedJobs: number;
  isActive: boolean;
}

// Authentication API
export const auth = {
  // Sign up
  signUp: async (data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    userType?: 'client' | 'technician';
  }) => {
    const response = await apiRequest('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    
    if (response.token) {
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, response.token);
    }
    
    return response;
  },

  // Sign in
  signIn: async (email: string, password: string) => {
    const response = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    if (response.token) {
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, response.token);
    }
    
    return response;
  },

  // Sign out
  signOut: async () => {
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    await apiRequest('/auth/logout', { method: 'POST' });
  },

  // Get current user
  getCurrentUser: async () => {
    return await apiRequest('/auth/me');
  },

  // Get user profile
  getUserProfile: async () => {
    return await apiRequest('/auth/me');
  },
};

// Services API
export const services = {
  // Get all services
  getAll: async () => {
    return await apiRequest('/services');
  },

  // Get service by ID
  getById: async (id: number) => {
    return await apiRequest(`/services/${id}`);
  },

  // Get services by category
  getByCategory: async (category: string) => {
    return await apiRequest(`/services?category=${category}`);
  },
};

// Service Requests API
export const requests = {
  // Create new request
  create: async (requestData: {
    deviceModelId: number;
    serviceTypeId: number;
    serviceMode: 'express' | 'pickup';
    issueDescription?: string;
    address: string;
    city: string;
    phoneNumber: string;
    preferredDate?: string;
    preferredTimeSlot?: string;
  }) => {
    return await apiRequest('/requests/create', {
      method: 'POST',
      body: JSON.stringify(requestData),
    });
  },

  // Get user requests
  getUserRequests: async () => {
    return await apiRequest('/requests/my');
  },

  // Get request by ID
  getById: async (id: number) => {
    return await apiRequest(`/requests/${id}`);
  },

  // Update request status (for technicians)
  updateStatus: async (id: number, status: ServiceRequest['status']) => {
    return await apiRequest(`/requests/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },

  // Get available requests (for technicians)
  getAvailable: async () => {
    return await apiRequest('/requests/pending');
  },

  // Assign request to technician
  acceptRequest: async (requestId: number) => {
    return await apiRequest(`/requests/${requestId}/accept`, {
      method: 'POST',
    });
  },

  // Get technician's assigned requests
  getTechnicianRequests: async () => {
    return await apiRequest('/requests/technician/my');
  },
};

// Technicians API
export const technicians = {
  // Get all available technicians
  getAvailable: async () => {
    return await apiRequest('/technicians/available');
  },

  // Get technician by user ID
  getByUserId: async (userId: number) => {
    return await apiRequest(`/technicians/user/${userId}`);
  },

  // Get technician profile
  getProfile: async () => {
    return await apiRequest('/technicians/profile');
  },
};

// Devices API
export const devices = {
  // Get all device types
  getTypes: async () => {
    return await apiRequest('/devices/types');
  },

  // Get device models by type
  getModelsByType: async (typeId: number) => {
    return await apiRequest(`/devices/types/${typeId}/models`);
  },
};

// Storage/Upload API
export const storage = {
  // Upload image
  uploadImage: async (uri: string, fileName: string) => {
    const formData = new FormData();
    formData.append('file', {
      uri,
      type: 'image/jpeg',
      name: fileName,
    } as any);

    const token = await getAuthToken();
    
    const response = await fetch(`${API_URL}/upload`, {
      method: 'POST',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    return response.json();
  },
};

export default {
  auth,
  services,
  requests,
  technicians,
  devices,
  storage,
};
