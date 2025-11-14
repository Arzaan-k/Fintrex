-- REVIEW QUEUE SYSTEM FOR HUMAN-IN-THE-LOOP WORKFLOW
-- Handles documents that need manual verification
-- Created: 2025-01-12

-- ============================================
-- 1. REVIEW QUEUE TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Document reference
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  accountant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Extracted data
  extracted_data JSONB NOT NULL,
  original_ocr_text TEXT,

  -- Confidence and validation
  overall_confidence DECIMAL(3,2) CHECK (overall_confidence >= 0 AND overall_confidence <= 1),
  weighted_confidence DECIMAL(3,2) CHECK (weighted_confidence >= 0 AND weighted_confidence <= 1),
  field_confidence_scores JSONB DEFAULT '{}',
  validation_errors JSONB DEFAULT '[]',
  validation_warnings JSONB DEFAULT '[]',

  -- Review status and workflow
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'approved', 'rejected', 'escalated')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),

  -- Assignment
  assigned_to UUID REFERENCES profiles(id),
  assigned_at TIMESTAMP WITH TIME ZONE,

  -- Review outcome
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewer_notes TEXT,
  corrected_data JSONB,
  correction_summary JSONB DEFAULT '{}',

  -- Escalation reason
  escalation_reason TEXT,
  review_reason TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Metadata
  metadata JSONB DEFAULT '{}'
);

-- Indexes for performance
CREATE INDEX idx_review_queue_status ON review_queue(status);
CREATE INDEX idx_review_queue_priority ON review_queue(priority);
CREATE INDEX idx_review_queue_accountant ON review_queue(accountant_id);
CREATE INDEX idx_review_queue_assigned ON review_queue(assigned_to);
CREATE INDEX idx_review_queue_created ON review_queue(created_at DESC);
CREATE INDEX idx_review_queue_document ON review_queue(document_id);
CREATE INDEX idx_review_queue_client ON review_queue(client_id);

-- Composite indexes for common queries
CREATE INDEX idx_review_queue_status_priority ON review_queue(status, priority, created_at DESC);
CREATE INDEX idx_review_queue_accountant_status ON review_queue(accountant_id, status, created_at DESC);

-- ============================================
-- 2. ADD CONFIDENCE FIELDS TO DOCUMENTS TABLE
-- ============================================

ALTER TABLE documents
ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS validation_errors JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reviewer_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS review_status TEXT CHECK (review_status IN ('pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_documents_needs_review ON documents(needs_review, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_confidence ON documents(confidence_score);

-- ============================================
-- 3. ADD CONFIDENCE FIELDS TO INVOICES TABLE
-- ============================================

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS extraction_confidence DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS validation_status JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;

-- ============================================
-- 4. EXTRACTION CORRECTIONS TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS extraction_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  review_queue_id UUID REFERENCES review_queue(id) ON DELETE SET NULL,

  -- Correction details
  field_name TEXT NOT NULL,
  extracted_value TEXT,
  corrected_value TEXT NOT NULL,
  correction_type TEXT CHECK (correction_type IN ('format', 'value', 'missing', 'extra', 'classification')),

  -- Reviewer
  corrected_by UUID NOT NULL REFERENCES profiles(id),
  corrected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Metadata
  notes TEXT,
  confidence_before DECIMAL(3,2),
  confidence_after DECIMAL(3,2)
);

CREATE INDEX idx_extraction_corrections_document ON extraction_corrections(document_id);
CREATE INDEX idx_extraction_corrections_field ON extraction_corrections(field_name);
CREATE INDEX idx_extraction_corrections_type ON extraction_corrections(correction_type);
CREATE INDEX idx_extraction_corrections_date ON extraction_corrections(corrected_at DESC);

-- ============================================
-- 5. EXTRACTION METRICS TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS extraction_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  -- Processing details
  extraction_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processing_time_ms INTEGER,
  ocr_provider TEXT,
  extraction_method TEXT,

  -- Confidence metrics
  overall_confidence DECIMAL(3,2),
  fields_extracted INTEGER,
  fields_validated INTEGER,

  -- Review metrics
  needed_review BOOLEAN DEFAULT FALSE,
  review_time_minutes INTEGER,
  correction_count INTEGER DEFAULT 0,

  -- Outcome
  auto_approved BOOLEAN DEFAULT FALSE,
  final_status TEXT CHECK (final_status IN ('approved', 'rejected', 'pending')),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_extraction_metrics_document ON extraction_metrics(document_id);
CREATE INDEX idx_extraction_metrics_date ON extraction_metrics(extraction_time DESC);
CREATE INDEX idx_extraction_metrics_confidence ON extraction_metrics(overall_confidence);

-- ============================================
-- 6. AUTO-ESCALATION TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION auto_escalate_low_confidence()
RETURNS TRIGGER AS $$
DECLARE
  v_accountant_id UUID;
  v_client_id UUID;
BEGIN
  -- Get accountant and client from document
  SELECT d.client_id, c.accountant_id
  INTO v_client_id, v_accountant_id
  FROM documents d
  JOIN clients c ON c.id = d.client_id
  WHERE d.id = NEW.id;

  -- Check if needs review
  IF NEW.needs_review = TRUE OR NEW.confidence_score < 0.95 THEN

    -- Insert into review queue
    INSERT INTO review_queue (
      document_id,
      client_id,
      accountant_id,
      extracted_data,
      overall_confidence,
      weighted_confidence,
      validation_errors,
      status,
      priority,
      escalation_reason,
      review_reason
    ) VALUES (
      NEW.id,
      v_client_id,
      v_accountant_id,
      COALESCE(NEW.extracted_data, '{}'::jsonb),
      NEW.confidence_score,
      NEW.confidence_score,
      COALESCE(NEW.validation_errors, '[]'::jsonb),
      'pending',
      CASE
        WHEN NEW.confidence_score < 0.85 THEN 'high'
        WHEN NEW.confidence_score < 0.95 THEN 'medium'
        ELSE 'low'
      END,
      'Low confidence extraction',
      CASE
        WHEN NEW.confidence_score < 0.95 THEN
          format('Confidence score: %s%%', ROUND(NEW.confidence_score * 100, 1))
        ELSE 'Manual review requested'
      END
    )
    ON CONFLICT DO NOTHING; -- Prevent duplicates

    -- Create notification for accountant
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      data,
      created_at
    ) VALUES (
      v_accountant_id,
      'review_required',
      'Document Needs Review',
      format('Document "%s" requires manual verification (confidence: %s%%)',
        NEW.file_name,
        ROUND(COALESCE(NEW.confidence_score, 0) * 100, 1)
      ),
      jsonb_build_object(
        'document_id', NEW.id,
        'confidence', NEW.confidence_score,
        'client_id', v_client_id
      ),
      NOW()
    );

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_auto_escalate ON documents;

