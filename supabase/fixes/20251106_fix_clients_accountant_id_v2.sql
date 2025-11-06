-- Fix clients table to match application schema with accountant_id column
BEGIN;

-- Ensure required enums exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_status') THEN
    CREATE TYPE public.client_status AS ENUM ('kyc_pending', 'active', 'inactive', 'suspended');
  END IF;
END $$;

-- Drop policies that reference old columns so we can rebuild them
DROP POLICY IF EXISTS "Users can manage their own clients" ON public.clients;
DROP POLICY IF EXISTS "Accountants can manage their clients" ON public.clients;
DROP POLICY IF EXISTS "Accountants can view their clients" ON public.clients;
DROP POLICY IF EXISTS "Accountants can create clients" ON public.clients;
DROP POLICY IF EXISTS "Accountants can update their clients" ON public.clients;
DROP POLICY IF EXISTS "Accountants can delete their clients" ON public.clients;

-- Drop legacy index if present
DROP INDEX IF EXISTS clients_user_idx;

-- Add accountant_id column and migrate data from user_id when present
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS accountant_id UUID;

UPDATE public.clients
SET accountant_id = user_id
WHERE accountant_id IS NULL;

ALTER TABLE public.clients
  ALTER COLUMN accountant_id SET NOT NULL;

-- Add foreign key if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
      AND table_schema = 'public'
      AND table_name = 'clients'
      AND constraint_name = 'clients_accountant_id_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE public.clients
      ADD CONSTRAINT clients_accountant_id_fkey
      FOREIGN KEY (accountant_id)
      REFERENCES auth.users(id) ON DELETE CASCADE';
  END IF;
END $$;

-- Rename columns to match frontend expectations
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'name'
  ) THEN
    EXECUTE 'ALTER TABLE public.clients RENAME COLUMN name TO business_name';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'phone'
  ) THEN
    EXECUTE 'ALTER TABLE public.clients RENAME COLUMN phone TO phone_number';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'gstin'
  ) THEN
    EXECUTE 'ALTER TABLE public.clients RENAME COLUMN gstin TO gst_number';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'pan'
  ) THEN
    EXECUTE 'ALTER TABLE public.clients RENAME COLUMN pan TO pan_number';
  END IF;
END $$;

-- Add any missing columns with defaults
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS business_name TEXT,
  ADD COLUMN IF NOT EXISTS contact_person TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS gst_number TEXT,
  ADD COLUMN IF NOT EXISTS pan_number TEXT,
  ADD COLUMN IF NOT EXISTS tan_number TEXT,
  ADD COLUMN IF NOT EXISTS business_type TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS pincode TEXT,
  ADD COLUMN IF NOT EXISTS kyc_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS status client_status DEFAULT 'kyc_pending',
  ADD COLUMN IF NOT EXISTS total_documents INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_documents INTEGER DEFAULT 0;

-- Ensure existing status column uses client_status enum
ALTER TABLE public.clients
  ALTER COLUMN status TYPE client_status USING status::client_status,
  ALTER COLUMN status SET DEFAULT 'kyc_pending';

-- Drop legacy user_id column
ALTER TABLE public.clients
  DROP COLUMN IF EXISTS user_id;

-- Recreate indexes and RLS policies with accountant_id
CREATE INDEX IF NOT EXISTS clients_accountant_idx ON public.clients(accountant_id);
CREATE INDEX IF NOT EXISTS clients_status_idx ON public.clients(status);

CREATE POLICY "Accountants can view their clients"
  ON public.clients FOR SELECT
  USING (auth.uid() = accountant_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Accountants can create clients"
  ON public.clients FOR INSERT
  WITH CHECK (auth.uid() = accountant_id);

CREATE POLICY "Accountants can update their clients"
  ON public.clients FOR UPDATE
  USING (auth.uid() = accountant_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Accountants can delete their clients"
  ON public.clients FOR DELETE
  USING (auth.uid() = accountant_id OR has_role(auth.uid(), 'admin'));

COMMIT;
