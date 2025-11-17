# WhatsApp Integration Setup Guide

Follow these steps in order to fix WhatsApp client identification:

## Step 1: Add Missing Database Columns ⚠️ CRITICAL

Your database is missing the required columns. **You must do this first!**

### Instructions:

1. **Open Supabase Dashboard**
   - Go to your Supabase project
   - Click "SQL Editor" in the left sidebar

2. **Run the migration script**
   - Open the file: `fix-missing-columns.sql`
   - Copy all the contents
   - Paste into Supabase SQL Editor
   - Click "Run" button

3. **Verify it worked**

   You should see output like:
   ```
   column_name        | data_type | is_nullable | column_default
   -------------------+-----------+-------------+----------------
   firm_name          | text      | YES         | null
   settings           | jsonb     | YES         | '{}'::jsonb
   whatsapp_api_key   | text      | YES         | null
   whatsapp_number    | text      | YES         | null
   ```

   And your profile data with the new columns.

### What this does:
- ✅ Adds `whatsapp_number` column - stores your WhatsApp Business number
- ✅ Adds `firm_name` column - stores your accounting firm name
- ✅ Adds `settings` column - stores user preferences
- ✅ Adds `whatsapp_api_key` column - stores WhatsApp API token
- ✅ Creates indexes for fast lookups

---

## Step 2: Set Your WhatsApp Business Number

After adding the columns, update your profile:

```sql
-- Replace 'your-email@example.com' with your actual email
-- Replace '+919876543210' with your WhatsApp Business number
UPDATE public.profiles
SET
  whatsapp_number = '+919876543210',
  firm_name = 'Your Firm Name'
WHERE email = 'your-email@example.com';

-- Verify it was set
SELECT id, full_name, firm_name, whatsapp_number, email
FROM public.profiles
WHERE whatsapp_number IS NOT NULL;
```

**Expected output:**
```
id         | full_name  | firm_name      | whatsapp_number  | email
-----------+------------+----------------+------------------+-------------------
uuid-here  | Your Name  | Your Firm Name | +919876543210    | your@email.com
```

---

## Step 3: Deploy Edge Function

Deploy the updated WhatsApp webhook:

```bash
cd /home/user/Fintrex
supabase functions deploy whatsapp-webhook
```

**Expected output:**
```
Deploying function whatsapp-webhook...
✓ Function deployed successfully
```

---

## Step 4: Add a Test Client

1. **Open your app** (localhost or deployed URL)
2. **Go to Clients page**
3. **Click "Add Client"**
4. **Fill in the form:**
   - Business Name: `Test Company`
   - Contact Person: `Your Name`
   - Phone Number: `9876543210` (or your mobile number)
   - Email: `test@example.com`
   - GST/PAN: (optional)
5. **Click "Save"**

The phone number will be automatically formatted to `+919876543210`.

---

## Step 5: Test WhatsApp Flow

### 5.1 Send a Test Message

1. **Open WhatsApp** on your phone
2. **Send a message** to your WhatsApp Business number (the one you set in Step 2)
3. **Type:** `Hi`

### 5.2 Expected Response

You should receive:

```
Welcome back, Test Company! 👋

Your documents will be automatically linked to your account.

Send me an invoice to get started! 📄
```

### 5.3 If You Get "Account Not Found"

This means the client matching failed. Check the logs:

```bash
supabase functions logs whatsapp-webhook --follow
```

Look for these log entries:

**Success logs:**
```
📱 Business WhatsApp number: +919876543210
✅ Found accountant: Your Name (uuid)
📞 Incoming phone: +919876543210, Variants: ["+919876543210","919876543210","9876543210","09876543210"]
🔍 Searching for client with accountant_id: uuid, phone variants: ...
🔎 Client search result: 1 matches found
📋 Matched client data: {...}
✅ Matched to existing client: Test Company (uuid)
```

**Failure logs (troubleshoot):**
```
📱 Business WhatsApp number: +919876543210
✅ Found accountant: Your Name (uuid)
📞 Incoming phone: +919876543210
🔎 Client search result: 0 matches found
⚠️ Unknown phone number +919876543210 - no client account found for accountant uuid
📊 Searched variants: +919876543210, 919876543210, 9876543210, 09876543210
```

---

## Step 6: Upload a Document

### 6.1 Request Upload

1. **In WhatsApp**, click the **"📄 Upload Invoice"** button
2. **You'll see:** "Please send a photo of your invoice/receipt..."

### 6.2 Send Document

1. **Take a photo** of an invoice or receipt (or send a PDF)
2. **Send it** via WhatsApp

