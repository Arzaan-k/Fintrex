-- ============================================
-- FIX SUPABASE RLS ERRORS AND SCHEMA ISSUES
-- Created: 2025-01-15
-- ============================================

-- ============================================
-- 1. FIX INVOICES TABLE SCHEMA
-- ============================================
-- Add missing columns that are used in the application

DO $$
BEGIN
  -- Add subtotal column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'invoices'
    AND column_name = 'subtotal'
  ) THEN
    ALTER TABLE public.invoices ADD COLUMN subtotal NUMERIC DEFAULT 0;
  END IF;

  -- Add CGST column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'invoices'
    AND column_name = 'cgst'
  ) THEN
    ALTER TABLE public.invoices ADD COLUMN cgst NUMERIC DEFAULT 0;
  END IF;

  -- Add SGST column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'invoices'
    AND column_name = 'sgst'
  ) THEN
    ALTER TABLE public.invoices ADD COLUMN sgst NUMERIC DEFAULT 0;
  END IF;

  -- Add IGST column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'invoices'
    AND column_name = 'igst'
  ) THEN
    ALTER TABLE public.invoices ADD COLUMN igst NUMERIC DEFAULT 0;
  END IF;

  -- Add CESS column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'invoices'
    AND column_name = 'cess'
  ) THEN
    ALTER TABLE public.invoices ADD COLUMN cess NUMERIC DEFAULT 0;
  END IF;

  -- Add vendor_address column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'invoices'
    AND column_name = 'vendor_address'
  ) THEN
    ALTER TABLE public.invoices ADD COLUMN vendor_address TEXT;
  END IF;

  -- Add customer_address column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'invoices'
    AND column_name = 'customer_address'
  ) THEN
    ALTER TABLE public.invoices ADD COLUMN customer_address TEXT;
  END IF;

END $$;

-- Add helpful comments
COMMENT ON COLUMN public.invoices.subtotal IS 'Invoice subtotal before taxes';
COMMENT ON COLUMN public.invoices.cgst IS 'Central GST amount';
COMMENT ON COLUMN public.invoices.sgst IS 'State GST amount';
COMMENT ON COLUMN public.invoices.igst IS 'Integrated GST amount';
COMMENT ON COLUMN public.invoices.cess IS 'Cess amount (additional tax)';
COMMENT ON COLUMN public.invoices.vendor_address IS 'Vendor billing address';
COMMENT ON COLUMN public.invoices.customer_address IS 'Customer billing address';

-- ============================================
-- 2. FIX REVIEW QUEUE RLS POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Accountants can view own review queue" ON review_queue;
DROP POLICY IF EXISTS "Accountants can update own review items" ON review_queue;
DROP POLICY IF EXISTS "System can insert review items" ON review_queue;

-- Create more permissive policies that handle both accountant_id and user's role
CREATE POLICY "Authenticated users can view review queue"
  ON review_queue FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      accountant_id = auth.uid() OR
      assigned_to = auth.uid() OR
      -- Allow viewing if user owns the client
      EXISTS (
        SELECT 1 FROM clients c
        WHERE c.id = review_queue.client_id
        AND (c.accountant_id = auth.uid() OR c.user_id = auth.uid())
      )
    )
  );

CREATE POLICY "Authenticated users can update review items"
  ON review_queue FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND (
      accountant_id = auth.uid() OR
      assigned_to = auth.uid() OR
      -- Allow updating if user owns the client
      EXISTS (
        SELECT 1 FROM clients c
        WHERE c.id = review_queue.client_id
        AND (c.accountant_id = auth.uid() OR c.user_id = auth.uid())
      )
    )
  );

CREATE POLICY "Authenticated users can insert review items"
  ON review_queue FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Authenticated users can delete review items"
  ON review_queue FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND (
      accountant_id = auth.uid() OR
      assigned_to = auth.uid()
    )
  );

-- ============================================
-- 3. FIX INVOICES RLS POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can insert their own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can update their own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can delete their own invoices" ON public.invoices;

