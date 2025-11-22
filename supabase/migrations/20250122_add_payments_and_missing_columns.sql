-- Add missing tables and columns for WhatsApp sync features

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  amount NUMERIC(15, 2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('cash', 'cheque', 'bank_transfer', 'upi', 'card', 'whatsapp_confirmed', 'other')),
  transaction_reference TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_client ON payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Add missing columns to client_kyc_checklists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_kyc_checklists'
    AND column_name = 'reminder_count'
  ) THEN
    ALTER TABLE client_kyc_checklists ADD COLUMN reminder_count INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_kyc_checklists'
    AND column_name = 'last_reminder_sent'
  ) THEN
    ALTER TABLE client_kyc_checklists ADD COLUMN last_reminder_sent TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_kyc_checklists'
    AND column_name = 'due_date'
  ) THEN
    ALTER TABLE client_kyc_checklists ADD COLUMN due_date DATE;
  END IF;
END $$;

-- Add missing columns to document_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_requests'
    AND column_name = 'last_reminder_sent'
  ) THEN
    ALTER TABLE document_requests ADD COLUMN last_reminder_sent TIMESTAMPTZ;
  END IF;
END $$;

-- Add missing columns to documents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents'
    AND column_name = 'file_size'
  ) THEN
    ALTER TABLE documents ADD COLUMN file_size BIGINT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents'
    AND column_name = 'upload_source'
  ) THEN
    ALTER TABLE documents ADD COLUMN upload_source TEXT DEFAULT 'web' CHECK (upload_source IN ('web', 'whatsapp', 'email', 'api'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents'
    AND column_name = 'review_status'
  ) THEN
    ALTER TABLE documents ADD COLUMN review_status TEXT DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents'
    AND column_name = 'reviewed_at'
  ) THEN
    ALTER TABLE documents ADD COLUMN reviewed_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add invoice number to invoices if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices'
    AND column_name = 'vendor_name'
  ) THEN
    ALTER TABLE invoices ADD COLUMN vendor_name TEXT;
  END IF;
END $$;

-- Create GST filings tracking table
CREATE TABLE IF NOT EXISTS gst_filings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  filing_type TEXT NOT NULL CHECK (filing_type IN ('GSTR-1', 'GSTR-3B', 'GSTR-4', 'GSTR-9')),
  filing_period TEXT NOT NULL, -- Format: MM/YYYY
  due_date DATE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'filed', 'late_filed', 'cancelled')),
  filed_date DATE,
  acknowledgment_number TEXT,
  filed_by UUID REFERENCES auth.users(id),
  reminder_count INTEGER DEFAULT 0,
  last_reminder_sent TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gst_filings_client ON gst_filings(client_id);
CREATE INDEX IF NOT EXISTS idx_gst_filings_status ON gst_filings(status);
CREATE INDEX IF NOT EXISTS idx_gst_filings_due_date ON gst_filings(due_date);
CREATE INDEX IF NOT EXISTS idx_gst_filings_period ON gst_filings(filing_period);

-- Create notifications table for in-app notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'success')),
  read BOOLEAN DEFAULT FALSE,
  action_url TEXT,
  action_label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_payments_updated_at') THEN
    CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_gst_filings_updated_at') THEN
    CREATE TRIGGER update_gst_filings_updated_at
    BEFORE UPDATE ON gst_filings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Trigger to send payment confirmation notification
CREATE OR REPLACE FUNCTION trigger_notify_payment_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Notify when payment is created
  IF (TG_OP = 'INSERT' AND NEW.status = 'completed') THEN
    PERFORM notify_whatsapp(
      'payment_confirmation',
      jsonb_build_object(
        'invoice_id', NEW.invoice_id,
        'client_id', NEW.client_id,
        'payment_amount', NEW.amount,
        'payment_date', NEW.payment_date
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_payment_confirmation_trigger ON payments;
CREATE TRIGGER notify_payment_confirmation_trigger
AFTER INSERT ON payments
FOR EACH ROW
EXECUTE FUNCTION trigger_notify_payment_confirmation();

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON gst_filings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO authenticated;

GRANT ALL ON payments TO service_role;
GRANT ALL ON gst_filings TO service_role;
GRANT ALL ON notifications TO service_role;

-- Enable Row Level Security
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE gst_filings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payments
CREATE POLICY "Users can view their client's payments"
  ON payments FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients WHERE accountant_id = auth.uid()
    )
    OR client_id IN (
      SELECT id FROM clients WHERE id IN (
        SELECT client_id FROM user_roles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Accountants can insert payments for their clients"
  ON payments FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT id FROM clients WHERE accountant_id = auth.uid()
    )
  );

CREATE POLICY "Accountants can update their client's payments"
  ON payments FOR UPDATE
  USING (
    client_id IN (
      SELECT id FROM clients WHERE accountant_id = auth.uid()
    )
  );

-- RLS Policies for gst_filings
CREATE POLICY "Users can view their client's GST filings"
  ON gst_filings FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients WHERE accountant_id = auth.uid()
    )
    OR client_id IN (
      SELECT id FROM clients WHERE id IN (
        SELECT client_id FROM user_roles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Accountants can manage GST filings for their clients"
  ON gst_filings FOR ALL
  USING (
    client_id IN (
      SELECT id FROM clients WHERE accountant_id = auth.uid()
    )
  );

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Service role can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- Create view for payment summary
CREATE OR REPLACE VIEW payment_summary AS
SELECT
  p.client_id,
  c.business_name,
  COUNT(p.id) as total_payments,
  SUM(p.amount) as total_amount,
  COUNT(CASE WHEN p.status = 'completed' THEN 1 END) as completed_payments,
  COUNT(CASE WHEN p.status = 'pending' THEN 1 END) as pending_payments,
  MAX(p.payment_date) as last_payment_date
FROM payments p
JOIN clients c ON c.id = p.client_id
GROUP BY p.client_id, c.business_name;

GRANT SELECT ON payment_summary TO authenticated, service_role;

COMMENT ON TABLE payments IS 'Payment records for invoices';
COMMENT ON TABLE gst_filings IS 'GST filing tracking and reminders';
COMMENT ON TABLE notifications IS 'In-app notifications for users';
COMMENT ON VIEW payment_summary IS 'Summary of payments by client';
