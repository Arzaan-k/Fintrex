-- Migration: Add WhatsApp integration fields to profiles table
-- This migration adds the necessary fields for WhatsApp Business integration

-- Add whatsapp_number column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'whatsapp_number'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN whatsapp_number TEXT;
    COMMENT ON COLUMN public.profiles.whatsapp_number IS 'WhatsApp Business phone number used to receive documents from clients (+91XXXXXXXXXX format)';
  END IF;
END $$;

-- Add whatsapp_api_key column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'whatsapp_api_key'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN whatsapp_api_key TEXT;
    COMMENT ON COLUMN public.profiles.whatsapp_api_key IS 'WhatsApp Business API access token (stored encrypted)';
  END IF;
END $$;

-- Add firm_name column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'firm_name'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN firm_name TEXT;
    COMMENT ON COLUMN public.profiles.firm_name IS 'Name of the accounting firm';
  END IF;
END $$;

-- Add settings column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'settings'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN settings JSONB DEFAULT '{}'::jsonb;
    COMMENT ON COLUMN public.profiles.settings IS 'User preferences and configuration (JSONB format)';
  END IF;
END $$;

-- Create index on whatsapp_number for fast lookups
CREATE INDEX IF NOT EXISTS idx_profiles_whatsapp_number
ON public.profiles(whatsapp_number)
WHERE whatsapp_number IS NOT NULL;

-- Create index on settings for JSONB queries
CREATE INDEX IF NOT EXISTS idx_profiles_settings
ON public.profiles USING GIN(settings);

-- Verify the changes
DO $$
DECLARE
  has_whatsapp_number BOOLEAN;
  has_whatsapp_api_key BOOLEAN;
  has_firm_name BOOLEAN;
  has_settings BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'whatsapp_number'
  ) INTO has_whatsapp_number;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'whatsapp_api_key'
  ) INTO has_whatsapp_api_key;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'firm_name'
  ) INTO has_firm_name;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'settings'
  ) INTO has_settings;

  RAISE NOTICE '✅ Migration completed successfully!';
  RAISE NOTICE '   - whatsapp_number: %', CASE WHEN has_whatsapp_number THEN '✅ Added' ELSE '❌ Failed' END;
  RAISE NOTICE '   - whatsapp_api_key: %', CASE WHEN has_whatsapp_api_key THEN '✅ Added' ELSE '❌ Failed' END;
  RAISE NOTICE '   - firm_name: %', CASE WHEN has_firm_name THEN '✅ Added' ELSE '❌ Failed' END;
  RAISE NOTICE '   - settings: %', CASE WHEN has_settings THEN '✅ Added' ELSE '❌ Failed' END;
END $$;
