// WORKING TESSERACT OCR IMPLEMENTATION
// This fixes all the API issues and makes Tesseract actually work

import { createWorker, PSM } from 'tesseract.js';
import { classifyDocument, extractInvoiceData, extractKYCData } from './ocr';
import { convertPdfToImages, isPdfProcessingAvailable } from './pdf-to-image';

export interface TesseractOCRResult {
  text: string;
  confidence: number;
  processingTime: number;
}

/**
 * Simple but effective Tesseract OCR processing
 * Uses optimized settings for better accuracy
 */
async function simpleOCRProcessing(file: File): Promise<{ text: string; confidence: number }> {
  console.log('🔄 Using Tesseract OCR processing...');
  
  const worker = await createWorker('eng', 1, {
    logger: m => {
      if (m.status === 'recognizing text') {
        console.log(`🔍 OCR Progress: ${(m.progress * 100).toFixed(0)}%`);
      }
    }
  });

  try {
    // Set Tesseract parameters for better accuracy
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO_OSD, // Automatic page segmentation with OSD
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,/-:@()₹$%# ',
    });

    const { data } = await worker.recognize(file);
    await worker.terminate();

    console.log(`✅ Tesseract OCR complete: ${data.text.length} characters, ${data.confidence.toFixed(1)}% confidence`);
    
    return {
      text: data.text,
      confidence: data.confidence / 100 // Convert to 0-1 range
    };
  } catch (error) {
    console.error('❌ Tesseract OCR failed:', error);
    await worker.terminate();
    throw error;
  }
}

/**
 * Convert File to ImageData for Tesseract compatibility
 */
async function fileToImageData(file: File): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    img.onload = () => {
      URL.revokeObjectURL(img.src);
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      try {
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        resolve(imageData);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    // Create object URL from file
    const url = URL.createObjectURL(file);
    img.src = url;
  });
}

/**
 * Working Tesseract OCR implementation
 */
export async function processWithTesseract(file: File): Promise<TesseractOCRResult> {
  const startTime = Date.now();
  console.log(`🚀 TESSERACT: Processing ${file.name} (${file.type})`);
  console.log(`📁 Size: ${(file.size/1024).toFixed(1)}KB`);

  // Handle PDF files by converting to images first
  let filesToProcess: File[] = [file];

    if (file.type === 'application/pdf') {
      console.log('📄 PDF file detected, converting to images...');

      try {
        filesToProcess = await convertPdfToImages(file);
        console.log(`🖼️ PDF converted to ${filesToProcess.length} images`);

        if (filesToProcess.length === 0) {
          throw new Error('PDF conversion produced no images');
        }
      } catch (error) {
        console.error('❌ PDF conversion failed:', error);
        return {
          text: `PDF conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}. Try uploading as image files instead.`,
          confidence: 0,
          processingTime: Date.now() - startTime
        };
      }
    }

  let combinedText = '';
  let totalConfidence = 0;
  let processedPages = 0;

  console.log(`🔄 Starting OCR processing for ${filesToProcess.length} files...`);

  try {
    // Process each file (PDF pages or single image)
    for (const fileToProcess of filesToProcess) {
    console.log(`🔍 Processing ${fileToProcess.name}...`);

    try {
      // Skip Tesseract entirely and use simple OCR processing
      console.log('🔄 Using simple OCR processing (reliable fallback)');

      // Check if file is valid
      if (!fileToProcess || fileToProcess.size === 0) {
        throw new Error('Invalid or empty file');
      }

      console.log(`📄 Processing file: ${fileToProcess.name}, size: ${(fileToProcess.size / 1024).toFixed(1)}KB, type: ${fileToProcess.type}`);

      const simpleResult = await simpleOCRProcessing(fileToProcess);
      const text = simpleResult.text;
      const confidence = simpleResult.confidence;
      console.log(`✅ Simple OCR processing successful: ${text.length} characters, ${(confidence * 100).toFixed(1)}% confidence`);

      // Combine text from multiple pages
      if (combinedText) {
        combinedText += '\n\n--- Page ' + (processedPages + 1) + ' ---\n\n';
      }
      combinedText += text;
      totalConfidence += confidence || 0;
      processedPages++;

      console.log(`✅ Page processed: ${text.length} characters, confidence: ${(confidence * 100).toFixed(1)}%`);

    } catch (pageError) {
      console.error(`❌ Failed to process page:`, pageError);
      // Continue with other pages if possible
      continue;
    }
  }

  if (processedPages === 0) {
    throw new Error('No pages were successfully processed');
  }

    const processingTime = Date.now() - startTime;
    const averageConfidence = totalConfidence / processedPages;

    console.log(`✅ TESSERACT COMPLETE:`);
    console.log(`   Pages processed: ${processedPages}`);
    console.log(`   Total text length: ${combinedText.length} characters`);
    console.log(`   Average confidence: ${(averageConfidence * 100).toFixed(1)}%`);
    console.log(`   Processing time: ${processingTime}ms`);

    if (combinedText.length < 10) {
      console.warn('⚠️ Very short OCR text detected - may indicate processing issues');
    }

    return {
      text: combinedText.trim(),
      confidence: averageConfidence || 0,
      processingTime
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('❌ TESSERACT ERROR:', error);
    throw new Error(`Tesseract processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Process document with working Tesseract
 */
export async function processDocumentWithTesseract(
  file: File,
  filename: string
): Promise<{
  documentType: string;
  ocrResult: TesseractOCRResult;
  extractedData: any;
}> {
  console.log(`📄 TESSERACT DOCUMENT PROCESSING: ${filename}`);
  
  // Process with Tesseract
  const ocrResult = await processWithTesseract(file);
  
  // Classify document based on OCR text
  const documentType = classifyDocument(filename, ocrResult.text);
  console.log(`🏷️ CLASSIFIED AS: ${documentType}`);
  console.log(`📄 EXTRACTED TEXT (first 500 chars):\n${ocrResult.text.substring(0, 500)}`);
  
  // Extract data based on document type
  let extractedData: any;
  
  if (documentType.startsWith('invoice') || documentType === 'receipt') {
    extractedData = extractInvoiceData(ocrResult.text);
    console.log(`🧾 INVOICE EXTRACTED:`, {
      number: extractedData.invoice_number || 'No number',
      amount: extractedData.total_amount || 0,
      vendor: extractedData.vendor_name || 'Unknown',
      date: extractedData.invoice_date || 'No date'
    });
  } else if (documentType.startsWith('kyc')) {
    extractedData = extractKYCData(ocrResult.text, documentType);
    console.log(`🆔 KYC EXTRACTED: ${extractedData.document_type || 'No type'}`);
  } else {
    extractedData = {
      text: ocrResult.text,
      confidence: ocrResult.confidence
    };
    console.log(`📝 TEXT EXTRACTED: ${ocrResult.text.length} chars`);
  }
  
  return {
    documentType,
    ocrResult,
    extractedData
  };
}