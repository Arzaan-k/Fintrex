// Automation Engine - Complete Document Processing Flow
// Handles: Document Receipt -> Classification -> Extraction -> Client Matching -> Data Update

import { supabase } from '@/integrations/supabase/client';
import { processDocumentComplete, ExtractedData } from '@/lib/ocr-enhanced';
import { processDocumentWithTesseract } from '@/lib/ocr-tesseract';
import { processDocumentWithDeepSeek, processDocumentWithDeepSeekAI, isDeepSeekAvailable } from '@/lib/ocr-deepseek';
import {
  matchClientByPhone,
  matchClientByEmail,
  matchClientByIdentifiers,
  createTemporaryClient,
  updateClientFromKYCData,
  isKYCComplete,
  smartMatch
} from '@/lib/client-matcher';

export interface IncomingDocument {
  source: 'whatsapp' | 'email' | 'web';
  senderPhone?: string;
  senderEmail?: string;
  accountantPhone?: string;
  accountantEmail?: string;
  file: File;
  metadata?: any;
}

export interface ProcessingResult {
  success: boolean;
  clientId?: string;
  documentId?: string;
  classification?: string;
  action: 'kyc_created' | 'kyc_updated' | 'invoice_added' | 'error';
  message: string;
  extractedData?: any;
}

/**
 * Main automation entry point
 * Processes any incoming document and routes it automatically
 */
export async function processIncomingDocument(
  incoming: IncomingDocument
): Promise<ProcessingResult> {
  try {
    console.log('🚀 Starting automated processing for document from:', incoming.senderPhone || incoming.senderEmail);

    // Step 1: Identify the accountant
    const accountant = await identifyAccountant(incoming);
    if (!accountant) {
      return {
        success: false,
        action: 'error',
        message: 'Could not identify accountant for this document'
      };
    }

    console.log('✓ Accountant identified:', accountant.id);

    // Step 2: Advanced OCR processing with multi-layer fallback
    // Chain: Tesseract -> DeepSeek -> LLM -> Basic fallback
    let extracted: ExtractedData;
    let processingMethod = 'unknown';

    try {
      console.log('🔍 Processing with Tesseract OCR (primary)...');
      const tesseractResult = await processDocumentWithTesseract(incoming.file, incoming.file.name);

      // Convert Tesseract result to ExtractedData format
      extracted = {
        classification: {
          type: tesseractResult.documentType,
          confidence: tesseractResult.ocrResult.confidence,
        },
        fields: tesseractResult.extractedData,
        rawText: tesseractResult.ocrResult.text,
        confidence: tesseractResult.ocrResult.confidence
      };

      processingMethod = 'tesseract';
      console.log('✓ Document processed with Tesseract. Type:', extracted.classification.type);

    } catch (tesseractError) {
      console.log('⚠️ Tesseract OCR failed, trying DeepSeek Vision:', tesseractError);

      try {
        // Check if DeepSeek is available
        const deepSeekAvailable = await isDeepSeekAvailable();

        if (deepSeekAvailable) {
          console.log('🧠 Processing with DeepSeek AI (OCR + AI Extraction)...');
          const deepSeekResult = await processDocumentWithDeepSeekAI(incoming.file, incoming.file.name);

          // Use AI-extracted data if available, otherwise use regex-extracted data
          const finalExtractedData = deepSeekResult.aiExtraction || deepSeekResult.extractedData;

          // Convert DeepSeek result to ExtractedData format
          extracted = {
            classification: {
              type: deepSeekResult.documentType,
              confidence: deepSeekResult.ocrResult.confidence,
            },
            fields: finalExtractedData,
            rawText: deepSeekResult.ocrResult.text,
            confidence: deepSeekResult.ocrResult.confidence
          };

          processingMethod = deepSeekResult.aiExtraction ? 'deepseek_ai' : 'deepseek_regex';
          console.log(`✓ Document processed with DeepSeek ${processingMethod.includes('ai') ? 'AI' : 'Regex'}. Type:`, extracted.classification.type);
        } else {
          throw new Error('DeepSeek not available');
        }

      } catch (deepSeekError) {
        console.log('⚠️ DeepSeek OCR failed, falling back to LLM processing:', deepSeekError);

        try {
          console.log('🤖 Processing with LLM (Gemini)...');
          extracted = await processDocumentComplete(incoming.file);
          processingMethod = 'llm';
          console.log('✓ Document processed with LLM. Type:', extracted.classification.type);

        } catch (llmError) {
          console.log('❌ All OCR methods failed, using basic fallback');

          // Basic fallback - just store the document
          extracted = {
            classification: {
              type: 'other',
              confidence: 0.1,
            },
            fields: {
              filename: incoming.file.name,
              error: 'All OCR processing methods failed',
              tesseractError: tesseractError instanceof Error ? tesseractError.message : 'Unknown',
              deepSeekError: deepSeekError instanceof Error ? deepSeekError.message : 'Unknown',
              llmError: llmError instanceof Error ? llmError.message : 'Unknown'
            },
            rawText: `Failed to process ${incoming.file.name} with all available OCR methods`,
            confidence: 0.1
          };

          processingMethod = 'fallback';
        }
      }
    }

    // Log the processing method used
    console.log(`🔄 OCR Processing completed using: ${processingMethod.toUpperCase()}`);

    // Step 3: Match or create client
    const clientMatch = await findOrCreateClient(incoming, extracted, accountant.id);
    console.log('✓ Client matched/created:', clientMatch.clientId);

    // Step 4: Store document
    const documentId = await storeDocument(
      incoming.file,
      clientMatch.clientId,
      extracted
    );
    console.log('✓ Document stored:', documentId);

    // Step 5: Route based on document type
    if (extracted.classification.type === 'pan_card' || 
        extracted.classification.type === 'aadhaar' || 
        extracted.classification.type === 'gst_certificate') {
      // KYC Document - Update client profile
      return await handleKYCDocument(clientMatch.clientId, extracted, documentId);
    } else if (extracted.classification.type === 'invoice' || 
               extracted.classification.type === 'receipt') {
      // Invoice/Receipt - Add to financial records
      return await handleInvoiceDocument(clientMatch.clientId, extracted, documentId);
    } else if (extracted.classification.type === 'bank_statement') {
      // Bank Statement - Extract transactions
      return await handleBankStatement(clientMatch.clientId, extracted, documentId);
    } else {
      // Other documents - just store
      return {
        success: true,
        clientId: clientMatch.clientId,
        documentId,
        classification: extracted.classification.type,
        action: 'kyc_updated',
        message: 'Document stored successfully'
      };
    }
  } catch (error: any) {
    console.error('❌ Error in automation engine:', error);
    return {
      success: false,
      action: 'error',
      message: error.message || 'Processing failed'
    };
  }
}