### 6.3 Expected Response

```
⏳ Processing your document...

This usually takes 5-15 seconds.
I'll extract all the details and verify them for you! 🤖
```

Then after processing (5-15 seconds):

```
⚠️ Review Required

I've extracted the following details:

📄 Invoice Details:
Invoice No: INV-12345
Date: 2025-01-15
Vendor: ABC Suppliers
Amount: ₹5,000

🎯 Confidence: 92%

Please verify the details are correct.
```

With buttons: `✅ Approve` | `✏️ Need Changes` | `❌ Reject`

---

## Troubleshooting

### Issue: "column whatsapp_number does not exist"

**Solution:** You skipped Step 1. Go back and run `fix-missing-columns.sql`.

### Issue: "Account Not Found" when messaging WhatsApp

**Possible causes:**

1. **Client phone doesn't match**

   Check the client's phone in database:
   ```sql
   SELECT business_name, phone_number
   FROM clients
   WHERE phone_number LIKE '%876543210%';
   ```

   Should show: `+919876543210` (not `9876543210` or other format)

2. **Wrong accountant WhatsApp number**

   Check your profile:
   ```sql
   SELECT full_name, whatsapp_number
   FROM profiles
   WHERE whatsapp_number IS NOT NULL;
   ```

   Should match your WhatsApp Business number.

3. **Client belongs to different accountant**

   Check client-accountant link:
   ```sql
   SELECT
     c.business_name,
     c.phone_number,
     p.full_name as accountant,
     p.whatsapp_number
   FROM clients c
   JOIN profiles p ON c.accountant_id = p.id
   WHERE c.phone_number LIKE '%876543210%';
   ```

### Issue: No response from WhatsApp at all

**Check:**

1. **Webhook is deployed**
   ```bash
   supabase functions list
   ```

2. **Webhook is verified with Meta**
   - Go to Meta Business Suite > WhatsApp > Configuration
   - Verify webhook URL is set and verified

3. **Environment variables are set**
   ```bash
   # Check these are set in Supabase dashboard:
   WHATSAPP_TOKEN
   WHATSAPP_VERIFY_TOKEN
   SUPABASE_URL
   SUPABASE_SERVICE_ROLE_KEY
   ```

4. **Check logs for errors**
   ```bash
   supabase functions logs whatsapp-webhook --follow
   ```

### Issue: Document upload fails

**Check logs for:**
```bash
supabase functions logs whatsapp-webhook | grep -i error
```

Common errors:
- Storage permission denied → Check RLS policies on `documents` bucket
- OCR failed → Check `ocr-secure` function is deployed
- Extraction failed → Check `extract-invoice` function is deployed

---

## Quick Verification Checklist

Before asking for help, verify:

- [ ] Ran `fix-missing-columns.sql` successfully
- [ ] Your profile has `whatsapp_number` set
- [ ] Test client exists with phone number in `+91XXXXXXXXXX` format
- [ ] Client's `accountant_id` matches your user ID
- [ ] Edge function deployed successfully
- [ ] Webhook verified with Meta
- [ ] Environment variables are set
- [ ] Checked logs for error messages

---

## Summary

**In order:**

1. ✅ Run `fix-missing-columns.sql` in Supabase SQL Editor
2. ✅ Set your `whatsapp_number` in profiles table
3. ✅ Deploy edge function: `supabase functions deploy whatsapp-webhook`
4. ✅ Add test client with your phone number
5. ✅ Send "Hi" to WhatsApp Business number
6. ✅ Should receive welcome message
7. ✅ Upload test document
8. ✅ Should receive extraction results

**If anything fails, check the logs first:**
```bash
supabase functions logs whatsapp-webhook --follow
```

---

## Need More Help?

Run these debug queries and share the output:

```sql
-- 1. Check profiles table structure
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY column_name;

-- 2. Check your profile
SELECT id, full_name, firm_name, whatsapp_number, email
FROM profiles
WHERE whatsapp_number IS NOT NULL;

-- 3. Check test client
SELECT id, business_name, phone_number, accountant_id
FROM clients
WHERE phone_number LIKE '%YOUR_PHONE%';

-- 4. Check client-accountant link
SELECT
  c.business_name,
  c.phone_number,
  c.accountant_id,
  p.full_name as accountant_name,
  p.whatsapp_number
FROM clients c
JOIN profiles p ON c.accountant_id = p.id
LIMIT 5;
```

Share the logs:
```bash
supabase functions logs whatsapp-webhook --limit 50
```

This will help identify the exact issue.
