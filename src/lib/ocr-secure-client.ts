// SECURE OCR CLIENT
// This replaces the insecure frontend OCR implementation
// All API keys are now safely stored server-side in Supabase Edge Functions

import { supabase } from '@/integrations/supabase/client';

export interface SecureOCRResult {
  text: string;
  confidence: number;
  provider: string;
  processingTime: number;
  metadata?: Record<string, unknown>;
}

export interface DocumentClassification {
  type: 'pan_card' | 'aadhaar' | 'gst_certificate' | 'bank_statement' | 'invoice' | 'receipt' | 'other';
  confidence: number;
  subType?: string;
}

export interface ExtractedData {
  classification: DocumentClassification;
  fields: Record<string, any>;
  rawText: string;
  confidence: number;
}

/**
 * Extract text from document using secure Edge Function
 * All API keys are server-side, never exposed to the client
 */
export async function extractTextSecure(
  file: File,
  provider: 'auto' | 'tesseract' | 'gemini' | 'deepseek' | 'vision' = 'auto'
): Promise<SecureOCRResult> {
  console.log(`🔒 SECURE OCR: Processing ${file.name} with provider: ${provider}`);

  // Step 1: Upload file to Supabase Storage (temporary bucket)
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `temp/${fileName}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  // Step 2: Get public URL for the uploaded file
  const { data: { publicUrl } } = supabase.storage
    .from('documents')
    .getPublicUrl(filePath);

  try {
    // Step 3: Call secure Edge Function with file URL
    const { data, error } = await supabase.functions.invoke('ocr-secure', {
      body: {
        fileUrl: publicUrl,
        fileName: file.name,
        provider
      }
    });

    if (error) {
      throw new Error(`OCR processing failed: ${error.message}`);
    }

    if (!data.success) {
      throw new Error(data.error || 'OCR processing failed');
    }

    console.log(`✅ SECURE OCR COMPLETE: ${data.provider} (${data.confidence * 100}% confidence)`);

    return {
      text: data.text,
      confidence: data.confidence,
      provider: data.provider,
      processingTime: data.processingTime,
      metadata: data.metadata
    };

  } finally {
    // Step 4: Clean up temporary file
    const { error: deleteError } = await supabase.storage
      .from('documents')
      .remove([filePath]);

    if (deleteError) {
      console.warn('Failed to delete temporary file:', deleteError);
    }
  }
}

/**
 * Classify document type based on text content
 */
export function classifyDocument(text: string, fileName?: string): DocumentClassification {
  const lowerText = text.toLowerCase();
  const lowerFileName = (fileName || '').toLowerCase();

  // Check filename hints first
  if (lowerFileName.includes('pan')) {
    return { type: 'pan_card', confidence: 0.85 };
  }
  if (lowerFileName.includes('aadhaar')) {
    return { type: 'aadhaar', confidence: 0.85 };
  }
  if (lowerFileName.includes('gst')) {
    return { type: 'gst_certificate', confidence: 0.80 };
  }
  if (lowerFileName.includes('invoice')) {
    return { type: 'invoice', confidence: 0.75 };
  }

  // Check text content
  if (lowerText.includes('permanent account number') || lowerText.includes('income tax department')) {
    return { type: 'pan_card', confidence: 0.90 };
  }
  if (lowerText.includes('aadhaar') || lowerText.includes('unique identification authority')) {
    return { type: 'aadhaar', confidence: 0.90 };
  }
  if (lowerText.includes('gstin') || lowerText.includes('goods and services tax')) {
    return { type: 'gst_certificate', confidence: 0.85 };
  }
  if (lowerText.includes('bank statement') || lowerText.includes('account statement')) {
    return { type: 'bank_statement', confidence: 0.85 };
  }
  if (lowerText.includes('invoice') || lowerText.includes('tax invoice')) {
    return { type: 'invoice', confidence: 0.80 };
  }
  if (lowerText.includes('receipt') || lowerText.includes('payment received')) {
    return { type: 'receipt', confidence: 0.80 };
  }

  return { type: 'other', confidence: 0.60 };
}

/**
 * Extract structured fields from text using regex patterns
 */
export function extractFields(text: string, documentType: string): Record<string, any> {
  const fields: Record<string, any> = {};

  // PAN Card patterns
  if (documentType === 'pan_card') {
    const panMatch = text.match(/([A-Z]{5}[0-9]{4}[A-Z]{1})/);
    if (panMatch) fields.panNumber = panMatch[1];

    const dateMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (dateMatch) fields.dateOfBirth = dateMatch[1];

    const nameMatch = text.match(/name[:\s]+([a-z\s]+)/i);
    if (nameMatch) fields.name = nameMatch[1].trim();
  }

  // GSTIN patterns
  if (documentType === 'gst_certificate') {
    const gstinMatch = text.match(/([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})/);
    if (gstinMatch) fields.gstin = gstinMatch[1];

    const nameMatch = text.match(/legal\s+name[:\s]+([a-z0-9\s&.]+)/i);
    if (nameMatch) fields.legalName = nameMatch[1].trim();

    const tradeNameMatch = text.match(/trade\s+name[:\s]+([a-z0-9\s&.]+)/i);
    if (tradeNameMatch) fields.tradeName = tradeNameMatch[1].trim();
  }

  // Aadhaar patterns
  if (documentType === 'aadhaar') {
    const aadhaarMatch = text.match(/(\d{4}\s\d{4}\s\d{4})/);
    if (aadhaarMatch) fields.aadhaarNumber = aadhaarMatch[1];

    const nameMatch = text.match(/([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
    if (nameMatch) fields.name = nameMatch[1].trim();

    const dobMatch = text.match(/(?:dob|date\s+of\s+birth)[:\s]+(\d{2}\/\d{2}\/\d{4})/i);
    if (dobMatch) fields.dateOfBirth = dobMatch[1];
  }

  // Invoice patterns
  if (documentType === 'invoice' || documentType === 'receipt') {
    const invoiceMatch = text.match(/(?:invoice|bill)\s*(?:no|number|#)\s*:?\s*([A-Z0-9-/]+)/i);
    if (invoiceMatch) fields.invoiceNumber = invoiceMatch[1];

    const dateMatch = text.match(/(?:date|dated)\s*:?\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/i);
    if (dateMatch) fields.invoiceDate = dateMatch[1];

    const amountMatch = text.match(/(?:total|amount|grand\s+total|₹|rs\.?)\s*:?\s*([0-9,]+\.?\d{0,2})/i);
    if (amountMatch) fields.totalAmount = parseFloat(amountMatch[1].replace(/,/g, ''));

    const gstinMatch = text.match(/gstin[:\s]+([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})/i);
    if (gstinMatch) fields.vendorGSTIN = gstinMatch[1];

    // Extract GST components
    const cgstMatch = text.match(/cgst\s*:?\s*(?:₹|rs\.?)?\s*([0-9,]+\.?\d{0,2})/i);
    if (cgstMatch) fields.cgst = parseFloat(cgstMatch[1].replace(/,/g, ''));

    const sgstMatch = text.match(/sgst\s*:?\s*(?:₹|rs\.?)?\s*([0-9,]+\.?\d{0,2})/i);
    if (sgstMatch) fields.sgst = parseFloat(sgstMatch[1].replace(/,/g, ''));

    const igstMatch = text.match(/igst\s*:?\s*(?:₹|rs\.?)?\s*([0-9,]+\.?\d{0,2})/i);
    if (igstMatch) fields.igst = parseFloat(igstMatch[1].replace(/,/g, ''));
  }

  return fields;
}

/**
 * Extract structured data from document using secure OCR
 */
export async function extractStructuredDataSecure(
  file: File,
  provider: 'auto' | 'tesseract' | 'gemini' | 'deepseek' | 'vision' = 'auto'
): Promise<ExtractedData> {
  // Extract text using secure OCR
  const ocrResult = await extractTextSecure(file, provider);

  // Classify document type
  const classification = classifyDocument(ocrResult.text, file.name);

  // Extract fields based on document type
  const fields = extractFields(ocrResult.text, classification.type);

  return {
    classification,
    fields,
    rawText: ocrResult.text,
    confidence: (ocrResult.confidence + classification.confidence) / 2
  };
}

/**
 * Validate extracted data
 */
export function validateExtractedData(data: ExtractedData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate based on document type
  if (data.classification.type === 'pan_card') {
    if (!data.fields.panNumber) {
      errors.push('PAN number not found');
    } else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(data.fields.panNumber)) {
      errors.push('Invalid PAN format');
    }
  }

  if (data.classification.type === 'gst_certificate') {
    if (!data.fields.gstin) {
      errors.push('GSTIN not found');
    } else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(data.fields.gstin)) {
      errors.push('Invalid GSTIN format');
    }
  }

  if (data.classification.type === 'aadhaar') {
    if (!data.fields.aadhaarNumber) {
      errors.push('Aadhaar number not found');
    } else if (!/^\d{4}\s\d{4}\s\d{4}$/.test(data.fields.aadhaarNumber)) {
      errors.push('Invalid Aadhaar format');
    }
  }

  if (data.classification.type === 'invoice') {
    if (!data.fields.invoiceNumber) {
      errors.push('Invoice number not found');
    }
    if (!data.fields.totalAmount) {
      errors.push('Total amount not found');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Process document end-to-end with secure OCR
 */
export async function processDocumentSecure(
  file: File,
  provider: 'auto' | 'tesseract' | 'gemini' | 'deepseek' | 'vision' = 'auto'
): Promise<ExtractedData> {
  const extractedData = await extractStructuredDataSecure(file, provider);

  // Validate the extracted data
  const validation = validateExtractedData(extractedData);

  if (!validation.valid) {
    console.warn('Validation warnings:', validation.errors);
  }

  return extractedData;
}