-- Create trigger
CREATE TRIGGER trigger_auto_escalate
  AFTER INSERT OR UPDATE OF confidence_score, needs_review
  ON documents
  FOR EACH ROW
  EXECUTE FUNCTION auto_escalate_low_confidence();

-- ============================================
-- 7. UPDATE TIMESTAMP TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_review_queue_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_review_queue_timestamp ON review_queue;

CREATE TRIGGER trigger_update_review_queue_timestamp
  BEFORE UPDATE ON review_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_review_queue_timestamp();

-- ============================================
-- 8. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE review_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_metrics ENABLE ROW LEVEL SECURITY;

-- Review Queue Policies
CREATE POLICY "Accountants can view own review queue"
  ON review_queue FOR SELECT
  USING (
    accountant_id = auth.uid() OR
    assigned_to = auth.uid()
  );

CREATE POLICY "Accountants can update own review items"
  ON review_queue FOR UPDATE
  USING (
    accountant_id = auth.uid() OR
    assigned_to = auth.uid()
  );

CREATE POLICY "System can insert review items"
  ON review_queue FOR INSERT
  WITH CHECK (true);

-- Extraction Corrections Policies
CREATE POLICY "Accountants can view own corrections"
  ON extraction_corrections FOR SELECT
  USING (
    corrected_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM review_queue rq
      WHERE rq.id = extraction_corrections.review_queue_id
      AND rq.accountant_id = auth.uid()
    )
  );

CREATE POLICY "Accountants can insert corrections"
  ON extraction_corrections FOR INSERT
  WITH CHECK (corrected_by = auth.uid());

-- Extraction Metrics Policies
CREATE POLICY "Accountants can view metrics for own documents"
  ON extraction_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      JOIN clients c ON c.id = d.client_id
      WHERE d.id = extraction_metrics.document_id
      AND c.accountant_id = auth.uid()
    )
  );

CREATE POLICY "System can insert metrics"
  ON extraction_metrics FOR INSERT
  WITH CHECK (true);

-- ============================================
-- 9. HELPER FUNCTIONS
-- ============================================

/**
 * Get review queue summary for accountant
 */
CREATE OR REPLACE FUNCTION get_review_queue_summary(accountant_uuid UUID)
RETURNS TABLE (
  status TEXT,
  priority TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    rq.status,
    rq.priority,
    COUNT(*)::BIGINT as count
  FROM review_queue rq
  WHERE rq.accountant_id = accountant_uuid
  GROUP BY rq.status, rq.priority
  ORDER BY rq.status, rq.priority;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/**
 * Get average confidence by document type
 */
CREATE OR REPLACE FUNCTION get_avg_confidence_by_type()
RETURNS TABLE (
  document_type TEXT,
  avg_confidence DECIMAL(3,2),
  total_documents BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.document_type,
    ROUND(AVG(d.confidence_score)::DECIMAL, 2) as avg_confidence,
    COUNT(*)::BIGINT as total_documents
  FROM documents d
  WHERE d.confidence_score IS NOT NULL
  GROUP BY d.document_type
  ORDER BY avg_confidence DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/**
 * Get most common correction types
 */
CREATE OR REPLACE FUNCTION get_common_corrections()
RETURNS TABLE (
  field_name TEXT,
  correction_type TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ec.field_name,
    ec.correction_type,
    COUNT(*)::BIGINT as count
  FROM extraction_corrections ec
  GROUP BY ec.field_name, ec.correction_type
  ORDER BY count DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 10. GRANT PERMISSIONS
-- ============================================

-- Grant usage on tables
GRANT SELECT, INSERT, UPDATE ON review_queue TO authenticated;
GRANT SELECT, INSERT ON extraction_corrections TO authenticated;
GRANT SELECT ON extraction_metrics TO authenticated;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION get_review_queue_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_avg_confidence_by_type() TO authenticated;
GRANT EXECUTE ON FUNCTION get_common_corrections() TO authenticated;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Add migration record
COMMENT ON TABLE review_queue IS 'Human-in-the-loop review queue for low-confidence extractions';
COMMENT ON TABLE extraction_corrections IS 'Tracks manual corrections for continuous improvement';
COMMENT ON TABLE extraction_metrics IS 'Analytics for extraction performance and accuracy';
