-- ============================================================================
-- FINTREX - COMPLETE DATABASE MIGRATION SCRIPT
-- ============================================================================
-- Run this entire script in your NEW Supabase Database SQL Editor
-- Project: tedkkwqlcoilopcrxkdl
-- URL: https://tedkkwqlcoilopcrxkdl.supabase.co
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. PROFILES TABLE (User profiles)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  business_name TEXT,
  business_type TEXT,
  gstin TEXT,
  pan TEXT,
  address JSONB,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Profiles RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- 2. CLIENTS TABLE (Client management)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  business_type TEXT,
  gstin TEXT,
  pan TEXT,
  address JSONB,
  kyc_status TEXT DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'in_progress', 'completed', 'rejected')),
  kyc_completed_at TIMESTAMPTZ,
  total_documents INTEGER DEFAULT 0,
  completed_documents INTEGER DEFAULT 0,
  notes TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS clients_user_idx ON public.clients(user_id);
CREATE INDEX IF NOT EXISTS clients_kyc_status_idx ON public.clients(kyc_status);

-- Clients RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own clients" ON public.clients;
CREATE POLICY "Users can manage their own clients"
  ON public.clients FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- 3. DOCUMENTS TABLE (Document storage and processing)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  document_type TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  ocr_text TEXT,
  ocr_confidence NUMERIC,
  extracted_data JSONB,
  processing_time INTEGER,
  error_message TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS documents_user_idx ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS documents_client_idx ON public.documents(client_id);
CREATE INDEX IF NOT EXISTS documents_status_idx ON public.documents(status);
CREATE INDEX IF NOT EXISTS documents_type_idx ON public.documents(document_type);

-- Documents RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own documents" ON public.documents;
CREATE POLICY "Users can manage their own documents"
  ON public.documents FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- 4. FINANCIAL RECORDS TABLE (Accounting entries)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.financial_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  record_type TEXT NOT NULL CHECK (record_type IN ('income', 'expense', 'asset', 'liability', 'equity')),
  category TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'INR',
  description TEXT,
  transaction_date DATE,
  payment_method TEXT,
  reference_number TEXT,
  tax_amount NUMERIC,
  tax_rate NUMERIC,
  notes TEXT,
  tags TEXT[],
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS financial_records_user_idx ON public.financial_records(user_id);
CREATE INDEX IF NOT EXISTS financial_records_client_idx ON public.financial_records(client_id);
CREATE INDEX IF NOT EXISTS financial_records_type_idx ON public.financial_records(record_type);
CREATE INDEX IF NOT EXISTS financial_records_date_idx ON public.financial_records(transaction_date);

-- Financial Records RLS
ALTER TABLE public.financial_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own financial records" ON public.financial_records;
CREATE POLICY "Users can manage their own financial records"
  ON public.financial_records FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- 5. INVOICES TABLE (Invoice data from OCR)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invoices_user_idx ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS invoices_client_idx ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS invoices_document_idx ON public.invoices(document_id);
CREATE INDEX IF NOT EXISTS invoices_type_idx ON public.invoices(invoice_type);
CREATE INDEX IF NOT EXISTS invoices_date_idx ON public.invoices(invoice_date);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON public.invoices(payment_status);

-- Invoices RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own invoices" ON public.invoices;
CREATE POLICY "Users can manage their own invoices"
  ON public.invoices FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- 6. KYC DOCUMENT TYPES TABLE (Master data)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.kyc_document_types (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  required_for TEXT[] DEFAULT '{}'::TEXT[],
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert KYC document types
INSERT INTO public.kyc_document_types(code, name, required_for, description) VALUES
  ('kyc_pan', 'PAN Card', '{proprietorship,partnership,pvt_ltd}'::TEXT[], 'Permanent Account Number'),
  ('kyc_aadhaar', 'Aadhaar Card', '{proprietorship,partnership}'::TEXT[], 'Aadhaar Identity Card'),
  ('kyc_gst', 'GST Certificate', '{proprietorship,partnership,pvt_ltd}'::TEXT[], 'GST Registration Certificate'),
  ('kyc_incorp', 'Incorporation Certificate', '{pvt_ltd}'::TEXT[], 'Certificate of Incorporation'),
  ('kyc_bank', 'Cancelled Cheque', '{proprietorship,partnership,pvt_ltd}'::TEXT[], 'Bank Account Proof'),
  ('kyc_address', 'Address Proof', '{proprietorship,partnership,pvt_ltd}'::TEXT[], 'Business Address Proof')
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 7. KYC CHECKLISTS TABLE (KYC requirements per client)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.kyc_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type_code TEXT NOT NULL REFERENCES public.kyc_document_types(code) ON DELETE RESTRICT,
  required BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'verified', 'rejected')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, type_code)
);

CREATE INDEX IF NOT EXISTS kyc_checklists_client_idx ON public.kyc_checklists(client_id);
CREATE INDEX IF NOT EXISTS kyc_checklists_status_idx ON public.kyc_checklists(status);

