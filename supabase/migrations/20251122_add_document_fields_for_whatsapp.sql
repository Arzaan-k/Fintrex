-- Migration: Add WhatsApp-required fields to documents table
-- This migration adds fields needed for WhatsApp webhook document processing

-- Add document_type column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'documents'
    AND column_name = 'document_type'
  ) THEN
    ALTER TABLE public.documents ADD COLUMN document_type TEXT CHECK (document_type IN ('invoice', 'receipt', 'kyc_document', 'other'));
    COMMENT ON COLUMN public.documents.document_type IS 'Type of document: invoice, receipt, kyc_document, or other';
  END IF;
END $$;

-- Add upload_source column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'documents'
    AND column_name = 'upload_source'
  ) THEN
    ALTER TABLE public.documents ADD COLUMN upload_source TEXT DEFAULT 'dashboard' CHECK (upload_source IN ('dashboard', 'whatsapp', 'email', 'api'));
    COMMENT ON COLUMN public.documents.upload_source IS 'Source of document upload: dashboard, whatsapp, email, or api';
  END IF;
END $$;

-- Add review_status column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'documents'
    AND column_name = 'review_status'
  ) THEN
    ALTER TABLE public.documents ADD COLUMN review_status TEXT DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected'));
    COMMENT ON COLUMN public.documents.review_status IS 'Review status of the document: pending, approved, or rejected';
  END IF;
END $$;

-- Add reviewed_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'documents'
    AND column_name = 'reviewed_at'
  ) THEN
    ALTER TABLE public.documents ADD COLUMN reviewed_at TIMESTAMP WITH TIME ZONE;
    COMMENT ON COLUMN public.documents.reviewed_at IS 'Timestamp when document was reviewed/approved/rejected';
  END IF;
END $$;

-- Update uploaded_via to upload_source for consistency (if uploaded_via exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'documents'
    AND column_name = 'uploaded_via'
  ) THEN
    -- Copy data from uploaded_via to upload_source if upload_source is empty
    UPDATE public.documents
    SET upload_source = COALESCE(upload_source, uploaded_via, 'dashboard')
    WHERE upload_source IS NULL OR upload_source = '';
  END IF;
END $$;

-- Create index on document_type for filtering
CREATE INDEX IF NOT EXISTS idx_documents_document_type
ON public.documents(document_type)
WHERE document_type IS NOT NULL;

-- Create index on upload_source for analytics
CREATE INDEX IF NOT EXISTS idx_documents_upload_source
ON public.documents(upload_source);

-- Create index on review_status for filtering
CREATE INDEX IF NOT EXISTS idx_documents_review_status
ON public.documents(review_status);

-- Verify the changes
DO $$
DECLARE
  has_document_type BOOLEAN;
  has_upload_source BOOLEAN;
  has_review_status BOOLEAN;
  has_reviewed_at BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'documents'
    AND column_name = 'document_type'
  ) INTO has_document_type;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'documents'
    AND column_name = 'upload_source'
  ) INTO has_upload_source;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'documents'
    AND column_name = 'review_status'
  ) INTO has_review_status;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'documents'
    AND column_name = 'reviewed_at'
  ) INTO has_reviewed_at;

  RAISE NOTICE '✅ Migration completed successfully!';
  RAISE NOTICE '   - document_type: %', CASE WHEN has_document_type THEN '✅ Added' ELSE '❌ Failed' END;
  RAISE NOTICE '   - upload_source: %', CASE WHEN has_upload_source THEN '✅ Added' ELSE '❌ Failed' END;
  RAISE NOTICE '   - review_status: %', CASE WHEN has_review_status THEN '✅ Added' ELSE '❌ Failed' END;
  RAISE NOTICE '   - reviewed_at: %', CASE WHEN has_reviewed_at THEN '✅ Added' ELSE '❌ Failed' END;
END $$;
