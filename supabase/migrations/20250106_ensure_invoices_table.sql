-- Ensure invoices table exists with all required columns
-- This is idempotent and can be run multiple times safely

-- Create invoices table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  invoice_type TEXT NOT NULL CHECK (invoice_type IN ('sales','purchase')),
  invoice_number TEXT,
  invoice_date DATE,
  due_date DATE,
  vendor_name TEXT,
  vendor_gstin TEXT,
  customer_name TEXT,
  customer_gstin TEXT,
  line_items JSONB,
  tax_details JSONB,
  total_amount NUMERIC,
  currency TEXT DEFAULT 'INR',
  payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid','partial','overdue')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS invoices_client_idx ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS invoices_type_idx ON public.invoices(invoice_type);
CREATE INDEX IF NOT EXISTS invoices_document_idx ON public.invoices(document_id);
CREATE INDEX IF NOT EXISTS invoices_date_idx ON public.invoices(invoice_date);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can insert their own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can update their own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can delete their own invoices" ON public.invoices;

-- Create RLS policies
CREATE POLICY "Users can view their own invoices"
  ON public.invoices FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own invoices"
  ON public.invoices FOR UPDATE
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own invoices"
  ON public.invoices FOR DELETE
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );

-- Add helpful comment
COMMENT ON TABLE public.invoices IS 'Stores invoice data extracted from documents via OCR';
