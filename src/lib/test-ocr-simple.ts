// Simple OCR test to isolate issues
import { createWorker } from 'tesseract.js';

export async function testBasicTesseract(): Promise<string> {
  console.log('🧪 Testing basic Tesseract functionality...');

  let worker: any = null;

  try {
    console.log('🔧 Creating Tesseract worker...');
    worker = await createWorker('eng');
    console.log('✅ Worker created successfully');

    console.log('📝 Recognizing test text...');
    // Use a simple test string instead of a file
    const result = await worker.recognize('Hello World');
    console.log('✅ OCR completed:', result.data.text);

    if (worker) {
      await worker.terminate();
      console.log('🧹 Worker terminated');
    }

    return result.data.text.trim();
  } catch (error) {
    console.error('❌ Basic Tesseract test failed:', error);
    if (worker) {
      try {
        await worker.terminate();
      } catch (e) {
        console.warn('Failed to terminate worker:', e);
      }
    }
    throw error;
  }
}

export async function testFileProcessing(): Promise<boolean> {
  console.log('🧪 Testing file processing...');

  try {
    // Create a simple test image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvas not available');
    }

    canvas.width = 200;
    canvas.height = 50;

    // White background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Black text
    ctx.fillStyle = 'black';
    ctx.font = '16px Arial';
    ctx.fillText('TEST OCR', 10, 30);

    // Convert to blob
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create blob'));
      }, 'image/png');
    });

    const file = new File([blob], 'test.png', { type: 'image/png' });
    console.log('📁 Test file created:', file.name, file.size, 'bytes');

    return true;
  } catch (error) {
    console.error('❌ File processing test failed:', error);
    return false;
  }
}






