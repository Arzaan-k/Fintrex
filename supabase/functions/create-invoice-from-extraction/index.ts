// Supabase Edge Function: create-invoice-from-extraction
// Creates invoice record from extracted invoice data and triggers journal entry creation
// Endpoint: POST /create-invoice-from-extraction
// Body: { documentId: string, extractedData: object, clientId: string, accountantId: string }

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const JSON_HEADERS = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization, apikey, x-client-info",
};

interface ExtractedInvoice {
  invoice_number?: string;
  invoice_date?: string;
  invoice_type?: string;
  document_type?: 'sales' | 'purchase';
  vendor?: {
    legal_name?: string;
    gstin?: string;
    address?: string;
  };
  customer?: {
    legal_name?: string;
    gstin?: string;
    address?: string;
  };
  line_items?: Array<any>;
  tax_summary?: {
    subtotal?: number;
    total_cgst?: number;
    total_sgst?: number;
    total_igst?: number;
    total_cess?: number;
    grand_total?: number;
  };
  payment_terms?: string;
  due_date?: string;
  notes?: string;
}

/**
 * Determine invoice type based on extracted data
 */
function determineInvoiceType(extracted: ExtractedInvoice): 'sales' | 'purchase' {
  // If explicitly specified, use it
  if (extracted.document_type === 'sales' || extracted.document_type === 'purchase') {
    return extracted.document_type;
  }

  // Heuristic: If customer details are present and more complete than vendor, likely a sales invoice
  const hasCustomer = extracted.customer?.legal_name || extracted.customer?.gstin;
  const hasVendor = extracted.vendor?.legal_name || extracted.vendor?.gstin;

  // If both present, assume sales (invoice issued by the business)
  // If only vendor present, assume purchase (invoice received from vendor)
  if (hasCustomer && hasVendor) {
    return 'sales';
  } else if (hasVendor && !hasCustomer) {
    return 'purchase';
  } else {
    // Default to purchase (most common use case for receipt via WhatsApp)
    return 'purchase';
  }
}

/**
 * Create invoice record from extracted data
 */
async function createInvoiceRecord(
  supabase: any,
  documentId: string,
  clientId: string,
  accountantId: string | undefined,
  extracted: ExtractedInvoice,
  overallConfidence: number
): Promise<any> {
  const invoiceType = determineInvoiceType(extracted);

  const taxSummary = extracted.tax_summary || {};

  // Build invoice record
  const invoiceData: any = {
    document_id: documentId,
    client_id: clientId,
    accountant_id: accountantId,
    invoice_type: invoiceType,
    invoice_number: extracted.invoice_number || `AUTO-${Date.now()}`,
    invoice_date: extracted.invoice_date || new Date().toISOString().split('T')[0],
    due_date: extracted.due_date || null,
    vendor_name: extracted.vendor?.legal_name || null,
    vendor_gstin: extracted.vendor?.gstin || null,
    vendor_address: extracted.vendor?.address || null,
    customer_name: extracted.customer?.legal_name || null,
    customer_gstin: extracted.customer?.gstin || null,
    customer_address: extracted.customer?.address || null,
    line_items: extracted.line_items || [],
    subtotal: taxSummary.subtotal || 0,
    cgst: taxSummary.total_cgst || 0,
    sgst: taxSummary.total_sgst || 0,
    igst: taxSummary.total_igst || 0,
    cess: taxSummary.total_cess || 0,
    total_amount: taxSummary.grand_total || 0,
    payment_status: 'unpaid',
    payment_terms: extracted.payment_terms || null,
    notes: extracted.notes || null,
    // Auto-generate journal entry if confidence is high
    auto_generated: overallConfidence >= 0.95,
  };

  // Insert invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert(invoiceData)
    .select()
    .single();

  if (invoiceError) {
    console.error('Error creating invoice:', invoiceError);
    throw invoiceError;
  }

  console.log(`✅ Invoice created: ${invoice.id}, type: ${invoiceType}, auto_generated: ${invoiceData.auto_generated}`);

  // Update document with invoice reference
  await supabase
    .from('documents')
    .update({
      status: 'completed',
      extracted_data: {
        ...extracted,
        invoice_id: invoice.id,
        invoice_type: invoiceType,
      },
    })
    .eq('id', documentId);

  return invoice;
}

/**
 * Main handler
 */
serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: JSON_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: JSON_HEADERS }
    );
  }

  try {
    const body = await req.json() as {
      documentId: string;
      extractedData: ExtractedInvoice;
      clientId: string;
      accountantId?: string;
      overallConfidence?: number;
    };

    if (!body.documentId || !body.extractedData || !body.clientId) {
      return new Response(
        JSON.stringify({ error: "documentId, extractedData, and clientId are required" }),
        { status: 400, headers: JSON_HEADERS }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Supabase configuration missing" }),
        { status: 500, headers: JSON_HEADERS }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });

    console.log(`📄 Creating invoice from extraction for document ${body.documentId}`);

    const invoice = await createInvoiceRecord(
      supabase,
      body.documentId,
      body.clientId,
      body.accountantId,
      body.extractedData,
      body.overallConfidence || 0
    );

    return new Response(
      JSON.stringify({
        success: true,
        invoice,
        message: invoice.auto_generated
          ? 'Invoice created and journal entry auto-generated'
          : 'Invoice created, awaiting manual review before journal entry',
      }),
      { status: 200, headers: JSON_HEADERS }
    );

  } catch (error) {
    console.error('❌ Error creating invoice:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: JSON_HEADERS }
    );
  }
});
