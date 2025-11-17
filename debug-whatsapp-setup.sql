-- Debug WhatsApp Client Identification Setup
-- Run these queries to verify your WhatsApp integration is configured correctly

-- 1. Check if accountant has WhatsApp number configured
SELECT
  id,
  full_name,
  firm_name,
  email,
  whatsapp_number,
  created_at
FROM profiles
WHERE whatsapp_number IS NOT NULL
ORDER BY created_at DESC;

-- 2. Check all clients for a specific accountant
-- Replace 'YOUR_ACCOUNTANT_ID' with actual accountant UUID
-- SELECT
--   id,
--   business_name,
--   contact_person,
--   phone_number,
--   email,
--   status,
--   created_at
-- FROM clients
-- WHERE accountant_id = 'YOUR_ACCOUNTANT_ID'
-- ORDER BY created_at DESC;

-- 3. Check clients with phone numbers
SELECT
  c.id,
  c.business_name,
  c.contact_person,
  c.phone_number,
  c.email,
  c.status,
  p.full_name as accountant_name,
  p.whatsapp_number as accountant_whatsapp,
  c.created_at
FROM clients c
JOIN profiles p ON c.accountant_id = p.id
WHERE c.phone_number IS NOT NULL
ORDER BY c.created_at DESC;

-- 4. Test phone number matching for a specific phone
-- Replace '+919876543210' with the phone number you want to test
-- This shows all possible matches
-- SELECT
--   c.id,
--   c.business_name,
--   c.contact_person,
--   c.phone_number,
--   c.accountant_id,
--   p.full_name as accountant_name,
--   p.whatsapp_number
-- FROM clients c
-- JOIN profiles p ON c.accountant_id = p.id
-- WHERE c.phone_number IN (
--   '+919876543210',
--   '919876543210',
--   '9876543210',
--   '09876543210'
-- );

-- 5. Check recent documents uploaded via WhatsApp
SELECT
  d.id,
  d.file_name,
  d.upload_source,
  d.status,
  d.created_at,
  c.business_name as client_name,
  c.phone_number as client_phone,
  p.full_name as accountant_name
FROM documents d
JOIN clients c ON d.client_id = c.id
JOIN profiles p ON c.accountant_id = p.id
WHERE d.upload_source = 'whatsapp'
ORDER BY d.created_at DESC
LIMIT 20;

-- 6. Check for duplicate phone numbers (should be empty for clean data)
SELECT
  phone_number,
  COUNT(*) as count,
  STRING_AGG(business_name, ', ') as clients
FROM clients
WHERE phone_number IS NOT NULL
GROUP BY phone_number
HAVING COUNT(*) > 1;

-- 7. Verify client count per accountant
SELECT
  p.full_name,
  p.firm_name,
  p.whatsapp_number,
  COUNT(c.id) as client_count
FROM profiles p
LEFT JOIN clients c ON c.accountant_id = p.id
WHERE p.whatsapp_number IS NOT NULL
GROUP BY p.id, p.full_name, p.firm_name, p.whatsapp_number
ORDER BY client_count DESC;
