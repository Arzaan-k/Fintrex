-- Debug Account Registration Issue for +917021307474
-- Run these queries to identify the problem

-- 1. Check if the client exists with any phone number variant
SELECT
  id,
  business_name,
  contact_person,
  phone_number,
  status,
  accountant_id,
  created_at
FROM clients
WHERE
  phone_number LIKE '%7021307474%'
  OR phone_number = '+917021307474'
  OR phone_number = '917021307474'
  OR phone_number = '7021307474'
  OR phone_number = '07021307474';

-- 2. Check all client statuses (to see what status your client has)
SELECT
  status,
  COUNT(*) as count
FROM clients
GROUP BY status;

-- 3. Check if there's an active client with this phone
SELECT
  id,
  business_name,
  contact_person,
  phone_number,
  status,
  accountant_id
FROM clients
WHERE phone_number = '+917021307474' AND status = 'active';

-- 4. Check if there's a kyc_pending client with this phone
SELECT
  id,
  business_name,
  contact_person,
  phone_number,
  status,
  accountant_id
FROM clients
WHERE phone_number = '+917021307474' AND status = 'kyc_pending';

-- 5. Show all clients (limit 20) to see the data
SELECT
  id,
  business_name,
  contact_person,
  phone_number,
  status,
  accountant_id,
  created_at
FROM clients
ORDER BY created_at DESC
LIMIT 20;
