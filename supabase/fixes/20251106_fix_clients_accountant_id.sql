-- Fix clients table to use accountant_id and expected columns
BEGIN;

-- Drop existing policies referencing user_id so we can swap columns safely
DROP POLICY IF EXISTS "Users can manage their own clients" ON public.clients;
DROP POLICY IF EXISTS "Accountants can manage their clients" ON public.clients;
DROP POLICY IF EXISTS "Accountants can view their clients" ON public.clients;
DROP POLICY IF EXISTS "Accountants can create clients" ON public.clients;
DROP POLICY IF EXISTS "Accountants can update their clients" ON public.clients;
DROP POLICY IF EXISTS "Accountants can delete their clients" ON public.clients;

-- Drop old indexes that reference user_id
DROP INDEX IF EXISTS clients_user_idx;

-- Add accountant_id column and copy data from user_id if available
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS accountant_id UUID;

UPDATE public.clients
SET accountant_id = user_id
WHERE accountant_id IS NULL;

ALTER TABLE public.clients
  ALTER COLUMN accountant_id SET NOT NULL;

-- Create FK (silently ignore if already present)
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

-- Rename columns to match expected schema (guarded renames)
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

-- Add any missing columns the app expects
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS contact_person TEXT,
  ADD COLUMN IF NOT EXISTS tan_number TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS pincode TEXT,
  ADD COLUMN IF NOT EXISTS total_documents INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_documents INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status client_status DEFAULT 'kyc_pending';

-- Ensure existing address column is TEXT (convert from JSONB if necessary)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'address'
      AND data_type = 'jsonb'
  ) THEN
    EXECUTE 'ALTER TABLE public.clients ALTER COLUMN address TYPE TEXT USING address::text';
  END IF;
END $$;

-- Drop legacy user_id column now that accountant_id is in place
ALTER TABLE public.clients
  DROP COLUMN IF EXISTS user_id;

-- Recreate indexes/policies using accountant_id
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
