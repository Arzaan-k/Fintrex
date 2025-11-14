# Security Migration Guide: Moving API Keys to Edge Functions

## 🚨 Critical Security Fix

This guide covers the migration from **insecure frontend API key exposure** to **secure server-side API key management** using Supabase Edge Functions.

## What Was Wrong

### Before (INSECURE ❌)

```typescript
// ❌ API keys exposed in frontend code
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const DEEPSEEK_API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY;

// ❌ API calls directly from browser
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1/...?key=${GEMINI_API_KEY}`,
  { ... }
);
```

**Problems:**
1. ⚠️ API keys visible in browser DevTools
2. ⚠️ Keys included in built JavaScript bundles
3. ⚠️ Anyone can steal keys and use your quota
4. ⚠️ No rate limiting or usage control
5. ⚠️ Potential for thousands of dollars in unauthorized API usage

### After (SECURE ✅)

```typescript
// ✅ No API keys in frontend
const { data } = await supabase.functions.invoke('ocr-secure', {
  body: { fileUrl, fileName, provider: 'auto' }
});

// ✅ API keys safely stored server-side as Supabase secrets
```

**Benefits:**
1. ✅ API keys never exposed to clients
2. ✅ Secrets stored encrypted in Supabase
3. ✅ Rate limiting possible at function level
4. ✅ Audit trail of all API usage
5. ✅ Cost control and monitoring

---

## Migration Steps

### Step 1: Deploy Secure Edge Function

```bash
# Navigate to your project
cd Fintrex

# Deploy the OCR secure function
supabase functions deploy ocr-secure
```

Expected output:
```
Deploying function ocr-secure...
Function ocr-secure deployed successfully!
```

### Step 2: Set Supabase Secrets

```bash
# Set secrets for each OCR provider you want to use
# (You only need the providers you actually use)

# Google Gemini (recommended - free tier available)
supabase secrets set GEMINI_API_KEY=your_actual_gemini_key_here

# DeepSeek Vision (optional - high accuracy)
supabase secrets set DEEPSEEK_API_KEY=your_actual_deepseek_key_here

# Google Cloud Vision (optional - highest accuracy)
supabase secrets set GOOGLE_VISION_API_KEY=your_actual_vision_key_here

# OCR.Space/Tesseract (optional - free tier)
supabase secrets set OCRSPACE_API_KEY=your_actual_ocrspace_key_here
```

### Step 3: Verify Secrets Are Set

```bash
supabase secrets list
```

Expected output:
```
GEMINI_API_KEY
DEEPSEEK_API_KEY
GOOGLE_VISION_API_KEY
OCRSPACE_API_KEY
```

**Important:** The values are never shown (they're encrypted)

### Step 4: Remove Frontend API Keys

#### A. Remove from .env file

```bash
# Edit your .env file and REMOVE these lines:
# VITE_GEMINI_API_KEY=...
# VITE_GOOGLE_AI_API_KEY=...
# VITE_DEEPSEEK_API_KEY=...
# VITE_GOOGLE_VISION_API_KEY=...
# VITE_BACKEND_URL=...
```

#### B. Clear from environment

```bash
# Clear any cached environment variables
rm -rf node_modules/.vite
npm run build # This will fail if any VITE_ keys are missing, which is good!
```

### Step 5: Update Frontend Code

The code has already been updated to use the secure implementation:

**Files Modified:**
- ✅ `src/pages/Documents.tsx` - Now imports from `backend-secure`
- ✅ `src/lib/backend-secure.ts` - New secure implementation
- ✅ `src/lib/ocr-secure-client.ts` - Secure OCR client wrapper

**Files Created:**
- ✅ `supabase/functions/ocr-secure/index.ts` - Edge Function
- ✅ `supabase/functions/ocr-secure/README.md` - Documentation

**Files Deprecated (DO NOT USE):**
- ❌ `src/lib/ocr-enhanced.ts` - Exposes GEMINI_API_KEY
- ❌ `src/lib/ocr-deepseek.ts` - Exposes DEEPSEEK_API_KEY
- ❌ `src/lib/ocr-vision.ts` - Exposes GOOGLE_VISION_API_KEY
- ❌ `src/lib/backend.ts` - Uses insecure implementations

### Step 6: Test the Migration

#### A. Test Edge Function Directly

```bash
# Get your Supabase anon key from dashboard
export SUPABASE_ANON_KEY=your_anon_key

# Test the function
curl -i --location --request POST 'https://your-project.supabase.co/functions/v1/ocr-secure' \
  --header "Authorization: Bearer $SUPABASE_ANON_KEY" \
  --header 'Content-Type: application/json' \
  --data '{
    "fileUrl": "https://example.com/sample-invoice.pdf",
    "fileName": "invoice.pdf",
    "provider": "auto"
  }'
