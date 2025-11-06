// Live test for Tesseract OCR implementation
// This file can be imported and used to test OCR functionality

import { processDocumentWithTesseract } from './ocr-tesseract';

/**
 * Test Tesseract OCR with a real file
 * @param file File to process
 * @returns Promise with test results
 */
export async function testTesseractLive(file: File): Promise<{
  success: boolean;
  results?: any;
  error?: string;
  processingTime?: number;
}> {
  const startTime = Date.now();

  try {
    console.log('🧪 STARTING LIVE TESSERACT TEST...');
    console.log(`📁 Testing file: ${file.name} (${file.type}, ${(file.size/1024).toFixed(1)}KB)`);

    const result = await processDocumentWithTesseract(file, file.name);

    const processingTime = Date.now() - startTime;

    console.log('✅ LIVE TEST RESULTS:');
    console.log(`   Document Type: ${result.documentType}`);
    console.log(`   OCR Confidence: ${(result.ocrResult.confidence * 100).toFixed(1)}%`);
    console.log(`   Text Length: ${result.ocrResult.text.length} characters`);
    console.log(`   Processing Time: ${processingTime}ms`);

    // Show first 200 characters of OCR text
    console.log(`   OCR Text Preview: "${result.ocrResult.text.substring(0, 200)}..."`);

    // Show extracted data
    console.log('   Extracted Data Keys:', Object.keys(result.extractedData));

    return {
      success: true,
      results: result,
      processingTime
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('❌ LIVE TEST FAILED:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime
    };
  }
}

/**
 * Create a simple test image for OCR testing
 * @returns Promise with test file
 */
export async function createTestImage(): Promise<File> {
  // Create a simple canvas with text
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas context not available');
  }

  canvas.width = 400;
  canvas.height = 200;

  // White background
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Black text
  ctx.fillStyle = 'black';
  ctx.font = '20px Arial';
  ctx.fillText('TEST INVOICE', 20, 40);
  ctx.fillText('Invoice No: INV-TEST-001', 20, 70);
  ctx.fillText('Date: 2024-01-15', 20, 100);
  ctx.fillText('Amount: ₹5,000', 20, 130);

  // Convert to blob
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'test-invoice.png', { type: 'image/png' });
        resolve(file);
      } else {
        throw new Error('Failed to create test image');
      }
    }, 'image/png');
  });
}





