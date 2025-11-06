import { createWorker, PSM, OEM } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

// Initialize PDF.js worker with local file for better compatibility
if (typeof window !== 'undefined') {
  // Use local worker file served by Vite dev server
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

export interface OCRResult {
  text: string;
  confidence: number;
  pages: number;
  processingTime: number;
  language: string;
}

/**
 * Enhanced OCR service with support for images and PDFs
 */
export class OCRService {
  private worker: Tesseract.Worker | null = null;
  private static instance: OCRService;

  private constructor() {}

  public static getInstance(): OCRService {
    if (!OCRService.instance) {
      OCRService.instance = new OCRService();
    }
    return OCRService.instance;
  }

  /**
   * Initialize the Tesseract worker with optimized settings for maximum accuracy
   */
  private async getWorker(): Promise<Tesseract.Worker> {
    if (!this.worker) {
      this.worker = await createWorker({
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        },
        errorHandler: (err: any) => console.error('Tesseract error:', err),
      } as any);

      // Load English language with best trained data
      await (this.worker as any).loadLanguage('eng');
      await (this.worker as any).initialize('eng', OEM.LSTM_ONLY);

      // Set optimized parameters for maximum document OCR accuracy
      await this.worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO_OSD, // Auto orientation and script detection
        tessedit_ocr_engine_mode: OEM.LSTM_ONLY, // Use only LSTM engine for better accuracy
        tessedit_char_whitelist: '', // Allow all characters for better recognition
        preserve_interword_spaces: '1',
        tessedit_do_invert: '0', // Don't invert colors
        textord_heavy_nr: '1', // Heavy noise removal
        textord_min_linesize: '2.5', // Minimum line size for better text detection
        classify_enable_learning: '0', // Disable learning for consistency
        classify_enable_adaptive_matcher: '1', // Enable adaptive matcher
        tessedit_write_images: '0', // Don't write debug images
        // Advanced accuracy parameters
        edges_max_children_per_outline: '10',
        edges_max_children_layers: '5',
        edges_children_per_grandchild: '10',
        edges_children_count_limit: '45',
        edges_min_nonhole: '12',
        edges_patharea_ratio: '40',
        edges_boxarea_ratio: '40',
        // Improve character recognition
        language_model_penalty_non_dict_word: '0.15',
        language_model_penalty_non_freq_dict_word: '0.1',
        // Additional accuracy improvements
        tessedit_create_hocr: '0',
        tessedit_create_pdf: '0',
        textord_tabfind_show_vlines: '0',
        textord_use_cjk_fp_model: '0',
        language_model_ngram_on: '1',
        language_model_ngram_use_only_first_uft8_step: '0',
        language_model_min_compound_length: '3',
      });
    }
    return this.worker;
  }

  /**
   * Post-process extracted text to improve accuracy and formatting
   */
  private postProcessText(text: string): string {
    if (!text) return '';

    return text
      // Remove excessive whitespace
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      // Fix common OCR errors in numbers
      .replace(/(\d)O(\d)/g, '$10$2') // Fix 'O' in numbers
      .replace(/(\d)o(\d)/g, '$10$2') // Fix 'o' in numbers
      .replace(/(\d)l(\d)/g, '$11$2') // Fix 'l' as '1' in numbers
      .replace(/(\d)I(\d)/g, '$11$2') // Fix 'I' as '1' in numbers
      .replace(/(\d)S(\d)/g, '$15$2') // Fix 'S' as '5' in numbers
      .replace(/(\d)Z(\d)/g, '$12$2') // Fix 'Z' as '2' in numbers
      .replace(/O(\d)/g, '0$1') // Fix 'O' at start of numbers
      .replace(/(\d)O/g, '$10') // Fix 'O' at end of numbers
      // Fix common character confusions
      .replace(/\bl([A-Z])/g, 'I$1') // Fix 'l' as 'I' before uppercase
      .replace(/([a-z])l([A-Z])/g, '$1I$2') // Fix 'l' as 'I' between cases
      // Fix currency symbols
      .replace(/Rs\.?\s*/gi, '₹')
      .replace(/INR\s*/gi, '₹')
      // Remove trailing/leading whitespace from lines
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n')
      .trim();
  }

  /**
   * Clean up resources
   */
  public async cleanup() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }

  /**
   * Preprocess image for better OCR accuracy with advanced enhancement
   */
  private async preprocessImage(imageFile: File): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      img.onload = () => {
        // Calculate optimal dimensions for OCR (higher resolution for better accuracy)
        const maxWidth = 3500;
        const maxHeight = 4500;
        let { width, height } = img;

        // Scale up if image is too small for better OCR
        if (width < 1000) {
          const scale = Math.min(maxWidth / width, maxHeight / height, 3.5);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        // Scale down if image is too large
        if (width > maxWidth || height > maxHeight) {
          const scale = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        canvas.width = width;
        canvas.height = height;

        // Apply image enhancements for better OCR
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw and enhance the image
        ctx.drawImage(img, 0, 0, width, height);

        // Apply advanced contrast and brightness enhancement
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Calculate histogram for better contrast adjustment
        const histogram = new Array(256).fill(0);
        for (let i = 0; i < data.length; i += 4) {
          const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
          histogram[gray]++;
        }

        // Find optimal min/max using percentile method (ignore extreme 1%)
        const totalPixels = width * height;
        const lowPercentile = Math.floor(totalPixels * 0.01);
        const highPercentile = Math.floor(totalPixels * 0.99);
        
        let cumSum = 0;
        let min = 0;
        for (let i = 0; i < 256; i++) {
          cumSum += histogram[i];
          if (cumSum > lowPercentile) {
            min = i;
            break;
          }
        }

        cumSum = 0;
        let max = 255;
        for (let i = 255; i >= 0; i--) {
          cumSum += histogram[i];
          if (cumSum > (totalPixels - highPercentile)) {
            max = i;
            break;
          }
        }

        const range = max - min;
        if (range > 20) { // Only apply if there's meaningful contrast
          for (let i = 0; i < data.length; i += 4) {
            // Enhanced contrast with gamma correction
            const r = Math.max(0, Math.min(255, ((data[i] - min) / range) * 255));
            const g = Math.max(0, Math.min(255, ((data[i + 1] - min) / range) * 255));
            const b = Math.max(0, Math.min(255, ((data[i + 2] - min) / range) * 255));
            
            // Apply slight sharpening
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
          }
        }

        // Apply slight denoising
        const denoisedData = this.applyMedianFilter(data, width, height);
        for (let i = 0; i < data.length; i++) {
          data[i] = denoisedData[i];
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas);
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(imageFile);
    });
  }

  /**
   * Apply median filter for noise reduction
   */
  private applyMedianFilter(data: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
    const output = new Uint8ClampedArray(data.length);
    const windowSize = 1; // 3x3 window

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        
        // Skip edge pixels
        if (x < windowSize || x >= width - windowSize || y < windowSize || y >= height - windowSize) {
          output[idx] = data[idx];
          output[idx + 1] = data[idx + 1];
          output[idx + 2] = data[idx + 2];
          output[idx + 3] = data[idx + 3];
          continue;
        }

        // Collect neighborhood values
        const rValues: number[] = [];
        const gValues: number[] = [];
        const bValues: number[] = [];

        for (let dy = -windowSize; dy <= windowSize; dy++) {
          for (let dx = -windowSize; dx <= windowSize; dx++) {
            const nIdx = ((y + dy) * width + (x + dx)) * 4;
            rValues.push(data[nIdx]);
            gValues.push(data[nIdx + 1]);
            bValues.push(data[nIdx + 2]);
          }
        }

        // Sort and get median
        rValues.sort((a, b) => a - b);
        gValues.sort((a, b) => a - b);
        bValues.sort((a, b) => a - b);
        const mid = Math.floor(rValues.length / 2);

        output[idx] = rValues[mid];
        output[idx + 1] = gValues[mid];
        output[idx + 2] = bValues[mid];
        output[idx + 3] = data[idx + 3];
      }
    }

    return output;
  }

  /**
   * Process image file with OCR using enhanced preprocessing
   */
  public async processImage(file: File): Promise<OCRResult> {
    const startTime = performance.now();

    try {
      // Preprocess the image for better OCR accuracy
      const processedCanvas = await this.preprocessImage(file);

      // Convert canvas to blob for Tesseract
      const processedBlob = await new Promise<Blob>((resolve, reject) => {
        processedCanvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error('Failed to convert canvas to blob')),
          'image/png',
          1.0 // Maximum quality
        );
      });

      const worker = await this.getWorker();

      // Try OCR with different PSM modes for best results
      let bestResult = { text: '', confidence: 0 };
      const psmModes = [PSM.AUTO_OSD, PSM.SINGLE_BLOCK, PSM.SINGLE_COLUMN];

      for (const psmMode of psmModes) {
        await this.worker!.setParameters({ tessedit_pageseg_mode: psmMode });
        const { data } = await worker.recognize(URL.createObjectURL(processedBlob));

        if (data.confidence > bestResult.confidence) {
          bestResult = {
            text: data.text,
            confidence: data.confidence
          };
        }
      }

      return {
        text: this.postProcessText(bestResult.text),
        confidence: bestResult.confidence / 100, // Convert to 0-1 range
        pages: 1,
        processingTime: performance.now() - startTime,
        language: 'en',
      };
    } catch (error) {
      console.error('Error processing image:', error);
      throw new Error(`Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert PDF to images with enhanced quality for OCR
   */
  private async pdfToImages(file: File): Promise<HTMLCanvasElement[]> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      // Remove cMapUrl for PDF.js v5 - it handles this internally
      cMapPacked: true,
      disableFontFace: false, // Enable font rendering for better text extraction
      isEvalSupported: true,
    }).promise;

    const canvases: HTMLCanvasElement[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);

      // Use higher scale for better OCR accuracy
      const scale = 3.0; // Increased from 2.0 for better quality
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', {
        alpha: false, // Disable alpha for better performance
        willReadFrequently: false
      });

      if (!context) throw new Error('Could not get canvas context');

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Clear canvas with white background
      context.fillStyle = 'white';
      context.fillRect(0, 0, canvas.width, canvas.height);

      // Render PDF page with high quality settings
      await page.render({
        canvasContext: context,
        viewport: viewport,
        canvas: canvas,
      } as any).promise;

      // Apply OCR-specific image enhancements to the rendered page
      const enhancedCanvas = await this.enhanceCanvasForOCR(canvas);
      canvases.push(enhancedCanvas);
    }

    return canvases;
  }

  /**
   * Enhance canvas image specifically for OCR processing
   */
  private async enhanceCanvasForOCR(canvas: HTMLCanvasElement): Promise<HTMLCanvasElement> {
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

      // Apply contrast enhancement
      let enhanced = gray;
      if (gray < 128) {
        enhanced = Math.max(0, gray * 0.8); // Darken dark areas
      } else {
        enhanced = Math.min(255, gray * 1.2); // Brighten light areas
      }

      data[i] = data[i + 1] = data[i + 2] = enhanced; // Set RGB to enhanced grayscale
      // Alpha channel remains unchanged
    }

    ctx.putImageData(imageData, 0, 0);
    return enhancedCanvas;
  }

  /**
   * Process PDF file with OCR using enhanced processing
   */
  public async processPDF(file: File): Promise<OCRResult> {
    const startTime = performance.now();

    try {
      const canvases = await this.pdfToImages(file);
      const worker = await this.getWorker();
      let combinedText = '';
      let totalConfidence = 0;

      for (const [index, canvas] of canvases.entries()) {
        console.log(`Processing page ${index + 1}/${canvases.length}...`);

        // Convert enhanced canvas to high-quality blob
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else reject(new Error('Failed to convert canvas to blob'));
            },
            'image/png',
            1.0 // Maximum quality
          );
        });

        // Try OCR with different PSM modes for best results
        let bestResult = { text: '', confidence: 0 };
        const psmModes = [PSM.AUTO_OSD, PSM.SINGLE_BLOCK, PSM.SINGLE_COLUMN];

        for (const psmMode of psmModes) {
          await this.worker!.setParameters({ tessedit_pageseg_mode: psmMode });
          const { data } = await worker.recognize(URL.createObjectURL(blob));

          if (data.confidence > bestResult.confidence) {
            bestResult = {
              text: data.text,
              confidence: data.confidence
            };
          }
        }

        const pageText = this.postProcessText(bestResult.text);
        combinedText += `\n\n--- Page ${index + 1} ---\n\n${pageText}`;
        totalConfidence += bestResult.confidence;
      }

      return {
        text: combinedText.trim(),
        confidence: totalConfidence / canvases.length / 100, // Average confidence
        pages: canvases.length,
        processingTime: performance.now() - startTime,
        language: 'en',
      };
    } catch (error) {
      console.error('Error processing PDF:', error);
      throw new Error(`Failed to process PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Main method to process any file type
   */
  public async processFile(file: File): Promise<OCRResult> {
    console.log(`Processing file: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
    
    if (file.type === 'application/pdf') {
      return this.processPDF(file);
    } else if (file.type.startsWith('image/')) {
      return this.processImage(file);
    } else {
      throw new Error(`Unsupported file type: ${file.type}`);
    }
  }

  /**
   * Extract text from file (auto-detect type)
   */
  public static async extractText(file: File): Promise<string> {
    const ocr = OCRService.getInstance();
    try {
      const result = await ocr.processFile(file);
      return result.text;
    } finally {
      // Don't clean up the worker to allow for multiple calls
      // await ocr.cleanup();
    }
  }
}
