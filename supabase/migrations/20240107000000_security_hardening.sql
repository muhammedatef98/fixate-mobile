-- Security hardening: missing RLS policies and constraints
-- Run after supabase-schema.sql and create_messages_table.sql

-- ============================================================
-- USERS: allow self-INSERT (so signUp can create profile row)
-- ============================================================
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- ORDERS: prevent technician from grabbing others' orders
-- ============================================================
DROP POLICY IF EXISTS "Technicians update only assigned orders" ON orders;
CREATE POLICY "Technicians update only assigned orders"
  ON orders FOR UPDATE
  USING (
    auth.uid() = user_id
    OR auth.uid() = technician_id
    OR (technician_id IS NULL AND status = 'pending')
  )
  WITH CHECK (
    auth.uid() = user_id
    OR auth.uid() = technician_id
  );

-- Only the customer (owner) can soft-delete / cancel via DELETE
DROP POLICY IF EXISTS "Users can delete own pending orders" ON orders;
CREATE POLICY "Users can delete own pending orders"
  ON orders FOR DELETE
  USING (auth.uid() = user_id AND status = 'pending');

-- ============================================================
-- TECHNICIANS: allow self-INSERT for new technician profile
-- ============================================================
DROP POLICY IF EXISTS "Users can create own technician profile" ON technicians;
CREATE POLICY "Users can create own technician profile"
  ON technicians FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- REVIEWS: allow update/delete own reviews + prevent duplicates
-- ============================================================
DROP POLICY IF EXISTS "Users can update own reviews" ON reviews;
CREATE POLICY "Users can update own reviews"
  ON reviews FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own reviews" ON reviews;
CREATE POLICY "Users can delete own reviews"
  ON reviews FOR DELETE
  USING (auth.uid() = user_id);

-- One review per order per user
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reviews_unique_user_order'
  ) THEN
    ALTER TABLE reviews
      ADD CONSTRAINT reviews_unique_user_order UNIQUE (user_id, order_id);
  END IF;
END$$;

-- ============================================================
-- MESSAGES: only sender can update/delete own messages
-- ============================================================
DROP POLICY IF EXISTS "Users can update own messages" ON messages;
CREATE POLICY "Users can update own messages"
  ON messages FOR UPDATE
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can delete own messages" ON messages;
CREATE POLICY "Users can delete own messages"
  ON messages FOR DELETE
  USING (auth.uid() = sender_id);

-- ============================================================
-- ORDER STATUS CHECK CONSTRAINT (replace old confirmed/in_progress)
-- ============================================================
DO $$
BEGIN
  ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
  ALTER TABLE orders ADD CONSTRAINT orders_status_check
    CHECK (status IN (
      'pending', 'accepted', 'picking_up', 'diagnosing',
      'repairing', 'delivering', 'completed', 'cancelled'
    ));
END$$;
