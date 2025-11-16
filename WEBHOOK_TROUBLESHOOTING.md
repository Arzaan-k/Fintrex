# WhatsApp Webhook Verification Troubleshooting Guide

## Quick Diagnosis

The webhook verification is failing. This guide will help you identify and fix the issue.

## Step 1: Deploy the Updated Function

The code has been fixed, but you need to deploy it to Supabase:

```bash
# Make sure you're in the project directory
cd /home/user/Fintrex

# Deploy the function
supabase functions deploy whatsapp-webhook
```

**Expected output:**
```
Deploying function whatsapp-webhook...
✓ Function deployed successfully
```

## Step 2: Check Environment Variables

The most common issue is missing or incorrect environment variables.

### Check if secrets are set:

```bash
supabase secrets list
```

You should see:
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Set the VERIFY_TOKEN if missing:

```bash
# Set your custom verify token (use any secure random string)
supabase secrets set WHATSAPP_VERIFY_TOKEN=your_secure_token_here

# Example:
supabase secrets set WHATSAPP_VERIFY_TOKEN=fintrex_webhook_2025_secure
```

**IMPORTANT:** Remember this token! You'll need to enter it in Meta's webhook configuration.

## Step 3: Test the Webhook Locally

Use the test script I created:

```bash
chmod +x test-webhook.sh
./test-webhook.sh
```

Enter your Supabase URL and VERIFY_TOKEN when prompted.

**What to look for:**
- ✅ Test 1 should PASS (returns status 200 and challenge)
- ✅ Test 2 should PASS (returns status 403 for wrong token)
- ✅ Test 3 should PASS (returns status 400 for missing params)

## Step 4: Check Supabase Logs

View real-time logs to see what's happening:

```bash
supabase functions logs whatsapp-webhook --follow
```

Then try the verification in Meta's dashboard and watch the logs.

**What to look for in logs:**

### If you see:
```
❌ VERIFY_TOKEN is NOT set in environment variables!
```
**Fix:** Run `supabase secrets set WHATSAPP_VERIFY_TOKEN=your_token`

### If you see:
```
❌ Token mismatch!
Received: abcde...
Expected: fghij...
```
**Fix:** The token you entered in Meta doesn't match the one in Supabase. Update one to match the other.

### If you see:
```
✅ VERIFICATION SUCCESSFUL - Returning challenge: xyz123
```
**Great!** Verification is working. The issue might be elsewhere.

## Step 5: Configure Meta Webhook

1. Go to **Meta Developers**: https://developers.facebook.com/apps/
2. Select your app → **WhatsApp** → **Configuration**
3. Click **Edit** next to "Webhook"

**Enter these values:**

- **Callback URL**: `https://<your-project>.supabase.co/functions/v1/whatsapp-webhook`
  - Replace `<your-project>` with your actual Supabase project ID
  - Example: `https://abcdefgh.supabase.co/functions/v1/whatsapp-webhook`

- **Verify Token**: The EXACT same value you set in `WHATSAPP_VERIFY_TOKEN`
  - ⚠️ **No extra spaces**
  - ⚠️ **Case sensitive**
  - ⚠️ **Must match exactly**

4. Click **Verify and Save**

## Common Issues & Fixes

### Issue 1: "Invalid verification" error

**Possible causes:**
- Function not deployed
- Wrong URL
- Missing query parameters

**Fix:**
```bash
# Redeploy function
supabase functions deploy whatsapp-webhook

# Test with curl
curl "https://your-project.supabase.co/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=your_token&hub.challenge=test123"
```

Expected response: `test123` (plain text)

### Issue 2: "Token mismatch" (403 error)

**Possible causes:**
- Different tokens in Meta vs Supabase
- Extra whitespace in token
- Token not set in Supabase

**Fix:**
```bash
# Get current secrets (won't show values, just names)
supabase secrets list

# Set/update the token
supabase secrets set WHATSAPP_VERIFY_TOKEN=your_exact_token

# Redeploy to apply changes
supabase functions deploy whatsapp-webhook
```

**Pro tip:** Use a simple token for testing first (e.g., `test123`), then change to a secure one later.

### Issue 3: "Server configuration error" (500)

**Cause:** VERIFY_TOKEN not set in environment

**Fix:**
```bash
supabase secrets set WHATSAPP_VERIFY_TOKEN=your_token
supabase functions deploy whatsapp-webhook
```

### Issue 4: Function not found / 404 error

**Possible causes:**
- Function not deployed
- Wrong function name
- Wrong project URL

**Fix:**
```bash
# Check deployed functions
supabase functions list

# Should show: whatsapp-webhook

# If not listed, deploy it
supabase functions deploy whatsapp-webhook

# Verify the correct URL
supabase status
```

### Issue 5: CORS errors (in browser console)

**This is normal** - Meta's server makes the request, not a browser. CORS errors in browser don't affect webhook verification.

## Step-by-Step Verification Checklist

- [ ] Code has been committed (latest version)
- [ ] Function deployed to Supabase
- [ ] `WHATSAPP_VERIFY_TOKEN` secret is set
- [ ] Secret value matches token in Meta
- [ ] No extra whitespace in token
- [ ] Webhook URL is correct
- [ ] Test script passes Test 1
- [ ] Logs show "✅ VERIFICATION SUCCESSFUL"
- [ ] Meta webhook configured
- [ ] Webhook fields subscribed (messages, messaging_postbacks)

## Manual Test with cURL

Test the webhook manually:

```bash
curl -v "https://YOUR_PROJECT.supabase.co/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123"
```

**Expected response:**
```
HTTP/2 200
content-type: text/plain

test123
```

## Still Not Working?

If you've tried everything above and it still doesn't work:

1. **Share the error message** from Meta's webhook configuration
2. **Check Supabase logs** and share what you see
3. **Verify the URL** is exactly correct (no typos)
4. **Try a simple token** like `test123` to rule out special character issues

## Debug Checklist

Run these commands and share the output:

```bash
# 1. Check if function exists
supabase functions list

# 2. Check function logs
supabase functions logs whatsapp-webhook --limit 20

# 3. Test webhook
curl "https://YOUR_PROJECT.supabase.co/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123"

# 4. Check secrets (won't show values)
supabase secrets list
```

## Success Indicators

You'll know it's working when:

1. **Test script passes** ✅
2. **Meta shows "Verified"** with a green checkmark ✅
3. **Logs show** "✅ VERIFICATION SUCCESSFUL" ✅
4. **You can subscribe to webhook fields** ✅

## Next Steps After Verification

Once verification succeeds:

1. Subscribe to webhook fields:
   - ✅ messages
   - ✅ messaging_postbacks

2. Test with a real WhatsApp message:
   - Send "hi" to your WhatsApp Business number
   - Check logs: `supabase functions logs whatsapp-webhook --follow`
   - Should see incoming message payload

3. Verify message processing works end-to-end

---

**Need more help?** Share:
- The exact error message from Meta
- Your Supabase function logs
- Your webhook URL (you can redact the project ID)
