-- Migration: Vendor Mappings for Smart Categorization
-- Creates table to store vendor → category mappings for AI learning

CREATE TABLE IF NOT EXISTS vendor_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  accountant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  category TEXT NOT NULL,
  account_code TEXT,
  account_name TEXT,
  confidence DECIMAL(3,2) DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  usage_count INTEGER DEFAULT 0,
  last_used TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(accountant_id, normalized_name)
);

CREATE INDEX IF NOT EXISTS idx_vendor_mappings_accountant ON vendor_mappings(accountant_id);
CREATE INDEX IF NOT EXISTS idx_vendor_mappings_normalized ON vendor_mappings(normalized_name);
CREATE INDEX IF NOT EXISTS idx_vendor_mappings_category ON vendor_mappings(category);

-- Enable RLS
ALTER TABLE vendor_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Accountants can view their own vendor mappings" ON vendor_mappings;
CREATE POLICY "Accountants can view their own vendor mappings"
  ON vendor_mappings FOR SELECT
  USING (accountant_id = auth.uid());

DROP POLICY IF EXISTS "Accountants can manage their own vendor mappings" ON vendor_mappings;
CREATE POLICY "Accountants can manage their own vendor mappings"
  ON vendor_mappings FOR ALL
  USING (accountant_id = auth.uid());

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_vendor_mappings_updated_at ON vendor_mappings;
CREATE TRIGGER update_vendor_mappings_updated_at
  BEFORE UPDATE ON vendor_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE vendor_mappings IS 'Smart categorization: vendor → category mappings that learn over time';
