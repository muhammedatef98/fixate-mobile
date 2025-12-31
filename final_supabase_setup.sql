-- ==========================================
-- Fixate - Comprehensive Supabase Setup
-- ==========================================
-- This script sets up all necessary tables, RLS policies, and triggers.
-- Run this in the Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- 1. Enable Necessary Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Profiles Table (Syncs with Auth.Users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('customer', 'technician')),
  city TEXT,
  push_token TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Services Table
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  icon TEXT,
  price_range TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create Technicians Table (Detailed Info)
CREATE TABLE IF NOT EXISTS technicians (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  specialization TEXT[] NOT NULL DEFAULT '{}',
  rating DECIMAL(3, 2) DEFAULT 5.0,
  total_jobs INTEGER DEFAULT 0,
  available BOOLEAN DEFAULT true,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id),
  technician_id UUID REFERENCES profiles(id),
  device_brand TEXT NOT NULL,
  device_model TEXT NOT NULL,
  issue_description TEXT,
  estimated_price DECIMAL(10, 2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'accepted', 'picking_up', 'diagnosing', 'repairing', 'delivering', 'completed', 'cancelled')),
  scheduled_date TIMESTAMP WITH TIME ZONE,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  service_type TEXT DEFAULT 'mobile',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create Messages Table (Chat)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_read BOOLEAN DEFAULT false
);

-- 7. Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies

-- Profiles
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Services
CREATE POLICY "Services are viewable by everyone" ON services FOR SELECT USING (true);

-- Technicians
CREATE POLICY "Technicians are viewable by everyone" ON technicians FOR SELECT USING (true);
CREATE POLICY "Technicians can update own record" ON technicians FOR UPDATE USING (auth.uid() = user_id);

-- Orders
CREATE POLICY "Users can view their own orders" ON orders FOR SELECT USING (auth.uid() = user_id OR auth.uid() = technician_id);
CREATE POLICY "Customers can create orders" ON orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Involved parties can update orders" ON orders FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = technician_id);

-- Messages
CREATE POLICY "Users can view messages for their orders" ON messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = messages.order_id
    AND (orders.user_id = auth.uid() OR orders.technician_id = auth.uid())
  )
);
CREATE POLICY "Users can send messages for their orders" ON messages FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = messages.order_id
    AND (orders.user_id = auth.uid() OR orders.technician_id = auth.uid())
  )
  AND auth.uid() = sender_id
);

-- 9. Insert Default Services
INSERT INTO services (name, description, category, icon, price_range) VALUES
  ('Screen Replacement', 'Professional screen repair for all devices', 'phones', 'smartphone', '200-500 SAR'),
  ('Battery Replacement', 'Replace old or damaged batteries', 'phones', 'battery-charging', '150-300 SAR'),
  ('Camera Repair', 'Fix camera issues and replacements', 'phones', 'camera', '250-400 SAR'),
  ('Laptop Screen Repair', 'Laptop display repair and replacement', 'laptops', 'laptop', '400-800 SAR'),
  ('Laptop Keyboard Repair', 'Keyboard replacement and repair', 'laptops', 'keyboard', '200-500 SAR'),
  ('Tablet Screen Repair', 'Tablet display repair services', 'tablets', 'tablet', '300-600 SAR'),
  ('Smart Watch Repair', 'Smart watch screen and battery repair', 'watches', 'watch', '150-400 SAR')
ON CONFLICT DO NOTHING;

-- 10. Trigger for Automatic Profile Creation (Optional but recommended)
-- This ensures a profile is created whenever a new user signs up via Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, city, phone)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', 'User'),
    COALESCE(new.raw_user_meta_data->>'role', 'customer'),
    new.raw_user_meta_data->>'city',
    new.raw_user_meta_data->>'phone'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Uncomment the following line to enable the trigger
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
