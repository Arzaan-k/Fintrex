# Database Migration Instructions

## Apply Review Queue System Migration

The review queue database schema needs to be applied to your Supabase project.

### Option 1: Using Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your Fintrex project

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "+ New Query"

3. **Copy Migration File**
   - Open file: `supabase/migrations/20250112000000_review_queue_system.sql`
   - Copy entire contents (429 lines)
   - Paste into SQL Editor

4. **Run Migration**
   - Click "Run" button
   - Wait for success message (should take 2-5 seconds)
   - Verify no errors in output

5. **Verify Tables Created**
   - Click "Table Editor" in left sidebar
   - You should see new tables:
     - `review_queue`
     - `extraction_corrections`
     - `extraction_metrics`

### Option 2: Using Supabase CLI

```bash
# 1. Link project (if not already linked)
npx supabase link --project-ref <your-project-ref>

# 2. Push migration
npx supabase db push

# 3. Verify migration applied
npx supabase db diff
# Should output: "No schema changes detected"
```

### Option 3: Manual SQL Execution

If you have direct database access:

```bash
psql -h <your-db-host> -U postgres -d postgres -f supabase/migrations/20250112000000_review_queue_system.sql
```

---

## What This Migration Creates

### Tables
1. **review_queue** - Human review workflow
   - Stores documents needing verification
   - Tracks assignment and review status
   - Stores corrections and reviewer notes

2. **extraction_corrections** - Learning system
   - Tracks all manual corrections
   - Enables pattern detection
   - Powers AI improvement suggestions

3. **extraction_metrics** - Analytics
   - Processing time and performance
   - Confidence tracking
   - Review time analysis

### Triggers
1. **auto_escalate_low_confidence**
   - Automatically adds documents to review queue
   - Triggered when confidence < 95%
   - Creates notification for accountant

2. **update_review_queue_timestamp**
   - Auto-updates updated_at column
   - Maintains audit trail

### Functions
1. **get_review_queue_summary(uuid)** - Dashboard metrics
2. **get_avg_confidence_by_type()** - Analytics by document type
3. **get_common_corrections()** - Top correction patterns

### Indexes
- 7 indexes on `review_queue` (including composite)
- 4 indexes on `extraction_corrections`
- 3 indexes on `extraction_metrics`
- 2 indexes on `documents` (confidence, needs_review)

### Security (RLS Policies)
- Accountants see only their own review items
- Reviewers see assigned items
- System can auto-insert for escalation
- Client-level data isolation

---

## Verify Migration Success

### SQL Queries to Test

```sql
-- 1. Check tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('review_queue', 'extraction_corrections', 'extraction_metrics');
-- Should return 3 rows

-- 2. Check triggers exist
SELECT trigger_name
FROM information_schema.triggers
WHERE trigger_schema = 'public';
-- Should include: trigger_auto_escalate, trigger_update_review_queue_timestamp

-- 3. Check functions exist
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%review%' OR routine_name LIKE '%correction%';
-- Should include: get_review_queue_summary, get_common_corrections, etc.

-- 4. Test review queue summary function
SELECT * FROM get_review_queue_summary('00000000-0000-0000-0000-000000000000');
-- Should return empty result (no errors)

-- 5. Check RLS policies
SELECT tablename, policyname
FROM pg_policies
WHERE tablename IN ('review_queue', 'extraction_corrections', 'extraction_metrics');
-- Should return multiple policies per table
```

---

## Rollback (If Needed)

If you need to undo this migration:

```sql
-- WARNING: This will delete all review queue data!

-- Drop tables (cascade removes dependencies)
DROP TABLE IF EXISTS extraction_metrics CASCADE;
DROP TABLE IF EXISTS extraction_corrections CASCADE;
DROP TABLE IF EXISTS review_queue CASCADE;

-- Remove columns added to existing tables
ALTER TABLE documents
DROP COLUMN IF EXISTS confidence_score,
DROP COLUMN IF EXISTS validation_errors,
DROP COLUMN IF EXISTS needs_review,
DROP COLUMN IF EXISTS reviewed_at,
DROP COLUMN IF EXISTS reviewer_id,
DROP COLUMN IF EXISTS review_status;

ALTER TABLE invoices
DROP COLUMN IF EXISTS extraction_confidence,
DROP COLUMN IF EXISTS validation_status,
DROP COLUMN IF EXISTS auto_generated,
DROP COLUMN IF EXISTS verified_by,
DROP COLUMN IF EXISTS verified_at;

-- Drop functions
DROP FUNCTION IF EXISTS auto_escalate_low_confidence() CASCADE;
DROP FUNCTION IF EXISTS update_review_queue_timestamp() CASCADE;
DROP FUNCTION IF EXISTS get_review_queue_summary(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_avg_confidence_by_type() CASCADE;
DROP FUNCTION IF EXISTS get_common_corrections() CASCADE;
```

---

## Troubleshooting

### Error: "relation already exists"
- Some tables already exist
- Safe to ignore or run rollback first

### Error: "permission denied"
- Run as postgres user or admin
- Check RLS policies if accessing from client

### Error: "function does not exist"
- Dependency issue - run entire migration again
- Check for syntax errors in SQL

### Error: "trigger already exists"
- Drop existing trigger first:
  ```sql
  DROP TRIGGER IF EXISTS trigger_auto_escalate ON documents;
  ```

---

## Post-Migration Steps

1. **Test Auto-Escalation**
   ```sql
   -- Insert test document with low confidence
   INSERT INTO documents (
     file_name, client_id, accountant_id,
     confidence_score, needs_review
   ) VALUES (
     'test.pdf', '<client-id>', '<accountant-id>',
     0.85, true
   );

   -- Check review queue
   SELECT * FROM review_queue ORDER BY created_at DESC LIMIT 1;
   -- Should have new entry with status='pending', priority='medium'
   ```

2. **Test Review Queue UI**
   - Navigate to `/review-queue` in application
   - Should see dashboard with summary cards
   - Should see queue items if any exist

3. **Test Review Workflow**
   - Assign item to yourself
   - Make corrections
   - Approve document
   - Check `extraction_corrections` table for saved corrections

4. **Monitor Metrics**
   ```sql
   -- View extraction metrics
   SELECT * FROM extraction_metrics ORDER BY extraction_time DESC LIMIT 10;

   -- View correction patterns
   SELECT field_name, correction_type, COUNT(*)
   FROM extraction_corrections
   GROUP BY field_name, correction_type
   ORDER BY COUNT(*) DESC;
   ```

---

## Support

If you encounter issues:

1. Check Supabase logs: Dashboard → Logs → Postgres
2. Verify permissions: Dashboard → Authentication → Policies
3. Test SQL directly: Dashboard → SQL Editor
4. Review error messages carefully
5. Check this migration file for comments

---

*Last Updated: 2025-01-12*
*Migration Version: 20250112000000*
