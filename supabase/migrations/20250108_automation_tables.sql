-- Migration: Automation Tables for Fintrex
-- Creates tables for processing queue, journal entries, and notifications

-- ===========================================
-- 1. Processing Queue Table
-- ===========================================
CREATE TABLE IF NOT EXISTS processing_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  accountant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_phone TEXT,
  sender_email TEXT,
  source TEXT NOT NULL CHECK (source IN ('whatsapp', 'email', 'web')),
  file_name TEXT NOT NULL,
  file_path TEXT,
  file_data TEXT, -- Base64 encoded file data (temporary storage)
  mime_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  result JSONB,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_processing_queue_status ON processing_queue(status);
CREATE INDEX idx_processing_queue_client_id ON processing_queue(client_id);
CREATE INDEX idx_processing_queue_created_at ON processing_queue(created_at DESC);

-- ===========================================
-- 2. Journal Entries Table
-- ===========================================
CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  entry_type TEXT CHECK (entry_type IN ('sales', 'purchase', 'payment', 'receipt', 'adjustment', 'other')),
  narration TEXT,
  is_auto_generated BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'reversed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_journal_entries_client_id ON journal_entries(client_id);
CREATE INDEX idx_journal_entries_entry_date ON journal_entries(entry_date DESC);
CREATE INDEX idx_journal_entries_status ON journal_entries(status);

-- ===========================================
-- 3. Journal Line Items Table
-- ===========================================
CREATE TABLE IF NOT EXISTS journal_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_name TEXT NOT NULL,
  account_code TEXT,
  debit_amount NUMERIC(15, 2) DEFAULT 0 CHECK (debit_amount >= 0),
  credit_amount NUMERIC(15, 2) DEFAULT 0 CHECK (credit_amount >= 0),
  reference_document_id UUID REFERENCES documents(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_journal_line_items_entry_id ON journal_line_items(entry_id);
CREATE INDEX idx_journal_line_items_account_name ON journal_line_items(account_name);

-- Add constraint: debit and credit cannot both be non-zero
ALTER TABLE journal_line_items 
ADD CONSTRAINT chk_debit_or_credit CHECK (
  (debit_amount = 0 AND credit_amount > 0) OR
  (debit_amount > 0 AND credit_amount = 0)
);

-- ===========================================
-- 4. Notifications Table
-- ===========================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- ===========================================
-- 5. Chart of Accounts Table
-- ===========================================
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  accountant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_code TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'income', 'expense')),
  parent_account_id UUID REFERENCES chart_of_accounts(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(accountant_id, account_code)
);

CREATE INDEX idx_chart_of_accounts_accountant_id ON chart_of_accounts(accountant_id);
CREATE INDEX idx_chart_of_accounts_account_type ON chart_of_accounts(account_type);

-- ===========================================
-- 6. Add missing columns to existing tables
-- ===========================================

-- Add whatsapp_number to profiles if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='whatsapp_number') THEN
    ALTER TABLE profiles ADD COLUMN whatsapp_number TEXT;
    CREATE INDEX idx_profiles_whatsapp_number ON profiles(whatsapp_number);
  END IF;
END $$;

-- Add phone_number to profiles if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='phone_number') THEN
    ALTER TABLE profiles ADD COLUMN phone_number TEXT;
    CREATE INDEX idx_profiles_phone_number ON profiles(phone_number);
  END IF;
END $$;

-- ===========================================
-- 7. Row Level Security (RLS) Policies
-- ===========================================

-- Enable RLS on new tables
ALTER TABLE processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;

-- Processing Queue Policies
CREATE POLICY "Users can view their own processing jobs"
  ON processing_queue FOR SELECT
  USING (
    accountant_id = auth.uid() OR
    client_id IN (SELECT id FROM clients WHERE accountant_id = auth.uid())
  );

