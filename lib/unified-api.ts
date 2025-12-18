import AsyncStorage from '@react-native-async-storage/async-storage';

// API Configuration - Point to unified API
const API_URL = 'https://fixate.site/api'; // Production URL
// const API_URL = 'http://localhost:5000/api'; // Development URL
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

// Unified Service Requests API (works with both web and mobile)
export const requests = {
  // Create new request with unified format
  create: async (requestData: {
    // Mobile-specific fields
    user_id?: string;
    service_id?: string;
    service_type?: 'mobile' | 'pickup';
    device_brand?: string;
    device_model?: string;
    issue_description?: string;
    estimated_price?: number;
    location?: string;
    latitude?: number;
    longitude?: number;
    media_urls?: string[];
    
    // Web-compatible fields
    userId?: number;
    deviceModelId?: number;
    serviceTypeId?: number;
    serviceMode?: 'express' | 'pickup';
    issueDescription?: string;
    address?: string;
    city?: string;
    phoneNumber?: string;
    preferredDate?: string;
    preferredTimeSlot?: string;
    paymentMethod?: string;
  }) => {
    // Convert mobile format to unified format
    const unifiedData = {
      userId: requestData.userId || parseInt(requestData.user_id || '0'),
      device_type: extractDeviceType(requestData.device_brand || '', requestData.device_model || ''),
      device_brand: requestData.device_brand,
      device_model_name: requestData.device_model,
      service_type: requestData.service_type || requestData.serviceMode || 'mobile',
      issue_id: requestData.service_id,
      issueDescription: requestData.issue_description || requestData.issueDescription,
      estimated_price: requestData.estimated_price,
      address: requestData.address || parseLocation(requestData.location || '').address,
      city: requestData.city || parseLocation(requestData.location || '').city,
      latitude: requestData.latitude,
      longitude: requestData.longitude,
      media_urls: requestData.media_urls || [],
      phoneNumber: requestData.phoneNumber || '',
      paymentMethod: requestData.paymentMethod || 'cash_on_delivery',
    };

    const response = await apiRequest('/unified-requests', {
      method: 'POST',
      body: JSON.stringify(unifiedData),
    });

    return response.data;
  },

  // Get user requests
  getUserRequests: async (userId: string | number) => {
    const response = await apiRequest(`/unified-requests/user/${userId}`);
    return response.data;
  },

  // Get request by ID
  getById: async (id: string | number) => {
    const response = await apiRequest(`/unified-requests/${id}`);
    return response.data;
  },

  // Update request status
  updateStatus: async (id: string | number, status: string) => {
    const response = await apiRequest(`/unified-requests/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    return response.data;
  },

  // Assign technician
  assignTechnician: async (id: string | number, technicianId: number) => {
    const response = await apiRequest(`/unified-requests/${id}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ technicianId }),
    });
    return response.data;
  },
};

// Helper functions
function extractDeviceType(brand: string, model: string): string {
  const lowerBrand = brand.toLowerCase();
  const lowerModel = model.toLowerCase();

  if (lowerModel.includes('ipad') || lowerModel.includes('tab')) {
    return 'tablet';
  }
  if (lowerModel.includes('macbook') || lowerModel.includes('laptop') || 
      lowerBrand === 'dell' || lowerBrand === 'hp' || lowerBrand === 'lenovo') {
    return 'laptop';
  }
  if (lowerModel.includes('watch')) {
    return 'watch';
  }
  return 'phone';
}

function parseLocation(location: string): { address: string; city: string } {
  const parts = location.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    return {
      address: parts[0],
      city: parts[1],
    };
  }
  return {
    address: location,
    city: 'Riyadh',
  };
}

// Keep existing auth and other APIs
export const auth = {
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

  signOut: async () => {
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  },

  getCurrentUser: async () => {
    return await apiRequest('/auth/me');
  },
};

// Storage/Upload API
export const storage = {
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

  uploadImageFromUri: async (bucket: string, uri: string, fileName: string) => {
    // Upload to unified API storage
    const result = await storage.uploadImage(uri, fileName);
    return result.url;
  },
};

export default {
  auth,
  requests,
  storage,
};