-- KYC Checklists RLS
ALTER TABLE public.kyc_checklists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage KYC checklists for their clients" ON public.kyc_checklists;
CREATE POLICY "Users can manage KYC checklists for their clients"
  ON public.kyc_checklists FOR ALL
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- 8. KYC DOCUMENTS TABLE (Uploaded KYC documents)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.kyc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type_code TEXT NOT NULL REFERENCES public.kyc_document_types(code) ON DELETE RESTRICT,
  file_path TEXT NOT NULL,
  file_name TEXT,
  file_size BIGINT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  extracted_data JSONB,
  confidence NUMERIC,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS kyc_documents_client_idx ON public.kyc_documents(client_id);
CREATE INDEX IF NOT EXISTS kyc_documents_type_idx ON public.kyc_documents(type_code);
CREATE INDEX IF NOT EXISTS kyc_documents_status_idx ON public.kyc_documents(status);

-- KYC Documents RLS
ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage KYC documents for their clients" ON public.kyc_documents;
CREATE POLICY "Users can manage KYC documents for their clients"
  ON public.kyc_documents FOR ALL
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- 9. AUTOMATION RULES TABLE (WhatsApp/Email automation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('whatsapp', 'email', 'manual', 'scheduled')),
  trigger_config JSONB,
  conditions JSONB,
  actions JSONB NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS automation_rules_user_idx ON public.automation_rules(user_id);
CREATE INDEX IF NOT EXISTS automation_rules_enabled_idx ON public.automation_rules(enabled);

-- Automation Rules RLS
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own automation rules" ON public.automation_rules;
CREATE POLICY "Users can manage their own automation rules"
  ON public.automation_rules FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- 10. AUTOMATION LOGS TABLE (Automation execution history)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'partial')),
  trigger_data JSONB,
  actions_executed JSONB,
  error_message TEXT,
  execution_time INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS automation_logs_rule_idx ON public.automation_logs(rule_id);
CREATE INDEX IF NOT EXISTS automation_logs_user_idx ON public.automation_logs(user_id);
CREATE INDEX IF NOT EXISTS automation_logs_status_idx ON public.automation_logs(status);
CREATE INDEX IF NOT EXISTS automation_logs_created_idx ON public.automation_logs(created_at);

-- Automation Logs RLS
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own automation logs" ON public.automation_logs;
CREATE POLICY "Users can view their own automation logs"
  ON public.automation_logs FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================================
-- 11. STORAGE BUCKETS (Supabase Storage)
-- ============================================================================

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('documents', 'documents', false),
  ('kyc-documents', 'kyc-documents', false),
  ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for documents bucket
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
CREATE POLICY "Users can upload their own documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
CREATE POLICY "Users can view their own documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
CREATE POLICY "Users can delete their own documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policies for kyc-documents bucket
DROP POLICY IF EXISTS "Users can upload KYC documents" ON storage.objects;
CREATE POLICY "Users can upload KYC documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'kyc-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can view KYC documents" ON storage.objects;
CREATE POLICY "Users can view KYC documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'kyc-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policies for avatars bucket (public)
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================================
-- 12. FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_clients_updated_at ON public.clients;
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_documents_updated_at ON public.documents;
CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_financial_records_updated_at ON public.financial_records;
CREATE TRIGGER update_financial_records_updated_at
  BEFORE UPDATE ON public.financial_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_kyc_checklists_updated_at ON public.kyc_checklists;
CREATE TRIGGER update_kyc_checklists_updated_at
  BEFORE UPDATE ON public.kyc_checklists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_kyc_documents_updated_at ON public.kyc_documents;
CREATE TRIGGER update_kyc_documents_updated_at
  BEFORE UPDATE ON public.kyc_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_automation_rules_updated_at ON public.automation_rules;
CREATE TRIGGER update_automation_rules_updated_at
  BEFORE UPDATE ON public.automation_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 13. HELPER FUNCTIONS
-- ============================================================================

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- MIGRATION COMPLETE!
-- ============================================================================

-- Add helpful comments
COMMENT ON TABLE public.profiles IS 'User profile information';
COMMENT ON TABLE public.clients IS 'Client management and KYC tracking';
COMMENT ON TABLE public.documents IS 'Document storage and OCR processing';
COMMENT ON TABLE public.financial_records IS 'Accounting entries and transactions';
COMMENT ON TABLE public.invoices IS 'Invoice data extracted from documents';
COMMENT ON TABLE public.kyc_document_types IS 'Master data for KYC document types';
COMMENT ON TABLE public.kyc_checklists IS 'KYC requirements per client';
COMMENT ON TABLE public.kyc_documents IS 'Uploaded KYC documents';
COMMENT ON TABLE public.automation_rules IS 'WhatsApp/Email automation rules';
COMMENT ON TABLE public.automation_logs IS 'Automation execution history';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ DATABASE MIGRATION COMPLETED SUCCESSFULLY!';
  RAISE NOTICE '📊 All tables, indexes, and policies created';
  RAISE NOTICE '🔐 Row Level Security enabled on all tables';
  RAISE NOTICE '📁 Storage buckets configured';
  RAISE NOTICE '🎉 Your Fintrex database is ready to use!';
END $$;
