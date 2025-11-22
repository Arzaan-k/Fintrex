-- WhatsApp Sync Triggers
-- Automatically send WhatsApp notifications when events occur in the database

-- Function to call WhatsApp notification service via HTTP
CREATE OR REPLACE FUNCTION notify_whatsapp(notification_type TEXT, payload JSONB)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;
  whatsapp_function_url text;
BEGIN
  -- Get the Supabase URL from app settings or use environment
  whatsapp_function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/whatsapp-notify';

  -- If setting doesn't exist, try to construct from current database
  IF whatsapp_function_url IS NULL OR whatsapp_function_url = '' THEN
    whatsapp_function_url := 'https://' || current_setting('app.settings.project_ref', true) || '.supabase.co/functions/v1/whatsapp-notify';
  END IF;

  -- Make async HTTP request to notification service
  -- Using pg_net extension for async HTTP calls
  SELECT net.http_post(
    url := whatsapp_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'notification_type', notification_type,
      'payload', payload
    )
  ) INTO request_id;

  -- Log the notification request
  INSERT INTO whatsapp_notifications_log (
    notification_type,
    payload,
    request_id,
    created_at
  ) VALUES (
    notification_type,
    payload,
    request_id,
    NOW()
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to send WhatsApp notification: %', SQLERRM;
END;
$$;

-- Create notifications log table
CREATE TABLE IF NOT EXISTS whatsapp_notifications_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  request_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_log_type ON whatsapp_notifications_log(notification_type);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_log_created ON whatsapp_notifications_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_log_status ON whatsapp_notifications_log(status);

-- Trigger: Document status changes
CREATE OR REPLACE FUNCTION trigger_notify_document_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only notify on status changes to completed, failed, or review_pending
  IF (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status) THEN
    IF NEW.status IN ('completed', 'failed', 'review_pending') THEN
      PERFORM notify_whatsapp(
        'document_status',
        jsonb_build_object(
          'document_id', NEW.id,
          'client_id', NEW.client_id,
          'status', NEW.status,
          'file_name', NEW.file_name
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_document_status_trigger ON documents;
CREATE TRIGGER notify_document_status_trigger
AFTER UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION trigger_notify_document_status();

-- Trigger: Journal entry created
CREATE OR REPLACE FUNCTION trigger_notify_journal_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Notify when new journal entry is created
  IF (TG_OP = 'INSERT') THEN
    PERFORM notify_whatsapp(
      'journal_entry',
      jsonb_build_object(
        'journal_entry_id', NEW.id,
        'client_id', NEW.client_id,
        'transaction_date', NEW.transaction_date,
        'description', NEW.description,
        'debit_amount', NEW.debit_amount,
        'credit_amount', NEW.credit_amount
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_journal_entry_trigger ON journal_entries;
CREATE TRIGGER notify_journal_entry_trigger
AFTER INSERT ON journal_entries
FOR EACH ROW
EXECUTE FUNCTION trigger_notify_journal_entry();

-- Trigger: Payment reminder
CREATE OR REPLACE FUNCTION trigger_notify_payment_reminder()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Notify when payment reminder is created or updated
  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status = 'overdue' AND OLD.status != 'overdue')) THEN
    PERFORM notify_whatsapp(
      'payment_reminder',
      jsonb_build_object(
        'invoice_id', NEW.invoice_id,
        'client_id', NEW.client_id,
        'due_date', NEW.due_date,
        'reminder_type', NEW.status,
        'reminder_count', NEW.reminder_count
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create payment_reminders table if it doesn't exist
CREATE TABLE IF NOT EXISTS payment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reminded', 'overdue', 'paid')),
  reminder_count INTEGER DEFAULT 0,
  last_reminder_sent TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_reminders_invoice ON payment_reminders(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_reminders_client ON payment_reminders(client_id);
CREATE INDEX IF NOT EXISTS idx_payment_reminders_status ON payment_reminders(status);
CREATE INDEX IF NOT EXISTS idx_payment_reminders_due_date ON payment_reminders(due_date);

DROP TRIGGER IF EXISTS notify_payment_reminder_trigger ON payment_reminders;
CREATE TRIGGER notify_payment_reminder_trigger
AFTER INSERT OR UPDATE ON payment_reminders
FOR EACH ROW
EXECUTE FUNCTION trigger_notify_payment_reminder();

-- Trigger: Anomaly detected
CREATE OR REPLACE FUNCTION trigger_notify_anomaly()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Notify when new anomaly is detected
  IF (TG_OP = 'INSERT') THEN
    PERFORM notify_whatsapp(
      'anomaly',
      jsonb_build_object(
        'document_id', NEW.document_id,
        'client_id', NEW.client_id,
        'anomaly_type', NEW.anomaly_type,
        'details', NEW.details,
        'severity', NEW.severity
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create anomalies table if it doesn't exist
CREATE TABLE IF NOT EXISTS anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  anomaly_type TEXT NOT NULL CHECK (anomaly_type IN ('amount_spike', 'duplicate', 'missing_sequence', 'tax_mismatch', 'other')),
  details TEXT,
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'ignored')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anomalies_document ON anomalies(document_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_client ON anomalies(client_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_status ON anomalies(status);
CREATE INDEX IF NOT EXISTS idx_anomalies_type ON anomalies(anomaly_type);

DROP TRIGGER IF EXISTS notify_anomaly_trigger ON anomalies;
CREATE TRIGGER notify_anomaly_trigger
AFTER INSERT ON anomalies
FOR EACH ROW
EXECUTE FUNCTION trigger_notify_anomaly();

-- Trigger: KYC document request
CREATE OR REPLACE FUNCTION trigger_notify_kyc_request()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Notify when KYC checklist item is created or updated to pending
  IF (TG_OP = 'INSERT' AND NEW.status = 'pending') OR
     (TG_OP = 'UPDATE' AND NEW.status = 'pending' AND OLD.status != 'pending') THEN
    PERFORM notify_whatsapp(
      'kyc_request',
      jsonb_build_object(
        'client_id', NEW.client_id,
        'document_type', NEW.document_type,
        'due_date', NEW.due_date
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_kyc_request_trigger ON client_kyc_checklists;
CREATE TRIGGER notify_kyc_request_trigger
AFTER INSERT OR UPDATE ON client_kyc_checklists
FOR EACH ROW
EXECUTE FUNCTION trigger_notify_kyc_request();

-- Trigger: Document request
CREATE OR REPLACE FUNCTION trigger_notify_document_request()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Notify when document request is created
  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.reminder_count > OLD.reminder_count)) THEN
    PERFORM notify_whatsapp(
      'document_request',
      jsonb_build_object(
        'client_id', NEW.client_id,
        'document_type', NEW.document_type,
        'priority', NEW.priority,
        'reminder_count', NEW.reminder_count
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Add reminder_count column to document_requests if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_requests'
    AND column_name = 'reminder_count'
  ) THEN
    ALTER TABLE document_requests ADD COLUMN reminder_count INTEGER DEFAULT 0;
  END IF;
END $$;

DROP TRIGGER IF EXISTS notify_document_request_trigger ON document_requests;
CREATE TRIGGER notify_document_request_trigger
AFTER INSERT OR UPDATE ON document_requests
FOR EACH ROW
EXECUTE FUNCTION trigger_notify_document_request();

-- Function to create payment reminders automatically when invoice is created
CREATE OR REPLACE FUNCTION create_payment_reminder_for_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_due_date DATE;
BEGIN
  -- Calculate due date (30 days from invoice date by default)
  v_due_date := NEW.invoice_date + INTERVAL '30 days';

  -- Create payment reminder
  INSERT INTO payment_reminders (
    invoice_id,
    client_id,
    due_date,
    status,
    reminder_count
  ) VALUES (
    NEW.id,
    NEW.client_id,
    v_due_date,
    'pending',
    0
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_payment_reminder_trigger ON invoices;
CREATE TRIGGER create_payment_reminder_trigger
AFTER INSERT ON invoices
FOR EACH ROW
EXECUTE FUNCTION create_payment_reminder_for_invoice();

-- Function to check for anomalies when document is completed
CREATE OR REPLACE FUNCTION check_document_anomalies()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_extracted_data JSONB;
  v_grand_total NUMERIC;
  v_avg_amount NUMERIC;
  v_duplicate_count INTEGER;
BEGIN
  -- Only check when document status changes to completed
  IF (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status != 'completed') THEN
    v_extracted_data := NEW.extracted_data;

    -- Get grand total from extracted data
    v_grand_total := (v_extracted_data->>'grand_total')::NUMERIC;

    IF v_grand_total IS NOT NULL THEN
      -- Check for amount spike (more than 3x average)
      SELECT AVG((extracted_data->>'grand_total')::NUMERIC)
      INTO v_avg_amount
      FROM documents
      WHERE client_id = NEW.client_id
        AND status = 'completed'
        AND (extracted_data->>'grand_total')::NUMERIC IS NOT NULL
        AND id != NEW.id
        AND created_at > NOW() - INTERVAL '90 days';

      IF v_avg_amount IS NOT NULL AND v_grand_total > (v_avg_amount * 3) THEN
        INSERT INTO anomalies (
          document_id,
          client_id,
          anomaly_type,
          details,
          severity,
          status
        ) VALUES (
          NEW.id,
          NEW.client_id,
          'amount_spike',
          format('Amount ₹%s is significantly higher than average ₹%s', v_grand_total, ROUND(v_avg_amount, 2)),
          'high',
          'pending'
        );
      END IF;

      -- Check for potential duplicates
      SELECT COUNT(*)
      INTO v_duplicate_count
      FROM documents
      WHERE client_id = NEW.client_id
        AND status = 'completed'
        AND id != NEW.id
        AND (extracted_data->>'invoice_number') = (v_extracted_data->>'invoice_number')
        AND (extracted_data->>'vendor_name') = (v_extracted_data->>'vendor_name');

      IF v_duplicate_count > 0 THEN
        INSERT INTO anomalies (
          document_id,
          client_id,
          anomaly_type,
          details,
          severity,
          status
        ) VALUES (
          NEW.id,
          NEW.client_id,
          'duplicate',
          format('Found %s document(s) with same invoice number and vendor', v_duplicate_count),
          'high',
          'pending'
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_document_anomalies_trigger ON documents;
CREATE TRIGGER check_document_anomalies_trigger
AFTER UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION check_document_anomalies();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

COMMENT ON FUNCTION notify_whatsapp IS 'Send WhatsApp notification via edge function';
COMMENT ON TABLE whatsapp_notifications_log IS 'Log of all WhatsApp notifications sent';
COMMENT ON TABLE payment_reminders IS 'Payment reminders for invoices';
COMMENT ON TABLE anomalies IS 'Detected anomalies in documents';
