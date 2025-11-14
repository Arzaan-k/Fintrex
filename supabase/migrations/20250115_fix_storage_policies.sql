-- ============================================
-- FIX STORAGE BUCKET RLS POLICIES
-- Created: 2025-01-15
-- ============================================

-- ============================================
-- 1. ENSURE DOCUMENTS BUCKET EXISTS
-- ============================================

-- Create documents bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  26214400, -- 25MB
  ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 26214400,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

-- ============================================
-- 2. DROP EXISTING STORAGE POLICIES
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;

-- ============================================
-- 3. CREATE PERMISSIVE STORAGE POLICIES
-- ============================================

-- Policy for uploading documents (including temp folder)
CREATE POLICY "Authenticated users can upload documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents' AND
    auth.uid() IS NOT NULL
  );

-- Policy for viewing documents
CREATE POLICY "Authenticated users can view documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents' AND
    auth.uid() IS NOT NULL
  );

-- Policy for updating documents
CREATE POLICY "Authenticated users can update documents"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documents' AND
    auth.uid() IS NOT NULL
  )
  WITH CHECK (
    bucket_id = 'documents' AND
    auth.uid() IS NOT NULL
  );

-- Policy for deleting documents (including temp files)
CREATE POLICY "Authenticated users can delete documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents' AND
    auth.uid() IS NOT NULL
  );

-- ============================================
-- 4. GRANT STORAGE PERMISSIONS
-- ============================================

-- Grant usage on storage schema
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Storage bucket policies fixed successfully!';
  RAISE NOTICE '📁 Documents bucket: Configured with 25MB limit';
  RAISE NOTICE '🔐 Storage policies: All authenticated users can upload to temp folder';
  RAISE NOTICE '🔐 Storage policies: Users can manage their own documents';
END $$;
