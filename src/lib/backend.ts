// Backend helper to call server endpoints (Supabase Edge Functions or any server)
// Falls back to local simulation when backend is not configured.

import { simulateProcessing, type ExtractedInvoice, type SuggestedRecord } from "@/lib/processing";

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
  // Fallback: local simulation
  return simulateProcessing(doc.file_name);
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
