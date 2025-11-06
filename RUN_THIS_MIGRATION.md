# 🚀 CORRECTED Database Migration - Run This!

## ✅ What Was Fixed

The original migration had a mismatch - it used `user_id` in the clients table, but your app expects `accountant_id`.

**Fixed File**: `CORRECTED_DATABASE_MIGRATION.sql`

## 🎯 Quick Steps

### 1. Go to Supabase Dashboard
- URL: https://supabase.com/dashboard
- Select project: **tedkkwqlcoilopcrxkdl**

### 2. Open SQL Editor
- Click **SQL Editor** in left sidebar
- Click **New Query**

### 3. Run the Corrected Migration
- Open file: `CORRECTED_DATABASE_MIGRATION.sql`
- Copy ALL contents (Ctrl+A, Ctrl+C)
- Paste in SQL Editor
- Click **Run** (Ctrl+Enter)

### 4. Verify Success
- Should see: "Success. No rows returned"
- Go to **Table Editor** - verify tables exist
- Check `clients` table has `accountant_id` column

### 5. Restart Dev Server
```bash
npm run dev
```

## ✅ What This Creates

### Tables (18 total)
1. **profiles** - User profiles
2. **user_roles** - Role assignments (admin/accountant/client)
3. **clients** - Client management (with `accountant_id`)
4. **vendors** - Vendor management
5. **chart_of_accounts** - Accounting structure
6. **documents** - Document storage
7. **document_checklist** - Document requirements
8. **document_processing_queue** - OCR processing queue
9. **financial_records** - Transactions
10. **journal_entries** - Journal entries
11. **journal_line_items** - Journal line items
12. **balance_sheets** - Balance sheet data
13. **gst_returns** - GST filing data
14. **compliance_deadlines** - Deadline tracking
15. **activity_logs** - Audit trail
16. **notification_preferences** - User preferences
17. **whatsapp_integration** - WhatsApp config
18. **email_integration** - Email config

### Enums (4 total)
- `app_role` - admin, accountant, client
- `client_status` - kyc_pending, active, inactive, suspended
- `document_status` - pending, processing, completed, failed, reviewed
- `activity_category` - client, document, financial, compliance, system

### Functions
- `has_role()` - Check user roles
- `update_updated_at_column()` - Auto-update timestamps
- `handle_new_user()` - Auto-create profile on signup

### Security
- ✅ Row Level Security on all tables
- ✅ Proper RLS policies for data isolation
- ✅ Auto-assign "accountant" role on signup

## 🧪 Test After Migration

```bash
# Start dev server
npm run dev

# Test these features:
1. Sign up / Login ✅
2. Create a client ✅
3. Upload document ✅
4. View clients list ✅
5. View documents list ✅
```

## 🔍 Key Differences from Old Migration

| Feature | Old Migration | Corrected Migration |
|---------|--------------|---------------------|
| Clients table | `user_id` | `accountant_id` ✅ |
| Column names | Mixed | Matches old schema ✅ |
| Enums | Missing | All created ✅ |
| Functions | Missing | All created ✅ |
| RLS Policies | Incomplete | Complete ✅ |

## ❌ Common Errors Fixed

### Error: "Could not find the 'accountant_id' column"
**Cause**: Old migration used `user_id`  
**Fixed**: Now uses `accountant_id` ✅

### Error: "type 'client_status' does not exist"
**Cause**: Enums not created  
**Fixed**: All enums created ✅

### Error: "function has_role does not exist"
**Cause**: Helper functions missing  
**Fixed**: All functions created ✅

## 📊 Expected Result

After running the migration, your app should:
- ✅ Load without errors
- ✅ Show clients list
- ✅ Allow creating clients
- ✅ Allow uploading documents
- ✅ Process documents with OCR
- ✅ Show financial records

## 🆘 If Something Goes Wrong

### Option 1: Reset and Retry
1. Go to Supabase Dashboard → Database → Tables
2. Delete all tables (if needed)
3. Run the migration again

### Option 2: Check Logs
1. Browser Console (F12) - Check for errors
2. Supabase Dashboard → Logs - Check database errors

### Option 3: Verify Schema
```sql
-- Run this to check if clients table has accountant_id
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'clients';
```

Should show `accountant_id` column!

---

**Ready to go! Run the migration and your app will work! 🎉**
