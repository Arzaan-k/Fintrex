# Apply Review Queue Migration - Quick Guide

## ⚡ Quick Steps (5 minutes)

### Step 1: Open Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your **Fintrex** project
3. Click **"SQL Editor"** in the left sidebar
4. Click **"+ New Query"** button

### Step 2: Copy Migration SQL
Open this file and copy ALL contents (429 lines):
```
supabase/migrations/20250112000000_review_queue_system.sql
```

### Step 3: Paste and Run
1. Paste the SQL into the editor
2. Click the **"Run"** button (or press Ctrl+Enter)
3. Wait 2-5 seconds for completion
4. ✅ You should see "Success. No rows returned"

### Step 4: Verify Tables Created
1. Click **"Table Editor"** in the left sidebar
2. You should now see these NEW tables:
   - ✅ `review_queue`
   - ✅ `extraction_corrections`
   - ✅ `extraction_metrics`

### Step 5: Test the Review Queue
1. Start your app: `npm run dev`
2. Navigate to: http://localhost:5173/review-queue
3. You should see the Review Queue dashboard with:
   - Summary cards (Pending, High Priority, etc.)
   - Queue items list (empty initially)
   - Filters and tabs

---

## 🐛 Troubleshooting

### Error: "relation already exists"
Some tables already exist. Options:
1. **Safe**: Run this first to check what exists:
   ```sql
   SELECT table_name
   FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name IN ('review_queue', 'extraction_corrections', 'extraction_metrics');
   ```
2. **If tables exist**: You can skip the migration (already applied)

### Error: "permission denied"
- Make sure you're logged in as the project owner
- Try using the "Database" → "Migrations" section instead

### Error: "trigger already exists"
Run this first to clean up:
```sql
DROP TRIGGER IF EXISTS trigger_auto_escalate ON documents;
DROP TRIGGER IF EXISTS trigger_update_review_queue_timestamp ON review_queue;
```
Then run the full migration again.

---

## 📋 What This Migration Does

Creates 3 new tables:
1. **review_queue** - Stores documents needing manual verification
2. **extraction_corrections** - Tracks all manual corrections for learning
3. **extraction_metrics** - Analytics for extraction performance

Adds columns to existing tables:
- **documents**: confidence_score, needs_review, reviewed_at, reviewer_id, review_status
- **invoices**: extraction_confidence, validation_status, auto_generated, verified_by, verified_at

Creates triggers:
- **auto_escalate_low_confidence** - Automatically adds low-confidence documents to review queue
- **update_review_queue_timestamp** - Auto-updates timestamps

Creates helper functions:
- **get_review_queue_summary(uuid)** - Dashboard metrics
- **get_avg_confidence_by_type()** - Analytics by document type
- **get_common_corrections()** - Top 20 correction patterns

---

## ✅ After Migration Success

### Test Auto-Escalation
Upload a test document via the Documents page and it should automatically:
1. Process through OCR + Extraction
2. Run validation rules
3. Calculate confidence score
4. If confidence < 95% → Automatically add to review_queue
5. Create notification for accountant

### Test Review Workflow
1. Go to `/review-queue`
2. Click "Assign to Me" on a pending item
3. Review the side-by-side interface
4. Make corrections if needed
5. Click "Approve" or "Reject"
6. Check that corrections are saved to `extraction_corrections` table

### Monitor Metrics
Run this query to see extraction metrics:
```sql
SELECT * FROM extraction_metrics
ORDER BY extraction_time DESC
LIMIT 10;
```

---

## 🎯 Quick Validation Query

After running the migration, test with this query:
```sql
-- Should return 3 rows
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE '%review%' OR table_name LIKE '%correction%' OR table_name LIKE '%metric%';

-- Should return empty (no errors)
SELECT * FROM review_queue LIMIT 1;

-- Test the summary function (should return empty, no errors)
SELECT * FROM get_review_queue_summary('00000000-0000-0000-0000-000000000000'::uuid);
```

If all queries run without errors, migration is successful! ✅

---

## 🚀 Ready to Use

Once migration is applied, you can:
- ✅ Navigate to `/review-queue` in your app
- ✅ Upload documents and see auto-escalation
- ✅ Review and correct low-confidence extractions
- ✅ Track learning system improvements
- ✅ Monitor accuracy metrics

---

## 📞 Need Help?

If you encounter issues:
1. Check Supabase Dashboard → Logs → Postgres Logs
2. Review the error message carefully
3. Check [DATABASE_MIGRATION_INSTRUCTIONS.md](DATABASE_MIGRATION_INSTRUCTIONS.md) for detailed troubleshooting
4. The migration SQL file has extensive comments explaining each section

---

**Estimated Time**: 5 minutes
**Difficulty**: Easy (copy-paste)
**Risk**: Low (no data loss, only creates new tables)

Good luck! 🎉
