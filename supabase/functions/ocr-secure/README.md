# OCR Secure Edge Function

This Supabase Edge Function provides secure, server-side OCR processing with support for multiple providers.

## Features

- **Multi-Provider Support**: Tesseract, Google Gemini, DeepSeek Vision, Google Cloud Vision
- **Automatic Fallback**: Tries providers in order until confidence threshold met
- **Server-Side Security**: All API keys stored securely as Supabase secrets
- **Zero Client Exposure**: No API keys ever sent to the frontend

## Providers

### 1. Tesseract (via OCR.Space)
- **Accuracy**: ~70%
- **Speed**: Fast
- **Cost**: Free tier available
- **Best For**: Quick scans, low-importance documents

### 2. Google Gemini Vision
- **Accuracy**: ~92%
- **Speed**: Fast
- **Cost**: Free tier available
- **Best For**: General documents, invoices

### 3. DeepSeek Vision
- **Accuracy**: ~95%
- **Speed**: Medium
- **Cost**: Paid (low cost)
- **Best For**: Complex documents, structured data

### 4. Google Cloud Vision
- **Accuracy**: ~98%
- **Speed**: Fast
- **Cost**: Paid
- **Best For**: High-accuracy requirements, enterprise

## Setup

### 1. Deploy the Function

```bash
supabase functions deploy ocr-secure
```

### 2. Set Secrets

```bash
# Required for each provider you want to use

# Tesseract (OCR.Space)
supabase secrets set OCRSPACE_API_KEY=your_ocrspace_key

# Google Gemini
supabase secrets set GEMINI_API_KEY=your_gemini_key

# DeepSeek
supabase secrets set DEEPSEEK_API_KEY=your_deepseek_key

# Google Cloud Vision
supabase secrets set GOOGLE_VISION_API_KEY=your_vision_key
```

### 3. Get API Keys

#### OCR.Space (Tesseract)
1. Visit: https://ocr.space/ocrapi
2. Sign up for free account
3. Get API key from dashboard

#### Google Gemini
1. Visit: https://makersuite.google.com/app/apikey
2. Create API key
3. Enable Gemini API

#### DeepSeek
1. Visit: https://platform.deepseek.com/
2. Sign up for account
3. Generate API key

#### Google Cloud Vision
1. Visit: https://console.cloud.google.com/
2. Enable Cloud Vision API
3. Create service account or API key

## Usage

### From Frontend

```typescript
import { supabase } from '@/integrations/supabase/client';

// Call the function
const { data, error } = await supabase.functions.invoke('ocr-secure', {
  body: {
    fileUrl: 'https://your-storage.com/document.pdf',
    fileName: 'invoice.pdf',
    provider: 'auto' // or 'tesseract', 'gemini', 'deepseek', 'vision'
  }
});

if (error) {
  console.error('OCR failed:', error);
} else {
  console.log('Extracted text:', data.text);
  console.log('Confidence:', data.confidence);
  console.log('Provider used:', data.provider);
}
```

### Provider Selection

- **'auto'** (default): Tries providers in order until confidence threshold met
  - Order: Tesseract → Gemini → DeepSeek → Vision
  - Stops when confidence meets threshold
  - Most cost-effective

- **'tesseract'**: Use OCR.Space only (fastest, free)
- **'gemini'**: Use Google Gemini only (good balance)
- **'deepseek'**: Use DeepSeek only (high accuracy)
- **'vision'**: Use Google Vision only (highest accuracy)

## API Response

```json
{
  "success": true,
  "text": "Extracted text from document...",
  "confidence": 0.95,
  "provider": "deepseek",
  "processingTime": 2341,
  "metadata": {
    "model": "deepseek-chat",
    "tokens": 1234
  }
}
```

## Error Handling

```json
{
  "success": false,
  "error": "Error message",
  "provider": "none"
}
```

## Security Benefits

✅ **API Keys Never Exposed**: All keys stored server-side as Supabase secrets
✅ **No Client-Side Key Management**: Frontend never sees API keys
✅ **Audit Trail**: All OCR requests logged server-side
✅ **Rate Limiting**: Can be implemented at Edge Function level
✅ **Cost Control**: Monitor and limit API usage server-side

## Cost Optimization

The 'auto' provider selection saves money by:
1. Trying free Tesseract first
2. Only using paid providers if confidence too low
3. Stopping at first provider that meets threshold
4. Using cheapest provider that gives acceptable results

## Monitoring

View function logs:
```bash
supabase functions logs ocr-secure
```

View function metrics:
```bash
supabase functions stats ocr-secure
```

## Testing

Test the function locally:
```bash
supabase functions serve ocr-secure
```

Test with curl:
```bash
curl -i --location --request POST 'http://localhost:54321/functions/v1/ocr-secure' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "fileUrl": "https://example.com/document.pdf",
    "fileName": "invoice.pdf",
    "provider": "auto"
  }'
```

## Migration from Old Implementation

### Before (Insecure)
```typescript
// ❌ API keys exposed in frontend
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const response = await fetch(
  `https://api.google.com/...?key=${GEMINI_API_KEY}`, // KEY EXPOSED!
  { ... }
);
```

### After (Secure)
```typescript
// ✅ API keys safe on server
const { data } = await supabase.functions.invoke('ocr-secure', {
  body: { fileUrl, fileName, provider: 'auto' }
});
```

## Troubleshooting

### Function Not Found
```bash
# Redeploy the function
supabase functions deploy ocr-secure
```

### API Key Not Working
```bash
# Check secrets are set
supabase secrets list

# Re-set the secret
supabase secrets set GEMINI_API_KEY=your_new_key
```

### CORS Errors
The function includes CORS headers. If you still get CORS errors, check your Supabase project settings.

### Low Confidence Results
Try a different provider:
```typescript
// Instead of 'auto', specify a high-accuracy provider
provider: 'vision' // or 'deepseek'
```

## Performance

- **Tesseract**: ~2-3 seconds per page
- **Gemini**: ~3-5 seconds per page
- **DeepSeek**: ~4-6 seconds per page
- **Vision**: ~2-4 seconds per page

Times vary based on document size and complexity.

## Limits

- **Max File Size**: 10MB (Supabase limit)
- **Timeout**: 60 seconds (Edge Function limit)
- **Rate Limit**: Configure via Supabase dashboard

## Support

For issues, check:
1. Function logs: `supabase functions logs ocr-secure`
2. Supabase dashboard: https://supabase.com/dashboard
3. GitHub issues: https://github.com/your-repo/fintrex/issues
