# Deploy WhatsApp Webhook Function

## ⚠️ CRITICAL: Your webhook function is NOT deployed yet!

Your Supabase project: `https://tedkkwqlcoilopcrxkdl.supabase.co`

The `whatsapp-webhook` function needs to be deployed before Meta can verify it.

---

## Option 1: Deploy via Supabase CLI (Recommended)

### Step 1: Install Supabase CLI

```bash
npm install -g supabase
```

### Step 2: Login to Supabase

```bash
supabase login
```

This will open a browser for authentication.

### Step 3: Link to Your Project

```bash
cd /home/user/Fintrex
supabase link --project-ref tedkkwqlcoilopcrxkdl
```

### Step 4: Deploy the Function

```bash
supabase functions deploy whatsapp-webhook
```

Expected output:
```
Deploying function whatsapp-webhook...
✓ Function deployed successfully
```

### Step 5: Set Environment Variables

```bash
# Set your verify token (use any secure string)
supabase secrets set WHATSAPP_VERIFY_TOKEN=fintrex_secure_2025

# Set your WhatsApp access token
supabase secrets set WHATSAPP_TOKEN=your_whatsapp_business_token

# These should already be set, but verify:
supabase secrets set SUPABASE_URL=https://tedkkwqlcoilopcrxkdl.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Step 6: Test the Deployment

```bash
curl "https://tedkkwqlcoilopcrxkdl.supabase.co/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=fintrex_secure_2025&hub.challenge=test123"
```

Expected response: `test123`

---

## Option 2: Deploy via Supabase Dashboard

If you don't have CLI access:

### Step 1: Go to Supabase Dashboard

1. Open: https://supabase.com/dashboard/project/tedkkwqlcoilopcrxkdl
2. Navigate to **Edge Functions** (in left sidebar)

### Step 2: Create New Function

1. Click **New Function** or **+ New function**
2. Function name: `whatsapp-webhook`
3. Template: Choose "HTTP Request" or "Blank"

### Step 3: Copy Function Code

1. Open `/home/user/Fintrex/supabase/functions/whatsapp-webhook/index.ts`
2. Copy ALL the code (entire file)
3. Paste it into the Supabase editor
4. Click **Deploy**

### Step 4: Set Secrets

1. In Supabase Dashboard, go to **Settings** → **Edge Functions** → **Secrets**
2. Add these secrets:

| Name | Value |
|------|-------|
| `WHATSAPP_VERIFY_TOKEN` | `fintrex_secure_2025` (or your chosen token) |
| `WHATSAPP_TOKEN` | Your WhatsApp Business API token |
| `SUPABASE_URL` | `https://tedkkwqlcoilopcrxkdl.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service role key |

3. Click **Save** for each secret

### Step 5: Test the Deployment

Open in browser or use curl:
```
https://tedkkwqlcoilopcrxkdl.supabase.co/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=fintrex_secure_2025&hub.challenge=test123
```

Should return: `test123`

---

## After Deployment: Configure Meta Webhook

Once the function is deployed and tested:

### Step 1: Go to Meta Developers

1. Open: https://developers.facebook.com/apps/
2. Select your WhatsApp app
3. Go to **WhatsApp** → **Configuration**

### Step 2: Configure Webhook

1. Click **Edit** next to "Webhook"
2. Enter these details:

**Callback URL:**
```
https://tedkkwqlcoilopcrxkdl.supabase.co/functions/v1/whatsapp-webhook
```

**Verify Token:** (MUST match exactly)
```
fintrex_secure_2025
```

3. Click **Verify and Save**

### Step 3: Subscribe to Events

After verification succeeds, subscribe to:
- ✅ **messages**
- ✅ **messaging_postbacks**

---

## Troubleshooting

### "Function not found" (404)
- **Cause:** Function not deployed
- **Fix:** Deploy using Option 1 or Option 2 above

### "VERIFY_TOKEN not configured" (500)
- **Cause:** Secret not set
- **Fix:** Set `WHATSAPP_VERIFY_TOKEN` secret

### "Token mismatch" (403)
- **Cause:** Token in Meta ≠ Token in Supabase
- **Fix:** Make sure both use exact same value

### "Missing parameters" (400)
- **Cause:** Wrong URL format
- **Fix:** Use full URL with all query params

---

## Quick Test Commands

### Test 1: Check if function exists
```bash
curl -I https://tedkkwqlcoilopcrxkdl.supabase.co/functions/v1/whatsapp-webhook
```
- **200 or 400:** Function exists ✅
- **404:** Function not deployed ❌

### Test 2: Test verification (after deployment)
```bash
curl "https://tedkkwqlcoilopcrxkdl.supabase.co/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123"
```
- **Should return:** `test123` ✅
- **403:** Wrong token ❌
- **500:** Token not set ❌

### Test 3: Check function logs
```bash
supabase functions logs whatsapp-webhook --project-ref tedkkwqlcoilopcrxkdl --follow
```

---

## Your Specific Configuration

**Project URL:** `https://tedkkwqlcoilopcrxkdl.supabase.co`

**Webhook URL:** `https://tedkkwqlcoilopcrxkdl.supabase.co/functions/v1/whatsapp-webhook`

**Verify Token:** `fintrex_secure_2025` (or your custom choice)

**Required Secrets:**
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## Next Steps Checklist

- [ ] Deploy function (Option 1 or 2)
- [ ] Set all required secrets
- [ ] Test with curl (should return challenge)
- [ ] Configure webhook in Meta
- [ ] Verify in Meta (should show green checkmark)
- [ ] Subscribe to webhook events
- [ ] Test with real WhatsApp message

---

**START WITH DEPLOYMENT!** The function must exist before Meta can verify it.
