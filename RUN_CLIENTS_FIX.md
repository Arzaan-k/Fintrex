# 🔧 Fixing the `accountant_id` Error

The error `ERROR: column "accountant_id" does not exist` means the `clients` table in your new Supabase project still uses the old `user_id` column. Follow these steps to fix it.

## ✅ Step 1: Run the Fix Script

1. Open the Supabase Dashboard: https://supabase.com/dashboard
2. Select project: **tedkkwqlcoilopcrxkdl**
3. Go to **SQL Editor** → **New Query**
4. Open and copy the contents of:
   ```
   supabase/fixes/20251106_fix_clients_accountant_id.sql
   ```
5. Paste into the SQL editor and click **Run**

This script will:
- Add `accountant_id` and migrate data from `user_id`
- Rename columns to match the app schema (`business_name`, `phone_number`, `gst_number`, etc.)
- Add missing columns (`contact_person`, `tan_number`, `city`, `state`, `pincode`, etc.)
- Drop the old `user_id` column
- Recreate indexes and Row Level Security policies using `accountant_id`

## 🔄 Step 2: Restart the Dev Server

```bash
npm run dev
```

## 🧪 Step 3: Retest in the App

- Refresh the app
- Navigate to **Clients** page
- Fetch clients / add a new client
- Verify that no errors appear and clients list loads

## ✅ Expected Result

- `clients` table has `accountant_id` column (NOT `user_id`)
- Creating/fetching clients works without errors
- Documents, Dashboard, Financials pages no longer show 400 errors

## 🆘 Troubleshooting

If the script fails:
1. Check Supabase logs for the exact error
2. Make sure you do **not** have pending unsaved changes in the SQL editor
3. Verify you copied the entire script (Ctrl+A / Ctrl+C)

---

After completing these steps, the app will use the correct schema and the `accountant_id` errors will be resolved.
