-- DEBUG EDIT CLIENT ISSUE
-- Run these queries to find why edit is not working

-- ============================================
-- CHECK 1: Verify Row Level Security Policies
-- ============================================

-- Check if RLS is enabled on clients table
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'clients';

-- Check what policies exist
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'clients';

-- If RLS is blocking updates, you'll see policies here
-- Most common issue: UPDATE policy requires accountant_id = auth.uid()


-- ============================================
-- CHECK 2: Verify Client Data
-- ============================================

-- Get the client you're trying to edit
SELECT
  id,
  client_name,
  business_name,
  contact_person,
  phone_number,
  email,
  gst_number,
  pan_number,
  accountant_id,
  created_at,
  updated_at
FROM clients
WHERE phone_number LIKE '%7021307474%'
   OR business_name ILIKE '%test%'
ORDER BY created_at DESC
LIMIT 5;

-- Copy the client ID and accountant_id for next checks


-- ============================================
-- CHECK 3: Test Manual Update
-- ============================================

-- Try updating manually to see if it works
-- REPLACE 'client-id-here' with actual client ID from CHECK 2
UPDATE clients
SET
  business_name = 'TEST UPDATE ' || now()::text,
  updated_at = now()
WHERE id = 'client-id-here'
RETURNING *;

-- If this returns 0 rows: RLS is blocking the update
-- If this returns 1 row: The UI code has an issue


-- ============================================
-- CHECK 4: Verify Your User ID
-- ============================================

-- Get your current auth user ID
SELECT auth.uid() as current_user_id;

-- Check if it matches the accountant_id on the client
SELECT
  c.id,
  c.client_name,
  c.accountant_id,
  auth.uid() as current_user,
  CASE
    WHEN c.accountant_id = auth.uid() THEN '✅ Match - should work'
    ELSE '❌ Mismatch - RLS will block update'
  END as status
FROM clients c
WHERE c.phone_number LIKE '%7021307474%';


-- ============================================
-- FIX: Grant Update Permission
-- ============================================

-- If RLS is blocking, ensure this policy exists
-- (Run this if you're the admin)

DO $$
BEGIN
  -- Drop existing policy if it exists
  DROP POLICY IF EXISTS "accountants_update_own_clients" ON clients;

  -- Create new policy allowing accountants to update their own clients
  CREATE POLICY "accountants_update_own_clients" ON clients
    FOR UPDATE
    USING (accountant_id = auth.uid())
    WITH CHECK (accountant_id = auth.uid());

  RAISE NOTICE 'Policy created successfully';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error creating policy: %', SQLERRM;
END $$;


-- ============================================
-- CHECK 5: Test Update Again
-- ============================================

-- Try updating again with your user
-- REPLACE 'client-id-here' with actual client ID
UPDATE clients
SET
  business_name = 'Updated at ' || now()::text,
  contact_person = 'Test Person',
  updated_at = now()
WHERE id = 'client-id-here'
  AND accountant_id = auth.uid()
RETURNING
  id,
  business_name,
  contact_person,
  updated_at;

-- If this works: UI should also work now
-- If this fails: Share the error message


-- ============================================
-- COMPLETE FIX: Enable All Operations
-- ============================================

-- Run this to ensure clients table has proper RLS policies
DO $$
BEGIN
  -- Enable RLS
  ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

  -- Drop all existing policies
  DROP POLICY IF EXISTS "accountants_own_clients" ON clients;
  DROP POLICY IF EXISTS "accountants_select_own_clients" ON clients;
  DROP POLICY IF EXISTS "accountants_insert_own_clients" ON clients;
  DROP POLICY IF EXISTS "accountants_update_own_clients" ON clients;
  DROP POLICY IF EXISTS "accountants_delete_own_clients" ON clients;

  -- Create comprehensive policies

  -- SELECT policy
  CREATE POLICY "accountants_select_own_clients" ON clients
    FOR SELECT
    USING (accountant_id = auth.uid());

  -- INSERT policy
  CREATE POLICY "accountants_insert_own_clients" ON clients
    FOR INSERT
    WITH CHECK (accountant_id = auth.uid());

  -- UPDATE policy
  CREATE POLICY "accountants_update_own_clients" ON clients
    FOR UPDATE
    USING (accountant_id = auth.uid())
    WITH CHECK (accountant_id = auth.uid());

  -- DELETE policy
  CREATE POLICY "accountants_delete_own_clients" ON clients
    FOR DELETE
    USING (accountant_id = auth.uid());

  RAISE NOTICE 'All RLS policies created successfully';
END $$;

-- Verify policies were created
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'clients';
