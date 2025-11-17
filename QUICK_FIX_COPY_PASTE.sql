-- ============================================
-- QUICK FIX - COPY AND PASTE THIS
-- ============================================
-- Replace the placeholder values, then run all at once
-- ============================================

-- STEP 1: FIND YOUR INFO
-- Run this first to see your profile and clients
SELECT
  '=== YOUR PROFILE ===' as section,
  id as profile_id,
  email,
  full_name,
  whatsapp_number as current_whatsapp_number
FROM profiles
ORDER BY created_at DESC
LIMIT 5;

SELECT
  '=== YOUR CLIENTS ===' as section,
  id as client_id,
  client_name,
  business_name,
  phone_number as current_phone,
  accountant_id
FROM clients
ORDER BY created_at DESC
LIMIT 10;


-- ============================================
-- STEP 2: UPDATE YOUR VALUES
-- ============================================
-- Replace these placeholders with your actual values:
--   YOUR_EMAIL_HERE → your actual email from Step 1
--   YOUR_WHATSAPP_BUSINESS_NUMBER → from Facebook Developer Console
--   (Example: +919876543210)

-- Set your WhatsApp Business number
UPDATE profiles
SET whatsapp_number = 'YOUR_WHATSAPP_BUSINESS_NUMBER'  -- ← CHANGE THIS
WHERE email = 'YOUR_EMAIL_HERE';  -- ← CHANGE THIS


-- ============================================
-- STEP 3: FIX ALL CLIENT PHONE NUMBERS
-- ============================================

-- Create the normalize function
CREATE OR REPLACE FUNCTION normalize_phone_number(phone TEXT)
RETURNS TEXT AS $$
DECLARE
  cleaned TEXT;
BEGIN
  cleaned := regexp_replace(phone, '[\s\-\(\)]', '', 'g');
  IF cleaned ~ '^\+91\d{10}$' THEN RETURN cleaned; END IF;
  IF cleaned ~ '^91\d{10}$' THEN RETURN '+' || cleaned; END IF;
  IF cleaned ~ '^\d{10}$' THEN RETURN '+91' || cleaned; END IF;
  IF cleaned ~ '^0\d{10}$' THEN RETURN '+91' || substring(cleaned, 2); END IF;
  RETURN cleaned;
END;
$$ LANGUAGE plpgsql;

-- Update all existing clients
UPDATE clients
SET phone_number = normalize_phone_number(phone_number)
WHERE phone_number != normalize_phone_number(phone_number);

-- Create trigger for future clients
CREATE OR REPLACE FUNCTION trigger_normalize_phone_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.phone_number IS NOT NULL THEN
    NEW.phone_number := normalize_phone_number(NEW.phone_number);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS normalize_phone_on_insert_update ON clients;
CREATE TRIGGER normalize_phone_on_insert_update
  BEFORE INSERT OR UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION trigger_normalize_phone_number();


-- ============================================
-- STEP 4: VERIFY IT WORKED
-- ============================================

-- Check your profile
SELECT
  '✅ PROFILE CHECK' as test,
  email,
  full_name,
  whatsapp_number,
  CASE
    WHEN whatsapp_number IS NOT NULL THEN 'PASS ✅'
    ELSE 'FAIL ❌ - WhatsApp number not set!'
  END as result
FROM profiles
WHERE email = 'YOUR_EMAIL_HERE';  -- ← Same email as Step 2

-- Check your clients
SELECT
  '✅ CLIENTS CHECK' as test,
  COUNT(*) as total_clients,
  COUNT(*) FILTER (WHERE phone_number LIKE '+91%') as correctly_formatted,
  CASE
    WHEN COUNT(*) = COUNT(*) FILTER (WHERE phone_number LIKE '+91%')
    THEN 'PASS ✅ - All phones formatted correctly'
    ELSE 'FAIL ❌ - Some phones not formatted'
  END as result
FROM clients;

-- Check WhatsApp will work
SELECT
  '✅ WHATSAPP READY CHECK' as test,
  c.client_name,
  c.phone_number,
  p.full_name as accountant,
  p.whatsapp_number,
  CASE
    WHEN p.whatsapp_number IS NOT NULL
     AND c.phone_number LIKE '+91%'
     AND c.accountant_id = p.id
    THEN 'PASS ✅ - WhatsApp should work!'
    ELSE 'FAIL ❌ - Still broken'
  END as result
FROM clients c
JOIN profiles p ON c.accountant_id = p.id
ORDER BY c.created_at DESC
LIMIT 5;


-- ============================================
-- EXAMPLE WITH REAL VALUES
-- ============================================
-- Here's an example of Step 2 filled in correctly:

/*
UPDATE profiles
SET whatsapp_number = '+919876543210'
WHERE email = 'john@example.com';
*/

-- After running, all checks should show PASS ✅
-- Then send "hi" from your client's phone to test!