CREATE POLICY "System can insert processing jobs"
  ON processing_queue FOR INSERT
  WITH CHECK (true); -- Allow Edge Functions to insert

CREATE POLICY "System can update processing jobs"
  ON processing_queue FOR UPDATE
  USING (true); -- Allow Edge Functions to update

-- Journal Entries Policies
CREATE POLICY "Accountants can view their clients' journal entries"
  ON journal_entries FOR SELECT
  USING (
    client_id IN (SELECT id FROM clients WHERE accountant_id = auth.uid())
  );

CREATE POLICY "Accountants can create journal entries for their clients"
  ON journal_entries FOR INSERT
  WITH CHECK (
    client_id IN (SELECT id FROM clients WHERE accountant_id = auth.uid())
  );

CREATE POLICY "Accountants can update their clients' journal entries"
  ON journal_entries FOR UPDATE
  USING (
    client_id IN (SELECT id FROM clients WHERE accountant_id = auth.uid())
  );

-- Journal Line Items Policies
CREATE POLICY "View journal line items through parent entry"
  ON journal_line_items FOR SELECT
  USING (
    entry_id IN (
      SELECT id FROM journal_entries 
      WHERE client_id IN (SELECT id FROM clients WHERE accountant_id = auth.uid())
    )
  );

CREATE POLICY "Insert journal line items through parent entry"
  ON journal_line_items FOR INSERT
  WITH CHECK (
    entry_id IN (
      SELECT id FROM journal_entries 
      WHERE client_id IN (SELECT id FROM clients WHERE accountant_id = auth.uid())
    )
  );

-- Notifications Policies
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (true); -- Allow Edge Functions to create

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Chart of Accounts Policies
CREATE POLICY "Accountants can view their own chart of accounts"
  ON chart_of_accounts FOR SELECT
  USING (accountant_id = auth.uid());

CREATE POLICY "Accountants can manage their own chart of accounts"
  ON chart_of_accounts FOR ALL
  USING (accountant_id = auth.uid());

-- ===========================================
-- 8. Helper Functions
-- ===========================================

-- Function to increment client document counts
CREATE OR REPLACE FUNCTION increment_client_documents(
  client_id UUID,
  increment_total BOOLEAN DEFAULT TRUE,
  increment_completed BOOLEAN DEFAULT FALSE
) RETURNS VOID AS $$
BEGIN
  IF increment_total THEN
    UPDATE clients 
    SET total_documents = COALESCE(total_documents, 0) + 1 
    WHERE id = client_id;
  END IF;
  
  IF increment_completed THEN
    UPDATE clients 
    SET completed_documents = COALESCE(completed_documents, 0) + 1 
    WHERE id = client_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get client's financial summary
CREATE OR REPLACE FUNCTION get_client_financial_summary(p_client_id UUID)
RETURNS TABLE (
  total_income NUMERIC,
  total_expenses NUMERIC,
  net_profit NUMERIC,
  total_assets NUMERIC,
  total_liabilities NUMERIC,
  net_worth NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN record_type = 'income' THEN amount ELSE 0 END), 0) as total_income,
    COALESCE(SUM(CASE WHEN record_type = 'expense' THEN amount ELSE 0 END), 0) as total_expenses,
    COALESCE(SUM(CASE WHEN record_type = 'income' THEN amount ELSE -amount END), 0) as net_profit,
    COALESCE(SUM(CASE WHEN record_type = 'asset' THEN amount ELSE 0 END), 0) as total_assets,
    COALESCE(SUM(CASE WHEN record_type = 'liability' THEN amount ELSE 0 END), 0) as total_liabilities,
    COALESCE(
      SUM(CASE WHEN record_type = 'asset' THEN amount ELSE 0 END) -
      SUM(CASE WHEN record_type = 'liability' THEN amount ELSE 0 END),
    0) as net_worth
  FROM financial_records
  WHERE client_id = p_client_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- 9. Triggers for updated_at
