-- Migration: Enhanced Double-Entry Accounting System
-- Adds comprehensive Indian accounting structure and automation

-- ===========================================
-- 1. Enhance Journal Entries Table
-- ===========================================

-- Add reference to invoices for better tracking
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS reference_document_id UUID REFERENCES documents(id) ON DELETE SET NULL;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS reference_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS fiscal_year INTEGER;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS period TEXT; -- 'Q1', 'Q2', etc.

CREATE INDEX IF NOT EXISTS idx_journal_entries_reference_document ON journal_entries(reference_document_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_reference_invoice ON journal_entries(reference_invoice_id);

-- ===========================================
-- 2. Enhance Chart of Accounts
-- ===========================================

-- Add more fields for comprehensive accounting
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS category TEXT; -- 'current_assets', 'operating_expenses', etc.
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS sub_category TEXT;
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS current_balance NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS is_system_account BOOLEAN DEFAULT FALSE; -- Cannot be deleted
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS description TEXT;

-- ===========================================
-- 3. Link Journal Line Items to Chart of Accounts
-- ===========================================

-- Add account_id reference (migration from account_name to account_id)
ALTER TABLE journal_line_items ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES chart_of_accounts(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_journal_line_items_account_id ON journal_line_items(account_id);

-- ===========================================
-- 4. Create Function to Validate Journal Entry Balance
-- ===========================================

CREATE OR REPLACE FUNCTION validate_journal_entry_balance(p_entry_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  total_debits NUMERIC;
  total_credits NUMERIC;
BEGIN
  SELECT
    COALESCE(SUM(debit_amount), 0),
    COALESCE(SUM(credit_amount), 0)
  INTO total_debits, total_credits
  FROM journal_line_items
  WHERE entry_id = p_entry_id;

  -- Return true if balanced (within 0.01 tolerance for rounding)
  RETURN ABS(total_debits - total_credits) < 0.01;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- 5. Create Function to Auto-Generate Journal Entry from Invoice
-- ===========================================

CREATE OR REPLACE FUNCTION create_journal_from_invoice(p_invoice_id UUID)
RETURNS UUID AS $$
DECLARE
  v_invoice RECORD;
  v_entry_id UUID;
  v_client_id UUID;
  v_accountant_id UUID;
  v_accounts_receivable_id UUID;
  v_accounts_payable_id UUID;
  v_sales_id UUID;
  v_purchases_id UUID;
  v_gst_input_id UUID;
  v_gst_output_id UUID;
BEGIN
  -- Get invoice details
  SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found: %', p_invoice_id;
  END IF;

  v_client_id := v_invoice.client_id;

  -- Get accountant_id from client
  SELECT accountant_id INTO v_accountant_id FROM clients WHERE id = v_client_id;

  -- Get account IDs from chart of accounts (create if they don't exist)
  -- For simplicity, we'll use account_name matching for now
  -- In production, you'd want to ensure proper account setup

  -- Create journal entry
  INSERT INTO journal_entries (
    client_id,
    entry_date,
    entry_type,
    narration,
    reference_invoice_id,
    reference_document_id,
    is_auto_generated,
    created_by,
    status
  ) VALUES (
    v_client_id,
    v_invoice.invoice_date,
    v_invoice.invoice_type,
    'Auto-generated from invoice ' || v_invoice.invoice_number,
    p_invoice_id,
    v_invoice.document_id,
    TRUE,
    v_accountant_id,
    'posted'
  ) RETURNING id INTO v_entry_id;

  IF v_invoice.invoice_type = 'sales' THEN
    -- Sales Invoice Journal Entry:
    -- DR: Accounts Receivable (Asset)
    -- CR: Sales (Income)
    -- CR: GST Output (Liability)

    INSERT INTO journal_line_items (entry_id, account_name, account_code, debit_amount, credit_amount, reference_document_id)
    VALUES
      -- Debit: Accounts Receivable (Total Amount)
      (v_entry_id, 'Accounts Receivable', '1130', v_invoice.total_amount, 0, v_invoice.document_id),
      -- Credit: Sales (Subtotal)
      (v_entry_id, 'Sales', '4100', 0, v_invoice.subtotal, v_invoice.document_id),
      -- Credit: CGST Output
      (v_entry_id, 'GST Output - CGST', '2131', 0, COALESCE(v_invoice.cgst, 0), v_invoice.document_id),
      -- Credit: SGST Output
      (v_entry_id, 'GST Output - SGST', '2132', 0, COALESCE(v_invoice.sgst, 0), v_invoice.document_id),
      -- Credit: IGST Output
      (v_entry_id, 'GST Output - IGST', '2133', 0, COALESCE(v_invoice.igst, 0), v_invoice.document_id);

  ELSIF v_invoice.invoice_type = 'purchase' THEN
    -- Purchase Invoice Journal Entry:
    -- DR: Purchases/Expenses (Expense)
    -- DR: GST Input (Asset)
    -- CR: Accounts Payable (Liability)

    INSERT INTO journal_line_items (entry_id, account_name, account_code, debit_amount, credit_amount, reference_document_id)
    VALUES
      -- Debit: Purchases (Subtotal)
      (v_entry_id, 'Purchases', '5100', v_invoice.subtotal, 0, v_invoice.document_id),
      -- Debit: CGST Input
      (v_entry_id, 'GST Input - CGST', '1151', COALESCE(v_invoice.cgst, 0), 0, v_invoice.document_id),
      -- Debit: SGST Input
      (v_entry_id, 'GST Input - SGST', '1152', COALESCE(v_invoice.sgst, 0), 0, v_invoice.document_id),
      -- Debit: IGST Input
      (v_entry_id, 'GST Input - IGST', '1153', COALESCE(v_invoice.igst, 0), 0, v_invoice.document_id),
      -- Credit: Accounts Payable (Total Amount)
      (v_entry_id, 'Accounts Payable', '2110', 0, v_invoice.total_amount, v_invoice.document_id);
  END IF;

  -- Validate entry is balanced
  IF NOT validate_journal_entry_balance(v_entry_id) THEN
    RAISE EXCEPTION 'Journal entry is not balanced for invoice %', p_invoice_id;
  END IF;

  RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- 6. Create Trigger to Auto-Create Journal Entry on Invoice Insert
-- ===========================================

CREATE OR REPLACE FUNCTION trigger_create_journal_from_invoice()
RETURNS TRIGGER AS $$
BEGIN
  -- Only auto-create for sales and purchase invoices
  IF NEW.invoice_type IN ('sales', 'purchase') AND NEW.auto_generated = TRUE THEN
    BEGIN
      PERFORM create_journal_from_invoice(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the invoice insert
      RAISE WARNING 'Failed to create journal entry for invoice %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS auto_create_journal_from_invoice ON invoices;

CREATE TRIGGER auto_create_journal_from_invoice
  AFTER INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_journal_from_invoice();

-- ===========================================
-- 7. Enhanced Chart of Accounts - Indian GST Compliant
-- ===========================================

-- Function to populate comprehensive Indian chart of accounts
CREATE OR REPLACE FUNCTION initialize_indian_chart_of_accounts(p_accountant_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Delete existing accounts for this accountant (fresh start)
  DELETE FROM chart_of_accounts WHERE accountant_id = p_accountant_id AND is_system_account = FALSE;

  -- ASSETS (1000-1999)
  INSERT INTO chart_of_accounts (accountant_id, account_code, account_name, account_type, category, is_system_account, display_order, description) VALUES
    (p_accountant_id, '1000', 'Assets', 'asset', 'parent', TRUE, 10, 'Total Assets'),

    -- Current Assets (1100-1499)
    (p_accountant_id, '1100', 'Current Assets', 'asset', 'current_assets', TRUE, 110, 'Assets expected to be converted to cash within a year'),
    (p_accountant_id, '1110', 'Cash in Hand', 'asset', 'current_assets', TRUE, 111, 'Physical cash'),
    (p_accountant_id, '1120', 'Cash at Bank', 'asset', 'current_assets', TRUE, 112, 'Bank account balances'),
    (p_accountant_id, '1130', 'Accounts Receivable', 'asset', 'current_assets', TRUE, 113, 'Money owed by customers (Debtors/Sundry Debtors)'),
    (p_accountant_id, '1140', 'Inventory', 'asset', 'current_assets', TRUE, 114, 'Stock of goods'),
    (p_accountant_id, '1150', 'GST Input Tax Credit', 'asset', 'current_assets', TRUE, 115, 'Input tax credit available'),
    (p_accountant_id, '1151', 'GST Input - CGST', 'asset', 'current_assets', TRUE, 116, 'Central GST paid on purchases'),
    (p_accountant_id, '1152', 'GST Input - SGST', 'asset', 'current_assets', TRUE, 117, 'State GST paid on purchases'),
    (p_accountant_id, '1153', 'GST Input - IGST', 'asset', 'current_assets', TRUE, 118, 'Integrated GST paid on inter-state purchases'),
    (p_accountant_id, '1160', 'Prepaid Expenses', 'asset', 'current_assets', TRUE, 119, 'Advance payments for expenses'),
    (p_accountant_id, '1170', 'Short-term Investments', 'asset', 'current_assets', TRUE, 120, 'Investments with maturity < 1 year'),

    -- Fixed Assets (1500-1899)
    (p_accountant_id, '1500', 'Fixed Assets', 'asset', 'non_current_assets', TRUE, 150, 'Long-term assets'),
    (p_accountant_id, '1510', 'Land & Buildings', 'asset', 'non_current_assets', TRUE, 151, 'Property owned'),
    (p_accountant_id, '1520', 'Plant & Machinery', 'asset', 'non_current_assets', TRUE, 152, 'Manufacturing equipment'),
    (p_accountant_id, '1530', 'Furniture & Fixtures', 'asset', 'non_current_assets', TRUE, 153, 'Office furniture'),
    (p_accountant_id, '1540', 'Vehicles', 'asset', 'non_current_assets', TRUE, 154, 'Company vehicles'),
    (p_accountant_id, '1550', 'Computers & Electronics', 'asset', 'non_current_assets', TRUE, 155, 'IT equipment'),
    (p_accountant_id, '1560', 'Accumulated Depreciation', 'asset', 'non_current_assets', TRUE, 156, 'Total depreciation on fixed assets'),

    -- Other Assets (1900-1999)
    (p_accountant_id, '1900', 'Long-term Investments', 'asset', 'non_current_assets', TRUE, 190, 'Investments with maturity > 1 year'),
    (p_accountant_id, '1910', 'Intangible Assets', 'asset', 'non_current_assets', TRUE, 191, 'Goodwill, patents, trademarks');

  -- LIABILITIES (2000-2999)
  INSERT INTO chart_of_accounts (accountant_id, account_code, account_name, account_type, category, is_system_account, display_order, description) VALUES
    (p_accountant_id, '2000', 'Liabilities', 'liability', 'parent', TRUE, 20, 'Total Liabilities'),

    -- Current Liabilities (2100-2499)
    (p_accountant_id, '2100', 'Current Liabilities', 'liability', 'current_liabilities', TRUE, 210, 'Debts due within a year'),
    (p_accountant_id, '2110', 'Accounts Payable', 'liability', 'current_liabilities', TRUE, 211, 'Money owed to suppliers (Creditors/Sundry Creditors)'),
    (p_accountant_id, '2120', 'Bank Overdraft', 'liability', 'current_liabilities', TRUE, 212, 'Negative bank balance'),
    (p_accountant_id, '2130', 'GST Output Tax Payable', 'liability', 'current_liabilities', TRUE, 213, 'GST collected on sales (to be paid to govt)'),
    (p_accountant_id, '2131', 'GST Output - CGST', 'liability', 'current_liabilities', TRUE, 214, 'Central GST collected'),
    (p_accountant_id, '2132', 'GST Output - SGST', 'liability', 'current_liabilities', TRUE, 215, 'State GST collected'),
    (p_accountant_id, '2133', 'GST Output - IGST', 'liability', 'current_liabilities', TRUE, 216, 'Integrated GST collected'),
    (p_accountant_id, '2140', 'TDS Payable', 'liability', 'current_liabilities', TRUE, 217, 'Tax deducted at source to be deposited'),
    (p_accountant_id, '2150', 'Salary Payable', 'liability', 'current_liabilities', TRUE, 218, 'Unpaid salaries'),
    (p_accountant_id, '2160', 'Rent Payable', 'liability', 'current_liabilities', TRUE, 219, 'Unpaid rent'),
    (p_accountant_id, '2170', 'Short-term Loans', 'liability', 'current_liabilities', TRUE, 220, 'Loans with maturity < 1 year'),

    -- Long-term Liabilities (2500-2999)
    (p_accountant_id, '2500', 'Long-term Liabilities', 'liability', 'non_current_liabilities', TRUE, 250, 'Debts due after 1 year'),
    (p_accountant_id, '2510', 'Long-term Loans', 'liability', 'non_current_liabilities', TRUE, 251, 'Bank loans, term loans'),
    (p_accountant_id, '2520', 'Debentures', 'liability', 'non_current_liabilities', TRUE, 252, 'Long-term debt securities'),
    (p_accountant_id, '2530', 'Mortgage Payable', 'liability', 'non_current_liabilities', TRUE, 253, 'Property mortgage');

  -- EQUITY (3000-3999)
  INSERT INTO chart_of_accounts (accountant_id, account_code, account_name, account_type, category, is_system_account, display_order, description) VALUES
    (p_accountant_id, '3000', 'Equity', 'equity', 'parent', TRUE, 30, 'Total Equity'),
    (p_accountant_id, '3100', 'Share Capital', 'equity', 'equity', TRUE, 310, "Owners' investment"),
    (p_accountant_id, '3200', 'Retained Earnings', 'equity', 'equity', TRUE, 320, 'Accumulated profits'),
    (p_accountant_id, '3300', 'Drawings', 'equity', 'equity', TRUE, 330, 'Money withdrawn by owners'),
    (p_accountant_id, '3400', 'Reserves & Surplus', 'equity', 'equity', TRUE, 340, 'Accumulated reserves');

  -- INCOME (4000-4999)
  INSERT INTO chart_of_accounts (accountant_id, account_code, account_name, account_type, category, is_system_account, display_order, description) VALUES
    (p_accountant_id, '4000', 'Income', 'income', 'parent', TRUE, 40, 'Total Income'),
    (p_accountant_id, '4100', 'Sales', 'income', 'revenue', TRUE, 410, 'Revenue from sales'),
    (p_accountant_id, '4110', 'Sales - Goods', 'income', 'revenue', TRUE, 411, 'Sale of goods'),
    (p_accountant_id, '4120', 'Sales - Services', 'income', 'revenue', TRUE, 412, 'Sale of services'),
    (p_accountant_id, '4200', 'Other Income', 'income', 'other_income', TRUE, 420, 'Non-operating income'),
    (p_accountant_id, '4210', 'Interest Income', 'income', 'other_income', TRUE, 421, 'Interest earned'),
    (p_accountant_id, '4220', 'Dividend Income', 'income', 'other_income', TRUE, 422, 'Dividends received'),
    (p_accountant_id, '4230', 'Rental Income', 'income', 'other_income', TRUE, 423, 'Property rent received');

  -- EXPENSES (5000-5999)
  INSERT INTO chart_of_accounts (accountant_id, account_code, account_name, account_type, category, is_system_account, display_order, description) VALUES
    (p_accountant_id, '5000', 'Expenses', 'expense', 'parent', TRUE, 50, 'Total Expenses'),

    -- Cost of Goods Sold (5100-5199)
    (p_accountant_id, '5100', 'Purchases', 'expense', 'cost_of_sales', TRUE, 510, 'Cost of purchasing goods for resale'),
    (p_accountant_id, '5110', 'Purchase - Goods', 'expense', 'cost_of_sales', TRUE, 511, 'Purchase of goods'),
    (p_accountant_id, '5120', 'Purchase - Raw Materials', 'expense', 'cost_of_sales', TRUE, 512, 'Purchase of raw materials'),
    (p_accountant_id, '5130', 'Freight Inward', 'expense', 'cost_of_sales', TRUE, 513, 'Transport cost on purchases'),

    -- Operating Expenses (5200-5899)
    (p_accountant_id, '5200', 'Operating Expenses', 'expense', 'operating_expenses', TRUE, 520, 'Day-to-day business expenses'),
    (p_accountant_id, '5210', 'Salaries & Wages', 'expense', 'operating_expenses', TRUE, 521, 'Employee compensation'),
    (p_accountant_id, '5220', 'Rent', 'expense', 'operating_expenses', TRUE, 522, 'Office/shop rent'),
    (p_accountant_id, '5230', 'Electricity', 'expense', 'operating_expenses', TRUE, 523, 'Electricity bills'),
    (p_accountant_id, '5240', 'Telephone & Internet', 'expense', 'operating_expenses', TRUE, 524, 'Communication expenses'),
    (p_accountant_id, '5250', 'Travel & Conveyance', 'expense', 'operating_expenses', TRUE, 525, 'Business travel'),
    (p_accountant_id, '5260', 'Printing & Stationery', 'expense', 'operating_expenses', TRUE, 526, 'Office supplies'),
    (p_accountant_id, '5270', 'Repairs & Maintenance', 'expense', 'operating_expenses', TRUE, 527, 'Equipment/property repairs'),
    (p_accountant_id, '5280', 'Insurance', 'expense', 'operating_expenses', TRUE, 528, 'Insurance premiums'),
    (p_accountant_id, '5290', 'Advertising & Marketing', 'expense', 'operating_expenses', TRUE, 529, 'Marketing costs'),
    (p_accountant_id, '5300', 'Professional Fees', 'expense', 'operating_expenses', TRUE, 530, 'CA, lawyer, consultant fees'),
    (p_accountant_id, '5310', 'Bank Charges', 'expense', 'operating_expenses', TRUE, 531, 'Bank fees and charges'),
    (p_accountant_id, '5320', 'Depreciation', 'expense', 'operating_expenses', TRUE, 532, 'Asset depreciation expense'),
    (p_accountant_id, '5330', 'Bad Debts', 'expense', 'operating_expenses', TRUE, 533, 'Uncollectible receivables'),

    -- Financial Expenses (5900-5999)
    (p_accountant_id, '5900', 'Interest Expense', 'expense', 'financial_expenses', TRUE, 590, 'Interest paid on loans'),
    (p_accountant_id, '5910', 'Other Expenses', 'expense', 'other_expenses', TRUE, 591, 'Miscellaneous expenses');

  RAISE NOTICE 'Indian Chart of Accounts initialized for accountant %', p_accountant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- 8. Create Trial Balance Function
-- ===========================================

CREATE OR REPLACE FUNCTION get_trial_balance(
  p_client_id UUID,
  p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  account_code TEXT,
  account_name TEXT,
  account_type TEXT,
  debit_total NUMERIC,
  credit_total NUMERIC,
  balance NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    coa.account_code,
    coa.account_name,
    coa.account_type,
    COALESCE(SUM(jli.debit_amount), 0) as debit_total,
    COALESCE(SUM(jli.credit_amount), 0) as credit_total,
    COALESCE(SUM(jli.debit_amount - jli.credit_amount), 0) as balance
  FROM chart_of_accounts coa
  LEFT JOIN journal_line_items jli ON jli.account_name = coa.account_name
  LEFT JOIN journal_entries je ON je.id = jli.entry_id
  WHERE je.client_id = p_client_id
    AND je.entry_date <= p_as_of_date
    AND je.status = 'posted'
  GROUP BY coa.account_code, coa.account_name, coa.account_type
  ORDER BY coa.account_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- 9. Add Comments
-- ===========================================

COMMENT ON FUNCTION create_journal_from_invoice IS 'Automatically creates double-entry journal from invoice (sales/purchase)';
COMMENT ON FUNCTION validate_journal_entry_balance IS 'Validates that total debits equal total credits for a journal entry';
COMMENT ON FUNCTION initialize_indian_chart_of_accounts IS 'Populates comprehensive Indian GST-compliant chart of accounts';
COMMENT ON FUNCTION get_trial_balance IS 'Generates trial balance for a client as of specified date';

-- ===========================================
-- DONE! Enhanced Double-Entry System Ready
-- ===========================================
