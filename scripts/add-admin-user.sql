-- Script to add admin role to a user
-- This script should be run after the first user registers in the app

-- Step 1: Find your user ID
-- Run this query to get your user ID:
SELECT id, email, name FROM users WHERE email = 'your-email@example.com';

-- Step 2: Add admin role
-- Replace 'YOUR_USER_ID_HERE' with the actual user ID from step 1
INSERT INTO user_roles (user_id, role)
VALUES ('YOUR_USER_ID_HERE', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Step 3: Verify admin role was added
SELECT u.id, u.email, u.name, ur.role
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
WHERE ur.role = 'admin';

-- Example usage:
-- 1. Register a user in the app
-- 2. Run the SELECT query to get the user ID
-- 3. Replace 'YOUR_USER_ID_HERE' with the actual ID
-- 4. Run the INSERT query
-- 5. Run the verification query to confirm
