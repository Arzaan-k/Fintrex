// Test file for OCR functionality
// This demonstrates how to use the Tesseract OCR implementation

import { processDocumentWithTesseract } from './ocr-tesseract';

/**
 * Test Tesseract OCR with a sample image file
 * @param file Image file to process
 */
export async function testTesseractOCR(file: File): Promise<void> {
  console.log('🔍 Testing Tesseract OCR...');
  
  try {
    const result = await processDocumentWithTesseract(file, file.name);
    
    console.log('✅ Tesseract OCR Test Results:');
    console.log('- Document Type:', result.documentType);
    console.log('- Confidence:', result.ocrResult.confidence.toFixed(2));
    console.log('- Processing Time:', result.ocrResult.processingTime, 'ms');
    console.log('- Extracted Text Length:', result.ocrResult.text.length, 'characters');
    
    // Log first 200 characters of extracted text
    console.log('- Extracted Text (first 200 chars):', result.ocrResult.text.substring(0, 200) + '...');
    
    // Log extracted data structure
    console.log('- Extracted Data Keys:', Object.keys(result.extractedData));
  } catch (error) {
    console.error('❌ Tesseract OCR Test Failed:', error);
  }
}

/**
 * Compare LLM vs Tesseract OCR results
 * @param file Image file to process
 */
export async function compareOCRMethods(file: File): Promise<void> {
  console.log('🔬 Comparing OCR Methods...');
  
  // Test Tesseract
  const tesseractStart = Date.now();
  const tesseractResult = await processDocumentWithTesseract(file, file.name);
  const tesseractTime = Date.now() - tesseractStart;
  
  console.log('📊 Comparison Results:');
  console.log('- Tesseract Confidence:', tesseractResult.ocrResult.confidence.toFixed(2));
  console.log('- Tesseract Processing Time:', tesseractTime, 'ms');
  console.log('- Tesseract Document Type:', tesseractResult.documentType);
}