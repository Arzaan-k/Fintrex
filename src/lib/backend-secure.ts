// SECURE BACKEND - All API keys server-side
// This replaces the insecure backend.ts implementation
// Uses Supabase Edge Functions for OCR processing

import { supabase } from "@/integrations/supabase/client";
import { extractTextSecure, extractStructuredDataSecure, classifyDocument, extractFields } from "@/lib/ocr-secure-client";

export interface ExtractedInvoice {
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  vendor?: {
    name?: string;
    gstin?: string;
    address?: string;
  };
  customer?: {
    name?: string;
    gstin?: string;
    address?: string;
  };
  lineItems?: Array<{
    description: string;
    quantity: number;
    rate: number;
    amount: number;
    hsn?: string;
    gst_rate?: number;
  }>;
  tax?: {
    cgst: number;
    sgst: number;
    igst: number;
    cess?: number;
    totalTax: number;
  };
  subtotal?: number;
  totalAmount: number;
  currency?: string;
  confidence: number;
}

export interface SuggestedRecord {
  record_type: "income" | "expense";
  amount: number;
  description: string;
  category: string;
  transaction_date: string;
}

/**
 * Process document with secure OCR Edge Function
 */
export async function processDocumentSecure(doc: {
  id: string;
  file_name: string;
  file_path: string;
}): Promise<{ extracted: ExtractedInvoice; suggestion: SuggestedRecord }> {
  console.log(`🔒 SECURE PROCESSING: ${doc.file_name}`);

  try {
    // Step 1: Get document from storage using signed URL (works with private buckets)
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.file_path, 3600); // 1 hour expiry

    if (urlError || !signedUrlData) {
      console.error("❌ Failed to create signed URL:", urlError);
      throw new Error(`Failed to get document URL: ${urlError?.message || 'Unknown error'}`);
    }

    console.log(`📎 Document URL created: ${doc.file_path}`);

    // Step 2: Fetch the file as a blob and convert to File
    const response = await fetch(signedUrlData.signedUrl);
    if (!response.ok) {
      console.error(`❌ Failed to fetch document: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to fetch document: ${response.status} - ${response.statusText}`);
    }

    const blob = await response.blob();
    const file = new File([blob], doc.file_name, { type: blob.type });

    // Step 3: Process with secure OCR (auto provider selection)
    console.log("🔐 Using secure OCR Edge Function...");
    const extractedData = await extractStructuredDataSecure(file, 'auto');

    console.log("✅ Secure OCR complete:", {
      type: extractedData.classification.type,
      confidence: extractedData.confidence,
      fieldsExtracted: Object.keys(extractedData.fields).length
    });

    // Step 4: Convert extracted data to invoice format
    const documentType = extractedData.classification.type;
    const fields = extractedData.fields;

    // Determine if this is income or expense based on document type and filename
    const fileName = doc.file_name.toLowerCase();
    const isPurchase = fileName.includes('purchase') || fileName.includes('bill') || fileName.includes('expense');
    const isSales = fileName.includes('sale') || fileName.includes('invoice') || documentType === 'invoice';

    // Build extracted invoice
    const extracted: ExtractedInvoice = {
      invoiceNumber: fields.invoiceNumber || fields.invoice_number || `DOC-${Date.now().toString().slice(-6)}`,
      invoiceDate: fields.invoiceDate || fields.invoice_date || new Date().toISOString().slice(0, 10),
      dueDate: fields.dueDate || fields.due_date,
      vendor: {
        name: fields.vendorName || fields.vendor || fields.legalName || "Unknown Vendor",
        gstin: fields.vendorGSTIN || fields.gstin,
        address: fields.vendorAddress || fields.address
      },
      customer: {
        name: fields.customerName || fields.customer,
        gstin: fields.customerGSTIN,
        address: fields.customerAddress
      },
      lineItems: fields.lineItems || fields.line_items || [
        {
          description: "Item/Service",
          quantity: 1,
          rate: fields.totalAmount || fields.amount || 0,
          amount: fields.totalAmount || fields.amount || 0,
          hsn: "9997"
        }
      ],
      tax: {
        cgst: fields.cgst || 0,
        sgst: fields.sgst || 0,
        igst: fields.igst || 0,
        cess: fields.cess || 0,
        totalTax: (fields.cgst || 0) + (fields.sgst || 0) + (fields.igst || 0) + (fields.cess || 0)
      },
      subtotal: fields.subtotal || (fields.totalAmount ? fields.totalAmount - ((fields.cgst || 0) + (fields.sgst || 0) + (fields.igst || 0)) : 0),
      totalAmount: fields.totalAmount || fields.amount || 0,
      currency: "INR",
      confidence: extractedData.confidence
    };

    // Build suggested record
    const suggestion: SuggestedRecord = {
      record_type: isSales ? "income" : "expense",
      amount: extracted.totalAmount,
      description: isSales
        ? `Sales invoice ${extracted.invoiceNumber}`
        : `Purchase bill ${extracted.invoiceNumber}`,
      category: isSales ? "Sales" : "Office Expenses",
      transaction_date: extracted.invoiceDate || new Date().toISOString().slice(0, 10)
    };

    console.log("📊 Processing result:", {
      invoiceNumber: extracted.invoiceNumber,
      amount: extracted.totalAmount,
      type: suggestion.record_type,
      confidence: extracted.confidence
    });

    return { extracted, suggestion };

  } catch (error) {
    console.error("❌ Secure processing error:", error);

    // Fallback: Return basic structure
    return {
      extracted: {
        invoiceNumber: `DOC-${Date.now().toString().slice(-6)}`,
        invoiceDate: new Date().toISOString().slice(0, 10),
        vendor: { name: "Unknown" },
        customer: { name: "Unknown" },
        totalAmount: 0,
        confidence: 0.1,
        tax: {
          cgst: 0,
          sgst: 0,
          igst: 0,
          totalTax: 0
        }
      },
      suggestion: {
        record_type: "expense",
        amount: 0,
        description: `Document processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        category: "Other",
        transaction_date: new Date().toISOString().slice(0, 10)
      }
    };
  }
}

/**
 * Extract invoice data (deprecated, use processDocumentSecure instead)
 */
export async function extractInvoiceSecure(doc: {
  id: string;
  file_name: string;
  file_path: string;
}): Promise<{ extracted: ExtractedInvoice; suggestion: SuggestedRecord }> {
  return processDocumentSecure(doc);
}

/**
 * Backward compatibility: Process document using old interface
 */
export async function processDocument(doc: {
  id: string;
  file_name: string;
}): Promise<{ extracted: ExtractedInvoice; suggestion: SuggestedRecord }> {
  // Fetch document details from database
  const { data: docData, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", doc.id)
    .single();

  if (error || !docData) {
    throw new Error(`Document not found: ${error?.message || 'Unknown error'}`);
  }

  return processDocumentSecure({
    id: doc.id,
    file_name: doc.file_name,
    file_path: docData.file_path
  });
}

/**
 * Extract invoice (backward compatibility)
 */
export async function extractInvoice(doc: {
  id: string;
  file_name: string;
}): Promise<{ extracted: ExtractedInvoice; suggestion: SuggestedRecord }> {
  return processDocument(doc);
}
