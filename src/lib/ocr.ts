// OCR and Document Processing utilities

export interface ExtractedInvoiceData {
  invoice_number: string;
  invoice_date: string;
  due_date?: string;
  vendor_name: string;
  vendor_gstin?: string;
  vendor_address?: string;
  customer_name: string;
  customer_gstin?: string;
  customer_address?: string;
  line_items: InvoiceLineItem[];
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  total_amount: number;
  payment_terms?: string;
  bank_details?: string;
}

export interface InvoiceLineItem {
  description: string;
  hsn_code?: string;
  quantity: number;
  rate: number;
  amount: number;
  gst_rate?: number;
}

export interface ExtractedKYCData {
  document_type: string;
  name?: string;
  pan_number?: string;
  aadhaar_number?: string;
  gstin?: string;
  date_of_birth?: string;
  address?: string;
  registration_date?: string;
  company_name?: string;
  cin?: string;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
}

/**
 * Simulate OCR processing (In production, this would call Google Vision API / AWS Textract)
 */
export async function simulateOCR(fileContent: string): Promise<string> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Return mock OCR text
  return `
    INVOICE
    Invoice No: INV-2024-001
    Date: ${new Date().toLocaleDateString('en-IN')}
    
    From: ABC Enterprises
    GSTIN: 27AABCU9603R1ZM
    Address: Mumbai, Maharashtra
    
    To: XYZ Corporation
    GSTIN: 29AABCU9603R1ZV
    
    Description              Qty    Rate    Amount
    Office Supplies          10     500     5,000
    Printing Services        5      1,000   5,000
    
    Subtotal: ₹10,000
    CGST @ 9%: ₹900
    SGST @ 9%: ₹900
    Total: ₹11,800
  `;
}

/**
 * Extract invoice data from OCR text using pattern matching
 * In production, this would use LLM (GPT-4/Claude) for better accuracy
 */
