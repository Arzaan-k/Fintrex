// Backend helper to call server endpoints (Supabase Edge Functions or any server)
// Falls back to local simulation when backend is not configured.

import { simulateProcessing, type ExtractedInvoice, type SuggestedRecord } from "@/lib/processing";
import { processDocumentComplete } from "@/lib/ocr-enhanced";
import { processDocumentWithTesseract } from "@/lib/ocr-tesseract";
import { processDocumentWithDeepSeek, processDocumentWithDeepSeekAI, isDeepSeekAvailable } from "@/lib/ocr-deepseek";
import { processWithVisionAPI } from "@/lib/ocr-vision";
import { supabase } from "@/integrations/supabase/client";

// Check if Gemini API is available (already configured in .env)
const isGeminiAvailable = (): boolean => {
  const geminiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  const googleAIKey = (import.meta as any).env?.GOOGLE_AI_API_KEY;
  const available = !!(geminiKey || googleAIKey);
  console.log('🔍 Checking Gemini availability:', {
    geminiKey: !!geminiKey,
    googleAIKey: !!googleAIKey,
    geminiKeyValue: geminiKey ? '***' + geminiKey.slice(-4) : 'not set',
    googleAIKeyValue: googleAIKey ? '***' + googleAIKey.slice(-4) : 'not set',
    available
  });
  return available;
};

// Check if Google Cloud Vision API is available
const isVisionAPIAvailable = (): boolean => {
  const key = (import.meta as any).env?.VITE_GOOGLE_VISION_API_KEY;
  console.log('🔍 Checking Vision API availability:', { visionKey: !!key, keyValue: key ? '***' + key.slice(-4) : 'not set' });
  return !!key;
};

// Enhanced invoice data extraction from OCR text
function extractBasicInvoiceData(text: string): {
  invoiceNumber?: string;
  totalAmount?: number;
  vendor?: string;
  customer?: string;
  date?: string;
  items?: any[];
} {
  const result: any = {};

  // Extract invoice number - more comprehensive patterns
  const invoicePatterns = [
    /invoice\s*#?\s*:?\s*([A-Z0-9\-]+)/i,
    /inv\s*#?\s*:?\s*([A-Z0-9\-]+)/i,
    /bill\s*#?\s*:?\s*([A-Z0-9\-]+)/i,
    /receipt\s*#?\s*:?\s*([A-Z0-9\-]+)/i,
    /invoice\s*no\.?\s*:?\s*([A-Z0-9\-]+)/i,
    /bill\s*no\.?\s*:?\s*([A-Z0-9\-]+)/i,
    /order\s*#?\s*:?\s*([A-Z0-9\-]+)/i,
  ];

  for (const pattern of invoicePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.invoiceNumber = match[1].trim();
      console.log(`📄 Found invoice number: ${result.invoiceNumber}`);
      break;
    }
  }

  // Extract total amount - more comprehensive patterns
  const amountPatterns = [
    /total\s*:?\s*₹?\s*(\d+(?:,\d+)*(?:\.\d{2})?)/i,
    /amount\s*:?\s*₹?\s*(\d+(?:,\d+)*(?:\.\d{2})?)/i,
    /grand\s*total\s*:?\s*₹?\s*(\d+(?:,\d+)*(?:\.\d{2})?)/i,
    /net\s*amount\s*:?\s*₹?\s*(\d+(?:,\d+)*(?:\.\d{2})?)/i,
    /final\s*total\s*:?\s*₹?\s*(\d+(?:,\d+)*(?:\.\d{2})?)/i,
    /balance\s*due\s*:?\s*₹?\s*(\d+(?:,\d+)*(?:\.\d{2})?)/i,
    /₹\s*(\d+(?:,\d+)*(?:\.\d{2})?)/g, // Find the largest ₹ amount
  ];

  let maxAmount = 0;
  for (const pattern of amountPatterns) {
    const matches = text.matchAll(new RegExp(pattern, 'gi'));
    for (const match of matches) {
      if (match[1]) {
        const amount = parseFloat(match[1].replace(/,/g, ''));
        if (amount > maxAmount) {
          maxAmount = amount;
          result.totalAmount = amount;
        }
      }
    }
  }

  if (result.totalAmount) {
    console.log(`💰 Found total amount: ₹${result.totalAmount}`);
  }

  // Extract vendor (look for company names at the beginning)
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  if (lines.length > 0) {
    // First non-empty line is likely the vendor
    result.vendor = lines[0].trim();
    console.log(`🏢 Found vendor: ${result.vendor}`);
  }

  // Extract date - more patterns
  const datePatterns = [
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/,
    /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/,
    /date\s*:?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    /dated?\s*:?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    /(\d{1,2}\s+[A-Za-z]{3,}\s+\d{4})/i, // e.g., "15 January 2024"
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.date = match[1];
      console.log(`📅 Found date: ${result.date}`);
      break;
    }
  }

  return result;
}

