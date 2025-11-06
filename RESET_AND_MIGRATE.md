# 🔄 Complete Database Reset & Migration

## Problem
The database has conflicting schemas and dependencies that prevent clean migration. We need to start fresh.

## ✅ Solution: Clean Reset

### Step 1: Reset Database (Supabase Dashboard)

1. Go to: https://supabase.com/dashboard
2. Select project: **tedkkwqlcoilopcrxkdl**
3. Go to **Database** → **Tables**
4. Delete ALL existing tables (if any exist):
   - clients
   - documents
   - financial_records
   - profiles
   - user_roles
   - kyc_checklists
   - kyc_documents
   - invoices
   - Any other tables

### Step 2: Run Complete Migration

1. Go to **SQL Editor** → **New Query**
2. Copy the ENTIRE contents from the reference script you provided
3. Paste and click **Run**

The script creates:
- ✅ 4 Enums (app_role, client_status, document_status, activity_category)
- ✅ 18 Tables (profiles, user_roles, clients, vendors, chart_of_accounts, documents, document_checklist, document_processing_queue, financial_records, journal_entries, journal_line_items, balance_sheets, gst_returns, compliance_deadlines, activity_logs, notification_preferences, whatsapp_integration, email_integration)
- ✅ All Indexes
- ✅ All Functions (has_role, update_updated_at_column, handle_new_user)
- ✅ All Triggers
- ✅ All RLS Policies

### Step 3: Verify

After running the script:

1. Go to **Table Editor**
2. Verify these tables exist:
   - ✅ profiles
   - ✅ user_roles
   - ✅ clients (with `accountant_id` column)
   - ✅ vendors
   - ✅ documents
   - ✅ financial_records
   - ✅ And 12 more tables

3. Click on `clients` table
4. Verify columns include:
   - ✅ accountant_id (UUID)
   - ✅ business_name (TEXT)
   - ✅ contact_person (TEXT)
   - ✅ phone_number (TEXT)
   - ✅ gst_number (TEXT)
   - ✅ status (client_status enum)

### Step 4: Test Application

```bash
# Restart dev server
npm run dev
```

Test these features:
1. ✅ Sign up / Login
2. ✅ Create a client
3. ✅ View clients list
4. ✅ Upload document
5. ✅ Process document
6. ✅ View financials

## Why This Works

The reference script you provided:
- Creates tables in the correct order (no dependency issues)
- Uses `accountant_id` consistently
- Has all required enums
- Includes all functions and triggers
- Has complete RLS policies

## If You Get Errors

### "relation already exists"
- This is OK - the script uses `CREATE TABLE IF NOT EXISTS`
- It won't overwrite existing tables

### "type already exists"
- This is OK - the script checks before creating enums

### "function already exists"
- This is OK - the script uses `CREATE OR REPLACE FUNCTION`

## Expected Result

After migration:
- ✅ No more "accountant_id does not exist" errors
- ✅ No more 400 errors on client operations
- ✅ No more "type client_status does not exist" errors
- ✅ All pages load correctly
- ✅ Can create/view clients
- ✅ Can upload/process documents

---

**The reference script you provided is the CORRECT, COMPLETE schema. Just run it!**
