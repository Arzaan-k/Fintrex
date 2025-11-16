# Your WhatsApp Webhook Setup

## Your Endpoint Information

Based on the endpoint you provided:
- **Your Supabase Project ID:** `tedkkwqlcoilopcrxkdl`
- **Your Endpoint:** `https://tedkkwqlcoilopcrxkdl.supabase.co/functions/v1/clever-api`

## Important Clarification Needed

You mentioned the endpoint is `clever-api`, but the WhatsApp webhook function in this repository is named `whatsapp-webhook`.

### Two Possible Scenarios:

#### Scenario 1: You Renamed the Function to `clever-api`

If you deployed the WhatsApp webhook code as `clever-api`, then:

**Your WhatsApp Webhook URL for Facebook:**
```
https://tedkkwqlcoilopcrxkdl.supabase.co/functions/v1/clever-api
```

**Test it with:**
```bash
curl "https://tedkkwqlcoilopcrxkdl.supabase.co/functions/v1/clever-api?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=TEST123"
```

Expected response: `TEST123`

#### Scenario 2: You Need to Deploy `whatsapp-webhook`

If `clever-api` is a different function, you need to deploy the WhatsApp webhook:

```bash
# Make sure you're linked to the correct project
supabase link --project-ref tedkkwqlcoilopcrxkdl

# Deploy the whatsapp-webhook function
supabase functions deploy whatsapp-webhook
```

**Then your WhatsApp Webhook URL would be:**
```
https://tedkkwqlcoilopcrxkdl.supabase.co/functions/v1/whatsapp-webhook
```

## Required Supabase Secrets

Regardless of which function name you use, you need these secrets set:

```bash
# Link to your project first
supabase link --project-ref tedkkwqlcoilopcrxkdl

# Set required secrets
supabase secrets set WHATSAPP_TOKEN=your_whatsapp_access_token
supabase secrets set WHATSAPP_VERIFY_TOKEN=your_unique_verify_token_123
supabase secrets set APP_URL=https://your-app-url.com

# IMPORTANT: Redeploy after setting secrets
supabase functions deploy whatsapp-webhook
# OR if you renamed it:
# supabase functions deploy clever-api
```

## Verification Checklist

- [ ] Confirmed which function name you're using (`clever-api` or `whatsapp-webhook`)
- [ ] Function is deployed to project `tedkkwqlcoilopcrxkdl`
- [ ] All secrets are set (WHATSAPP_TOKEN, WHATSAPP_VERIFY_TOKEN)
- [ ] Function redeployed after setting secrets
- [ ] Tested webhook URL with curl (returns challenge string)
- [ ] Same WHATSAPP_VERIFY_TOKEN used in Facebook webhook configuration

## Facebook/Meta Configuration

1. Go to https://developers.facebook.com/apps/
2. Select your WhatsApp app
3. Click **WhatsApp** → **Configuration**
4. Under **Webhook**, click **Edit**
5. Enter:
   - **Callback URL:** `https://tedkkwqlcoilopcrxkdl.supabase.co/functions/v1/[YOUR_FUNCTION_NAME]`
     - Replace `[YOUR_FUNCTION_NAME]` with either `clever-api` or `whatsapp-webhook`
   - **Verify Token:** The EXACT same token you set in `WHATSAPP_VERIFY_TOKEN`
6. Click **Verify and Save**

## Testing Your Setup

### Step 1: Test the endpoint directly

Replace `YOUR_VERIFY_TOKEN` with your actual token:

```bash
# If using clever-api:
curl "https://tedkkwqlcoilopcrxkdl.supabase.co/functions/v1/clever-api?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=TEST123"

# If using whatsapp-webhook:
curl "https://tedkkwqlcoilopcrxkdl.supabase.co/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=TEST123"
```

**Expected response:** `TEST123` (plain text)

### Step 2: Check for errors

If you get an error, check the function logs:

```bash
# Link to your project
supabase link --project-ref tedkkwqlcoilopcrxkdl

# Check logs (replace with your function name)
supabase functions logs clever-api --limit 20
# OR
supabase functions logs whatsapp-webhook --limit 20
```

### Step 3: Common error responses

| Response | Meaning | Solution |
|----------|---------|----------|
| `404 Not Found` | Function not deployed | Deploy the function |
| `403 Forbidden` | Token mismatch | Check WHATSAPP_VERIFY_TOKEN matches |
| `500 Server Error` | VERIFY_TOKEN not set | Set secrets and redeploy |
| `TEST123` | ✅ Success! | Configure in Facebook |

## Quick Fix Commands

If you're using the `whatsapp-webhook` function name:

```bash
# Navigate to project
cd /home/user/Fintrex

# Link to correct project
supabase link --project-ref tedkkwqlcoilopcrxkdl

# Set secrets
supabase secrets set WHATSAPP_TOKEN=your_whatsapp_access_token
supabase secrets set WHATSAPP_VERIFY_TOKEN=fintrex_secure_2025
supabase secrets set APP_URL=https://your-app.com

# Deploy function
supabase functions deploy whatsapp-webhook

# Test it
curl "https://tedkkwqlcoilopcrxkdl.supabase.co/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=fintrex_secure_2025&hub.challenge=TEST123"
```

## Need Help?

Please confirm:
1. **Which function name are you using?** (`clever-api` or `whatsapp-webhook`)
2. **Have you deployed the function to project `tedkkwqlcoilopcrxkdl`?**
3. **Have you set the WHATSAPP_VERIFY_TOKEN secret?**
4. **What error message do you see in Facebook when trying to verify?**

With this information, I can provide exact commands to fix your setup!

---

**Last Updated:** 2025-01-16
