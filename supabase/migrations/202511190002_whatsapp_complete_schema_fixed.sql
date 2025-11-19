-- Complete WhatsApp Integration Schema - FIXED VERSION
-- Supporting KYC workflows, document requests, sessions, and accounting validations

-- ============================================
-- 1. WhatsApp Sessions Table (Persistent Storage)
-- ============================================
CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL UNIQUE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  accountant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'idle' CHECK (state IN (
    'idle',
    'awaiting_document_type',
    'awaiting_document',
    'awaiting_confirmation',
    'processing',
    'kyc_flow',
    'awaiting_kyc_document',
    'payment_tracking'
  )),
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  document_type TEXT,
  kyc_checklist_item_id UUID,
  context JSONB DEFAULT '{}'::jsonb,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes only if table was created
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_whatsapp_sessions_phone') THEN
    CREATE INDEX idx_whatsapp_sessions_phone ON public.whatsapp_sessions(phone_number);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_whatsapp_sessions_client') THEN
    CREATE INDEX idx_whatsapp_sessions_client ON public.whatsapp_sessions(client_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_whatsapp_sessions_expires') THEN
    CREATE INDEX idx_whatsapp_sessions_expires ON public.whatsapp_sessions(expires_at);
  END IF;
END $$;

-- Auto-delete expired sessions function
CREATE OR REPLACE FUNCTION clean_expired_whatsapp_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM public.whatsapp_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. KYC Checklist Templates
-- ============================================
CREATE TABLE IF NOT EXISTS public.kyc_checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accountant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  template_name TEXT NOT NULL,
  business_type TEXT NOT NULL CHECK (business_type IN (
    'proprietorship',
    'partnership',
    'llp',
    'private_limited',
    'public_limited',
    'trust',
    'society',
    'huf',
    'other'
  )),
  required_documents TEXT[] NOT NULL DEFAULT ARRAY[
    'pan_card',
    'aadhaar_card',
    'gst_certificate',
    'bank_details',
    'cancelled_cheque'
  ],
  optional_documents TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(accountant_id, template_name)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kyc_templates_accountant') THEN
    CREATE INDEX idx_kyc_templates_accountant ON public.kyc_checklist_templates(accountant_id);
  END IF;
END $$;

-- ============================================
-- 3. Client KYC Checklists
-- ============================================
CREATE TABLE IF NOT EXISTS public.client_kyc_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  template_id UUID REFERENCES public.kyc_checklist_templates(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL,
  is_required BOOLEAN DEFAULT TRUE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'uploaded', 'verified', 'rejected')),
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  uploaded_at TIMESTAMP WITH TIME ZONE,
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  reminder_count INTEGER DEFAULT 0,
  last_reminder_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(client_id, document_type)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_client_kyc_client') THEN
    CREATE INDEX idx_client_kyc_client ON public.client_kyc_checklists(client_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_client_kyc_status') THEN
    CREATE INDEX idx_client_kyc_status ON public.client_kyc_checklists(status);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_client_kyc_document') THEN
    CREATE INDEX idx_client_kyc_document ON public.client_kyc_checklists(document_id);
  END IF;
END $$;

-- ============================================
-- 4. Document Request Queue
-- ============================================
CREATE TABLE IF NOT EXISTS public.document_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  accountant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  document_type TEXT NOT NULL,
  request_type TEXT DEFAULT 'manual' CHECK (request_type IN ('manual', 'automated', 'reminder')),
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'received', 'expired')),
  sent_at TIMESTAMP WITH TIME ZONE,
  received_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  response_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_document_requests_client') THEN
    CREATE INDEX idx_document_requests_client ON public.document_requests(client_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_document_requests_status') THEN
    CREATE INDEX idx_document_requests_status ON public.document_requests(status);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_document_requests_expires') THEN
    CREATE INDEX idx_document_requests_expires ON public.document_requests(expires_at);
  END IF;
END $$;

-- ============================================
-- 5. Vendor Master (for normalization)
-- Use vendor_master to avoid conflict with vendor_mappings
-- ============================================
CREATE TABLE IF NOT EXISTS public.vendor_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accountant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  primary_name TEXT NOT NULL,
  alternate_names TEXT[] DEFAULT ARRAY[]::TEXT[],
  gstin TEXT,
  pan TEXT,
  phone_number TEXT,
  email TEXT,
  address TEXT,
  category TEXT,
  payment_terms TEXT,
  bank_details JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  total_transactions INTEGER DEFAULT 0,
  total_amount DECIMAL(15, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_vendor_master_accountant') THEN
    CREATE INDEX idx_vendor_master_accountant ON public.vendor_master(accountant_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_vendor_master_gstin') THEN
    CREATE INDEX idx_vendor_master_gstin ON public.vendor_master(gstin) WHERE gstin IS NOT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_vendor_master_pan') THEN
    CREATE INDEX idx_vendor_master_pan ON public.vendor_master(pan) WHERE pan IS NOT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_vendor_master_name') THEN
    CREATE INDEX idx_vendor_master_name ON public.vendor_master USING gin(to_tsvector('english', primary_name));
  END IF;
END $$;

-- ============================================
-- 6. WhatsApp Message Log (for analytics)
-- ============================================
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  accountant_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message_content JSONB,
  status TEXT DEFAULT 'received',
  whatsapp_message_id TEXT,
  error_message TEXT,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_whatsapp_messages_phone') THEN
    CREATE INDEX idx_whatsapp_messages_phone ON public.whatsapp_messages(phone_number);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_whatsapp_messages_client') THEN
    CREATE INDEX idx_whatsapp_messages_client ON public.whatsapp_messages(client_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_whatsapp_messages_created') THEN
    CREATE INDEX idx_whatsapp_messages_created ON public.whatsapp_messages(created_at);
  END IF;
END $$;

-- ============================================
-- 7. Rate Limiting Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.whatsapp_rate_limits (
  phone_number TEXT PRIMARY KEY,
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  blocked_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_rate_limits_blocked') THEN
    CREATE INDEX idx_rate_limits_blocked ON public.whatsapp_rate_limits(blocked_until) WHERE blocked_until IS NOT NULL;
  END IF;
END $$;

-- ============================================
-- 8. Payment Tracking
-- ============================================
CREATE TABLE IF NOT EXISTS public.payment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  accountant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  due_date DATE NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reminded', 'paid', 'overdue', 'cancelled')),
  reminder_count INTEGER DEFAULT 0,
  last_reminded_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payment_reminders_client') THEN
    CREATE INDEX idx_payment_reminders_client ON public.payment_reminders(client_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payment_reminders_status') THEN
    CREATE INDEX idx_payment_reminders_status ON public.payment_reminders(status);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payment_reminders_due_date') THEN
    CREATE INDEX idx_payment_reminders_due_date ON public.payment_reminders(due_date);
  END IF;
END $$;

-- ============================================
-- 9. GST Validation Cache
-- ============================================
CREATE TABLE IF NOT EXISTS public.gst_validation_cache (
  gstin TEXT PRIMARY KEY,
  legal_name TEXT,
  trade_name TEXT,
  registration_date DATE,
  business_type TEXT,
  status TEXT,
  validation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_valid BOOLEAN,
  error_message TEXT,
  raw_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_gst_validation_status') THEN
    CREATE INDEX idx_gst_validation_status ON public.gst_validation_cache(status);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_gst_validation_date') THEN
    CREATE INDEX idx_gst_validation_date ON public.gst_validation_cache(validation_date);
  END IF;
END $$;

-- ============================================
-- 10. Update existing invoices table with vendor_master_id
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'invoices'
    AND column_name = 'vendor_master_id'
  ) THEN
    ALTER TABLE public.invoices
    ADD COLUMN vendor_master_id UUID REFERENCES public.vendor_master(id) ON DELETE SET NULL;

    CREATE INDEX idx_invoices_vendor_master ON public.invoices(vendor_master_id);
  END IF;
END $$;

-- ============================================
-- 11. Update documents table with validation fields
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'documents'
    AND column_name = 'validation_errors'
  ) THEN
    ALTER TABLE public.documents
    ADD COLUMN validation_errors JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN validation_warnings JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN accounting_validated BOOLEAN DEFAULT FALSE,
    ADD COLUMN gst_validated BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- ============================================
-- 12. Helper Functions
-- ============================================

-- Function to get or create session
CREATE OR REPLACE FUNCTION get_or_create_whatsapp_session(
  p_phone_number TEXT,
  p_client_id UUID DEFAULT NULL,
  p_accountant_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_session_id UUID;
BEGIN
  SELECT id INTO v_session_id
  FROM public.whatsapp_sessions
  WHERE phone_number = p_phone_number
    AND expires_at > NOW();

  IF v_session_id IS NULL THEN
    INSERT INTO public.whatsapp_sessions (
      phone_number,
      client_id,
      accountant_id,
      state
    ) VALUES (
      p_phone_number,
      p_client_id,
      p_accountant_id,
      'idle'
    )
    RETURNING id INTO v_session_id;
  ELSE
    UPDATE public.whatsapp_sessions
    SET last_activity = NOW(),
        expires_at = NOW() + INTERVAL '24 hours',
        client_id = COALESCE(p_client_id, client_id),
        accountant_id = COALESCE(p_accountant_id, accountant_id)
    WHERE id = v_session_id;
  END IF;

  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check and update rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_phone_number TEXT,
  p_max_requests INTEGER DEFAULT 20,
  p_window_minutes INTEGER DEFAULT 60
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_count INTEGER;
  v_window_start TIMESTAMP;
  v_blocked_until TIMESTAMP;
BEGIN
  SELECT blocked_until INTO v_blocked_until
  FROM public.whatsapp_rate_limits
  WHERE phone_number = p_phone_number;

  IF v_blocked_until IS NOT NULL AND v_blocked_until > NOW() THEN
    RETURN FALSE;
  END IF;

  SELECT request_count, window_start INTO v_current_count, v_window_start
  FROM public.whatsapp_rate_limits
  WHERE phone_number = p_phone_number;

  IF v_window_start IS NULL OR v_window_start < (NOW() - (p_window_minutes || ' minutes')::INTERVAL) THEN
    INSERT INTO public.whatsapp_rate_limits (phone_number, request_count, window_start)
    VALUES (p_phone_number, 1, NOW())
    ON CONFLICT (phone_number)
    DO UPDATE SET
      request_count = 1,
      window_start = NOW(),
      blocked_until = NULL,
      updated_at = NOW();
    RETURN TRUE;
  ELSIF v_current_count >= p_max_requests THEN
    UPDATE public.whatsapp_rate_limits
    SET blocked_until = NOW() + INTERVAL '1 hour',
        updated_at = NOW()
    WHERE phone_number = p_phone_number;
    RETURN FALSE;
  ELSE
    UPDATE public.whatsapp_rate_limits
    SET request_count = request_count + 1,
        updated_at = NOW()
    WHERE phone_number = p_phone_number;
    RETURN TRUE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get pending KYC documents
CREATE OR REPLACE FUNCTION get_pending_kyc_documents(p_client_id UUID)
RETURNS TABLE(document_type TEXT, is_required BOOLEAN, reminder_count INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ckc.document_type,
    ckc.is_required,
    ckc.reminder_count
  FROM public.client_kyc_checklists ckc
  WHERE ckc.client_id = p_client_id
    AND ckc.status IN ('pending', 'rejected')
  ORDER BY ckc.is_required DESC, ckc.requested_at ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 13. Row Level Security (RLS) Policies
-- ============================================

ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_kyc_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_reminders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role full access on whatsapp_sessions" ON public.whatsapp_sessions;
DROP POLICY IF EXISTS "Service role full access on kyc_templates" ON public.kyc_checklist_templates;
DROP POLICY IF EXISTS "Service role full access on client_kyc" ON public.client_kyc_checklists;
DROP POLICY IF EXISTS "Service role full access on document_requests" ON public.document_requests;
DROP POLICY IF EXISTS "Service role full access on vendor_master" ON public.vendor_master;
DROP POLICY IF EXISTS "Service role full access on whatsapp_messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Service role full access on payment_reminders" ON public.payment_reminders;

-- Service role policies
CREATE POLICY "Service role full access on whatsapp_sessions"
  ON public.whatsapp_sessions FOR ALL
  TO service_role USING (true);

CREATE POLICY "Service role full access on kyc_templates"
  ON public.kyc_checklist_templates FOR ALL
  TO service_role USING (true);

CREATE POLICY "Service role full access on client_kyc"
  ON public.client_kyc_checklists FOR ALL
  TO service_role USING (true);

CREATE POLICY "Service role full access on document_requests"
  ON public.document_requests FOR ALL
  TO service_role USING (true);

CREATE POLICY "Service role full access on vendor_master"
  ON public.vendor_master FOR ALL
  TO service_role USING (true);

CREATE POLICY "Service role full access on whatsapp_messages"
  ON public.whatsapp_messages FOR ALL
  TO service_role USING (true);

CREATE POLICY "Service role full access on payment_reminders"
  ON public.payment_reminders FOR ALL
  TO service_role USING (true);

-- Drop authenticated user policies if they exist
DROP POLICY IF EXISTS "Accountants can view their own sessions" ON public.whatsapp_sessions;
DROP POLICY IF EXISTS "Accountants can manage their own templates" ON public.kyc_checklist_templates;
DROP POLICY IF EXISTS "Accountants can view their clients' KYC" ON public.client_kyc_checklists;
DROP POLICY IF EXISTS "Accountants can manage their own vendor_master" ON public.vendor_master;
DROP POLICY IF EXISTS "Accountants can manage their own document requests" ON public.document_requests;

-- Authenticated user policies
CREATE POLICY "Accountants can view their own sessions"
  ON public.whatsapp_sessions FOR SELECT
  USING (auth.uid() = accountant_id);

CREATE POLICY "Accountants can manage their own templates"
  ON public.kyc_checklist_templates FOR ALL
  USING (auth.uid() = accountant_id);

CREATE POLICY "Accountants can view their clients' KYC"
  ON public.client_kyc_checklists FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_kyc_checklists.client_id
      AND c.accountant_id = auth.uid()
    )
  );

CREATE POLICY "Accountants can manage their own vendor_master"
  ON public.vendor_master FOR ALL
  USING (auth.uid() = accountant_id);

CREATE POLICY "Accountants can manage their own document requests"
  ON public.document_requests FOR ALL
  USING (auth.uid() = accountant_id);

-- ============================================
-- COMPLETE: WhatsApp Complete Schema Migration (FIXED)
-- ============================================

-- Add helpful comments
COMMENT ON TABLE public.whatsapp_sessions IS 'Persistent WhatsApp session storage replacing in-memory Map';
COMMENT ON TABLE public.kyc_checklist_templates IS 'KYC document checklist templates for different business types';
COMMENT ON TABLE public.client_kyc_checklists IS 'Per-client KYC document tracking';
COMMENT ON TABLE public.vendor_master IS 'Normalized vendor master for invoice matching';
COMMENT ON TABLE public.document_requests IS 'Queue for accountant-initiated document requests';
COMMENT ON TABLE public.payment_reminders IS 'Payment reminder tracking for invoice due dates';
