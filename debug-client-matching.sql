-- Debug Client Matching Issue for WhatsApp Webhook
-- Phone number from WhatsApp: +917021307474

-- Step 1: Check if accountant profile has WhatsApp number set
SELECT
  id,
  full_name,
  firm_name,
  whatsapp_number,
  email
FROM profiles
WHERE whatsapp_number IS NOT NULL;

-- If no results, your accountant profile doesn't have whatsapp_number set!
-- This is likely the issue - the webhook needs to know which accountant owns this WhatsApp number

-- Step 2: Check all phone number variants for the client
SELECT
  id,
  client_name,
  phone_number,
  phone,
  email,
  accountant_id,
  status
FROM clients
WHERE
  phone_number IN ('+917021307474', '917021307474', '7021307474', '07021307474')
  OR phone IN ('+917021307474', '917021307474', '7021307474', '07021307474')
  OR phone_number LIKE '%7021307474%'
  OR phone LIKE '%7021307474%';

-- Step 3: See what phone format the client actually has
SELECT
  id,
  client_name,
  phone_number,
  phone,
  accountant_id
FROM clients
WHERE client_name ILIKE '%test%' OR client_name ILIKE '%whatsapp%'
ORDER BY created_at DESC
LIMIT 10;

-- Step 4: Check the exact client you created
SELECT
  id,
  client_name,
  phone_number,
  phone,
  accountant_id,
  status
FROM clients
ORDER BY created_at DESC
LIMIT 5;

-- SOLUTIONS:

-- Solution 1: Set WhatsApp number in accountant profile
-- Replace 'your-accountant-id' with your actual profile ID
-- Replace '+919876543210' with your WhatsApp Business number (with country code)
/*
UPDATE profiles
SET whatsapp_number = '+919876543210'
WHERE id = 'your-accountant-id';
*/

-- Solution 2: Update client phone number to match WhatsApp format
-- Replace 'client-id' with the actual client ID
-- Use the EXACT format WhatsApp sends: +917021307474
/*
UPDATE clients
SET phone_number = '+917021307474'
WHERE id = 'client-id';
*/

-- Solution 3: Check if client has the correct accountant_id
/*
UPDATE clients
SET accountant_id = 'your-accountant-id'
WHERE phone_number LIKE '%7021307474%';
*/