-- Create better policies that handle both client users and accountants
CREATE POLICY "Users can view invoices for their clients"
  ON public.invoices FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      -- Client can view their own invoices
      client_id IN (
        SELECT id FROM public.clients WHERE user_id = auth.uid()
      ) OR
      -- Accountant can view invoices for their clients
      client_id IN (
        SELECT id FROM public.clients WHERE accountant_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert invoices for their clients"
  ON public.invoices FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      -- Client can insert their own invoices
      client_id IN (
        SELECT id FROM public.clients WHERE user_id = auth.uid()
      ) OR
      -- Accountant can insert invoices for their clients
      client_id IN (
        SELECT id FROM public.clients WHERE accountant_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update invoices for their clients"
  ON public.invoices FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND (
      client_id IN (
        SELECT id FROM public.clients WHERE user_id = auth.uid()
      ) OR
      client_id IN (
        SELECT id FROM public.clients WHERE accountant_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete invoices for their clients"
  ON public.invoices FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND (
      client_id IN (
        SELECT id FROM public.clients WHERE user_id = auth.uid()
      ) OR
      client_id IN (
        SELECT id FROM public.clients WHERE accountant_id = auth.uid()
      )
    )
  );

-- ============================================
-- 4. ENSURE DOCUMENTS TABLE HAS PROPER RLS
-- ============================================

-- Ensure documents table has RLS enabled
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Drop existing document policies if they exist
DROP POLICY IF EXISTS "Users can view documents for their clients" ON public.documents;
DROP POLICY IF EXISTS "Users can insert documents for their clients" ON public.documents;
DROP POLICY IF EXISTS "Users can update documents for their clients" ON public.documents;
DROP POLICY IF EXISTS "Users can delete documents for their clients" ON public.documents;

-- Create comprehensive document policies
CREATE POLICY "Users can view documents for their clients"
  ON public.documents FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      client_id IN (
        SELECT id FROM public.clients WHERE user_id = auth.uid()
      ) OR
      client_id IN (
        SELECT id FROM public.clients WHERE accountant_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert documents for their clients"
  ON public.documents FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      client_id IN (
        SELECT id FROM public.clients WHERE user_id = auth.uid()
      ) OR
      client_id IN (
        SELECT id FROM public.clients WHERE accountant_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update documents for their clients"
  ON public.documents FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND (
      client_id IN (
        SELECT id FROM public.clients WHERE user_id = auth.uid()
      ) OR
      client_id IN (
        SELECT id FROM public.clients WHERE accountant_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete documents for their clients"
  ON public.documents FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND (
      client_id IN (
        SELECT id FROM public.clients WHERE user_id = auth.uid()
      ) OR
      client_id IN (
        SELECT id FROM public.clients WHERE accountant_id = auth.uid()
      )
    )
  );

-- ============================================
-- 5. ENSURE FINANCIAL_RECORDS TABLE HAS PROPER RLS
-- ============================================

-- Ensure financial_records table has RLS enabled
ALTER TABLE public.financial_records ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view financial records for their clients" ON public.financial_records;
DROP POLICY IF EXISTS "Users can insert financial records for their clients" ON public.financial_records;
DROP POLICY IF EXISTS "Users can update financial records for their clients" ON public.financial_records;
DROP POLICY IF EXISTS "Users can delete financial records for their clients" ON public.financial_records;

-- Create financial records policies
CREATE POLICY "Users can view financial records for their clients"
  ON public.financial_records FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      client_id IN (
        SELECT id FROM public.clients WHERE user_id = auth.uid()
      ) OR
      client_id IN (
        SELECT id FROM public.clients WHERE accountant_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert financial records for their clients"
  ON public.financial_records FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      client_id IN (
        SELECT id FROM public.clients WHERE user_id = auth.uid()
      ) OR
      client_id IN (
        SELECT id FROM public.clients WHERE accountant_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update financial records for their clients"
  ON public.financial_records FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND (
      client_id IN (
        SELECT id FROM public.clients WHERE user_id = auth.uid()
      ) OR
      client_id IN (
        SELECT id FROM public.clients WHERE accountant_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete financial records for their clients"
  ON public.financial_records FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND (
      client_id IN (
        SELECT id FROM public.clients WHERE user_id = auth.uid()
      ) OR
      client_id IN (
        SELECT id FROM public.clients WHERE accountant_id = auth.uid()
      )
    )
  );

-- ============================================
-- 6. REFRESH SCHEMA CACHE
-- ============================================

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ RLS policies and schema fixes applied successfully!';
  RAISE NOTICE '📋 Invoices table: Added missing tax columns (CGST, SGST, IGST, CESS)';
  RAISE NOTICE '🔐 Review Queue: Updated RLS policies for better access control';
  RAISE NOTICE '🔐 Invoices: Updated RLS policies to support both clients and accountants';
  RAISE NOTICE '🔐 Documents: Ensured proper RLS policies';
  RAISE NOTICE '🔐 Financial Records: Ensured proper RLS policies';
END $$;