export function extractInvoiceData(ocrText: string): ExtractedInvoiceData {
  // Simple regex-based extraction (production would use LLM)
  const invoiceNumberMatch = ocrText.match(/Invoice\s*No[:\s]+([A-Z0-9-]+)/i);
  const dateMatch = ocrText.match(/Date[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
  const totalMatch = ocrText.match(/Total[:\s]+₹?\s*([0-9,]+(?:\.\d{2})?)/i);
  const gstinMatches = ocrText.match(/GSTIN[:\s]+([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})/gi);
  
  return {
    invoice_number: invoiceNumberMatch ? invoiceNumberMatch[1] : `INV-${Date.now()}`,
    invoice_date: dateMatch ? formatDate(dateMatch[1]) : new Date().toISOString().split('T')[0],
    vendor_name: 'Extracted Vendor',
    vendor_gstin: gstinMatches && gstinMatches[0] ? gstinMatches[0].replace('GSTIN:', '').trim() : undefined,
    customer_name: 'Extracted Customer',
    customer_gstin: gstinMatches && gstinMatches[1] ? gstinMatches[1].replace('GSTIN:', '').trim() : undefined,
    line_items: [{
      description: 'Extracted Item',
      quantity: 1,
      rate: 10000,
      amount: 10000,
      gst_rate: 18
    }],
    subtotal: 10000,
    cgst: 900,
    sgst: 900,
    igst: 0,
    cess: 0,
    total_amount: parseFloat((totalMatch ? totalMatch[1].replace(/,/g, '') : '11800')),
    payment_terms: 'Net 30 days'
  };
}

/**
 * Extract KYC data from OCR text
 */
export function extractKYCData(ocrText: string, documentType: string): ExtractedKYCData {
  const data: ExtractedKYCData = {
    document_type: documentType
  };
  
  // PAN Card extraction
  const panMatch = ocrText.match(/\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/);
  if (panMatch) {
    data.pan_number = panMatch[0];
  }
  
  // Aadhaar extraction
  const aadhaarMatch = ocrText.match(/\b\d{4}\s?\d{4}\s?\d{4}\b/);
  if (aadhaarMatch) {
    data.aadhaar_number = aadhaarMatch[0].replace(/\s/g, '');
  }
  
  // GSTIN extraction
  const gstinMatch = ocrText.match(/\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b/);
  if (gstinMatch) {
    data.gstin = gstinMatch[0];
  }
  
  // Name extraction (simplified - would use NER in production)
  const nameMatch = ocrText.match(/Name[:\s]+([A-Za-z\s]+)(?:\n|$)/i);
  if (nameMatch) {
    data.name = nameMatch[1].trim();
  }
  
  // DOB extraction
  const dobMatch = ocrText.match(/(?:DOB|Date of Birth)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
  if (dobMatch) {
    data.date_of_birth = formatDate(dobMatch[1]);
  }
  
  // Address extraction (simplified)
  const addressMatch = ocrText.match(/Address[:\s]+([^\n]+(?:\n[^\n]+){0,2})/i);
  if (addressMatch) {
    data.address = addressMatch[1].trim();
  }
  
  return data;
}

/**
 * Classify document type from filename and content
 * In production, this would use an LLM or trained classifier
 */
export function classifyDocument(filename: string, ocrText: string): string {
  const lowerFilename = filename.toLowerCase();
  const lowerText = ocrText.toLowerCase();
  
  if (lowerFilename.includes('pan') || lowerText.includes('permanent account number')) {
    return 'kyc_pan';
  }
  if (lowerFilename.includes('aadhaar') || lowerText.includes('aadhaar')) {
    return 'kyc_aadhaar';
  }
  if (lowerFilename.includes('gst') || lowerText.includes('gstin') || lowerText.includes('gst certificate')) {
    return 'kyc_gst_certificate';
  }
  if (lowerFilename.includes('invoice') || lowerText.includes('invoice') || lowerText.includes('tax invoice')) {
    return 'invoice_sales';
  }
  if (lowerFilename.includes('purchase') || lowerFilename.includes('bill')) {
    return 'invoice_purchase';
  }
  if (lowerFilename.includes('statement') || lowerText.includes('bank statement')) {
    return 'bank_statement';
  }
  if (lowerFilename.includes('receipt')) {
    return 'receipt';
  }
  if (lowerFilename.includes('cheque')) {
    return 'kyc_cancelled_cheque';
  }
  
  return 'other';
}

/**
 * Calculate confidence score for OCR extraction
 */
export function calculateConfidenceScore(data: any): number {
  let score = 0;
  let fields = 0;
  
  Object.entries(data).forEach(([key, value]) => {
    fields++;
    if (value !== null && value !== undefined && value !== '') {
      score++;
    }
  });
  
  return fields > 0 ? score / fields : 0;
}

/**
 * Validate extracted invoice data
 */
export function validateInvoiceData(data: ExtractedInvoiceData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data.invoice_number) {
    errors.push('Invoice number is required');
  }
  if (!data.invoice_date) {
    errors.push('Invoice date is required');
  }
  if (!data.vendor_name) {
    errors.push('Vendor name is required');
  }
  if (!data.customer_name) {
    errors.push('Customer name is required');
  }
  if (data.line_items.length === 0) {
    errors.push('At least one line item is required');
  }
  if (data.total_amount <= 0) {
    errors.push('Total amount must be greater than zero');
  }
  
  // Validate GSTIN format if provided
  if (data.vendor_gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(data.vendor_gstin)) {
    errors.push('Invalid vendor GSTIN format');
  }
  if (data.customer_gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(data.customer_gstin)) {
    errors.push('Invalid customer GSTIN format');
  }
  
  // Validate tax calculation
  const calculatedTotal = data.subtotal + data.cgst + data.sgst + data.igst + data.cess;
  if (Math.abs(calculatedTotal - data.total_amount) > 1) {
    errors.push('Tax calculation mismatch');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Format date string to ISO format
 */
function formatDate(dateStr: string): string {
  try {
    const parts = dateStr.split(/[\/\-]/);
    if (parts.length === 3) {
      // Assume DD/MM/YYYY or DD-MM-YYYY
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const year = parseInt(parts[2]);
      const fullYear = year < 100 ? 2000 + year : year;
      return new Date(fullYear, month, day).toISOString().split('T')[0];
    }
  } catch (e) {
    console.error('Date parsing error:', e);
  }
  return new Date().toISOString().split('T')[0];
}

/**
 * Enhance image quality before OCR
 * In production, this would use image processing libraries
 */
export async function enhanceImage(file: File): Promise<File> {
  // Placeholder for image enhancement
  // In production: adjust contrast, denoise, deskew, etc.
  return file;
}

/**
 * Detect if document is handwritten
 * Returns confidence score
 */
export function detectHandwriting(ocrText: string): number {
  // Simplified detection
  // In production, use ML model for handwriting detection
  const lowConfidenceIndicators = [
    'unclear',
    'illegible', 
    'handwritten',
    '?',
    '[unclear]'
  ];
  
  let score = 0;
  lowConfidenceIndicators.forEach(indicator => {
    if (ocrText.toLowerCase().includes(indicator)) {
      score += 0.2;
    }
  });
  
  return Math.min(score, 1);
}

/**
 * Extract table data from OCR text
 */
export function extractTableData(ocrText: string): string[][] {
  // Simple table extraction based on line spacing
  const lines = ocrText.split('\n');
  const table: string[][] = [];
  
  lines.forEach(line => {
    const cells = line.split(/\s{2,}|\t/).filter(cell => cell.trim());
    if (cells.length > 1) {
      table.push(cells);
    }
  });
  
  return table;
}

/**
 * Suggest expense category based on description
 */
export function suggestExpenseCategory(description: string): string {
  const lowerDesc = description.toLowerCase();
  
  const categories: { [key: string]: string[] } = {
    'Office Supplies': ['stationery', 'paper', 'pen', 'office supplies', 'printer', 'toner'],
    'Travel & Conveyance': ['uber', 'ola', 'taxi', 'fuel', 'petrol', 'travel', 'flight', 'hotel'],
    'Utilities': ['electricity', 'water', 'internet', 'broadband', 'phone', 'airtel', 'jio'],
    'Rent': ['rent', 'lease', 'rental'],
    'Salary': ['salary', 'wages', 'payroll', 'compensation'],
    'Marketing': ['advertising', 'marketing', 'promotion', 'google ads', 'facebook ads'],
    'Professional Fees': ['legal', 'consultant', 'professional', 'audit', 'accounting'],
    'Maintenance': ['maintenance', 'repair', 'service'],
    'Insurance': ['insurance', 'premium'],
    'Software': ['software', 'subscription', 'saas', 'microsoft', 'adobe']
  };
  
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => lowerDesc.includes(keyword))) {
      return category;
    }
  }
  
  return 'Other Expenses';
}


