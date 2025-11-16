# WhatsApp Webhook Verification Debugging Guide

## Current Status
✅ Edge function code is correct (fixed in recent commit)
⚠️ Need to verify deployment and configuration

## Step-by-Step Verification Process

### 1. Check if Edge Function is Deployed

The edge function must be deployed to Supabase before it can receive webhook requests.

**Check deployment status:**
```bash
# List all deployed functions
supabase functions list
```

**If NOT deployed, deploy it now:**
```bash
# Deploy the whatsapp-webhook function
cd /home/user/Fintrex
supabase functions deploy whatsapp-webhook
```

### 2. Verify Supabase Secrets are Set

The function requires these environment variables to be set as Supabase secrets:

**Required secrets:**
- `WHATSAPP_TOKEN` - Your WhatsApp Business API access token
- `WHATSAPP_VERIFY_TOKEN` (or `VERIFY_TOKEN`) - Your custom verification token
- `SUPABASE_URL` - Auto-set by Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-set by Supabase
- `APP_URL` - Your app URL (e.g., https://fintrex.onrender.com)

**Check current secrets:**
```bash
supabase secrets list
```

**Set missing secrets:**
```bash
# Set WhatsApp token
supabase secrets set WHATSAPP_TOKEN=YOUR_WHATSAPP_ACCESS_TOKEN

# Set verify token (create your own secure string)
supabase secrets set WHATSAPP_VERIFY_TOKEN=your_unique_verify_token_here

# Set app URL
supabase secrets set APP_URL=https://your-app-url.com
```

**IMPORTANT**: After setting secrets, you MUST redeploy the function:
```bash
supabase functions deploy whatsapp-webhook
```

### 3. Get Your Webhook URL

Your webhook URL should be:
```
https://izqefnwufcaldqpzuhkr.supabase.co/functions/v1/whatsapp-webhook
```

### 4. Test the Webhook Locally

Before configuring in Facebook, test that verification works:

```bash
# Replace YOUR_VERIFY_TOKEN with the token you set in Supabase secrets
curl "https://izqefnwufcaldqpzuhkr.supabase.co/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=TEST123"
```

**Expected response:** `TEST123` (the challenge string returned as plain text)

**If you get an error:**
- `403 Forbidden` = Token mismatch (verify token is wrong)
- `500 Server Error` = VERIFY_TOKEN not configured in Supabase
- `400 Bad Request` = Missing parameters
- `404 Not Found` = Function not deployed

### 5. Configure in Facebook/Meta

1. Go to https://developers.facebook.com/apps/
2. Select your WhatsApp app
3. Click **WhatsApp** → **Configuration**
4. Under **Webhook**, click **Edit**
5. Enter:
   - **Callback URL**: `https://izqefnwufcaldqpzuhkr.supabase.co/functions/v1/whatsapp-webhook`
   - **Verify Token**: The EXACT same token you set in `WHATSAPP_VERIFY_TOKEN`
6. Click **Verify and Save**

### 6. Subscribe to Webhook Fields

After verification succeeds, subscribe to these webhook fields:
- ✅ **messages**
- ✅ **messaging_postbacks** (for button interactions)

## Common Issues and Solutions

### Issue 1: "The URL couldn't be validated"

**Possible causes:**
1. Edge function not deployed
2. VERIFY_TOKEN not set in Supabase secrets
3. Token mismatch between Supabase and Facebook

**Solution:**
```bash
# 1. Deploy function
supabase functions deploy whatsapp-webhook

# 2. Set verify token
supabase secrets set WHATSAPP_VERIFY_TOKEN=my_secure_token_123

# 3. Redeploy after setting secrets
supabase functions deploy whatsapp-webhook

# 4. Test with curl
curl "https://izqefnwufcaldqpzuhkr.supabase.co/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=my_secure_token_123&hub.challenge=TEST"

# 5. Use the SAME token in Facebook
```

### Issue 2: Function deployed but still failing

**Check function logs:**
```bash
supabase functions logs whatsapp-webhook --limit 50
```

Look for error messages like:
- `VERIFY_TOKEN not configured` = Secret not set
- `Token mismatch` = Wrong verify token in Facebook

### Issue 3: Secrets not being read

**Cause:** Secrets are only loaded when function is deployed

**Solution:**
```bash
# Always redeploy after changing secrets
supabase secrets set WHATSAPP_VERIFY_TOKEN=your_token
supabase functions deploy whatsapp-webhook  # MUST DO THIS!
```

## Verification Checklist

Run through this checklist:

- [ ] Supabase CLI installed and logged in
- [ ] Edge function deployed (`supabase functions list` shows whatsapp-webhook)
- [ ] WHATSAPP_TOKEN secret set
- [ ] WHATSAPP_VERIFY_TOKEN (or VERIFY_TOKEN) secret set
- [ ] Function redeployed after setting secrets
- [ ] Webhook URL tested with curl (returns challenge)
- [ ] Same verify token used in Facebook webhook configuration
- [ ] Webhook fields subscribed (messages, messaging_postbacks)

## Quick Fix Commands

If you're starting fresh, run these commands in order:

```bash
# 1. Navigate to project
cd /home/user/Fintrex

# 2. Set secrets
supabase secrets set WHATSAPP_TOKEN=YOUR_WHATSAPP_ACCESS_TOKEN
supabase secrets set WHATSAPP_VERIFY_TOKEN=fintrex_webhook_secure_2025
supabase secrets set APP_URL=https://your-app.com

# 3. Deploy function
supabase functions deploy whatsapp-webhook

# 4. Test verification
curl "https://izqefnwufcaldqpzuhkr.supabase.co/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=fintrex_webhook_secure_2025&hub.challenge=TEST123"

# Should return: TEST123
```

## Need More Help?

Check function logs for detailed error messages:
```bash
supabase functions logs whatsapp-webhook --follow
```

Then configure webhook in Facebook while watching the logs to see what's happening in real-time.

---

**Last Updated:** 2025-01-16
