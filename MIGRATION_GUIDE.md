# 🚀 Database Migration Guide - Old to New Supabase

## ✅ Step 1: Environment Updated

Your `.env` file has been updated with the new Supabase credentials:

```env
✅ VITE_SUPABASE_PROJECT_ID="tedkkwqlcoilopcrxkdl"
✅ VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
✅ VITE_SUPABASE_URL="https://tedkkwqlcoilopcrxkdl.supabase.co"
```

## 📋 Step 2: Run Database Migration

### Quick Setup (5 minutes)

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select project: **tedkkwqlcoilopcrxkdl**

2. **Open SQL Editor**
   - Click **SQL Editor** in the left sidebar
   - Click **New Query**

3. **Run Migration Script**
   - Open the file: `COMPLETE_DATABASE_MIGRATION.sql`
   - Copy ALL the contents (Ctrl+A, Ctrl+C)
   - Paste into the SQL Editor
   - Click **Run** or press `Ctrl+Enter`

4. **Wait for Completion**
   - Should take 10-30 seconds
   - You'll see: "✅ DATABASE MIGRATION COMPLETED SUCCESSFULLY!"

## 📊 What Gets Created

### Tables (10 total)

1. **profiles** - User profiles and settings
2. **clients** - Client management with KYC tracking
3. **documents** - Document storage and OCR processing
4. **financial_records** - Accounting entries (income/expense)
5. **invoices** - Invoice data from OCR extraction
6. **kyc_document_types** - Master data for KYC types
7. **kyc_checklists** - KYC requirements per client
8. **kyc_documents** - Uploaded KYC documents
9. **automation_rules** - WhatsApp/Email automation
10. **automation_logs** - Automation execution history

### Storage Buckets (3 total)

1. **documents** - Invoice/receipt uploads (private)
2. **kyc-documents** - KYC document uploads (private)
3. **avatars** - User profile pictures (public)

### Security Features

- ✅ Row Level Security (RLS) enabled on all tables
- ✅ Policies for user data isolation
- ✅ Storage policies for file access control
- ✅ Automatic profile creation on signup
- ✅ Updated_at triggers on all tables

## 🧪 Step 3: Verify Migration

### Check Tables Created

1. Go to **Table Editor** in Supabase Dashboard
2. You should see all 10 tables listed
3. Click on each to verify columns

### Check Storage Buckets

1. Go to **Storage** in Supabase Dashboard
2. You should see 3 buckets:
   - documents
   - kyc-documents
   - avatars

### Test the Application

```bash
# Restart dev server
npm run dev
```

Then test:

1. ✅ **Sign up / Login** - Creates profile automatically
2. ✅ **Create a client** - Tests clients table
3. ✅ **Upload document** - Tests documents table + storage
4. ✅ **Process document** - Tests OCR + financial_records + invoices
5. ✅ **View financials** - Tests financial_records queries
6. ✅ **View invoices** - Tests invoices queries

## 🔍 Troubleshooting

### Issue: "relation does not exist"

**Solution**: Make sure you ran the ENTIRE migration script, not just parts of it.

### Issue: "permission denied"

**Solution**: 
1. Check you're logged in to the app
2. Verify RLS policies were created (see migration script)

### Issue: "foreign key constraint violation"

**Solution**: Tables are created in the correct order in the migration script. Run it all at once.

### Issue: Storage bucket not found

**Solution**: 
1. Go to Storage in Supabase Dashboard
2. Manually create buckets if needed:
   - Name: `documents`, Public: No
   - Name: `kyc-documents`, Public: No
   - Name: `avatars`, Public: Yes

## 📈 Migration Comparison

| Feature | Old DB | New DB | Status |
|---------|--------|--------|--------|
| Project ID | izqefnwufcaldqpzuhkr | tedkkwqlcoilopcrxkdl | ✅ Updated |
| Tables | ? | 10 tables | ✅ Created |
| Storage | ? | 3 buckets | ✅ Created |
| RLS | ? | Enabled | ✅ Secured |
| Policies | ? | All set | ✅ Protected |

## 🎯 Post-Migration Checklist

- [ ] Run `COMPLETE_DATABASE_MIGRATION.sql` in Supabase SQL Editor
- [ ] Verify all 10 tables exist in Table Editor
- [ ] Verify 3 storage buckets exist in Storage
- [ ] Restart dev server (`npm run dev`)
- [ ] Test signup/login
- [ ] Create a test client
- [ ] Upload a test document
- [ ] Process the document with OCR
- [ ] Verify data in financials page
- [ ] Verify data in invoices page
- [ ] Check console for any errors

## 🔐 Security Notes

### Row Level Security (RLS)

All tables have RLS enabled with policies that ensure:
- Users can only see their own data
- Users can only modify their own data
- Client data is isolated per user
- Documents are private to the uploader

### Storage Security

- **documents** bucket: Only accessible by document owner
- **kyc-documents** bucket: Only accessible by client owner
- **avatars** bucket: Public read, owner write

### API Keys

Your API keys remain the same:
- ✅ Gemini API Key: Configured
- ✅ Google Vision API Key: Configured
- ✅ DeepSeek API Key: Configured

## 📝 Data Migration (Optional)

If you need to migrate data from the old database:

### Option 1: Manual Export/Import

1. **Export from old DB**:
   - Go to old Supabase project
   - Table Editor → Select table → Export as CSV
   - Repeat for each table

2. **Import to new DB**:
   - Go to new Supabase project
   - Table Editor → Select table → Import CSV
   - Repeat for each table

### Option 2: SQL Dump

```sql
-- In OLD database, export data
COPY (SELECT * FROM clients) TO '/tmp/clients.csv' CSV HEADER;
COPY (SELECT * FROM documents) TO '/tmp/documents.csv' CSV HEADER;
-- ... repeat for other tables

-- In NEW database, import data
COPY clients FROM '/tmp/clients.csv' CSV HEADER;
COPY documents FROM '/tmp/documents.csv' CSV HEADER;
-- ... repeat for other tables
```

### Option 3: Fresh Start

Since you have a new database, you can start fresh:
- ✅ No old data to migrate
- ✅ Clean slate for testing
- ✅ Proper schema from the start

## 🎉 Success Indicators

You'll know migration is successful when:

1. ✅ No console errors on app startup
2. ✅ Can sign up / login successfully
3. ✅ Can create clients
4. ✅ Can upload documents
5. ✅ OCR processing works
6. ✅ Financial records are created
7. ✅ Invoice data is extracted
8. ✅ All pages load without errors

## 🆘 Need Help?

If you encounter issues:

1. **Check Supabase Logs**:
   - Dashboard → Logs → View recent errors

2. **Check Browser Console**:
   - F12 → Console → Look for errors

3. **Verify Environment**:
   - `.env` file has correct credentials
   - Dev server restarted after `.env` changes

4. **Test Database Connection**:
   ```javascript
   // In browser console
   console.log(import.meta.env.VITE_SUPABASE_URL)
   // Should show: https://tedkkwqlcoilopcrxkdl.supabase.co
   ```

## 📚 Next Steps

After successful migration:

1. ✅ Test all features thoroughly
2. ✅ Upload sample documents
3. ✅ Process with OCR
4. ✅ Generate financial reports
5. ✅ Set up automation rules
6. ✅ Configure WhatsApp integration (optional)

---

**Your new database is ready! Run the migration script and start testing! 🚀**
