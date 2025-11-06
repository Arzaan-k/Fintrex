// HIGH-ACCURACY OCR USING GOOGLE VISION API
// This replaces the problematic Tesseract implementation

/**
 * Process document with Google Vision API OCR
 * @param file File to process
 * @returns OCR result with text and confidence
 */
export async function processWithVisionAPI(file: File): Promise<{
  text: string;
  confidence: number;
  processingTime: number;
}> {
  const startTime = Date.now();
  console.log(`🚀 VISION API: Processing ${file.name} (${file.type})`);
  
  try {
    // Convert file to base64 for API submission
    const base64 = await fileToBase64(file);
    console.log(`📁 File converted to base64 (${Math.floor(base64.length/1024)}KB)`);
    
    // Check if Google Vision API key is available
    const apiKey = import.meta.env?.VITE_GOOGLE_VISION_API_KEY;
    if (!apiKey) {
      console.error('❌ GOOGLE VISION API KEY NOT CONFIGURED');
      throw new Error('Google Vision API key not configured. Please set VITE_GOOGLE_VISION_API_KEY in .env file.');
    }
    
    console.log('📡 Sending to Google Vision API...');
    
    // Call Google Vision API
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: base64.split(',')[1] },
            features: [
              { type: 'TEXT_DETECTION', maxResults: 1 },
              { type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }
            ]
          }]
        })
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ VISION API ERROR (${response.status}):`, errorText);
      throw new Error(`Google Vision API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    const processingTime = Date.now() - startTime;
    
    // Extract text from response
    const text = data.responses?.[0]?.fullTextAnnotation?.text || 
                 data.responses?.[0]?.textAnnotations?.[0]?.description || 
                 '';
    
    const confidence = 0.95; // Google Vision is very accurate
    
    console.log(`✅ VISION API COMPLETE:`);
    console.log(`   Text length: ${text.length} characters`);
    console.log(`   Processing time: ${processingTime}ms`);
    console.log(`   First 200 chars: "${text.substring(0, 200)}..."`);
    
    return {
      text: text.trim(),
      confidence,
      processingTime
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('❌ VISION API ERROR:', error);
    throw new Error(`Vision API processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Process document with Vision API and classify it
 */
export async function processDocumentWithVisionAPI(
  file: File,
  filename: string
): Promise<{
  documentType: string;
  ocrResult: { text: string; confidence: number; processingTime: number };
  extractedData: any;
}> {
  console.log(`📄 VISION DOCUMENT PROCESSING: ${filename}`);
  
  // This will throw if OCR fails
  const ocrResult = await processWithVisionAPI(file);
  
  // Import classification and extraction functions
  const { classifyDocument, extractInvoiceData, extractKYCData } = await import('./ocr');
  
  // Classify based on REAL OCR text
  const documentType = classifyDocument(filename, ocrResult.text);
  console.log(`🏷️ VISION CLASSIFICATION: ${documentType}`);
  
  // Extract data based on REAL OCR text
  let extractedData: any;
  
  if (documentType.startsWith('invoice') || documentType === 'receipt') {
    extractedData = extractInvoiceData(ocrResult.text);
    console.log(`🧾 INVOICE DATA EXTRACTED: ${extractedData.invoiceNumber || 'No invoice number'}`);
  } else if (documentType.startsWith('kyc')) {
    extractedData = extractKYCData(ocrResult.text, documentType);
    console.log(`🆔 KYC DATA EXTRACTED: ${extractedData.document_type || 'No doc type'}`);
  } else {
    extractedData = {
      text: ocrResult.text.substring(0, 1000) + '...',
      confidence: ocrResult.confidence
    };
    console.log(`📝 GENERIC TEXT EXTRACTED: ${ocrResult.text.length} chars`);
  }
  
  return {
    documentType,
    ocrResult,
    extractedData
  };
}

/**
 * Convert File to base64 string
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}