-- ============================================
-- COMPLETE FIX FOR ALL CLIENTS - RUN THIS ONCE
-- ============================================
-- This script will:
-- 1. Set your WhatsApp number on your profile
-- 2. Fix ALL existing client phone numbers
-- 3. Create a trigger to auto-format future phone numbers
-- 4. Fix RLS policies for edit/delete
-- ============================================

-- ============================================
-- STEP 1: CONFIGURE YOUR PROFILE
-- ============================================
-- IMPORTANT: Change these values to YOUR actual values!

-- First, check your current profile
SELECT
  id,
  email,
  full_name,
  whatsapp_number,
  '👆 Copy your email and replace below' as note
FROM profiles
ORDER BY created_at DESC
LIMIT 5;

-- UPDATE THIS: Set your WhatsApp Business number
-- Replace the email and phone number with YOUR values
UPDATE profiles
SET whatsapp_number = '+919876543210'  -- ← CHANGE THIS to your WhatsApp Business number
WHERE email = 'your-email@example.com';  -- ← CHANGE THIS to your email

-- Verify it worked (should show UPDATE 1)
SELECT id, email, full_name, whatsapp_number
FROM profiles
WHERE whatsapp_number IS NOT NULL;


-- ============================================
-- STEP 2: CREATE PHONE NORMALIZATION FUNCTION
-- ============================================
-- This function will be used to auto-format ALL phone numbers

CREATE OR REPLACE FUNCTION normalize_phone_number(phone TEXT)
RETURNS TEXT AS $$
DECLARE
  cleaned TEXT;
BEGIN
  -- Remove all spaces, dashes, parentheses
  cleaned := regexp_replace(phone, '[\s\-\(\)]', '', 'g');

  -- If it starts with +91, keep it as is
  IF cleaned ~ '^\+91\d{10}$' THEN
    RETURN cleaned;
  END IF;

  -- If it starts with 91 (no +) and has 12 digits, add +
  IF cleaned ~ '^91\d{10}$' THEN
    RETURN '+' || cleaned;
  END IF;

  -- If it's exactly 10 digits, add +91
  IF cleaned ~ '^\d{10}$' THEN
    RETURN '+91' || cleaned;
  END IF;

  -- If it starts with 0 and has 11 digits, remove 0 and add +91
  IF cleaned ~ '^0\d{10}$' THEN
    RETURN '+91' || substring(cleaned, 2);
  END IF;

  -- Return as is if no pattern matches
  RETURN cleaned;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- STEP 3: FIX ALL EXISTING CLIENT PHONE NUMBERS
-- ============================================

-- Preview what will be updated
SELECT
  id,
  client_name,
  business_name,
  phone_number as current_phone,
  normalize_phone_number(phone_number) as new_phone,
  CASE
    WHEN phone_number = normalize_phone_number(phone_number) THEN '✅ Already correct'
    ELSE '⚠️ Will be updated'
  END as status
FROM clients
ORDER BY created_at DESC;

-- Actually update ALL client phone numbers
UPDATE clients
SET phone_number = normalize_phone_number(phone_number)
WHERE phone_number != normalize_phone_number(phone_number);

-- Show results
SELECT
  COUNT(*) as total_clients,
  COUNT(*) FILTER (WHERE phone_number LIKE '+91%') as correct_format,
  COUNT(*) FILTER (WHERE phone_number NOT LIKE '+91%') as needs_fixing
FROM clients;


-- ============================================
-- STEP 4: CREATE TRIGGER FOR AUTO-FORMATTING
-- ============================================
-- This ensures ALL future phone numbers are auto-formatted

-- Create trigger function
CREATE OR REPLACE FUNCTION trigger_normalize_phone_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-format phone number before insert or update
  IF NEW.phone_number IS NOT NULL THEN
    NEW.phone_number := normalize_phone_number(NEW.phone_number);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS normalize_phone_on_insert_update ON clients;

-- Create trigger for INSERT and UPDATE
CREATE TRIGGER normalize_phone_on_insert_update
  BEFORE INSERT OR UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION trigger_normalize_phone_number();


-- ============================================
-- STEP 5: FIX RLS POLICIES
-- ============================================
-- Enable proper permissions for accountants

-- Enable RLS on clients table
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "accountants_own_clients" ON clients;
DROP POLICY IF EXISTS "accountants_select_own_clients" ON clients;
DROP POLICY IF EXISTS "accountants_insert_own_clients" ON clients;
DROP POLICY IF EXISTS "accountants_update_own_clients" ON clients;
DROP POLICY IF EXISTS "accountants_delete_own_clients" ON clients;

-- Create SELECT policy
CREATE POLICY "accountants_select_own_clients" ON clients
  FOR SELECT
  USING (accountant_id = auth.uid());

