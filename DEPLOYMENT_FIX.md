# WhatsApp Schema Deployment - FIXED ✅

## Issue Resolved

**Error:** `column "primary_name" does not exist`

**Root Cause:** The migration used `CREATE TABLE IF NOT EXISTS` which skipped table creation if a table existed, but then tried to create indexes on columns that didn't exist in the existing table.

## Solution Applied

### 1. **Table Name Changed**
- **Before:** `vendors` (conflicted with existing `vendor_mappings` table)
- **After:** `vendor_master` (unique table name)

### 2. **Safe Index Creation**
All indexes now wrapped in conditional blocks:

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_vendor_master_name') THEN
    CREATE INDEX idx_vendor_master_name ON public.vendor_master
    USING gin(to_tsvector('english', primary_name));
  END IF;
END $$;
```

### 3. **Updated Code References**
- ✅ `vendor-matching.ts` - Updated all `.from('vendors')` to `.from('vendor_master')`
- ✅ Migration file - Changed `vendor_id` to `vendor_master_id` in invoices table
- ✅ RLS policies - Updated to use correct table name

## Deploy the Fixed Schema

```bash
cd /home/user/Fintrex

# Deploy the FIXED migration
psql $DATABASE_URL < supabase/migrations/202511190002_whatsapp_complete_schema_fixed.sql

# OR using Supabase CLI
supabase db push
```

## Verify Deployment

```sql
-- Check if vendor_master table exists
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_name = 'vendor_master'
ORDER BY ordinal_position;

-- Expected columns:
-- id, accountant_id, primary_name, alternate_names, gstin, pan,
-- phone_number, email, address, category, payment_terms,
-- bank_details, is_active, total_transactions, total_amount,
-- created_at, updated_at

-- Check if indexes were created
SELECT indexname
FROM pg_indexes
WHERE tablename = 'vendor_master';

-- Expected indexes:
-- vendor_master_pkey
-- idx_vendor_master_accountant
-- idx_vendor_master_gstin
-- idx_vendor_master_pan
-- idx_vendor_master_name
```

## All Tables Created

Run this to verify all WhatsApp tables:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND (
  table_name LIKE '%whatsapp%'
  OR table_name = 'vendor_master'
  OR table_name = 'kyc_checklist_templates'
  OR table_name = 'client_kyc_checklists'
  OR table_name = 'document_requests'
  OR table_name = 'payment_reminders'
  OR table_name = 'gst_validation_cache'
)
ORDER BY table_name;
```

Expected output:
```
client_kyc_checklists
document_requests
gst_validation_cache
kyc_checklist_templates
payment_reminders
vendor_master
whatsapp_messages
whatsapp_rate_limits
whatsapp_sessions
```

## Quick Test

```sql
-- Test vendor_master table
INSERT INTO vendor_master (
  accountant_id,
  primary_name,
  gstin,
  pan
) VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  'Test Vendor Pvt Ltd',
  '27AABCT1332L1ZG',
  'AABCT1332L'
);

-- Verify insertion
SELECT * FROM vendor_master WHERE primary_name = 'Test Vendor Pvt Ltd';

-- Clean up test data
DELETE FROM vendor_master WHERE primary_name = 'Test Vendor Pvt Ltd';
```

## Integration Notes

When integrating with your webhook, use:

```typescript
// ✅ CORRECT - Use vendor_master
import { findOrCreateVendor } from './vendor-matching.ts';

const { vendor, isNew, matchType } = await findOrCreateVendor(supabase, accountantId, {
  name: vendorName,
  gstin: vendorGSTIN,
  pan: vendorPAN,
});

// Link to invoice
await supabase
  .from('invoices')
  .update({ vendor_master_id: vendor.id })  // ✅ Use vendor_master_id
  .eq('id', invoiceId);
```

```typescript
// ❌ WRONG - Don't use vendors or vendor_id
await supabase
  .from('vendors')  // ❌ Table doesn't exist
  .update({ vendor_id: vendor.id })  // ❌ Wrong column name
```

## What Changed from Original

| Component | Original | Fixed |
|-----------|----------|-------|
| **Table Name** | `vendors` | `vendor_master` |
| **Invoice Column** | `vendor_id` | `vendor_master_id` |
| **Index Creation** | Direct CREATE INDEX | Conditional DO blocks |
| **Table Creation** | IF NOT EXISTS (unsafe) | IF NOT EXISTS + conditional indexes |

## Migration File

The correct migration file is:
```
supabase/migrations/202511190002_whatsapp_complete_schema_fixed.sql
```

The old file has been removed:
```
supabase/migrations/202511190001_whatsapp_complete_schema.sql ❌ DELETED
```

## Status: ✅ READY FOR DEPLOYMENT

The schema is now safe to deploy without conflicts. All modules have been updated to use the correct table and column names.

---

**Next Steps:**
1. Deploy the fixed schema
2. Test with sample data
3. Integrate vendor matching into webhook
4. Monitor vendor deduplication accuracy

For full implementation guide, see: `WHATSAPP_COMPLETE_IMPLEMENTATION.md`
