# Migration from Supabase to Backend API

## Overview
This migration replaces Supabase with our custom PostgreSQL backend API.

## Changes Made

### 1. New API Client (`lib/api.ts`)
- Created a new API client that connects to `http://72.61.241.131/api`
- Supports authentication with JWT tokens
- Matches backend schema and endpoints

### 2. Migration Steps

#### Replace Supabase imports:
```typescript
// OLD
import { auth, services, orders } from '../lib/supabase';

// NEW
import { auth, services, requests } from '../lib/api';
```

#### Update function calls:
```typescript
// OLD
const data = await orders.getUserOrders(userId);

// NEW  
const data = await requests.getUserRequests();
```

### 3. Key Differences

| Supabase | Backend API |
|----------|-------------|
| `orders` | `requests` |
| `orders.create()` | `requests.create()` |
| `orders.getUserOrders(userId)` | `requests.getUserRequests()` |
| `orders.assignToTechnician()` | `requests.acceptRequest()` |
| UUID IDs | Integer IDs |
| `user_id` | `userId` |
| `created_at` | `createdAt` |

### 4. Files to Update

1. `app/(customer)/orders.tsx` → Replace `supabaseOrders` with `requests`
2. `app/(customer)/services.tsx` → Replace `supabaseServices` with `services`
3. `app/(customer)/profile.tsx` → Replace `supabase.auth` with `auth`
4. `app/(technician)/*` → Update all technician screens
5. `app/request.tsx` → Update service request creation

### 5. Authentication Changes

```typescript
// OLD (Supabase)
const { data } = await supabase.auth.signInWithPassword({ email, password });

// NEW (Backend API)
const data = await auth.signIn(email, password);
```

### 6. Environment Variables

No `.env` file needed! API URL is hardcoded in `lib/api.ts`:
```typescript
const API_URL = 'http://72.61.241.131/api';
```

For production, update this to your domain:
```typescript
const API_URL = 'https://fixate.site/api';
```

### 7. Testing

1. Test authentication (signup/login)
2. Test service requests creation
3. Test technician dashboard
4. Test order tracking

### 8. Deployment

After migration:
```bash
# Install dependencies
npm install

# Run on Android
npx expo start --android

# Run on iOS
npx expo start --ios
```

## Benefits

✅ **Unified Database** - Same data for website and mobile app
✅ **No Supabase Costs** - Use your own PostgreSQL
✅ **Better Control** - Full control over backend logic
✅ **Consistent API** - Same endpoints for all platforms