-- Create INSERT policy
CREATE POLICY "accountants_insert_own_clients" ON clients
  FOR INSERT
  WITH CHECK (accountant_id = auth.uid());

-- Create UPDATE policy
CREATE POLICY "accountants_update_own_clients" ON clients
  FOR UPDATE
  USING (accountant_id = auth.uid())
  WITH CHECK (accountant_id = auth.uid());

-- Create DELETE policy
CREATE POLICY "accountants_delete_own_clients" ON clients
  FOR DELETE
  USING (accountant_id = auth.uid());


-- ============================================
-- STEP 6: VERIFY EVERYTHING
-- ============================================

-- Check 1: Profile has WhatsApp number
SELECT
  '✅ Profile Check' as test,
  CASE
    WHEN COUNT(*) > 0 THEN 'PASS - WhatsApp number is set'
    ELSE 'FAIL - Go back to Step 1!'
  END as result
FROM profiles
WHERE whatsapp_number IS NOT NULL;

-- Check 2: All clients have correct phone format
SELECT
  '✅ Phone Format Check' as test,
  COUNT(*) as total_clients,
  COUNT(*) FILTER (WHERE phone_number LIKE '+91%') as correct_format,
  CASE
    WHEN COUNT(*) = COUNT(*) FILTER (WHERE phone_number LIKE '+91%') THEN 'PASS - All phones formatted'
    ELSE 'FAIL - Some phones not formatted'
  END as result
FROM clients;

-- Check 3: Trigger exists
SELECT
  '✅ Trigger Check' as test,
  CASE
    WHEN COUNT(*) > 0 THEN 'PASS - Auto-format trigger is active'
    ELSE 'FAIL - Trigger not created'
  END as result
FROM pg_trigger
WHERE tgname = 'normalize_phone_on_insert_update';

-- Check 4: RLS policies exist
SELECT
  '✅ RLS Policies Check' as test,
  COUNT(*) as policy_count,
  CASE
    WHEN COUNT(*) >= 4 THEN 'PASS - All policies created'
    ELSE 'FAIL - Missing policies'
  END as result
FROM pg_policies
WHERE tablename = 'clients';

-- Check 5: WhatsApp will work
SELECT
  '✅ WhatsApp Integration Check' as test,
  c.client_name,
  c.phone_number,
  p.full_name as accountant,
  p.whatsapp_number,
  CASE
    WHEN p.whatsapp_number IS NOT NULL AND c.phone_number LIKE '+91%'
    THEN 'PASS - WhatsApp should work!'
    ELSE 'FAIL - Something is wrong'
  END as result
FROM clients c
JOIN profiles p ON c.accountant_id = p.id
ORDER BY c.created_at DESC
LIMIT 5;


-- ============================================
-- STEP 7: TEST THE AUTO-FORMATTING
-- ============================================

-- Test: Try inserting a client with wrong phone format
-- The trigger should auto-format it to +91XXXXXXXXXX
/*
INSERT INTO clients (
  client_name,
  business_name,
  contact_person,
  phone_number,
  accountant_id
) VALUES (
  'Test Auto Format',
  'Test Business',
  'Test Contact',
  '9876543210',  -- Wrong format (no +91)
  (SELECT id FROM profiles WHERE whatsapp_number IS NOT NULL LIMIT 1)
) RETURNING
  client_name,
  phone_number,
  'Should be +919876543210' as expected;

-- Clean up test
DELETE FROM clients WHERE client_name = 'Test Auto Format';
*/


-- ============================================
-- FINAL SUMMARY
-- ============================================

SELECT
  '🎉 SETUP COMPLETE!' as status,
  '' as blank_line,
  'Next Steps:' as instructions,
  '1. Send "hi" to your WhatsApp Business number' as step_1,
  '2. Check logs - should see ✅ Matched to existing client' as step_2,
  '3. Try editing a client - should save successfully' as step_3,
  '4. Add new clients - phone numbers auto-format to +91' as step_4;


-- ============================================
-- TROUBLESHOOTING
-- ============================================

-- If WhatsApp still doesn't work, run this:
/*
SELECT
  'Debugging WhatsApp Issue' as debug,
  c.client_name,
  c.phone_number as client_phone,
  p.full_name as accountant,
  p.whatsapp_number as business_whatsapp,
  CASE
    WHEN p.whatsapp_number IS NULL THEN 'ERROR: Profile has no WhatsApp number'
    WHEN c.phone_number NOT LIKE '+91%' THEN 'ERROR: Client phone wrong format'
    ELSE 'OK: Should work'
  END as diagnosis
FROM clients c
LEFT JOIN profiles p ON c.accountant_id = p.id
WHERE c.phone_number LIKE '%7021307474%';
*/
