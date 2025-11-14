// Supabase Edge Function: ocr-secure
// Secure OCR processing with server-side API keys
// Supports: Tesseract (via OCR.Space), DeepSeek Vision, Google Vision API
// Endpoint: POST /ocr-secure
// Body: { fileUrl: string, fileName: string, provider?: 'auto' | 'tesseract' | 'deepseek' | 'vision' }

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OCRRequest {
  fileUrl: string;
  fileName: string;
  provider?: 'auto' | 'tesseract' | 'deepseek' | 'vision';
}

interface OCRResult {
  text: string;
  confidence: number;
  provider: string;
  processingTime: number;
  metadata?: Record<string, unknown>;
}

/**
 * Process with Google Vision API (highest accuracy, 98%+)
 */
async function processWithGoogleVision(fileUrl: string): Promise<OCRResult> {
  const startTime = Date.now();
  const apiKey = Deno.env.get("GOOGLE_VISION_API_KEY");

  if (!apiKey) {
    throw new Error("Google Vision API key not configured");
  }

  // Fetch image and convert to base64
  const imageResponse = await fetch(fileUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch image: ${imageResponse.status}`);
  }

  const imageBuffer = await imageResponse.arrayBuffer();
  const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));

  // Call Google Vision API
  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          image: { content: base64Image },
          features: [
            { type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }
          ]
        }]
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Vision API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.responses?.[0]?.fullTextAnnotation?.text || '';

  return {
    text: text.trim(),
    confidence: 0.98,
    provider: 'google_vision',
    processingTime: Date.now() - startTime,
    metadata: {
      pages: data.responses?.[0]?.fullTextAnnotation?.pages?.length || 1
    }
  };
}

/**
 * Process with DeepSeek Vision AI (95% accuracy, advanced document understanding)
 */
async function processWithDeepSeek(fileUrl: string): Promise<OCRResult> {
  const startTime = Date.now();
  const apiKey = Deno.env.get("DEEPSEEK_API_KEY");

  if (!apiKey) {
    throw new Error("DeepSeek API key not configured");
  }

  // Fetch image and convert to base64
  const imageResponse = await fetch(fileUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch image: ${imageResponse.status}`);
  }

  const imageBuffer = await imageResponse.arrayBuffer();
  const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));

  // Determine MIME type from URL
  const mimeType = fileUrl.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

  // Call DeepSeek API
  const response = await fetch(
    'https://api.deepseek.com/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract all text from this document image. Preserve structure and formatting. Return only the extracted text, no explanations.'
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`
              }
            }
          ]
        }],
        temperature: 0.1,
        max_tokens: 4096
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';

  return {
    text: text.trim(),
    confidence: 0.95,
    provider: 'deepseek',
    processingTime: Date.now() - startTime,
    metadata: {
      model: 'deepseek-chat',
      tokens: data.usage?.total_tokens
    }
  };
}

/**
 * Process with Gemini Vision (92% accuracy, fast and free tier available)
 */
async function processWithGemini(fileUrl: string): Promise<OCRResult> {
  const startTime = Date.now();
  const apiKey = Deno.env.get("GEMINI_API_KEY");

  if (!apiKey) {
    throw new Error("Gemini API key not configured");
  }

  // Fetch image and convert to base64
  const imageResponse = await fetch(fileUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch image: ${imageResponse.status}`);
  }

  const imageBuffer = await imageResponse.arrayBuffer();
  const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));

  // Determine MIME type
  const mimeType = fileUrl.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

  // Call Gemini API
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: 'Extract all text from this document image. Preserve the structure and formatting as much as possible.' },
            { inline_data: { mime_type: mimeType, data: base64Image } }
          ]
        }]
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  return {
    text: text.trim(),
    confidence: 0.92,
    provider: 'gemini',
    processingTime: Date.now() - startTime,
    metadata: {
      model: 'gemini-1.5-flash'
    }
  };
}

/**
 * Process with OCR.Space (Tesseract-based, 70% accuracy, free tier)
 */
async function processWithTesseract(fileUrl: string): Promise<OCRResult> {
  const startTime = Date.now();
  const apiKey = Deno.env.get("OCRSPACE_API_KEY");

  if (!apiKey) {
    throw new Error("OCR.Space API key not configured");
  }

  const formData = new FormData();
  formData.append("url", fileUrl);
  formData.append("language", "eng");
  formData.append("isTable", "true");
  formData.append("OCREngine", "2");

  const response = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    headers: { apikey: apiKey },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`OCR.Space API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data?.ParsedResults?.[0]?.ParsedText || '';
  const confidence = parseFloat(data?.ParsedResults?.[0]?.TextOrientation) || 0.7;

  return {
    text: text.trim(),
    confidence: Math.min(confidence, 0.85),
    provider: 'tesseract',
    processingTime: Date.now() - startTime
  };
}

/**
 * Auto-select best OCR provider with fallback chain
 */
async function processAuto(fileUrl: string): Promise<OCRResult> {
  const providers = [
    { name: 'tesseract', fn: processWithTesseract, threshold: 0.8 },
    { name: 'gemini', fn: processWithGemini, threshold: 0.85 },
    { name: 'deepseek', fn: processWithDeepSeek, threshold: 0.9 },
    { name: 'vision', fn: processWithGoogleVision, threshold: 0.95 }
  ];

  let lastError: Error | null = null;
  let bestResult: OCRResult | null = null;

  // Try providers in order: fast/free first, then fallback to premium
  for (const provider of providers) {
    try {
      console.log(`Trying ${provider.name}...`);
      const result = await provider.fn(fileUrl);

      if (!bestResult || result.confidence > bestResult.confidence) {
        bestResult = result;
      }

      // If confidence meets threshold, return immediately
      if (result.confidence >= provider.threshold) {
        console.log(`${provider.name} confidence ${result.confidence} meets threshold ${provider.threshold}`);
        return result;
      }
    } catch (error) {
      console.error(`${provider.name} failed:`, error);
      lastError = error as Error;
      // Continue to next provider
    }
  }

  // If we got any result, return the best one
  if (bestResult) {
    return bestResult;
  }

  // All providers failed
  throw lastError || new Error('All OCR providers failed');
}

/**
 * Main handler
 */
serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json() as OCRRequest;

    if (!body.fileUrl) {
      return new Response(
        JSON.stringify({ error: "fileUrl is required" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const provider = body.provider || 'auto';
    let result: OCRResult;

    switch (provider) {
      case 'tesseract':
        result = await processWithTesseract(body.fileUrl);
        break;
      case 'gemini':
        result = await processWithGemini(body.fileUrl);
        break;
      case 'deepseek':
        result = await processWithDeepSeek(body.fileUrl);
        break;
      case 'vision':
        result = await processWithGoogleVision(body.fileUrl);
        break;
      case 'auto':
      default:
        result = await processAuto(body.fileUrl);
        break;
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...result
      }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('OCR processing error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'none'
      }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
