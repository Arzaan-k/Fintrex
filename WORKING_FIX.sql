-- ============================================
-- WORKING FIX - Updated for Actual Table Structure
-- ============================================

-- STEP 1: Check what columns exist in profiles table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- STEP 2: See your current profile data
SELECT * FROM profiles LIMIT 5;

-- STEP 3: Find your profile ID
-- Replace with method that works for your table structure
SELECT
  id,
  full_name,
  firm_name,
  whatsapp_number,
  created_at
FROM profiles
ORDER BY created_at DESC
LIMIT 5;

-- STEP 4: Set your WhatsApp Business number
-- Replace 'YOUR-PROFILE-ID-FROM-STEP-3' with actual ID
-- Replace '+919876543210' with YOUR WhatsApp Business number
UPDATE profiles
SET whatsapp_number = '+919876543210'  -- ← CHANGE THIS to your business number
WHERE id = 'YOUR-PROFILE-ID-FROM-STEP-3';  -- ← CHANGE THIS to your profile ID

-- STEP 5: Verify it worked
SELECT
  id,
  full_name,
  firm_name,
  whatsapp_number,
  CASE
    WHEN whatsapp_number IS NOT NULL THEN '✅ WhatsApp number is set!'
    ELSE '❌ Still NULL - update failed'
  END as status
FROM profiles
WHERE whatsapp_number IS NOT NULL;

-- STEP 6: Check your clients
SELECT
  id,
  client_name,
  business_name,
  phone_number,
  accountant_id
FROM clients
ORDER BY created_at DESC
LIMIT 10;

-- STEP 7: Create phone normalization function
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

-- STEP 8: Fix ALL existing client phone numbers
UPDATE clients
SET phone_number = normalize_phone_number(phone_number)
WHERE phone_number != normalize_phone_number(phone_number);

-- Show how many were updated
SELECT
  'Phone Update Result' as info,
  COUNT(*) as total_clients,
  COUNT(*) FILTER (WHERE phone_number LIKE '+91%') as correctly_formatted,
  COUNT(*) FILTER (WHERE phone_number NOT LIKE '+91%') as still_wrong
FROM clients;

-- STEP 9: Create trigger for future clients
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

-- STEP 10: Fix RLS policies
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "accountants_update_own_clients" ON clients;
CREATE POLICY "accountants_update_own_clients" ON clients
  FOR UPDATE
  USING (accountant_id = auth.uid())
  WITH CHECK (accountant_id = auth.uid());

DROP POLICY IF EXISTS "accountants_delete_own_clients" ON clients;
CREATE POLICY "accountants_delete_own_clients" ON clients
  FOR DELETE
  USING (accountant_id = auth.uid());

-- STEP 11: Final verification
SELECT
  '✅ FINAL CHECK' as test,
  c.client_name,
  c.phone_number,
  c.accountant_id,
  p.full_name as accountant,
  p.whatsapp_number,
  CASE
    WHEN p.whatsapp_number IS NOT NULL
     AND c.phone_number LIKE '+91%'
     AND c.accountant_id = p.id
    THEN '✅ READY - WhatsApp should work!'
    ELSE '❌ PROBLEM - Check values above'
  END as status
FROM clients c
JOIN profiles p ON c.accountant_id = p.id
ORDER BY c.created_at DESC
LIMIT 5;

-- ============================================
-- QUICK REFERENCE
-- ============================================

-- To find your profile ID (use one of these based on your table):
-- SELECT id, full_name FROM profiles WHERE full_name LIKE '%Your Name%';
-- SELECT id, firm_name FROM profiles WHERE firm_name LIKE '%Your Firm%';
-- SELECT id FROM profiles ORDER BY created_at DESC LIMIT 1;  -- If you're the only/newest user

-- After finding your profile ID, use it in STEP 4 above
