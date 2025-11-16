# EMERGENCY FIX - Facebook Can't Connect to Webhook

## THE MOST LIKELY ISSUE: JWT Authentication

Supabase Edge Functions by default require JWT authentication. Facebook's webhook verification requests DON'T have authentication tokens, so they get blocked!

## THE FIX - Deploy Without JWT Verification

Run this command RIGHT NOW:

```bash
cd /home/user/Fintrex

# Link to your project
supabase link --project-ref tedkkwqlcoilopcrxkdl

# Deploy WITHOUT JWT verification (this allows Facebook to connect)
supabase functions deploy whatsapp-webhook --no-verify-jwt
```

If you named your function `clever-api`, use this instead:

```bash
supabase functions deploy clever-api --no-verify-jwt
```

## Why This Matters

- **WITH JWT verification** (default): Only authenticated requests work → Facebook BLOCKED ❌
- **WITHOUT JWT verification** (`--no-verify-jwt`): Public access → Facebook CAN CONNECT ✅

## Security Note

The `--no-verify-jwt` flag is SAFE for webhooks because:
1. You verify the webhook using `hub.verify_token` parameter
2. WhatsApp sends a signature you can verify in POST requests
3. This is how webhook endpoints are meant to work

## After Deploying - Test It

```bash
# Test your endpoint (use any verify token - we're just testing if it responds)
curl "https://tedkkwqlcoilopcrxkdl.supabase.co/functions/v1/clever-api?hub.mode=subscribe&hub.verify_token=test&hub.challenge=HELLO"
```

**Expected response:**
- If VERIFY_TOKEN is set correctly and matches: `HELLO`
- If token doesn't match: `Forbidden` (but at least it responds!)
- If 401/403 unauthorized: Still has JWT verification enabled

## Full Reset Commands (if above doesn't work)

```bash
# 1. Link to project
supabase link --project-ref tedkkwqlcoilopcrxkdl

# 2. Set secrets (replace with YOUR actual values)
supabase secrets set WHATSAPP_VERIFY_TOKEN=my_secret_token_12345
supabase secrets set WHATSAPP_TOKEN=your_whatsapp_business_token

# 3. Deploy WITHOUT JWT verification
supabase functions deploy whatsapp-webhook --no-verify-jwt

# 4. Test it
curl "https://tedkkwqlcoilopcrxkdl.supabase.co/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=my_secret_token_12345&hub.challenge=TEST"

# Should return: TEST
```

## In Facebook - Use These Exact Settings

**Callback URL:**
```
https://tedkkwqlcoilopcrxkdl.supabase.co/functions/v1/whatsapp-webhook
```
(or use `clever-api` if that's your function name)

**Verify Token:**
```
my_secret_token_12345
```
(use the EXACT same token you set in `WHATSAPP_VERIFY_TOKEN`)

## Still Not Working?

If after deploying with `--no-verify-jwt` it still doesn't work, check the function logs WHILE clicking "Verify and Save" in Facebook:

```bash
# In one terminal, watch logs live
supabase functions logs whatsapp-webhook --follow

# In another terminal/tab, go to Facebook and click "Verify and Save"
# Watch what error appears in the logs
```

Send me the log output and I'll tell you exactly what's wrong!

---

## TL;DR - RUN THIS NOW:

```bash
cd /home/user/Fintrex
supabase link --project-ref tedkkwqlcoilopcrxkdl
supabase functions deploy whatsapp-webhook --no-verify-jwt
```

Then try Facebook verification again. This should fix it!
