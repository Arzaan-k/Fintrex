# WhatsApp Integration - Complete Deployment Guide

## ⚠️ Current Issue: Missing Edge Functions

Your WhatsApp webhook is deployed but failing because it depends on other edge functions that aren't deployed yet.

**Error:** `OCR processing failed: {"code":"NOT_FOUND","message":"Requested function was not found"}`

---

## 📋 Required Components

The WhatsApp integration requires **3 edge functions** to work:

```
1. whatsapp-webhook  ✅ DEPLOYED
2. ocr-secure        ❌ NOT DEPLOYED (causing error)
3. extract-invoice   ❌ NOT DEPLOYED (needed after OCR)
```

### **How They Work Together:**

```
User sends invoice via WhatsApp
    ↓
whatsapp-webhook receives it
    ↓
Calls ocr-secure to extract text
    ↓
Calls extract-invoice to parse data
    ↓
Sends results back to user
```

---

## 🚀 Quick Deployment (3 Steps)

### **Step 1: Deploy OCR Function**

```bash
supabase functions deploy ocr-secure --no-verify-jwt
```

**Required API Keys** (choose at least one):
```bash
# Option A: Google Gemini (Recommended - Good accuracy, free tier)
supabase secrets set GEMINI_API_KEY=your_gemini_key

# Option B: OCR.Space (Fastest, free)
supabase secrets set OCRSPACE_API_KEY=your_ocrspace_key

# Option C: DeepSeek (High accuracy)
supabase secrets set DEEPSEEK_API_KEY=your_deepseek_key

# Option D: Google Cloud Vision (Highest accuracy)
supabase secrets set GOOGLE_VISION_API_KEY=your_vision_key
```

**Get API Keys:**
- **Gemini**: https://makersuite.google.com/app/apikey (Free)
- **OCR.Space**: https://ocr.space/ocrapi (Free tier)
- **DeepSeek**: https://platform.deepseek.com/ (Paid)
- **Google Vision**: https://console.cloud.google.com/ (Paid)

---

### **Step 2: Deploy Invoice Extraction Function**

```bash
supabase functions deploy extract-invoice --no-verify-jwt
```

**Required API Key:**
```bash
# Google Gemini for structured data extraction
supabase secrets set GEMINI_API_KEY=your_gemini_key
```

---

### **Step 3: Verify Deployment**

Check all functions are deployed:
```bash
supabase functions list
```

You should see:
```
✅ whatsapp-webhook
✅ ocr-secure
✅ extract-invoice
```

---

## 🔑 Complete Secrets Checklist

Here are ALL the secrets you need to set:

```bash
# WhatsApp Webhook
supabase secrets set WHATSAPP_TOKEN=your_meta_token
supabase secrets set WHATSAPP_VERIFY_TOKEN=your_verify_token
supabase secrets set SUPABASE_URL=https://izqefnwufcaldqpzuhkr.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
supabase secrets set APP_URL=https://app.fintrex.ai

# OCR (at least one provider)
supabase secrets set GEMINI_API_KEY=your_gemini_key

# That's it! Gemini is used by both ocr-secure and extract-invoice
```

**Verify secrets are set:**
```bash
supabase secrets list
```

---

## 🧪 Test the Full Flow

### **Test 1: OCR Function**
```bash
curl -i --location --request POST \
  'https://izqefnwufcaldqpzuhkr.supabase.co/functions/v1/ocr-secure' \
  --header 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "documentId": "test-123",
    "filePath": "test/invoice.pdf"
  }'
```

Should return: `{"success": true, "text": "...", "provider": "gemini"}`

### **Test 2: Invoice Extraction**
```bash
curl -i --location --request POST \
  'https://izqefnwufcaldqpzuhkr.supabase.co/functions/v1/extract-invoice' \
  --header 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "documentId": "test-123",
    "ocrText": "INVOICE #123\nDate: 01/01/2024\nTotal: Rs 1000",
    "ocrProvider": "gemini"
  }'
```

Should return: Extracted invoice data with fields

### **Test 3: WhatsApp Webhook**
Send "Hi" to your WhatsApp Business number → Should get welcome message

### **Test 4: Full Document Upload**
1. Send "Hi" to WhatsApp
2. Click "Upload Invoice"
3. Select "Invoice"
4. Send an invoice image
5. Should get: "⏳ Processing your document..."
6. Then: Extraction results with approve/reject buttons

---

## 🛠️ Alternative: Deploy via Dashboard