```

Expected response:
```json
{
  "success": true,
  "text": "Extracted text...",
  "confidence": 0.95,
  "provider": "gemini",
  "processingTime": 2341
}
```

#### B. Test from Frontend

1. Start the dev server:
```bash
npm run dev
```

2. Navigate to Documents page
3. Upload a test document
4. Click "Process Document"
5. Check browser DevTools Network tab - you should see:
   - ✅ Call to `ocr-secure` Edge Function
   - ❌ NO calls to external APIs (Gemini, DeepSeek, etc.)

#### C. Verify No API Keys Exposed

1. Open browser DevTools → Sources
2. Search for "GEMINI_API_KEY" in all files
3. Search for "DEEPSEEK_API_KEY" in all files
4. **Result:** Should find ZERO matches ✅

### Step 7: Rotate Compromised Keys

If your API keys were already exposed (which they were), you should rotate them:

#### Google Gemini

1. Visit: https://makersuite.google.com/app/apikey
2. Delete the old API key
3. Create a new API key
4. Update Supabase secret:
```bash
supabase secrets set GEMINI_API_KEY=your_new_key_here
```

#### DeepSeek

1. Visit: https://platform.deepseek.com/
2. Revoke old API key
3. Generate new API key
4. Update Supabase secret:
```bash
supabase secrets set DEEPSEEK_API_KEY=your_new_key_here
```

#### Google Cloud Vision

1. Visit: https://console.cloud.google.com/apis/credentials
2. Delete old API key
3. Create new API key
4. Update Supabase secret:
```bash
supabase secrets set GOOGLE_VISION_API_KEY=your_new_key_here
```

### Step 8: Monitor Usage

#### A. Check Function Logs

```bash
# View real-time logs
supabase functions logs ocr-secure --follow

# View recent logs
supabase functions logs ocr-secure --limit 100
```

#### B. Check API Usage

1. **Gemini:** https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas
2. **DeepSeek:** https://platform.deepseek.com/usage
3. **Vision:** https://console.cloud.google.com/apis/api/vision.googleapis.com/quotas

---

## Verification Checklist

After migration, verify:

- [ ] Edge Function deployed successfully
- [ ] All secrets set in Supabase
- [ ] Secrets verified with `supabase secrets list`
- [ ] No `VITE_*_API_KEY` in .env file
- [ ] No API keys found in browser DevTools
- [ ] Document upload works
- [ ] OCR processing works
- [ ] Function logs show successful calls
- [ ] No external API calls from browser
- [ ] Old API keys rotated
- [ ] Monitoring set up for API usage

---

## Troubleshooting

### Function Returns "API key not configured"

**Problem:** Secret not set properly

**Solution:**
```bash
# Check which secrets are missing
supabase secrets list

# Set the missing secret
supabase secrets set GEMINI_API_KEY=your_key_here

# Redeploy function (may be needed)
supabase functions deploy ocr-secure
```

### Function Timeout

**Problem:** Document too large or provider too slow

**Solution:**
```typescript
// Try a faster provider
const { data } = await supabase.functions.invoke('ocr-secure', {
  body: {
    fileUrl,
    fileName,
    provider: 'tesseract' // Fastest provider
  }
});
```

### CORS Errors

**Problem:** Function not allowing your domain

**Solution:**
1. Check CORS headers in `ocr-secure/index.ts`
2. Make sure you're using the correct Supabase anon key
3. Verify function is deployed: `supabase functions list`

### High API Costs

**Problem:** Too many high-cost provider calls

**Solution:**
```typescript
// Use 'auto' to start with cheapest provider
provider: 'auto' // Tries Tesseract first, only uses paid if needed
```

Or limit which providers are available by not setting their secrets.

---

## Security Best Practices

### ✅ DO

1. **Store secrets in Supabase:**
   ```bash
   supabase secrets set KEY_NAME=value
   ```

2. **Use environment variables for non-secrets:**
   ```bash
   # In .env (safe for frontend)
   VITE_APP_NAME=Fintrex
   VITE_SUPABASE_URL=https://...
   ```

3. **Rotate keys regularly:**
   - Monthly for high-security
   - Quarterly for medium-security

4. **Monitor API usage:**
   - Set up billing alerts
   - Check logs regularly

5. **Use auto provider selection:**
   - Saves money
   - Uses cheapest option first

### ❌ DON'T

1. **Never prefix secrets with VITE_:**
   ```bash
   # ❌ WRONG - exposes key to frontend
   VITE_GEMINI_API_KEY=...

   # ✅ CORRECT - keeps key server-side
   # (set via Supabase secrets)
   ```

2. **Never commit secrets to git:**
   ```bash
   # Make sure .env is in .gitignore
   echo ".env" >> .gitignore
   ```

3. **Never log API keys:**
   ```typescript
   // ❌ WRONG
   console.log('API Key:', GEMINI_API_KEY);

   // ✅ CORRECT
   console.log('API Key configured:', !!GEMINI_API_KEY);
   ```

4. **Never hardcode secrets:**
   ```typescript
   // ❌ WRONG
   const API_KEY = "AIzaSy_hardcoded_key";

   // ✅ CORRECT
   const API_KEY = Deno.env.get("GEMINI_API_KEY");
   ```

---

## Additional Resources

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Supabase Secrets Management](https://supabase.com/docs/guides/functions/secrets)
- [OCR Secure Function README](./supabase/functions/ocr-secure/README.md)

---

## Support

If you encounter issues during migration:

1. Check function logs: `supabase functions logs ocr-secure`
2. Verify secrets: `supabase secrets list`
3. Test function directly with curl
4. Check GitHub issues for similar problems

---

## Summary

**Before:** API keys exposed in frontend (CRITICAL vulnerability)
**After:** API keys secure in Supabase Edge Functions (SECURE)

**Impact:**
- 🔒 Security: Fixed critical vulnerability
- 💰 Cost: Better control over API usage
- 📊 Monitoring: Full audit trail
- 🚀 Performance: Same or better
- 💻 Development: Cleaner separation of concerns

**Next Steps:**
1. Deploy Edge Function ✅
2. Set secrets ✅
3. Remove frontend keys ✅
4. Test thoroughly ✅
5. Rotate old keys ✅
6. Monitor usage ✅
