// PDF to Image conversion utility for OCR processing
// Converts PDF pages to images that can be processed by OCR engines

import * as pdfjsLib from 'pdfjs-dist';

// Initialize PDF.js worker with local file for better compatibility
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

/**
 * Convert PDF file to images
 * @param file PDF file to convert
 * @returns Promise with array of image files (one per page)
 */
export async function convertPdfToImages(file: File): Promise<File[]> {
  console.log(`📄 Converting PDF to images: ${file.name}`);

  // PDF.js is imported as ES module, no need to check global availability

  try {
    // Load PDF document with better error handling
    const arrayBuffer = await file.arrayBuffer();
    console.log(`📄 Loading PDF: ${arrayBuffer.byteLength} bytes`);

    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      cMapPacked: true,
      disableFontFace: false,
      isEvalSupported: true,
    }).promise;

    console.log(`📑 PDF loaded: ${pdf.numPages} pages`);

    const imageFiles: File[] = [];

    // Convert each page to image
    for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 5); pageNum++) { // Limit to first 5 pages
      console.log(`🖼️ Converting page ${pageNum} to image...`);

      const page = await pdf.getPage(pageNum);
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Canvas context not available');
      }

      // Set canvas size based on PDF page with higher scale for OCR accuracy
      const viewport = page.getViewport({ scale: 3.0 }); // Increased to 3x scale for better OCR
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Render PDF page to canvas
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await page.render(renderContext).promise;

      // Convert canvas directly to blob (skip enhancement for now)
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to convert canvas to blob'));
          }
        }, 'image/png', 1.0); // Maximum quality
      });

      // Create File from blob
      const imageFile = new File([blob], `${file.name.replace('.pdf', '')}_page_${pageNum}.png`, {
        type: 'image/png',
        lastModified: Date.now()
      });

      imageFiles.push(imageFile);
      console.log(`✅ Page ${pageNum} converted to image (${(blob.size / 1024).toFixed(1)}KB)`);
      console.log(`📄 Created file: ${imageFile.name}, size: ${(imageFile.size / 1024).toFixed(1)}KB, type: ${imageFile.type}`);
    }

    console.log(`🎉 PDF conversion complete: ${imageFiles.length} images created`);
    return imageFiles;

  } catch (error) {
    console.error('❌ PDF conversion failed:', error);
    throw new Error(`PDF conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if PDF processing is available
 */
export function isPdfProcessingAvailable(): boolean {
  return typeof pdfjsLib !== 'undefined' &&
         typeof pdfjsLib.getDocument === 'function';
}

/**
 * Enhance image for better OCR accuracy
 */
async function enhanceImageForOCR(canvas: HTMLCanvasElement): Promise<HTMLCanvasElement> {
  const enhancedCanvas = document.createElement('canvas');
  const ctx = enhancedCanvas.getContext('2d');

  if (!ctx) throw new Error('Could not get canvas context');

  enhancedCanvas.width = canvas.width;
  enhancedCanvas.height = canvas.height;

  // Draw original image
  ctx.drawImage(canvas, 0, 0);

  // Apply OCR enhancements
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Convert to grayscale and enhance contrast for better text recognition
  for (let i = 0; i < data.length; i += 4) {
    // Convert to grayscale using luminance formula
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);

    // Apply contrast enhancement for OCR
    let enhanced = gray;
    if (gray < 128) {
      enhanced = Math.max(0, gray * 0.9); // Slightly darken dark areas
    } else {
      enhanced = Math.min(255, gray * 1.1); // Slightly brighten light areas
    }

    data[i] = data[i + 1] = data[i + 2] = enhanced; // Set RGB to enhanced grayscale
  }

  ctx.putImageData(imageData, 0, 0);
  return enhancedCanvas;
}

/**
 * Initialize PDF.js (call this once when the app starts)
 */
export function initializePdfJs(workerSrc?: string) {
  if (typeof window !== 'undefined' && pdfjsLib) {
    // Set worker source if provided
    if (workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
    }
    console.log('📚 PDF.js initialized');
  }
}





