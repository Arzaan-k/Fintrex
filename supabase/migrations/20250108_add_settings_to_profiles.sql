-- Migration: Add settings column to profiles table for automation configuration
-- This enables accountants to store their WhatsApp, email, branding, and automation preferences

-- Add settings column to profiles table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'settings'
    ) THEN
        ALTER TABLE profiles ADD COLUMN settings JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Add whatsapp_number column for WhatsApp Business integration
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'whatsapp_number'
    ) THEN
        ALTER TABLE profiles ADD COLUMN whatsapp_number TEXT;
    END IF;
END $$;

-- Add additional profile fields
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'ca_registration_number'
    ) THEN
        ALTER TABLE profiles ADD COLUMN ca_registration_number TEXT;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'address'
    ) THEN
        ALTER TABLE profiles ADD COLUMN address TEXT;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'city'
    ) THEN
        ALTER TABLE profiles ADD COLUMN city TEXT;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'state'
    ) THEN
        ALTER TABLE profiles ADD COLUMN state TEXT;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'pincode'
    ) THEN
        ALTER TABLE profiles ADD COLUMN pincode TEXT;
    END IF;
END $$;

-- Create index on whatsapp_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_whatsapp_number ON profiles(whatsapp_number);

-- Create index on settings for JSONB queries
CREATE INDEX IF NOT EXISTS idx_profiles_settings ON profiles USING GIN(settings);

-- Add comments for documentation
COMMENT ON COLUMN profiles.settings IS 'JSONB field storing automation settings including email_config, branding, notifications, and automation preferences';
COMMENT ON COLUMN profiles.whatsapp_number IS 'WhatsApp Business number used to receive documents from clients';
COMMENT ON COLUMN profiles.ca_registration_number IS 'Chartered Accountant registration number';

-- Example settings structure (for documentation):
/*
{
  "email_config": {
    "enabled": true,
    "provider": "gmail",
    "smtp_host": "",
    "smtp_port": "587",
    "imap_host": "",
    "imap_port": "993"
  },
  "branding": {
    "logo_url": "https://...",
    "primary_color": "#3b82f6",
    "greeting_message": "Hello! Welcome to...",
    "acknowledgment_message": "Document received..."
  },
  "notifications": {
    "email_new_document": true,
    "email_processing_complete": true,
    "email_kyc_complete": true,
    "email_weekly_summary": true,
    "whatsapp_enabled": false
  },
  "automation": {
    "auto_process_documents": true,
    "auto_create_journal_entries": true,
    "auto_send_acknowledgments": true,
    "require_manual_review": false,
    "confidence_threshold": 0.85
  }
}
*/
