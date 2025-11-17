-- QUICK FIX: Add missing columns to profiles table
-- Run this in your Supabase SQL Editor to fix the "column does not exist" error

-- 1. Add whatsapp_number column
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;

-- 2. Add whatsapp_api_key column
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS whatsapp_api_key TEXT;

-- 3. Add firm_name column
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS firm_name TEXT;

-- 4. Add settings column
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_whatsapp_number
ON public.profiles(whatsapp_number)
WHERE whatsapp_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_settings
ON public.profiles USING GIN(settings);

-- 6. Add comments for documentation
COMMENT ON COLUMN public.profiles.whatsapp_number IS 'WhatsApp Business phone number (+91XXXXXXXXXX format)';
COMMENT ON COLUMN public.profiles.whatsapp_api_key IS 'WhatsApp Business API access token';
COMMENT ON COLUMN public.profiles.firm_name IS 'Name of the accounting firm';
COMMENT ON COLUMN public.profiles.settings IS 'User preferences and configuration';

-- 7. Verify the columns were added
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('whatsapp_number', 'whatsapp_api_key', 'firm_name', 'settings')
ORDER BY column_name;

-- 8. Show current profile structure
SELECT
  id,
  full_name,
  firm_name,
  whatsapp_number,
  created_at
FROM public.profiles
LIMIT 5;
