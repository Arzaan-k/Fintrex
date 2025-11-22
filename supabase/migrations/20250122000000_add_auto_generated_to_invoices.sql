-- Add auto_generated column to invoices table for automatic journal entry creation
-- This enables the trigger auto_create_journal_from_invoice to work properly

ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN DEFAULT FALSE;

-- Add accountant_id column to link invoices to accountants
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS accountant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_invoices_accountant_id ON public.invoices(accountant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_document_id ON public.invoices(document_id);

-- Comments
COMMENT ON COLUMN public.invoices.auto_generated IS 'When TRUE, triggers automatic journal entry creation';
COMMENT ON COLUMN public.invoices.accountant_id IS 'The accountant who owns this invoice (linked to the client)';
