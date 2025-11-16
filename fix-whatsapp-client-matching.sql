-- Fix WhatsApp Client Matching Issue
-- This script fixes the most common issues preventing WhatsApp webhook from finding clients

-- ============================================
-- STEP 1: Set WhatsApp Number on Accountant Profile
-- ============================================
-- IMPORTANT: Replace the values below with YOUR actual data

-- First, find your profile ID
-- Run this query and note your profile ID:
SELECT id, email, full_name, whatsapp_number
FROM profiles
WHERE email = 'your-email@example.com';  -- Replace with your actual email

-- Then, set your WhatsApp Business number
-- Replace 'your-profile-id' with the ID from above
-- Replace '+919876543210' with your actual WhatsApp Business number
UPDATE profiles
SET whatsapp_number = '+919876543210'  -- Your WhatsApp Business number (with +91)
WHERE id = 'your-profile-id';          -- Your profile ID from query above

-- Verify it's set correctly:
SELECT id, email, full_name, whatsapp_number
FROM profiles
WHERE whatsapp_number IS NOT NULL;


-- ============================================
-- STEP 2: Fix Client Phone Number Format
-- ============================================
-- WhatsApp sends phone numbers as: +917021307474
-- Your client record must match this format

-- Check current phone number format for the specific client
SELECT id, client_name, phone_number, phone, accountant_id
FROM clients
WHERE phone_number LIKE '%7021307474%' OR phone LIKE '%7021307474%';

-- Update the client phone number to WhatsApp format
-- Replace with the actual client ID from above
UPDATE clients
SET phone_number = '+917021307474'  -- Exact format WhatsApp sends
WHERE id = 'client-id-here';        -- Replace with actual client ID

-- OR update by searching for the phone number
UPDATE clients
SET phone_number = '+917021307474'
WHERE phone_number LIKE '%7021307474%';


-- ============================================
-- STEP 3: Verify Client Belongs to Correct Accountant
-- ============================================
-- The client must belong to the accountant who owns the WhatsApp Business number

-- Check the relationship
SELECT
  c.id as client_id,
  c.client_name,
  c.phone_number,
  c.accountant_id,
  p.full_name as accountant_name,
  p.whatsapp_number as accountant_whatsapp
FROM clients c
LEFT JOIN profiles p ON c.accountant_id = p.id
WHERE c.phone_number = '+917021307474';

-- If accountant_id is wrong or NULL, update it
UPDATE clients
SET accountant_id = 'correct-accountant-profile-id'  -- Replace with your profile ID
WHERE phone_number = '+917021307474';


-- ============================================
-- STEP 4: Verification Query
-- ============================================
-- This query should return exactly ONE row with all data filled in
-- If it doesn't, something is still misconfigured

SELECT
  c.id as client_id,
  c.client_name,
  c.phone_number as client_phone,
  c.accountant_id,
  p.id as profile_id,
  p.full_name as accountant_name,
  p.whatsapp_number as business_whatsapp
FROM clients c
JOIN profiles p ON c.accountant_id = p.id
WHERE c.phone_number = '+917021307474'
  AND p.whatsapp_number IS NOT NULL;

-- Expected result:
-- 1 row showing:
-- - client_id: UUID of the client
-- - client_name: The client's name
-- - client_phone: +917021307474
-- - accountant_id: Your profile UUID
-- - profile_id: Your profile UUID (same as accountant_id)
-- - accountant_name: Your name
-- - business_whatsapp: Your WhatsApp Business number


-- ============================================
-- STEP 5: Bulk Fix All Client Phone Numbers (Optional)
-- ============================================
-- If you have multiple clients with wrong phone formats, run this:

-- Preview what will be updated
SELECT
  id,
  client_name,
  phone_number as current_phone,
  CASE
    WHEN phone_number LIKE '+91%' THEN phone_number
    WHEN phone_number LIKE '91%' AND length(phone_number) = 12 THEN '+' || phone_number
    WHEN length(phone_number) = 10 THEN '+91' || phone_number
    WHEN phone_number LIKE '0%' AND length(phone_number) = 11 THEN '+91' || substring(phone_number, 2)
    ELSE phone_number
  END as new_phone
FROM clients
WHERE accountant_id = 'your-accountant-id';  -- Replace with your profile ID

-- Apply the bulk update (CAREFUL - review above first!)
/*
UPDATE clients
SET phone_number = CASE
    WHEN phone_number LIKE '+91%' THEN phone_number
    WHEN phone_number LIKE '91%' AND length(phone_number) = 12 THEN '+' || phone_number
    WHEN length(phone_number) = 10 THEN '+91' || phone_number
    WHEN phone_number LIKE '0%' AND length(phone_number) = 11 THEN '+91' || substring(phone_number, 2)
    ELSE phone_number
  END
WHERE accountant_id = 'your-accountant-id'
  AND phone_number NOT LIKE '+91%';
*/


-- ============================================
-- QUICK FIX TEMPLATE
-- ============================================
-- Copy this template and fill in your values:

/*
-- 1. Set your WhatsApp Business number on your profile
UPDATE profiles
SET whatsapp_number = '+91__________'  -- Your 10-digit WhatsApp Business number
WHERE email = '_______________@_____.com';

-- 2. Fix the client phone number
UPDATE clients
SET phone_number = '+91__________'  -- The exact number WhatsApp sends
WHERE id = '____________________________';  -- Client UUID

-- 3. Verify
SELECT
  c.client_name,
  c.phone_number,
  p.full_name as accountant,
  p.whatsapp_number
FROM clients c
JOIN profiles p ON c.accountant_id = p.id
WHERE c.phone_number = '+91__________';
*/


-- ============================================
-- TROUBLESHOOTING
-- ============================================

-- If you're still seeing "No client ID" in the logs:

-- 1. Check if accountant profile has WhatsApp number
SELECT COUNT(*) as profiles_with_whatsapp
FROM profiles
WHERE whatsapp_number IS NOT NULL;
-- Should be > 0

-- 2. Check if client exists with correct phone format
SELECT COUNT(*) as matching_clients
FROM clients
WHERE phone_number = '+917021307474';
-- Should be 1

-- 3. Check if client is linked to correct accountant
SELECT COUNT(*) as linked_clients
FROM clients c
JOIN profiles p ON c.accountant_id = p.id
WHERE c.phone_number = '+917021307474'
  AND p.whatsapp_number IS NOT NULL;
-- Should be 1

-- 4. Show all clients for debugging
SELECT
  c.id,
  c.client_name,
  c.phone_number,
  c.accountant_id,
  p.whatsapp_number as accountant_whatsapp_number
FROM clients c
LEFT JOIN profiles p ON c.accountant_id = p.id
ORDER BY c.created_at DESC
LIMIT 10;