/**
 * Identify accountant from incoming document
 */
async function identifyAccountant(incoming: IncomingDocument) {
  if (incoming.source === 'whatsapp' && incoming.accountantPhone) {
    // Get accountant by WhatsApp number
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('phone_number', incoming.accountantPhone)
      .single();
    return data;
  }

  if (incoming.source === 'email' && incoming.accountantEmail) {
    // Get accountant by email
    const { data } = await supabase.auth.admin.listUsers();
    const user = data.users?.find(u => u.email === incoming.accountantEmail);
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      return profile;
    }
  }

  // For web uploads, accountant should be in session
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    return profile;
  }

  return null;
}

/**
 * Find existing client or create new one
 */
async function findOrCreateClient(
  incoming: IncomingDocument,
  extracted: ExtractedData,
  accountantId: string
): Promise<{ clientId: string; isNew: boolean }> {
  // First try to match by sender info
  if (incoming.senderPhone) {
    const match = await matchClientByPhone(incoming.senderPhone, accountantId);
    if (match.matched && match.clientId) {
      return { clientId: match.clientId, isNew: false };
    }
  }

  if (incoming.senderEmail) {
    const match = await matchClientByEmail(incoming.senderEmail, accountantId);
    if (match.matched && match.clientId) {
      return { clientId: match.clientId, isNew: false };
    }
  }

  // Try to match by extracted data (GSTIN, PAN, etc.)
  const smartMatchResult = await smartMatch(extracted.fields, accountantId);
  if (smartMatchResult.matched && smartMatchResult.clientId) {
    return { clientId: smartMatchResult.clientId, isNew: false };
  }

  // No match found - create temporary client
  const tempClient = await createTemporaryClient(accountantId, {
    phone: incoming.senderPhone,
    email: incoming.senderEmail,
    name: extracted.fields.name || extracted.fields.businessName
  });

  return { clientId: tempClient.clientId, isNew: true };
}

/**
 * Store document in database and storage
 */