-- ===========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_processing_queue_updated_at 
  BEFORE UPDATE ON processing_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_journal_entries_updated_at 
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chart_of_accounts_updated_at 
  BEFORE UPDATE ON chart_of_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- 10. Insert Default Chart of Accounts
-- ===========================================

-- This will be populated when an accountant signs up
-- For now, we'll create a function they can call

CREATE OR REPLACE FUNCTION initialize_chart_of_accounts(p_accountant_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Assets
  INSERT INTO chart_of_accounts (accountant_id, account_code, account_name, account_type) VALUES
    (p_accountant_id, '1000', 'Assets', 'asset'),
    (p_accountant_id, '1100', 'Current Assets', 'asset'),
    (p_accountant_id, '1110', 'Cash', 'asset'),
    (p_accountant_id, '1120', 'Bank Accounts', 'asset'),
    (p_accountant_id, '1130', 'Debtors', 'asset'),
    (p_accountant_id, '1140', 'Inventory', 'asset'),
    (p_accountant_id, '1200', 'Fixed Assets', 'asset'),
    (p_accountant_id, '1210', 'Plant & Machinery', 'asset'),
    (p_accountant_id, '1220', 'Furniture & Fixtures', 'asset');
  
  -- Liabilities
  INSERT INTO chart_of_accounts (accountant_id, account_code, account_name, account_type) VALUES
    (p_accountant_id, '2000', 'Liabilities', 'liability'),
    (p_accountant_id, '2100', 'Current Liabilities', 'liability'),
    (p_accountant_id, '2110', 'Creditors', 'liability'),
    (p_accountant_id, '2120', 'Bank Overdraft', 'liability'),
    (p_accountant_id, '2200', 'Long-term Liabilities', 'liability'),
    (p_accountant_id, '2210', 'Loans', 'liability');
  
  -- Equity
  INSERT INTO chart_of_accounts (accountant_id, account_code, account_name, account_type) VALUES
    (p_accountant_id, '3000', 'Equity', 'equity'),
    (p_accountant_id, '3100', 'Share Capital', 'equity'),
    (p_accountant_id, '3200', 'Retained Earnings', 'equity');
  
  -- Income
  INSERT INTO chart_of_accounts (accountant_id, account_code, account_name, account_type) VALUES
    (p_accountant_id, '4000', 'Income', 'income'),
    (p_accountant_id, '4100', 'Sales', 'income'),
    (p_accountant_id, '4200', 'Other Income', 'income');
  
  -- Expenses
  INSERT INTO chart_of_accounts (accountant_id, account_code, account_name, account_type) VALUES
    (p_accountant_id, '5000', 'Expenses', 'expense'),
    (p_accountant_id, '5100', 'Cost of Goods Sold', 'expense'),
    (p_accountant_id, '5200', 'Operating Expenses', 'expense'),
    (p_accountant_id, '5210', 'Salaries', 'expense'),
    (p_accountant_id, '5220', 'Rent', 'expense'),
    (p_accountant_id, '5230', 'Utilities', 'expense'),
    (p_accountant_id, '5240', 'Travel & Conveyance', 'expense');
    
  -- GST Accounts
  INSERT INTO chart_of_accounts (accountant_id, account_code, account_name, account_type) VALUES
    (p_accountant_id, '1150', 'GST Input', 'asset'),
    (p_accountant_id, '2130', 'GST Output', 'liability');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- DONE!
-- ===========================================

COMMENT ON TABLE processing_queue IS 'Queue for automated document processing from WhatsApp/Email';
COMMENT ON TABLE journal_entries IS 'Accounting journal entries (auto and manual)';
COMMENT ON TABLE journal_line_items IS 'Line items for journal entries (debits and credits)';
COMMENT ON TABLE notifications IS 'User notifications for document processing and other events';
COMMENT ON TABLE chart_of_accounts IS 'Chart of accounts for each accountant';
