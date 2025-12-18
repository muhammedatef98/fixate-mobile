/**
 * Mobile API Adapter
 * This file provides compatibility between the mobile app's Supabase API
 * and the web's PostgreSQL database, allowing both to use the same backend
 */

import { createClient } from '@supabase/supabase-js';

// Configuration
const UNIFIED_API_URL = process.env.UNIFIED_API_URL || 'https://fixate.site/api';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

/**
 * Adapter for mobile app to use unified API instead of direct Supabase
 */
export class MobileAPIAdapter {
  private apiUrl: string;

  constructor(apiUrl: string = UNIFIED_API_URL) {
    this.apiUrl = apiUrl;
  }

  /**
   * Create a new order (mobile app format)
   * Maps mobile app order format to unified API format
   */
  async createOrder(orderData: {
    user_id: string;
    service_id: string;
    service_type: 'mobile' | 'pickup';
    device_brand: string;
    device_model: string;
    issue_description: string;
    estimated_price: number;
    location: string;
    latitude: number;
    longitude: number;
    media_urls?: string[];
  }) {
    try {
      // Extract device type from service_id or device info
      const device_type = this.extractDeviceType(orderData.device_brand, orderData.device_model);
      
      // Extract issue_id from issue_description if formatted as "[Type] Issue: description"
      const issue_id = this.extractIssueId(orderData.issue_description);
      
      // Split location into address and city
      const { address, city } = this.parseLocation(orderData.location);

      // Map to unified API format
      const unifiedData = {
        userId: parseInt(orderData.user_id) || 0, // Convert UUID to integer if needed
        device_type,
        device_brand: orderData.device_brand,
        device_model_name: orderData.device_model,
        service_type: orderData.service_type,
        issue_id,
        issueDescription: orderData.issue_description,
        estimated_price: orderData.estimated_price,
        address,
        city,
        latitude: orderData.latitude,
        longitude: orderData.longitude,
        media_urls: orderData.media_urls || [],
        phoneNumber: '', // Will be filled from user profile
        paymentMethod: 'cash_on_delivery',
      };

      const response = await fetch(`${this.apiUrl}/unified-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(unifiedData),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Map back to mobile app format
      return {
        id: result.data.id.toString(),
        user_id: orderData.user_id,
        service_id: orderData.service_id,
        technician_id: result.data.technicianId?.toString() || null,
        device_brand: result.data.device_brand,
        device_model: result.data.device_model_name,
        issue_description: result.data.issueDescription,
        estimated_price: result.data.estimated_price,
        status: result.data.status,
        scheduled_date: result.data.preferredDate,
        address: result.data.location || result.data.address,
        notes: result.data.issueDescription,
        created_at: result.data.createdAt,
        updated_at: result.data.updatedAt,
      };
    } catch (error) {
      console.error('Error creating order via unified API:', error);
      throw error;
    }
  }

  /**
   * Get orders for a user
   */
  async getUserOrders(userId: string) {
    try {
      const response = await fetch(`${this.apiUrl}/unified-requests/user/${userId}`);
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Map to mobile app format
      return result.data.map((req: any) => ({
        id: req.id.toString(),
        user_id: req.userId.toString(),
        service_id: req.issue_id || 'unknown',
        technician_id: req.technicianId?.toString() || null,
        device_brand: req.device_brand,
        device_model: req.device_model_name,
        issue_description: req.issueDescription,
        estimated_price: req.estimated_price,
        status: req.status,
        scheduled_date: req.preferredDate,
        address: req.address,
        notes: req.issueDescription,
        created_at: req.createdAt,
        updated_at: req.updatedAt,
      }));
    } catch (error) {
      console.error('Error fetching user orders:', error);
      throw error;
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId: string, status: string) {
    try {
      const response = await fetch(`${this.apiUrl}/unified-requests/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }

  // Helper methods

  private extractDeviceType(brand: string, model: string): string {
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

  private extractIssueId(issueDescription: string): string {
    // Try to extract issue ID from formatted description like "[Type] Issue: description"
    const match = issueDescription.match(/\[(.*?)\]\s*(.*?):/);
    if (match && match[2]) {
      const issueName = match[2].trim().toLowerCase();
      // Map common issue names to IDs
      const issueMap: Record<string, string> = {
        'broken screen': 'screen_broken',
        'شاشة مكسورة': 'screen_broken',
        'battery draining fast': 'battery_drain',
        'البطارية تنفذ بسرعة': 'battery_drain',
        'charging issue': 'charging_issue',
        'مشكلة في الشحن': 'charging_issue',
        'camera issue': 'camera_issue',
        'مشكلة في الكاميرا': 'camera_issue',
      };
      return issueMap[issueName] || 'other';
    }
    return 'other';
  }

  private parseLocation(location: string): { address: string; city: string } {
    // Try to parse location string like "Street, City, Region"
    const parts = location.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      return {
        address: parts[0],
        city: parts[1],
      };
    }
    return {
      address: location,
      city: 'Riyadh', // Default city
    };
  }
}

/**
 * Usage example for mobile app:
 * 
 * // In mobile app, replace Supabase calls with:
 * import { MobileAPIAdapter } from './mobile-api-adapter';
 * 
 * const api = new MobileAPIAdapter();
 * 
 * // Create order
 * const order = await api.createOrder({
 *   user_id: user.id,
 *   service_id: selectedIssue.id,
 *   service_type: 'mobile',
 *   device_brand: selectedBrand.name,
 *   device_model: selectedModel,
 *   issue_description: issueDescription,
 *   estimated_price: selectedIssue.estimatedPrice,
 *   location: address,
 *   latitude: location.latitude,
 *   longitude: location.longitude,
 *   media_urls: uploadedUrls,
 * });
 * 
 * // Get user orders
 * const orders = await api.getUserOrders(user.id);
 * 
 * // Update order status
 * await api.updateOrderStatus(orderId, 'completed');
 */

export default MobileAPIAdapter;
