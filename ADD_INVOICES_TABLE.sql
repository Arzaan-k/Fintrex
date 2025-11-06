-- Add invoices table to the database
-- Run this in Supabase SQL Editor

-- Create invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  invoice_number TEXT,
  invoice_date DATE,
  due_date DATE,
  invoice_type TEXT CHECK (invoice_type IN ('sales', 'purchase')),
  vendor_name TEXT,
  vendor_gstin TEXT,
  vendor_address TEXT,
  customer_name TEXT,
  customer_gstin TEXT,
  customer_address TEXT,
  subtotal NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'INR',
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'unpaid', 'paid', 'overdue', 'cancelled')),
  payment_date DATE,
  notes TEXT,
  line_items JSONB,
  tax_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Align existing table (if already present) with expected columns
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS vendor_gstin TEXT,
  ADD COLUMN IF NOT EXISTS vendor_address TEXT,
  ADD COLUMN IF NOT EXISTS customer_gstin TEXT,
  ADD COLUMN IF NOT EXISTS customer_address TEXT,
  ADD COLUMN IF NOT EXISTS tax_details JSONB,
  ALTER COLUMN payment_status DROP DEFAULT,
  ALTER COLUMN payment_status TYPE TEXT,
  ALTER COLUMN payment_status SET DEFAULT 'pending';

-- Relax payment_status constraint to include unpaid
ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_payment_status_check;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_payment_status_check
  CHECK (payment_status IN ('pending', 'unpaid', 'paid', 'overdue', 'cancelled'));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_invoices_document ON public.invoices(document_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON public.invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_type ON public.invoices(invoice_type);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(payment_status);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Users can view invoices of their clients" ON public.invoices;
CREATE POLICY "Users can view invoices of their clients" ON public.invoices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE clients.id = invoices.client_id
        AND (clients.accountant_id = auth.uid() OR has_role(auth.uid(), 'admin'))
    )
  );

DROP POLICY IF EXISTS "Users can create invoices for their clients" ON public.invoices;
CREATE POLICY "Users can create invoices for their clients" ON public.invoices
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE clients.id = invoices.client_id
        AND clients.accountant_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update invoices of their clients" ON public.invoices;
CREATE POLICY "Users can update invoices of their clients" ON public.invoices
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE clients.id = invoices.client_id
        AND (clients.accountant_id = auth.uid() OR has_role(auth.uid(), 'admin'))
    )
  );

DROP POLICY IF EXISTS "Users can delete invoices of their clients" ON public.invoices;
CREATE POLICY "Users can delete invoices of their clients" ON public.invoices
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE clients.id = invoices.client_id
        AND (clients.accountant_id = auth.uid() OR has_role(auth.uid(), 'admin'))
    )
  );

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Invoices table created successfully!';
END $$;
