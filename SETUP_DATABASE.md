# Database Setup Guide

## Quick Setup

The `invoices` table is missing from your Supabase database. Here's how to fix it:

### Option 1: Run Migration via Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: **Fintrex**
3. Go to **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy and paste the following SQL:

```sql
-- Ensure invoices table exists with all required columns
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  invoice_type TEXT NOT NULL CHECK (invoice_type IN ('sales','purchase')),
  invoice_number TEXT,
  invoice_date DATE,
  due_date DATE,
  vendor_name TEXT,
  vendor_gstin TEXT,
  customer_name TEXT,
  customer_gstin TEXT,
  line_items JSONB,
  tax_details JSONB,
  total_amount NUMERIC,
  currency TEXT DEFAULT 'INR',
  payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid','partial','overdue')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS invoices_client_idx ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS invoices_type_idx ON public.invoices(invoice_type);
CREATE INDEX IF NOT EXISTS invoices_document_idx ON public.invoices(document_id);
CREATE INDEX IF NOT EXISTS invoices_date_idx ON public.invoices(invoice_date);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own invoices"
  ON public.invoices FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own invoices"
  ON public.invoices FOR UPDATE
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own invoices"
  ON public.invoices FOR DELETE
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );
```

6. Click **Run** or press `Ctrl+Enter`
7. You should see: **Success. No rows returned**

### Option 2: Using Supabase CLI

If you have Supabase CLI installed:

```bash
# Navigate to project directory
cd "c:\Users\Arzaan Ali Khan\OneDrive\Desktop\Developer\Fintrex"

# Run the migration
supabase db push
```

### Option 3: Manual Table Creation

If the above doesn't work, create the table manually:

1. Go to **Table Editor** in Supabase Dashboard
2. Click **New Table**
3. Name: `invoices`
4. Add these columns:

| Column Name | Type | Default | Nullable | Unique |
|------------|------|---------|----------|--------|
| id | uuid | gen_random_uuid() | No | Yes (PK) |
| document_id | uuid | - | Yes | No |
| client_id | uuid | - | No | No |
| invoice_type | text | - | No | No |
| invoice_number | text | - | Yes | No |
| invoice_date | date | - | Yes | No |
| due_date | date | - | Yes | No |
| vendor_name | text | - | Yes | No |
| vendor_gstin | text | - | Yes | No |
| customer_name | text | - | Yes | No |
| customer_gstin | text | - | Yes | No |
| line_items | jsonb | - | Yes | No |
| tax_details | jsonb | - | Yes | No |
| total_amount | numeric | - | Yes | No |
| currency | text | 'INR' | Yes | No |
| payment_status | text | 'unpaid' | Yes | No |
| created_at | timestamptz | now() | No | No |
| updated_at | timestamptz | now() | No | No |

5. Add foreign keys:
   - `document_id` → `documents.id` (ON DELETE SET NULL)
   - `client_id` → `clients.id` (ON DELETE CASCADE)

6. Enable RLS and add policies (see SQL above)

## Verify Setup

After running the migration, verify it worked:

1. Go to **Table Editor** in Supabase Dashboard
2. You should see the `invoices` table listed
3. Click on it to see the columns

## Test the Application

1. Restart your dev server:
   ```bash
   npm run dev
   ```

2. Navigate to `/documents`
3. Upload a document
4. Click "Process"
5. Check console - you should no longer see the 404 error for `/rest/v1/invoices`

## Common Issues

### Issue: "relation 'public.invoices' does not exist"
**Solution**: Run the SQL migration above in Supabase SQL Editor

### Issue: "permission denied for table invoices"
**Solution**: Make sure RLS policies are created (see SQL above)

### Issue: "foreign key constraint violation"
**Solution**: Ensure `clients` and `documents` tables exist first

## Database Schema Overview

After setup, your database should have these tables:

- ✅ `clients` - Client information
- ✅ `documents` - Uploaded documents
- ✅ `financial_records` - Accounting entries
- ✅ `invoices` - Invoice data extracted from documents
- ✅ `kyc_documents` - KYC verification documents
- ✅ `kyc_checklists` - KYC requirements per client

## Next Steps

Once the database is set up:

1. ✅ Upload a test invoice/receipt
2. ✅ Process it with OCR
3. ✅ Verify data is extracted correctly
4. ✅ Check the `invoices` table for the new record
5. ✅ View invoices in the Invoices page

---

**Need Help?**

If you encounter any issues:
1. Check Supabase logs in Dashboard → Logs
2. Check browser console for errors
3. Verify your Supabase connection in `.env`
4. Ensure you're authenticated in the app