const BACKEND_URL = (import.meta as any).env?.VITE_BACKEND_URL as string | undefined;

async function postJSON<T>(url: string, body: any): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Request failed ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function processDocument(doc: { id: string; file_name: string }): Promise<{ extracted: ExtractedInvoice; suggestion: SuggestedRecord }> {
  if (BACKEND_URL) {
    const base = BACKEND_URL.replace(/\/$/, "");
    // Expect backend to return { extracted, suggestion }
    return await postJSON<{ extracted: ExtractedInvoice; suggestion: SuggestedRecord }>(
      `${base}/process-document`,
      { documentId: doc.id }
    );
  }
  
  // WORKING TESSERACT OCR IMPLEMENTATION
  console.log('🤖 TESSERACT OCR: Starting processing...');
  
  // Get the file from Supabase storage
  const { data: documentData, error: docError } = await supabase
    .from("documents")
    .select("file_path, client_id")
    .eq("id", doc.id)
    .single();
  
  if (docError) {
    console.error('❌ Database error:', docError);
    throw new Error(`Database error: ${docError.message}`);
  }
  
  // Download the file from storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('documents')
    .download(documentData.file_path);
  
  if (downloadError) {
    console.error('❌ File download error:', downloadError);
    throw new Error(`File download error: ${downloadError.message}`);
  }
  
  // Convert Blob to File
  const file = new File([fileData], doc.file_name, { type: fileData.type });
  console.log(`📁 PROCESSING: ${doc.file_name} | ${file.type} | ${(file.size/1024).toFixed(1)}KB`);
  
  let processingMethod = 'unknown';

  try {
    // PRIMARY: Enhanced Tesseract OCR (reliable, works offline, no API costs)
    console.log('🤖 USING ENHANCED TESSERACT OCR (primary - reliable & free)...');

    const tesseractResult = await processDocumentWithTesseract(file, doc.file_name);

    console.log('📊 TESSERACT RESULTS:');
    console.log(`   Document Type: ${tesseractResult.documentType}`);
    console.log(`   Confidence: ${(tesseractResult.ocrResult.confidence * 100).toFixed(1)}%`);
    console.log(`   Text Length: ${tesseractResult.ocrResult.text.length} chars`);
    console.log(`   Processing Time: ${tesseractResult.ocrResult.processingTime}ms`);

    processingMethod = 'enhanced-tesseract';

    // Convert to expected format
    const extracted: ExtractedInvoice = {
      invoiceNumber: tesseractResult.extractedData.invoiceNumber || tesseractResult.extractedData.invoice_number || `OCR-${Date.now().toString().slice(-6)}`,
      invoiceDate: tesseractResult.extractedData.invoiceDate || tesseractResult.extractedData.invoice_date || new Date().toISOString().slice(0, 10),
      vendor: {
        name: tesseractResult.extractedData.vendorName || tesseractResult.extractedData.vendor_name || 'Extracted Vendor',
        gstin: tesseractResult.extractedData.vendorGSTIN || tesseractResult.extractedData.vendor_gstin
      },
      customer: {
        name: tesseractResult.extractedData.customerName || tesseractResult.extractedData.customer_name || 'Extracted Customer',
        gstin: tesseractResult.extractedData.customerGSTIN || tesseractResult.extractedData.customer_gstin
      },
      lineItems: tesseractResult.extractedData.lineItems || tesseractResult.extractedData.line_items || [],
      tax: tesseractResult.extractedData.taxDetails || tesseractResult.extractedData.tax_details || { cgst: 0, sgst: 0, igst: 0, totalTax: 0 },
      totalAmount: tesseractResult.extractedData.totalAmount || tesseractResult.extractedData.total_amount || 0,
      currency: tesseractResult.extractedData.currency || "INR",
      confidence: tesseractResult.ocrResult.confidence,
      rawText: tesseractResult.ocrResult.text,
    };

    console.log('🧾 EXTRACTED DATA:', {
      invoiceNumber: extracted.invoiceNumber,
      totalAmount: extracted.totalAmount,
      vendor: extracted.vendor.name,
      customer: extracted.customer.name,
      textLength: extracted.rawText?.length || 0
    });

    const suggestion: SuggestedRecord = {
      record_type: tesseractResult.documentType.includes('invoice') || tesseractResult.documentType.includes('receipt') ? 'income' :
                  tesseractResult.documentType.includes('purchase') ? 'expense' : 'income',
      amount: extracted.totalAmount,
      description: `Invoice ${extracted.invoiceNumber}`,
      category: tesseractResult.documentType.includes('purchase') ? 'Purchase' : 'Sales',
      transaction_date: extracted.invoiceDate,
    };

    console.log('💰 SUGGESTION:', suggestion);
    console.log(`🔄 OCR Processing completed using: ${processingMethod.toUpperCase()}`);

    return { extracted, suggestion };

  } catch (tesseractError) {
    console.error('❌ TESSERACT FAILED:', tesseractError);

    try {
      // Secondary: DeepSeek Vision OCR (advanced, high-accuracy)
      console.log('🧠 FALLING BACK TO DEEPSEEK VISION OCR...');

      const deepSeekAvailable = await isDeepSeekAvailable();
      if (deepSeekAvailable) {
        const deepSeekResult = await processDocumentWithDeepSeekAI(file, doc.file_name);

        console.log('📊 DEEPSEEK AI RESULTS:');
        console.log(`   Document Type: ${deepSeekResult.documentType}`);
        console.log(`   Confidence: ${(deepSeekResult.ocrResult.confidence * 100).toFixed(1)}%`);
        console.log(`   Text Length: ${deepSeekResult.ocrResult.text.length} chars`);
        console.log(`   Processing Time: ${deepSeekResult.ocrResult.processingTime}ms`);
        console.log(`   AI Extraction: ${deepSeekResult.aiExtraction ? 'Used' : 'Not Available'}`);

        processingMethod = deepSeekResult.aiExtraction ? 'deepseek_ai' : 'deepseek_regex';

        // Use AI-extracted data if available, otherwise use regex-extracted data
        const finalData = deepSeekResult.aiExtraction || deepSeekResult.extractedData;

        // Convert to expected format
        const extracted: ExtractedInvoice = {
          invoiceNumber: finalData.invoiceNumber || finalData.invoice_number || `OCR-${Date.now().toString().slice(-6)}`,
          invoiceDate: finalData.invoiceDate || finalData.invoice_date || new Date().toISOString().slice(0, 10),
          vendor: {
            name: finalData.vendorName || finalData.vendor_name || 'Extracted Vendor',
            gstin: finalData.vendorGSTIN || finalData.vendor_gstin
          },
          customer: {
            name: finalData.customerName || finalData.customer_name || 'Extracted Customer',
            gstin: finalData.customerGSTIN || finalData.customer_gstin
          },
          lineItems: finalData.lineItems || finalData.line_items || [],
          tax: finalData.taxDetails || finalData.tax_details || { cgst: 0, sgst: 0, igst: 0, totalTax: 0 },
          totalAmount: finalData.totalAmount || finalData.total_amount || 0,
          currency: finalData.currency || "INR",
          confidence: deepSeekResult.ocrResult.confidence,
        };

        const suggestion: SuggestedRecord = {
          record_type: deepSeekResult.documentType.includes('invoice') || deepSeekResult.documentType.includes('receipt') ? 'income' :
                      deepSeekResult.documentType.includes('purchase') ? 'expense' : 'income',
          amount: extracted.totalAmount,
          description: `Invoice ${extracted.invoiceNumber}`,
          category: deepSeekResult.documentType.includes('purchase') ? 'Purchase' : 'Sales',
          transaction_date: extracted.invoiceDate,
        };

        console.log('🧾 DEEPSEEK EXTRACTED DATA:', {
          invoiceNumber: extracted.invoiceNumber,
          totalAmount: extracted.totalAmount,
          vendor: extracted.vendor.name,
          customer: extracted.customer.name
        });

        console.log(`🔄 OCR Processing completed using: ${processingMethod.toUpperCase()}`);
        return { extracted, suggestion };

      } else {
        throw new Error('DeepSeek not available');
      }

    } catch (deepSeekError) {
      console.error('❌ DEEPSEEK FAILED:', deepSeekError);

      try {
        // Tertiary: LLM-based OCR (Gemini)
        console.log('🤖 FALLING BACK TO LLM OCR (Gemini)...');
        const { processDocumentComplete } = await import('./ocr-enhanced');
        const llmResult = await processDocumentComplete(file);

        processingMethod = 'llm';

        // Convert LLM result to expected format
        const extracted: ExtractedInvoice = {
          invoiceNumber: llmResult.fields?.invoiceNumber || llmResult.fields?.invoice_number || `OCR-${Date.now().toString().slice(-6)}`,
          invoiceDate: llmResult.fields?.invoiceDate || llmResult.fields?.invoice_date || new Date().toISOString().slice(0, 10),
          vendor: {
            name: llmResult.fields?.vendorName || llmResult.fields?.vendor_name || 'Extracted Vendor',
            gstin: llmResult.fields?.vendorGSTIN || llmResult.fields?.vendor_gstin
          },
          customer: {
            name: llmResult.fields?.customerName || llmResult.fields?.customer_name || 'Extracted Customer',
            gstin: llmResult.fields?.customerGSTIN || llmResult.fields?.customer_gstin
          },
          lineItems: llmResult.fields?.lineItems || llmResult.fields?.line_items || [],
          tax: llmResult.fields?.taxDetails || llmResult.fields?.tax_details || { cgst: 0, sgst: 0, igst: 0, totalTax: 0 },
          totalAmount: llmResult.fields?.totalAmount || llmResult.fields?.total_amount || 0,
          currency: llmResult.fields?.currency || "INR",
          confidence: llmResult.confidence || 0.8,
        };

        const suggestion: SuggestedRecord = {
          record_type: llmResult.classification?.type?.includes('invoice') || llmResult.classification?.type?.includes('receipt') ? 'income' :
                      llmResult.classification?.type?.includes('purchase') ? 'expense' : 'income',
          amount: extracted.totalAmount,
          description: `Invoice ${extracted.invoiceNumber}`,
          category: llmResult.classification?.type?.includes('purchase') ? 'Purchase' : 'Sales',
          transaction_date: extracted.invoiceDate,
        };

        console.log(`🔄 OCR Processing completed using: ${processingMethod.toUpperCase()}`);
        return { extracted, suggestion };

      } catch (llmError) {
        console.error('❌ ALL OCR METHODS FAILED:', { tesseractError, deepSeekError, llmError });

        // Final fallback: local simulation
        console.log('🔄 USING SIMULATION FALLBACK...');
        processingMethod = 'simulation';
        console.log(`🔄 OCR Processing completed using: ${processingMethod.toUpperCase()}`);
        return simulateProcessing(doc.file_name);
      }
    }
  }
}

export async function extractInvoice(draft: any): Promise<{ invoice: any; confidence: number }> {
  if (BACKEND_URL) {
    const base = BACKEND_URL.replace(/\/$/, "");
    return await postJSON<{ invoice: any; confidence: number }>(
      `${base}/extract-invoice`,
      { draft }
    );
  }
  // Minimal local normalization fallback
  return {
    invoice: {
      invoice_type: "sales",
      invoice_number: draft?.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
      invoice_date: draft?.invoiceDate || new Date().toISOString().slice(0, 10),
      vendor_name: draft?.vendor?.name,
      vendor_gstin: draft?.vendor?.gstin,
      customer_name: draft?.customer?.name,
      customer_gstin: draft?.customer?.gstin,
      line_items: draft?.lineItems || [],
      tax_details: draft?.tax || {},
      total_amount: draft?.totalAmount || 0,
      currency: draft?.currency || "INR",
      payment_status: "unpaid",
    },
    confidence: draft?.confidence ?? 0.8,
  };
}
