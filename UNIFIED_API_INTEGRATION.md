# Unified API Integration Guide

## Overview

This update integrates the mobile app with the unified API that's shared with the web application. Both platforms now use the same PostgreSQL database and API endpoints.

## Changes Made

### 1. New Files Added

- **`lib/unified-api.ts`** - New API client that connects to the unified backend
- **`lib/mobile-api-adapter.ts`** - Adapter for backward compatibility with existing code

### 2. API Endpoint Change

**Old:**
```typescript
const API_URL = 'http://72.61.241.131/api'; // Old VPS backend
```

**New:**
```typescript
const API_URL = 'https://fixate.site/api'; // Unified backend
```

### 3. Request Format

The unified API supports both mobile and web formats:

**Mobile Format (Supabase-style):**
```typescript
{
  user_id: string,
  service_id: string,
  service_type: 'mobile' | 'pickup',
  device_brand: string,
  device_model: string,
  issue_description: string,
  estimated_price: number,
  location: string,
  latitude: number,
  longitude: number,
  media_urls: string[]
}
```

**Unified Format (automatically converted):**
```typescript
{
  userId: number,
  device_type: 'phone' | 'tablet' | 'laptop' | 'watch',
  device_brand: string,
  device_model_name: string,
  service_type: 'mobile' | 'pickup',
  issue_id: string,
  issueDescription: string,
  estimated_price: number,
  address: string,
  city: string,
  latitude: number,
  longitude: number,
  media_urls: string[],
  phoneNumber: string,
  paymentMethod: string
}
```

## How to Use

### Option 1: Update Existing Code (Recommended)

Replace imports in your files:

```typescript
// Old
import { requests, auth, storage } from './lib/api';

// New
import { requests, auth, storage } from './lib/unified-api';
```

### Option 2: Use Adapter (Quick Fix)

The adapter provides backward compatibility:

```typescript
import { MobileAPIAdapter } from './lib/mobile-api-adapter';

const api = new MobileAPIAdapter('https://fixate.site/api');

// Use existing code without changes
const order = await api.createOrder({
  user_id: user.id,
  service_id: selectedIssue.id,
  // ... rest of the data
});
```

## Migration Steps

### 1. Update app/request.tsx

Find the section where orders are created (around line 278):

**Old Code:**
```typescript
const order = await requests.create({
  user_id: user.id,
  service_id: selectedIssue?.id || 'unknown',
  // ...
});
```

**New Code:**
```typescript
import { requests } from '../lib/unified-api';

const order = await requests.create({
  user_id: user.id,
  service_id: selectedIssue?.id || 'unknown',
  service_type: selectedServiceType,
  device_brand: selectedBrand?.name || '',
  device_model: selectedModel || '',
  issue_description: `[${serviceTypeLabel?.name || ''}] ${selectedIssue?.name}: ${issueDescription}`,
  estimated_price: selectedIssue?.estimatedPrice || 0,
  location: address,
  latitude: location.latitude,
  longitude: location.longitude,
  media_urls: uploadedUrls,
});
```

### 2. Update Other Files

Update imports in:
- `app/(customer)/orders.tsx`
- `app/(technician)/my-orders.tsx`
- Any other file using the API

### 3. Test the Integration

```bash
# Install dependencies
npm install

# Start the app
npm start

# Test creating an order
# Test viewing orders
# Test updating order status
```

## Environment Variables

Add to your `.env` or `app.config.js`:

```env
UNIFIED_API_URL=https://fixate.site/api
```

## Benefits

✅ **Unified Database** - Web and mobile share the same data
✅ **Consistent API** - Same endpoints for both platforms
✅ **Better Features** - GPS, images, dynamic search
✅ **Easier Maintenance** - One backend to update
✅ **Real-time Sync** - Changes reflect immediately on both platforms

## Troubleshooting

### Issue: Network request failed

**Solution:** Make sure you're using HTTPS for production:
```typescript
const API_URL = 'https://fixate.site/api'; // Not http://
```

### Issue: User ID mismatch

**Solution:** The unified API uses integer IDs. The adapter handles conversion automatically.

### Issue: CORS errors

**Solution:** The backend is configured to accept requests from mobile apps. Make sure you're using the correct API URL.

## Support

For issues or questions:
- Email: fixate01@gmail.com
- GitHub: [muhammedatef98/fixatee-mobile](https://github.com/muhammedatef98/fixatee-mobile)

## Next Steps

After integration:
1. ✅ Test all features thoroughly
2. ✅ Update any hardcoded API URLs
3. ✅ Remove old Supabase dependencies (optional)
4. ✅ Deploy to production

---

**Integration Status:** ✅ Ready to use
**Last Updated:** December 2024
