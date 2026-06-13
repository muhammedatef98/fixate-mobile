# Supabase Setup Guide for Fixate

## 🚀 Quick Start (5 minutes)

### 1. Create Supabase Account
1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign up with GitHub/Google (free forever)

### 2. Create New Project
1. Click "New Project"
2. Fill in:
   - **Name**: `fixate`
   - **Database Password**: (save this!)
   - **Region**: Choose closest to Saudi Arabia (e.g., `Singapore`)
3. Click "Create new project"
4. Wait 2-3 minutes for setup

### 3. Get API Keys
1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon/public key**: `eyJhbGc...` (long string)

### 4. Update App Configuration
Open `mobile/lib/supabase.ts` and replace:

```typescript
const SUPABASE_URL = 'https://your-project.supabase.co'; // ← Your Project URL
const SUPABASE_ANON_KEY = 'your-anon-key'; // ← Your anon key
```

### 5. Create Database Tables
1. Go to **SQL Editor** in Supabase dashboard
2. Click "New query"
3. Copy ALL content from `mobile/supabase-schema.sql`
4. Paste and click "Run"
5. Wait for "Success" message

### 6. Test Connection
```bash
cd mobile
npm start
```

Open the app and try:
- Sign up as customer
- Create a repair order
- View services

---

## 📊 Database Structure

### Tables Created:
- ✅ **users** - Customer and technician profiles
- ✅ **services** - Repair services catalog
- ✅ **orders** - Repair requests and bookings
- ✅ **technicians** - Technician profiles and ratings
- ✅ **reviews** - Customer reviews and ratings

### Default Data:
- 8 pre-loaded services (screen repair, battery, etc.)
- Ready for production use

---

## 🔐 Security (Row Level Security)

All tables have RLS enabled:
- Users can only see/edit their own data
- Services are public (read-only)
- Orders are private to user and assigned technician
- Technicians can update their own profile

---

## 💾 Free Tier Limits

**Supabase Free Forever:**
- ✅ 500 MB database
- ✅ 1 GB file storage
- ✅ 2 GB bandwidth/month
- ✅ 50,000 monthly active users
- ✅ Unlimited API requests

**Perfect for:**
- MVP and testing
- Small to medium apps
- ~1000-5000 active users

---

## 🔧 Common Issues

### "Invalid API key"
- Double-check you copied the **anon** key (not service_role)
- Make sure no extra spaces in the key

### "relation does not exist"
- Run the SQL schema again
- Check SQL Editor for error messages

### "Row Level Security policy violation"
- Make sure user is authenticated
- Check if policies are enabled (they should be)

---

## 📱 Features Enabled

### Authentication:
- ✅ Email/Password signup and login
- ✅ Session persistence (stays logged in)
- ✅ Password reset (via email)
- ✅ Guest mode (no database)

### Real-time:
- ✅ Live order updates
- ✅ Technician availability changes
- ✅ New service notifications

### Storage:
- ✅ User avatars
- ✅ Order images (before/after)
- ✅ Public CDN URLs

---

## 🚀 Going Live

When ready for production:

1. **Custom Domain** (optional):
   - Settings → API → Custom Domain
   - Add your domain (e.g., api.fixate.com)

2. **Email Templates**:
   - Authentication → Email Templates
   - Customize signup/reset emails

3. **Backup**:
   - Database → Backups
   - Enable daily backups (free)

4. **Monitoring**:
   - Database → Logs
   - Check API usage and errors

---

## 📚 Resources

- [Supabase Docs](https://supabase.com/docs)
- [React Native Guide](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

---

## 💡 Next Steps

After setup:
1. Test signup/login flow
2. Create test orders
3. Add more services (SQL Editor)
4. Customize email templates
5. Deploy to App Store/Play Store

---

**Need help?** Check Supabase Discord or docs!
