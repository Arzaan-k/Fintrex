-- Extended schema for comprehensive accounting platform

-- Create additional enums
CREATE TYPE public.document_type AS ENUM (
  'kyc_pan', 'kyc_aadhaar', 'kyc_gst_certificate', 'kyc_incorporation',
  'kyc_address_proof', 'kyc_bank_details', 'kyc_cancelled_cheque',
  'invoice_sales', 'invoice_purchase', 'bank_statement', 'receipt',
  'bill_of_supply', 'credit_note', 'debit_note', 'other'
);

CREATE TYPE public.invoice_type AS ENUM ('sales', 'purchase');
CREATE TYPE public.payment_status AS ENUM ('unpaid', 'partial', 'paid', 'overdue');
CREATE TYPE public.subscription_plan AS ENUM ('starter', 'professional', 'enterprise', 'custom');

-- Extend clients table with more fields
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS business_type TEXT,
ADD COLUMN IF NOT EXISTS registration_date DATE,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS pincode TEXT,
ADD COLUMN IF NOT EXISTS tan_number TEXT,
ADD COLUMN IF NOT EXISTS kyc_documents JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS compliance_status JSONB DEFAULT '{}'::jsonb;

-- Extend profiles table for accountants
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS firm_name TEXT,
ADD COLUMN IF NOT EXISTS ca_registration_number TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
ADD COLUMN IF NOT EXISTS subscription_plan subscription_plan DEFAULT 'starter',
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS email_integration_config JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS whatsapp_api_key TEXT,
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;

-- Add document_type to documents table
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS document_type document_type,
ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS ocr_text TEXT,
ADD COLUMN IF NOT EXISTS processing_error TEXT;

-- Create invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  invoice_type invoice_type NOT NULL,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE,
  vendor_name TEXT,
  vendor_gstin TEXT,
  vendor_address TEXT,
  customer_name TEXT,
  customer_gstin TEXT,
  customer_address TEXT,
  line_items JSONB DEFAULT '[]'::jsonb,
  subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0,
  cgst DECIMAL(15, 2) DEFAULT 0,
  sgst DECIMAL(15, 2) DEFAULT 0,
  igst DECIMAL(15, 2) DEFAULT 0,
  cess DECIMAL(15, 2) DEFAULT 0,
  total_amount DECIMAL(15, 2) NOT NULL,
  payment_status payment_status DEFAULT 'unpaid',
  payment_terms TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chart_of_accounts table
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accountant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  account_code TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'income', 'expense')),
  account_category TEXT,
  parent_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(accountant_id, account_code)
);

-- Create journal_entries table
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  entry_date DATE NOT NULL,
  entry_type TEXT DEFAULT 'standard',
  narration TEXT NOT NULL,
  is_auto_generated BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'posted' CHECK (status IN ('draft', 'posted', 'reversed')),
  reference_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create journal_line_items table
CREATE TABLE IF NOT EXISTS public.journal_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID REFERENCES public.journal_entries(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES public.chart_of_accounts(id) NOT NULL,
  debit_amount DECIMAL(15, 2) DEFAULT 0,
  credit_amount DECIMAL(15, 2) DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create balance_sheets table
CREATE TABLE IF NOT EXISTS public.balance_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  as_of_date DATE NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'final')),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_assets DECIMAL(15, 2) DEFAULT 0,
  total_liabilities DECIMAL(15, 2) DEFAULT 0,
  total_equity DECIMAL(15, 2) DEFAULT 0,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  generated_by UUID REFERENCES auth.users(id),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(client_id, as_of_date)
);

-- Create profit_loss_statements table
CREATE TABLE IF NOT EXISTS public.profit_loss_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'final')),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_revenue DECIMAL(15, 2) DEFAULT 0,
  total_expenses DECIMAL(15, 2) DEFAULT 0,
  net_profit DECIMAL(15, 2) DEFAULT 0,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  generated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(client_id, start_date, end_date)
);

-- Create gst_returns table
CREATE TABLE IF NOT EXISTS public.gst_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  return_type TEXT NOT NULL CHECK (return_type IN ('GSTR1', 'GSTR3B', 'GSTR9')),
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INTEGER NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'filed', 'cancelled')),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_outward_supply DECIMAL(15, 2) DEFAULT 0,
  total_inward_supply DECIMAL(15, 2) DEFAULT 0,
  total_tax_liability DECIMAL(15, 2) DEFAULT 0,
  total_input_credit DECIMAL(15, 2) DEFAULT 0,
  filed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(client_id, return_type, period_month, period_year)
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  is_read BOOLEAN DEFAULT FALSE,
  link TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create activity_logs table
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON public.invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_client_id ON public.journal_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_entry_date ON public.journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_balance_sheets_client_id ON public.balance_sheets(client_id);
CREATE INDEX IF NOT EXISTS idx_profit_loss_statements_client_id ON public.profit_loss_statements(client_id);
CREATE INDEX IF NOT EXISTS idx_gst_returns_client_id ON public.gst_returns(client_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);

