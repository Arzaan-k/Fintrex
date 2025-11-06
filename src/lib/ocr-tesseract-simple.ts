// SIMPLIFIED TESSERACT OCR - For troubleshooting
// This is a minimal implementation to test basic OCR functionality

import { createWorker, Worker } from 'tesseract.js';

export interface SimpleOCRResult {
  text: string;
  confidence: number;
  success: boolean;
  error?: string;
}

/**
 * Simple Tesseract OCR test
 */
export async function testTesseractBasic(): Promise<SimpleOCRResult> {
  console.log('🧪 Testing basic Tesseract OCR...');

  let worker: Worker | null = null;

  try {
    // Create worker
    worker = await createWorker();

    // Load language
    await worker.loadLanguage('eng');
    await worker.initialize('eng');

    console.log('✅ Tesseract worker initialized');

    // Test with simple text
    const result = await worker.recognize('HELLO WORLD TEST');
    const text = result.data.text.trim();
    const confidence = result.data.confidence || 0;

    console.log('📝 OCR Result:', { text, confidence });

    return {
      text,
      confidence,
      success: true
    };

  } catch (error) {
    console.error('❌ Tesseract basic test failed:', error);
    return {
      text: '',
      confidence: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch (e) {
        console.warn('Failed to terminate worker:', e);
      }
    }
  }
}

/**
 * Test OCR with a simple canvas-generated image
 */
export async function testTesseractWithImage(): Promise<SimpleOCRResult> {
  console.log('🖼️ Testing Tesseract with generated image...');

  let worker: Worker | null = null;

  try {
    // Create a simple test image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvas context not available');
    }

    canvas.width = 300;
    canvas.height = 100;

    // White background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Black text
    ctx.fillStyle = 'black';
    ctx.font = 'bold 24px Arial';
    ctx.fillText('OCR TEST 123', 20, 50);
    ctx.fillText('HELLO WORLD', 20, 80);

    // Convert canvas to blob
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create blob'));
      }, 'image/png');
    });

    // Create file
    const file = new File([blob], 'test-ocr.png', { type: 'image/png' });
    console.log('📁 Test image created:', file.size, 'bytes');

    // Initialize Tesseract
    worker = await createWorker();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');

    console.log('🔍 Processing image...');

    // Process image
    const result = await worker.recognize(file);
    const text = result.data.text.trim();
    const confidence = result.data.confidence || 0;

    console.log('✅ Image OCR Result:', { text, confidence });

    return {
      text,
      confidence,
      success: true
    };

  } catch (error) {
    console.error('❌ Image OCR test failed:', error);
    return {
      text: '',
      confidence: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch (e) {
        console.warn('Failed to terminate worker:', e);
      }
    }
  }
}

/**
 * Check if Tesseract.js is working
 */
export function isTesseractAvailable(): boolean {
  try {
    // Check if the library is loaded
    return typeof createWorker === 'function';
  } catch (error) {
    console.error('Tesseract.js not available:', error);
    return false;
  }
}




