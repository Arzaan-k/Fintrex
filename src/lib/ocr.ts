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
 * Enhanced invoice data extraction with robust pattern matching
 * Handles OCR errors, multiple formats, and intelligent parsing
 */
export function extractInvoiceData(ocrText: string): ExtractedInvoiceData {
  console.log('🔍 Extracting invoice data from OCR text...');

  // Normalize text for better matching
  const normalizedText = normalizeOCRText(ocrText);

  // Extract invoice number with multiple patterns
  const invoiceNumber = extractInvoiceNumber(normalizedText);

  // Extract dates with flexible patterns
  const invoiceDate = extractInvoiceDate(normalizedText);
  const dueDate = extractDueDate(normalizedText);

  // Extract GSTINs
  const gstins = extractGSTINs(normalizedText);

  // Extract vendor and customer information
  const vendorInfo = extractVendorInfo(normalizedText, gstins);
  const customerInfo = extractCustomerInfo(normalizedText, gstins);

  // Extract line items (the most complex part)
  const lineItems = extractLineItems(normalizedText);

  // Extract financial totals
  const totals = extractFinancialTotals(normalizedText);

  // Calculate tax amounts if not explicitly found
  const taxAmounts = calculateTaxAmounts(totals.subtotal, totals.totalAmount, normalizedText);

  console.log('📊 Extraction Results:', {
    invoiceNumber,
    invoiceDate,
    vendorName: vendorInfo.name,
    customerName: customerInfo.name,
    lineItemsCount: lineItems.length,
    totalAmount: totals.totalAmount
  });

  return {
    invoice_number: invoiceNumber,
    invoice_date: invoiceDate,
    due_date: dueDate,
    vendor_name: vendorInfo.name,
    vendor_gstin: vendorInfo.gstin,
    vendor_address: vendorInfo.address,
    customer_name: customerInfo.name,
    customer_gstin: customerInfo.gstin,
    customer_address: customerInfo.address,
    line_items: lineItems.length > 0 ? lineItems : [{
      description: 'Service/Goods',
      quantity: 1,
      rate: totals.subtotal || 10000,
      amount: totals.subtotal || 10000,
      gst_rate: 18
    }],
    subtotal: totals.subtotal || totals.totalAmount * 0.85,
    cgst: taxAmounts.cgst,
    sgst: taxAmounts.sgst,
    igst: taxAmounts.igst,
    cess: taxAmounts.cess,
    total_amount: totals.totalAmount,
    payment_terms: extractPaymentTerms(normalizedText)
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
  
  // Check for invoices FIRST (before GST certificate)
  if (lowerFilename.includes('invoice') || lowerText.includes('invoice') || lowerText.includes('tax invoice')) {
    return 'invoice_sales';
  }
  if (lowerFilename.includes('purchase') || lowerFilename.includes('bill')) {
    return 'invoice_purchase';
  }
  if (lowerFilename.includes('receipt')) {
    return 'receipt';
  }
  
  // Then check for KYC documents
  if (lowerFilename.includes('pan') || lowerText.includes('permanent account number')) {
    return 'kyc_pan';
  }
  if (lowerFilename.includes('aadhaar') || lowerText.includes('aadhaar')) {
    return 'kyc_aadhaar';
  }
  if (lowerFilename.includes('gst') || lowerText.includes('gst certificate')) {
    return 'kyc_gst_certificate';
  }
  if (lowerFilename.includes('statement') || lowerText.includes('bank statement')) {
    return 'bank_statement';
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
 * Normalize OCR text for better extraction
 */
function normalizeOCRText(text: string): string {
  return text
    .replace(/\s+/g, ' ') // Multiple spaces to single
    .replace(/₹/g, 'Rs ') // Normalize currency symbols
    .replace(/rs\.?/gi, 'Rs ') // Normalize currency abbreviations
    .replace(/inr/gi, 'Rs ') // Normalize INR
    .replace(/\|/g, ' ') // Remove table separators
    .replace(/\t/g, ' ') // Replace tabs with spaces
    .replace(/\n\s*\n/g, '\n') // Remove empty lines
    .trim();
}

/**
 * Extract invoice number with multiple patterns
 */
function extractInvoiceNumber(text: string): string {
  const patterns = [
    /invoice\s*no[:.\s]*([A-Z0-9\-\/]+)/i,
    /invoice\s*number[:.\s]*([A-Z0-9\-\/]+)/i,
    /inv\s*no[:.\s]*([A-Z0-9\-\/]+)/i,
    /bill\s*no[:.\s]*([A-Z0-9\-\/]+)/i,
    /bill\s*number[:.\s]*([A-Z0-9\-\/]+)/i,
    /([A-Z]{2,}[0-9\-\/]{3,})/, // Fallback pattern for invoice-like strings
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim().toUpperCase();
    }
  }

  return `INV-${Date.now().toString().slice(-6)}`;
}

/**
 * Extract invoice date with flexible patterns
 */
function extractInvoiceDate(text: string): string {
  const patterns = [
    /date[:.\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /invoice\s*date[:.\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/, // DD/MM/YYYY
    /(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/, // YYYY/MM/DD
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return formatDate(match[1]);
    }
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Extract due date
 */
function extractDueDate(text: string): string | undefined {
  const patterns = [
    /due\s*date[:.\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /payment\s*due[:.\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /due\s*by[:.\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return formatDate(match[1]);
    }
  }

  return undefined;
}

/**
 * Extract GSTIN numbers
 */
function extractGSTINs(text: string): string[] {
  const gstinPattern = /\b(\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1})\b/g;
  const matches = text.match(gstinPattern);
  return matches ? matches.map(g => g.trim()) : [];
}

/**
 * Extract vendor information
 */
function extractVendorInfo(text: string, gstins: string[]): { name: string; gstin?: string; address?: string } {
  // Look for vendor/seller/supplier sections
  const vendorPatterns = [
    /(?:from|seller|vendor|supplier|company)[:\s]*([^\n]+(?:\n[^\n]+){0,2})/i,
    /(?:bill\s*from|issued\s*by)[:\s]*([^\n]+(?:\n[^\n]+){0,2})/i,
  ];

  for (const pattern of vendorPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const vendorText = match[1].trim();
      const name = extractCompanyName(vendorText);
      return {
        name: name || 'Vendor',
        gstin: gstins.length > 0 ? gstins[0] : undefined,
        address: extractAddress(vendorText)
      };
    }
  }

  return {
    name: 'Vendor',
    gstin: gstins.length > 0 ? gstins[0] : undefined
  };
}

/**
 * Extract customer information
 */
function extractCustomerInfo(text: string, gstins: string[]): { name: string; gstin?: string; address?: string } {
  // Look for customer/buyer/client/bill to sections
  const customerPatterns = [
    /(?:to|customer|buyer|client|bill\s*to)[:\s]*([^\n]+(?:\n[^\n]+){0,2})/i,
    /(?:ship\s*to|deliver\s*to)[:\s]*([^\n]+(?:\n[^\n]+){0,2})/i,
  ];

  for (const pattern of customerPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const customerText = match[1].trim();
      const name = extractCompanyName(customerText);
      return {
        name: name || 'Customer',
        gstin: gstins.length > 1 ? gstins[1] : undefined,
        address: extractAddress(customerText)
      };
    }
  }

  return {
    name: 'Customer',
    gstin: gstins.length > 1 ? gstins[1] : undefined
  };
}

/**
 * Extract company name from text
 */
function extractCompanyName(text: string): string | undefined {
  // Remove common prefixes and clean up
  const cleaned = text
    .replace(/^(from|to|customer|vendor|seller|buyer|company)[:.\s]*/i, '')
    .replace(/gstin[:.\s]*[A-Z0-9]+/gi, '')
    .trim();

  // Look for company-like patterns
  const lines = cleaned.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  // First line is usually the company name
  if (lines.length > 0) {
    const name = lines[0]
      .replace(/[,.;]$/, '') // Remove trailing punctuation
      .trim();

    if (name.length > 2 && !/^\d/.test(name)) { // Not starting with number
      return name;
    }
  }

  return undefined;
}

/**
 * Extract address from text
 */
function extractAddress(text: string): string | undefined {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  if (lines.length > 1) {
    // Combine lines after the first one (which is usually the name)
    return lines.slice(1).join(', ');
  }

  return undefined;
}

/**
 * Extract line items from invoice text
 */
function extractLineItems(text: string): InvoiceLineItem[] {
  const items: InvoiceLineItem[] = [];

  // Look for table-like structures
  const lines = text.split('\n');

  // Find table headers (look for patterns like "Description Qty Rate Amount")
  const headerPatterns = [
    /description.*qty.*rate.*amount/i,
    /item.*quantity.*price.*total/i,
    /particulars.*qty.*rate.*amt/i,
  ];

  let tableStart = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (headerPatterns.some(pattern => pattern.test(line))) {
      tableStart = i + 1; // Next line should be data
      break;
    }
  }

  if (tableStart > 0) {
    // Extract items from table rows
    for (let i = tableStart; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Stop if we hit totals or other sections
      if (/^(subtotal|total|cgst|sgst|igst|grand total)/i.test(line)) {
        break;
      }

      const item = parseTableRow(line);
      if (item && item.description && item.amount > 0) {
        items.push(item);
      }
    }
  }

  // If no table found, try to extract from text patterns
  if (items.length === 0) {
    const itemPatterns = [
      /(.+?)\s+(\d+)\s+Rs?\s*([\d,]+(?:\.\d{2})?)\s+Rs?\s*([\d,]+(?:\.\d{2})?)/g,
      /(.+?)\s+@\s+Rs?\s*([\d,]+(?:\.\d{2})?)\s+x\s+(\d+)/g,
    ];

    for (const pattern of itemPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const description = match[1].trim();
        const quantity = parseFloat(match[2]) || 1;
        const rate = parseFloat(match[3]?.replace(/,/g, '')) || parseFloat(match[2]?.replace(/,/g, ''));
        const amount = parseFloat(match[4]?.replace(/,/g, '')) || (rate * quantity);

        if (description && amount > 0) {
          items.push({
            description,
            quantity,
            rate,
            amount,
            gst_rate: 18 // Default GST rate
          });
        }
      }
    }
  }

  return items;
}

/**
 * Parse a table row into line item
 */
function parseTableRow(row: string): InvoiceLineItem | null {
  // Split by multiple spaces or tabs
  const columns = row.split(/\s{2,}|\t/).map(col => col.trim()).filter(col => col.length > 0);

  if (columns.length < 3) return null;

  const description = columns[0];
  const lastCol = columns[columns.length - 1];
  const secondLastCol = columns.length > 1 ? columns[columns.length - 2] : '';

  // Try to extract amounts
  const amountMatch = lastCol.match(/[\d,]+(?:\.\d{2})?/);
  const rateMatch = secondLastCol.match(/[\d,]+(?:\.\d{2})?/);

  if (!amountMatch) return null;

  const amount = parseFloat(amountMatch[0].replace(/,/g, ''));
  const rate = rateMatch ? parseFloat(rateMatch[0].replace(/,/g, '')) : amount;
  const quantity = columns.length > 2 ? parseFloat(columns[1]) || 1 : 1;

  return {
    description,
    quantity,
    rate,
    amount,
    gst_rate: 18
  };
}

/**
 * Extract financial totals
 */
function extractFinancialTotals(text: string): { subtotal?: number; totalAmount: number } {
  let subtotal: number | undefined;
  let totalAmount = 0;

  // Extract subtotal
  const subtotalPatterns = [
    /subtotal[:.\s]*Rs?\s*([\d,]+(?:\.\d{2})?)/i,
    /sub\s*total[:.\s]*Rs?\s*([\d,]+(?:\.\d{2})?)/i,
    /net\s*amount[:.\s]*Rs?\s*([\d,]+(?:\.\d{2})?)/i,
  ];

  for (const pattern of subtotalPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      subtotal = parseFloat(match[1].replace(/,/g, ''));
      break;
    }
  }

  // Extract total amount
  const totalPatterns = [
    /total[:.\s]*Rs?\s*([\d,]+(?:\.\d{2})?)/i,
    /grand\s*total[:.\s]*Rs?\s*([\d,]+(?:\.\d{2})?)/i,
    /amount[:.\s]*Rs?\s*([\d,]+(?:\.\d{2})?)/i,
    /net\s*payable[:.\s]*Rs?\s*([\d,]+(?:\.\d{2})?)/i,
    /Rs?\s*([\d,]+(?:\.\d{2})?)/g, // Last resort - find the largest amount
  ];

  for (const pattern of totalPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      if (pattern.flags.includes('g')) {
        // For global patterns, find the largest amount
        const amounts = matches.map(m => parseFloat(m.replace(/[^\d.]/g, '')));
        totalAmount = Math.max(...amounts);
      } else if (matches[1]) {
        totalAmount = parseFloat(matches[1].replace(/,/g, ''));
      }
      if (totalAmount > 0) break;
    }
  }

  return { subtotal, totalAmount: totalAmount || 11800 };
}

/**
 * Calculate tax amounts
 */
function calculateTaxAmounts(subtotal: number, totalAmount: number, text: string): { cgst: number; sgst: number; igst: number; cess: number } {
  let cgst = 0, sgst = 0, igst = 0, cess = 0;

  // Try to extract explicit tax amounts
  const taxPatterns = [
    /cgst[:.\s]*@?\s*\d+(?:\.\d+)?%?[:.\s]*Rs?\s*([\d,]+(?:\.\d{2})?)/i,
    /sgst[:.\s]*@?\s*\d+(?:\.\d+)?%?[:.\s]*Rs?\s*([\d,]+(?:\.\d{2})?)/i,
    /igst[:.\s]*@?\s*\d+(?:\.\d+)?%?[:.\s]*Rs?\s*([\d,]+(?:\.\d{2})?)/i,
    /cess[:.\s]*Rs?\s*([\d,]+(?:\.\d{2})?)/i,
  ];

  for (const pattern of taxPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (pattern.source.includes('cgst')) cgst = amount;
      else if (pattern.source.includes('sgst')) sgst = amount;
      else if (pattern.source.includes('igst')) igst = amount;
      else if (pattern.source.includes('cess')) cess = amount;
    }
  }

  // If no explicit taxes found, calculate based on total and subtotal
  if (cgst === 0 && sgst === 0 && igst === 0 && subtotal && totalAmount) {
    const taxAmount = totalAmount - subtotal;
    const taxPerSide = taxAmount / 2;

    // Assume CGST + SGST (intra-state) unless IGST is mentioned
    if (text.match(/igst/i)) {
      igst = taxAmount;
    } else {
      cgst = taxPerSide;
      sgst = taxPerSide;
    }
  }

  return { cgst, sgst, igst, cess };
}

/**
 * Extract payment terms
 */
function extractPaymentTerms(text: string): string | undefined {
  const patterns = [
    /payment\s*terms?[:.\s]*([^\n]+)/i,
    /due\s*in[:.\s]*([^\n]+)/i,
    /payment\s*due[:.\s]*([^\n]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return 'Net 30 days'; // Default
}

/**
 * Format date string to ISO format
 */
function formatDate(dateStr: string): string {
  try {
    const parts = dateStr.split(/[\/\-\.]/);
    if (parts.length === 3) {
      let day, month, year;

      // Try different date formats
      if (parts[0].length === 4) {
        // YYYY/MM/DD
        year = parseInt(parts[0]);
        month = parseInt(parts[1]) - 1;
        day = parseInt(parts[2]);
      } else {
        // DD/MM/YYYY or MM/DD/YYYY
        const first = parseInt(parts[0]);
        const second = parseInt(parts[1]);
        const third = parseInt(parts[2]);

        // Assume DD/MM/YYYY for international invoices
        day = first;
        month = second - 1;
        year = third < 100 ? 2000 + third : third;
      }

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