-- Enable RLS on new tables
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balance_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profit_loss_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gst_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invoices
CREATE POLICY "Users can view invoices of their clients"
  ON public.invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE clients.id = invoices.client_id
      AND clients.accountant_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Users can create invoices for their clients"
  ON public.invoices FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE clients.id = invoices.client_id
      AND clients.accountant_id = auth.uid()
    )
  );

CREATE POLICY "Users can update invoices of their clients"
  ON public.invoices FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE clients.id = invoices.client_id
      AND clients.accountant_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- RLS Policies for chart_of_accounts
CREATE POLICY "Users can view their own chart of accounts"
  ON public.chart_of_accounts FOR SELECT
  USING (auth.uid() = accountant_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create their own chart of accounts"
  ON public.chart_of_accounts FOR INSERT
  WITH CHECK (auth.uid() = accountant_id);

CREATE POLICY "Users can update their own chart of accounts"
  ON public.chart_of_accounts FOR UPDATE
  USING (auth.uid() = accountant_id);

-- RLS Policies for journal_entries
CREATE POLICY "Users can view journal entries of their clients"
  ON public.journal_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE clients.id = journal_entries.client_id
      AND clients.accountant_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Users can create journal entries for their clients"
  ON public.journal_entries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE clients.id = journal_entries.client_id
      AND clients.accountant_id = auth.uid()
    )
  );

-- RLS Policies for journal_line_items
CREATE POLICY "Users can view journal line items of their clients"
  ON public.journal_line_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.journal_entries je
      JOIN public.clients c ON c.id = je.client_id
      WHERE je.id = journal_line_items.entry_id
      AND c.accountant_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Users can create journal line items for their clients"
  ON public.journal_line_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.journal_entries je
      JOIN public.clients c ON c.id = je.client_id
      WHERE je.id = journal_line_items.entry_id
      AND c.accountant_id = auth.uid()
    )
  );

-- RLS Policies for balance_sheets
CREATE POLICY "Users can view balance sheets of their clients"
  ON public.balance_sheets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE clients.id = balance_sheets.client_id
      AND clients.accountant_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Users can create balance sheets for their clients"
  ON public.balance_sheets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE clients.id = balance_sheets.client_id
      AND clients.accountant_id = auth.uid()
    )
  );

-- RLS Policies for profit_loss_statements
CREATE POLICY "Users can view P&L statements of their clients"
  ON public.profit_loss_statements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE clients.id = profit_loss_statements.client_id
      AND clients.accountant_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- RLS Policies for gst_returns
CREATE POLICY "Users can view GST returns of their clients"
  ON public.gst_returns FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE clients.id = gst_returns.client_id
      AND clients.accountant_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Users can create GST returns for their clients"
  ON public.gst_returns FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE clients.id = gst_returns.client_id
      AND clients.accountant_id = auth.uid()
    )
  );

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- RLS Policies for activity_logs
CREATE POLICY "Users can view their own activity logs"
  ON public.activity_logs FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can create activity logs"
  ON public.activity_logs FOR INSERT
  WITH CHECK (true);

-- Create function to auto-generate journal entries from invoices
CREATE OR REPLACE FUNCTION public.generate_journal_entry_from_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Auto-generate journal entry for completed invoices
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'paid') THEN
    INSERT INTO public.journal_entries (client_id, entry_date, narration, is_auto_generated, created_by, reference_document_id)
    VALUES (
      NEW.client_id,
      NEW.invoice_date,
      CONCAT('Auto-generated from invoice ', NEW.invoice_number),
      TRUE,
      auth.uid(),
      NEW.document_id
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for invoice journal entry generation
DROP TRIGGER IF EXISTS on_invoice_payment_completed ON public.invoices;
CREATE TRIGGER on_invoice_payment_completed
  AFTER INSERT OR UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_journal_entry_from_invoice();

-- Create function to log activities
CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, metadata)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    NEW.id,
    jsonb_build_object('timestamp', NOW())
  );
  RETURN NEW;
END;
$$;

-- Create triggers for activity logging on key tables
DROP TRIGGER IF EXISTS log_client_activity ON public.clients;
CREATE TRIGGER log_client_activity
  AFTER INSERT OR UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.log_activity();

DROP TRIGGER IF EXISTS log_document_activity ON public.documents;
CREATE TRIGGER log_document_activity
  AFTER INSERT OR UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.log_activity();

DROP TRIGGER IF EXISTS log_invoice_activity ON public.invoices;
CREATE TRIGGER log_invoice_activity
  AFTER INSERT OR UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.log_activity();