If you don't have Supabase CLI:

### **Deploy ocr-secure:**
1. Go to: https://supabase.com/dashboard/project/izqefnwufcaldqpzuhkr/functions
2. Click "Deploy new function"
3. Name: `ocr-secure`
4. Upload: `supabase/functions/ocr-secure/index.ts`
5. Click Deploy

### **Deploy extract-invoice:**
1. Click "Deploy new function"
2. Name: `extract-invoice`
3. Upload: `supabase/functions/extract-invoice/index.ts`
4. Click Deploy

### **Set Secrets:**
1. Go to: Settings → Edge Functions → Secrets
2. Add each secret listed above

---

## 📊 Function Details

### **ocr-secure**
- **Purpose**: Extract text from images/PDFs
- **Providers**: Tesseract, Gemini, DeepSeek, Vision
- **Auto-fallback**: Tries providers until confidence threshold met
- **Cost**: Free tier available (Gemini/OCR.Space)

### **extract-invoice**
- **Purpose**: Parse OCR text into structured invoice data
- **Uses**: Google Gemini for AI extraction
- **Extracts**: Invoice #, date, vendor, amounts, line items, GST
- **Validation**: Accounting rules, GST calculations

### **whatsapp-webhook**
- **Purpose**: Handle WhatsApp messages and document uploads
- **Features**: Interactive buttons, session management, flow control
- **Dependencies**: Requires ocr-secure and extract-invoice

---

## 🎯 Recommended Deployment Order

1. ✅ Deploy **ocr-secure** first (with Gemini API key)
2. ✅ Deploy **extract-invoice** second (uses same Gemini key)
3. ✅ **whatsapp-webhook** already deployed
4. ✅ Test the full flow

---

## 🔥 Quick Commands (Copy-Paste)

**Deploy all functions:**
```bash
# Login and link
supabase login
supabase link --project-ref izqefnwufcaldqpzuhkr

# Deploy OCR
supabase functions deploy ocr-secure --no-verify-jwt

# Deploy Invoice Extraction
supabase functions deploy extract-invoice --no-verify-jwt

# Verify
supabase functions list
```

**Set minimum required secrets:**
```bash
# WhatsApp
supabase secrets set WHATSAPP_TOKEN=your_meta_token
supabase secrets set WHATSAPP_VERIFY_TOKEN=your_verify_token
supabase secrets set SUPABASE_URL=https://izqefnwufcaldqpzuhkr.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OCR & Extraction (one key for both)
supabase secrets set GEMINI_API_KEY=your_gemini_key

# Verify
supabase secrets list
```

---

## 🚨 Troubleshooting

### **"Function not found"**
→ Deploy the missing function: `supabase functions deploy <function-name>`

### **"API key missing"**
→ Set the secret: `supabase secrets set GEMINI_API_KEY=...`

### **"OCR failed"**
→ Check function logs: `supabase functions logs ocr-secure`

### **"Extraction failed"**
→ Check function logs: `supabase functions logs extract-invoice`

### **"WhatsApp not responding"**
→ Check webhook logs: `supabase functions logs whatsapp-webhook`

---

## ✅ Success Checklist

After deployment, verify:

- [ ] All 3 functions deployed (`supabase functions list`)
- [ ] All secrets set (`supabase secrets list`)
- [ ] Database migration run (document_type column exists)
- [ ] WhatsApp webhook verification successful
- [ ] Can send "Hi" and get welcome message
- [ ] Can upload invoice and get extraction results

---

## 📚 More Information

- **OCR Details**: See `supabase/functions/ocr-secure/README.md`
- **WhatsApp Flow**: See `QUICK_DEPLOY.md`
- **Database Schema**: See `supabase/migrations/20251122_add_document_fields_for_whatsapp.sql`

---

## 💡 Cost Optimization

**Free Tier Setup** (Recommended for testing):
- Use **Google Gemini** for OCR and extraction
- Free tier: 15 requests/minute, 1500 requests/day
- Perfect for small-medium businesses

**Upgrade Path**:
- High volume → Add DeepSeek API key
- High accuracy needs → Add Google Vision API key
- The system automatically uses the best available provider

---

## 🎉 You're Almost There!

Just deploy the 2 missing functions and you're done!

```bash
supabase functions deploy ocr-secure --no-verify-jwt
supabase functions deploy extract-invoice --no-verify-jwt
supabase secrets set GEMINI_API_KEY=your_key
```

Then test by sending an invoice to your WhatsApp! 🚀
