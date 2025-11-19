# 🚀 Fintrex WhatsApp Integration - Deployment Guide

## Issues Fixed

### ✅ Fixed Issues:
1. **Duplicate Index Error** - Created idempotent migration that checks for existing indexes
2. **Edge Function Import Error** - Added `deno.json` configuration for proper module resolution
3. **All migrations consolidated** - Single clean migration file

---

## 📋 Step-by-Step Deployment Instructions

### **Step 1: Run the Migration in Supabase Dashboard**

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/izqefnwufcaldqpzuhkr
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy and paste the entire contents of this file:
   ```
   supabase/migrations/20250120000000_whatsapp_complete_fixed.sql
   ```
5. Click **Run** (or press Ctrl+Enter)
6. ✅ You should see success message - all tables, indexes, and policies created!

**What this migration does:**
- Creates `whatsapp_sessions` table for persistent session storage
- Creates `kyc_checklist_templates` for KYC document templates
- Creates `client_kyc_checklists` for tracking client KYC documents
- Creates `document_requests` queue for accountant-initiated requests
- Creates `vendors` master table for invoice matching
- Creates `whatsapp_messages` log for analytics
- Creates `whatsapp_rate_limits` for rate limiting
- Creates `payment_reminders` for invoice tracking
- Creates `gst_validation_cache` for GST validation
- Adds RLS policies for security
- All operations are **idempotent** (safe to run multiple times)

---

### **Step 2: Deploy the WhatsApp Webhook Edge Function**

#### Option A: Using Supabase Dashboard (Recommended)

1. Go to **Edge Functions** in your Supabase Dashboard
2. Click **Deploy a new function**
3. Name it: `whatsapp-webhook`
4. Copy the contents of these files:

**Main file (index.ts):**
```
supabase/functions/whatsapp-webhook/index.ts
```

**Import files** - You'll need to upload these as well:
- `supabase/functions/whatsapp-webhook/session-manager.ts`
- `supabase/functions/whatsapp-webhook/accounting-validations.ts`
- `supabase/functions/whatsapp-webhook/kyc-workflows.ts`
- `supabase/functions/whatsapp-webhook/vendor-matching.ts`

**Configuration (deno.json):**
```
supabase/functions/whatsapp-webhook/deno.json
```

5. Click **Deploy**

#### Option B: Using Supabase CLI (If authenticated)

```bash
# First, login to Supabase
supabase login

# Link your project
supabase link --project-ref izqefnwufcaldqpzuhkr

# Deploy the function
supabase functions deploy whatsapp-webhook
```

---

### **Step 3: Set Environment Secrets**

Go to **Settings > Edge Functions > Secrets** and add:

```bash
WHATSAPP_TOKEN=your_whatsapp_business_api_token
WHATSAPP_VERIFY_TOKEN=your_verify_token_for_webhook
SUPABASE_URL=https://izqefnwufcaldqpzuhkr.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
APP_URL=https://app.fintrex.ai
```

Or via CLI:
```bash
supabase secrets set WHATSAPP_TOKEN=your_token
supabase secrets set WHATSAPP_VERIFY_TOKEN=your_verify_token
supabase secrets set SUPABASE_URL=https://izqefnwufcaldqpzuhkr.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_key
supabase secrets set APP_URL=https://app.fintrex.ai
```

---

### **Step 4: Test the Deployment**

#### Test 1: Verify Webhook Endpoint

```bash
curl "https://izqefnwufcaldqpzuhkr.supabase.co/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=test123"
```

Expected response: `test123`

#### Test 2: Check Database Tables

Run this in SQL Editor:
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'whatsapp_sessions',
    'kyc_checklist_templates',
    'client_kyc_checklists',
    'vendors',
    'whatsapp_messages',
    'payment_reminders'
  );
```

Should return all 6 tables.

#### Test 3: Check Indexes

```sql
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE '%whatsapp%';
```

Should show all WhatsApp-related indexes.

---

## 🔍 Troubleshooting

### Error: "relation already exists"
✅ **Fixed!** The new migration uses `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`

### Error: "index already exists"
✅ **Fixed!** All index creations now use `IF NOT EXISTS`

### Error: Module not found "session-manager.ts"
✅ **Fixed!** Added `deno.json` configuration file

### Edge Function returns 502
**Check:**
1. Are all secrets set correctly?
2. Is the function deployed with all import files?
3. Check function logs in Supabase Dashboard

### WhatsApp webhook not receiving messages
**Check:**
1. Verify token is set correctly
2. URL is configured in WhatsApp Business API settings
3. Check function logs for errors

---

## 📁 Files Modified/Created

### New Files:
- ✅ `supabase/migrations/20250120000000_whatsapp_complete_fixed.sql` - Fixed migration
- ✅ `supabase/functions/whatsapp-webhook/deno.json` - Deno configuration
- ✅ `DEPLOYMENT_GUIDE.md` - This file

### Existing Files (No changes needed):
- `supabase/functions/whatsapp-webhook/index.ts`
- `supabase/functions/whatsapp-webhook/session-manager.ts`
- `supabase/functions/whatsapp-webhook/accounting-validations.ts`
- `supabase/functions/whatsapp-webhook/kyc-workflows.ts`
- `supabase/functions/whatsapp-webhook/vendor-matching.ts`

---

## 🎯 Next Steps After Deployment

1. **Add WhatsApp Business Number** to your accountant profile in the app
2. **Add client phone numbers** in the Clients page
3. **Test WhatsApp flow:**
   - Send "Hi" to your WhatsApp Business number
   - Bot should respond with welcome message
   - Try uploading an invoice
4. **Monitor logs** in Supabase Dashboard > Edge Functions > Logs

---

## 💡 Quick Command Reference

```bash
# Login to Supabase
supabase login

# Link project
supabase link --project-ref izqefnwufcaldqpzuhkr

# Deploy edge function
supabase functions deploy whatsapp-webhook

# Set secrets
supabase secrets set KEY=value

# View function logs
supabase functions logs whatsapp-webhook

# Test locally (requires Docker)
supabase functions serve whatsapp-webhook
```

---

## ✅ Deployment Checklist

- [ ] Run migration SQL in Supabase Dashboard
- [ ] Deploy whatsapp-webhook edge function
- [ ] Set all environment secrets
- [ ] Test webhook verification endpoint
- [ ] Verify tables created in database
- [ ] Configure WhatsApp Business API webhook URL
- [ ] Test with real WhatsApp message
- [ ] Monitor function logs for errors

---

## 📞 Support

If you encounter any issues:
1. Check Supabase function logs
2. Verify all secrets are set
3. Check database tables exist
4. Test webhook endpoint manually
5. Review WhatsApp API configuration

---

**Last Updated:** 2025-01-20
**Migration File:** `20250120000000_whatsapp_complete_fixed.sql`
**Edge Function:** `whatsapp-webhook`
