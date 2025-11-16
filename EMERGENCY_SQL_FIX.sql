-- EMERGENCY FIX: WhatsApp Client Matching
-- Run these queries ONE BY ONE in Supabase SQL Editor
-- Copy the output of each query and check the results

-- ============================================
-- STEP 1: CHECK CURRENT STATE
-- ============================================

-- 1.1 Check if your profile has WhatsApp number set
SELECT
  id,
  email,
  full_name,
  whatsapp_number,
  CASE
    WHEN whatsapp_number IS NULL THEN '❌ NOT SET - THIS IS THE PROBLEM!'
    ELSE '✅ Set correctly'
  END as status
FROM profiles
ORDER BY created_at DESC
LIMIT 5;

-- EXPECTED: You should see your profile with whatsapp_number filled
-- IF NULL: This is why WhatsApp doesn't work! Continue to Step 2.


-- 1.2 Check your client record
SELECT
  id,
  client_name,
  business_name,
  phone_number,
  accountant_id,
  CASE
    WHEN phone_number LIKE '+917021307474' THEN '✅ Correct format'
    WHEN phone_number LIKE '%7021307474%' THEN '⚠️ Wrong format - needs +91 prefix'
    ELSE '❓ Different number'
  END as phone_status
FROM clients
WHERE phone_number LIKE '%7021307474%'
   OR phone LIKE '%7021307474%';

-- EXPECTED: Should show 1 client with phone_number = '+917021307474'
-- IF WRONG FORMAT: Continue to Step 2.


-- 1.3 Check if client is linked to accountant with WhatsApp number
SELECT
  c.id as client_id,
  c.client_name,
  c.phone_number as client_phone,
  c.accountant_id,
  p.full_name as accountant_name,
  p.whatsapp_number as accountant_whatsapp,
  CASE
    WHEN p.whatsapp_number IS NULL THEN '❌ ACCOUNTANT HAS NO WHATSAPP NUMBER'
    WHEN c.phone_number != '+917021307474' THEN '❌ CLIENT PHONE WRONG FORMAT'
    ELSE '✅ Should work!'
  END as status
FROM clients c
LEFT JOIN profiles p ON c.accountant_id = p.id
WHERE c.phone_number LIKE '%7021307474%'
   OR c.phone LIKE '%7021307474%';

-- EXPECTED: Should show ✅ Should work!
-- IF NOT: Follow Step 2 to fix.


-- ============================================
-- STEP 2: FIX THE ISSUES
-- ============================================

-- 2.1 Get your profile ID and email (copy this for next step)
SELECT id, email FROM profiles ORDER BY created_at DESC LIMIT 5;

-- 2.2 Set your WhatsApp Business number
-- REPLACE 'your-email@example.com' with your actual email from 2.1
-- REPLACE '+919876543210' with your actual WhatsApp Business phone number
UPDATE profiles
SET whatsapp_number = '+919876543210'  -- ← CHANGE THIS to your WhatsApp Business number
WHERE email = 'your-email@example.com';  -- ← CHANGE THIS to your email

-- After running, you should see: "UPDATE 1"
-- If you see "UPDATE 0", the email doesn't match. Check step 2.1 again.


-- 2.3 Fix client phone number format
-- This updates any client with this number to the correct WhatsApp format
UPDATE clients
SET phone_number = '+917021307474'
WHERE phone_number LIKE '%7021307474%'
  AND phone_number != '+917021307474';

-- After running, you should see: "UPDATE 1"


-- 2.4 Make sure client is linked to your profile
-- First, get your profile ID (if you haven't already)
SELECT id, email FROM profiles WHERE email = 'your-email@example.com';

-- Then update the client
-- REPLACE 'your-profile-id' with the ID from above
UPDATE clients
SET accountant_id = 'your-profile-id'  -- ← CHANGE THIS to your profile ID
WHERE phone_number = '+917021307474';


-- ============================================
-- STEP 3: VERIFY THE FIX
-- ============================================

-- 3.1 Final verification - should return 1 row with all data
SELECT
  '✅ READY FOR WHATSAPP' as status,
  c.id as client_id,
  c.client_name,
  c.business_name,
  c.phone_number as client_phone,
  p.full_name as accountant,
  p.whatsapp_number as business_whatsapp_number
FROM clients c
JOIN profiles p ON c.accountant_id = p.id
WHERE c.phone_number = '+917021307474'
  AND p.whatsapp_number IS NOT NULL;

-- EXPECTED: 1 row showing all your data
-- IF NO ROWS: Something is still wrong. Share the output with me.


-- ============================================
-- QUICK COPY-PASTE FIX (if you know your values)
-- ============================================

-- Replace these values and run all at once:
/*
-- Set your email here
DO $$
DECLARE
  v_email TEXT := 'your-email@example.com';  -- ← CHANGE THIS
  v_whatsapp TEXT := '+919876543210';        -- ← CHANGE THIS to your WhatsApp Business number
  v_profile_id UUID;
BEGIN
  -- Update profile
  UPDATE profiles
  SET whatsapp_number = v_whatsapp
  WHERE email = v_email
  RETURNING id INTO v_profile_id;

  -- Update client phone
  UPDATE clients
  SET phone_number = '+917021307474',
      accountant_id = v_profile_id
  WHERE phone_number LIKE '%7021307474%';

  -- Show result
  RAISE NOTICE 'Updated profile: % and client for accountant: %', v_email, v_profile_id;
END $$;

-- Verify
SELECT
  c.client_name,
  c.phone_number,
  p.full_name,
  p.whatsapp_number
FROM clients c
JOIN profiles p ON c.accountant_id = p.id
WHERE c.phone_number = '+917021307474';
*/
