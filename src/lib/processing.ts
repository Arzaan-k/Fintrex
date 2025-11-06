// Simulated OCR + LLM processing for invoices and documents
// Returns extracted structured data and a suggested financial record

export type ExtractedInvoice = {
  invoiceNumber: string | null;
  invoiceDate: string | null; // ISO date string
  vendor: { name: string | null; gstin: string | null; address?: string | null };
  customer: { name: string | null; gstin: string | null; address?: string | null };
  lineItems: Array<{ description: string; quantity: number; rate: number; amount: number; hsn?: string | null }>;
  tax: { cgst: number; sgst: number; igst: number; totalTax: number };
  totalAmount: number;
  currency: string;
  confidence: number; // 0..1
};

export type SuggestedRecord = {
  record_type: 'income' | 'expense' | 'asset' | 'liability';
  amount: number;
  description: string;
  category: string;
  transaction_date: string; // YYYY-MM-DD
};

export function simulateProcessing(fileName: string): { extracted: ExtractedInvoice; suggestion: SuggestedRecord } {
  // Very naive inference based on filename keywords
  const lower = fileName.toLowerCase();
  const isPurchase = lower.includes('purchase') || lower.includes('bill');
  const isSales = lower.includes('sale') || lower.includes('invoice');

  const baseAmount = 5000 + Math.floor(Math.random() * 45000);
  const cgst = isSales || isPurchase ? Math.round(baseAmount * 0.09) : 0;
  const sgst = isSales || isPurchase ? Math.round(baseAmount * 0.09) : 0;
  const igst = 0;
  const total = baseAmount + cgst + sgst + igst;

  const today = new Date();
  const isoDate = today.toISOString().slice(0, 10);

  const extracted: ExtractedInvoice = {
    invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
    invoiceDate: isoDate,
    vendor: { name: isPurchase ? 'ABC Supplies' : 'Your Company', gstin: '27ABCDE1234F1Z5', address: '123 Business Street, Pune' },
    customer: { name: isSales ? 'XYZ Retail' : 'Your Company', gstin: '27ABCDE1234F1Z5', address: '789 Corporate Avenue, Mumbai' },
    lineItems: [
      { description: 'Goods / Services', quantity: 1, rate: baseAmount, amount: baseAmount, hsn: '9997' },
    ],
    tax: { cgst, sgst, igst, totalTax: cgst + sgst + igst },
    totalAmount: total,
    currency: 'INR',
    confidence: 0.92,
  };

  const suggestion: SuggestedRecord = {
    record_type: isSales ? 'income' : 'expense',
    amount: total,
    description: isSales ? 'Sales invoice processed' : 'Purchase bill processed',
    category: isSales ? 'Sales' : 'Office Expenses',
    transaction_date: isoDate,
  };

  return { extracted, suggestion };
}