async function storeDocument(
  file: File,
  clientId: string,
  extracted: ExtractedData
): Promise<string> {
  // Upload file to Supabase Storage
  const timestamp = Date.now();
  const filePath = `${clientId}/${timestamp}_${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, file);

  if (uploadError) {
    console.error('Upload error:', uploadError);
    throw new Error('Failed to upload document');
  }

  // Create document record
  const { data, error } = await supabase
    .from('documents')
    .insert({
      client_id: clientId,
      file_name: file.name,
      file_path: filePath,
      file_type: file.type,
      file_size: file.size,
      status: 'completed',
      extracted_data: extracted,
      uploaded_via: 'automation'
    })
    .select()
    .single();

  if (error) {
    throw new Error('Failed to create document record');
  }

  // Update client document counts
  await supabase.rpc('increment_client_documents', { 
    client_id: clientId,
    increment_total: true,
    increment_completed: true
  });

  return data.id;
}

/**
 * Handle KYC documents - Update client profile
 */
async function handleKYCDocument(
  clientId: string,
  extracted: ExtractedData,
  documentId: string
): Promise<ProcessingResult> {
  const fields = extracted.fields;

  // Extract KYC data based on document type
  const kycData: any = {};

  if (extracted.classification.type === 'pan_card') {
    kycData.panNumber = fields.panNumber;
    kycData.contactPerson = fields.name;
  } else if (extracted.classification.type === 'gst_certificate') {
    kycData.gstin = fields.gstin;
    kycData.businessName = fields.legalName || fields.tradeName;
    kycData.address = fields.address;
  } else if (extracted.classification.type === 'aadhaar') {
    kycData.contactPerson = fields.name;
    kycData.address = fields.address;
    kycData.phone = fields.phone;
  }

  // Update client profile
  const updated = await updateClientFromKYCData(clientId, kycData);

  if (updated) {
    // Check if KYC is now complete
    const kycComplete = await isKYCComplete(clientId);
    if (kycComplete) {
      // Activate client
      await supabase
        .from('clients')
        .update({ status: 'active' })
        .eq('id', clientId);
    }

    return {
      success: true,
      clientId,
      documentId,
      classification: extracted.classification.type,
      action: 'kyc_updated',
      message: `KYC profile updated with ${extracted.classification.type}`,
      extractedData: fields
    };
  }

  return {
    success: false,
    action: 'error',
    message: 'Failed to update client profile'
  };
}

/**
 * Handle invoice documents - Add to financial records
 */
async function handleInvoiceDocument(
  clientId: string,
  extracted: ExtractedData,
  documentId: string
): Promise<ProcessingResult> {
  const fields = extracted.fields;

  try {
    // Determine invoice type (sales or purchase)
    const invoiceType = determineInvoiceType(fields);

    // Create financial record
    const recordType = invoiceType === 'sales' ? 'income' : 'expense';
    const amount = parseFloat(fields.totalAmount || 0);
    const transactionDate = fields.invoiceDate || new Date().toISOString().split('T')[0];

    const { data: finRecord, error: finError } = await supabase
      .from('financial_records')
      .insert({
        client_id: clientId,
        document_id: documentId,
        record_type: recordType,
        amount: amount,
        category: fields.category || 'General',
        description: `Invoice ${fields.invoiceNumber || ''}`,
        transaction_date: transactionDate
      })
      .select()
      .single();

    if (finError) {
      throw new Error('Failed to create financial record');
    }

    // Create invoice record
    const { error: invError } = await supabase
      .from('invoices')
      .insert({
        document_id: documentId,
        client_id: clientId,
        invoice_type: invoiceType,
        invoice_number: fields.invoiceNumber,
        invoice_date: transactionDate,
        due_date: fields.dueDate || null,
        vendor_name: fields.vendorName,
        vendor_gstin: fields.vendorGSTIN,
        customer_name: fields.customerName,
        customer_gstin: fields.customerGSTIN,
        line_items: fields.lineItems || [],
        tax_details: fields.taxDetails || {},
        total_amount: amount,
        currency: fields.currency || 'INR',
        payment_status: 'unpaid'
      });

    if (invError) {
      console.error('Invoice creation error:', invError);
    }

    // Auto-create journal entry
    await createJournalEntry(clientId, invoiceType, amount, transactionDate, fields);
    
    // Auto-generate balance sheet
    await generateAndUpdateBalanceSheet(clientId);

    return {
      success: true,
      clientId,
      documentId,
      classification: 'invoice',
      action: 'invoice_added',
      message: `Invoice processed: ${invoiceType} of ₹${amount.toLocaleString('en-IN')}`,
      extractedData: fields
    };
  } catch (error: any) {
    console.error('Error handling invoice:', error);
    return {
      success: false,
      action: 'error',
      message: error.message
    };
  }
}

/**
 * Handle bank statement - Extract transactions
 */
async function handleBankStatement(
  clientId: string,
  extracted: ExtractedData,
  documentId: string
): Promise<ProcessingResult> {
  // TODO: Implement bank statement transaction extraction
  // For now, just mark as processed
  return {
    success: true,
    clientId,
    documentId,
    classification: 'bank_statement',
    action: 'kyc_updated',
    message: 'Bank statement received and stored'
  };
}

/**
 * Determine if invoice is sales or purchase
 */
function determineInvoiceType(fields: any): 'sales' | 'purchase' {
  // If customer GSTIN is present, likely sales invoice
  if (fields.customerGSTIN || fields.customerName) {
    return 'sales';
  }
  // If vendor GSTIN is present, likely purchase invoice
  if (fields.vendorGSTIN || fields.vendorName) {
    return 'purchase';
  }
  // Default to purchase (expense)
  return 'purchase';
}

/**
 * Create automated journal entry from invoice
 */
async function createJournalEntry(
  clientId: string,
  invoiceType: 'sales' | 'purchase',
  amount: number,
  date: string,
  invoiceData: any
) {
  try {
    const taxAmount = parseFloat(invoiceData.taxDetails?.totalTax || 0);
    const baseAmount = amount - taxAmount;

    // Create journal entry
    const { data: entry, error: entryError } = await supabase
      .from('journal_entries')
      .insert({
        client_id: clientId,
        entry_date: date,
        entry_type: invoiceType === 'sales' ? 'sales' : 'purchase',
        narration: `Auto: Invoice ${invoiceData.invoiceNumber || ''}`,
        is_auto_generated: true,
        status: 'posted'
      })
      .select()
      .single();

    if (entryError || !entry) {
      console.error('Failed to create journal entry:', entryError);
      return;
    }

    // Create journal line items
    if (invoiceType === 'sales') {
      // Sales: Debit Debtors, Credit Sales, Credit GST Output
      await supabase.from('journal_line_items').insert([
        {
          entry_id: entry.id,
          account_name: 'Debtors',
          debit_amount: amount,
          credit_amount: 0
        },
        {
          entry_id: entry.id,
          account_name: 'Sales',
          debit_amount: 0,
          credit_amount: baseAmount
        },
        {
          entry_id: entry.id,
          account_name: 'GST Output',
          debit_amount: 0,
          credit_amount: taxAmount
        }
      ]);
    } else {
      // Purchase: Debit Expense, Debit GST Input, Credit Creditors
      await supabase.from('journal_line_items').insert([
        {
          entry_id: entry.id,
          account_name: 'Expenses',
          debit_amount: baseAmount,
          credit_amount: 0
        },
        {
          entry_id: entry.id,
          account_name: 'GST Input',
          debit_amount: taxAmount,
          credit_amount: 0
        },
        {
          entry_id: entry.id,
          account_name: 'Creditors',
          debit_amount: 0,
          credit_amount: amount
        }
      ]);
    }

    console.log('✓ Journal entry created:', entry.id);
  } catch (error) {
    console.error('Error creating journal entry:', error);
  }
}

/**
 * Generate and update balance sheet for a client
 */
async function generateAndUpdateBalanceSheet(clientId: string) {
  try {
    // Use the database function to generate/update balance sheet
    const { error } = await supabase.rpc('update_client_balance_sheet', {
      p_client_id: clientId
    });
    
    if (error) {
      console.error('Error updating balance sheet:', error);
      return;
    }

    console.log('✓ Balance sheet updated for client:', clientId);
  } catch (error) {
    console.error('Error generating balance sheet:', error);
  }
}

/**
 * Calculate total from an object of numbers
 */
function calculateObjectTotal(obj: { [key: string]: number }): number {
  return Object.values(obj).reduce((sum, value) => sum + value, 0);
}

/**
 * Notify accountant about new document
 */
export async function notifyAccountant(
  accountantId: string,
  result: ProcessingResult
) {
  // Create notification record
  await supabase.from('notifications').insert({
    user_id: accountantId,
    type: result.action,
    title: 'New Document Processed',
    message: result.message,
    data: {
      clientId: result.clientId,
      documentId: result.documentId,
      classification: result.classification
    },
    read: false
  });
}
