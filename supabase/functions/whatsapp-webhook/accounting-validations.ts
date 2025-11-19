// Accounting-specific validation functions
// Professional validations as per Indian accounting standards and GST regulations

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface InvoiceData {
  invoice_number?: string;
  invoice_date?: string;
  vendor_name?: string;
  vendor_gstin?: string;
  customer_gstin?: string;
  line_items?: any[];
  subtotal?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  cess?: number;
  grand_total?: number;
  place_of_supply?: string;
}

/**
 * Validate GSTIN format as per Indian GST standards
 * Format: 22AAAAA0000A1Z5
 * - First 2 digits: State code (01-37)
 * - Next 10 characters: PAN
 * - 13th character: Entity number (1-9, A-Z)
 * - 14th character: Z (default)
 * - 15th character: Check digit
 */
export function validateGSTIN(gstin: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!gstin) {
    return { isValid: false, errors: ['GSTIN is required'], warnings: [] };
  }

  const gstinPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

  if (!gstinPattern.test(gstin)) {
    errors.push(`Invalid GSTIN format: ${gstin}. Expected format: 22AAAAA0000A1Z5`);
  }

  // Validate state code
  const stateCode = parseInt(gstin.substring(0, 2));
  if (stateCode < 1 || stateCode > 37) {
    errors.push(`Invalid state code in GSTIN: ${stateCode}`);
  }

  // Validate PAN format within GSTIN
  const panPart = gstin.substring(2, 12);
  const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  if (!panPattern.test(panPart)) {
    errors.push('Invalid PAN format within GSTIN');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate PAN format
 * Format: ABCDE1234F
 * - First 3 characters: Alphabetic series (AAA to ZZZ)
 * - 4th character: Type of holder (C, P, H, F, A, T, B, L, J, G)
 * - 5th character: First character of surname/name
 * - Next 4 characters: Sequential number (0001 to 9999)
 * - Last character: Alphabetic check digit
 */
export function validatePAN(pan: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!pan) {
    return { isValid: false, errors: ['PAN is required'], warnings: [] };
  }

  const panPattern = /^[A-Z]{3}[CPHTFABLJ][A-Z][0-9]{4}[A-Z]$/;

  if (!panPattern.test(pan)) {
    errors.push(`Invalid PAN format: ${pan}. Expected format: ABCDE1234F`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate HSN/SAC code
 * HSN: 4, 6, or 8 digits for goods
 * SAC: 6 digits for services
 */
export function validateHSNSAC(code: string, type: 'HSN' | 'SAC' = 'HSN'): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!code) {
    warnings.push(`${type} code is missing`);
    return { isValid: true, errors: [], warnings };
  }

  const cleanCode = code.replace(/\s/g, '');

  if (type === 'HSN') {
    if (!/^[0-9]{4}$|^[0-9]{6}$|^[0-9]{8}$/.test(cleanCode)) {
      errors.push(`Invalid HSN code: ${code}. Must be 4, 6, or 8 digits`);
    }
  } else {
    if (!/^[0-9]{6}$/.test(cleanCode)) {
      errors.push(`Invalid SAC code: ${code}. Must be 6 digits`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate GST tax calculation
 * Ensures CGST + SGST = IGST logic is maintained
 * Validates that tax percentages are standard GST rates (5%, 12%, 18%, 28%)
 */
export function validateGSTCalculation(invoiceData: InvoiceData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const subtotal = invoiceData.subtotal || 0;
  const cgst = invoiceData.cgst || 0;
  const sgst = invoiceData.sgst || 0;
  const igst = invoiceData.igst || 0;
  const cess = invoiceData.cess || 0;
  const grandTotal = invoiceData.grand_total || 0;

  // Validate mutually exclusive IGST vs CGST+SGST
  if (igst > 0 && (cgst > 0 || sgst > 0)) {
    errors.push('IGST and CGST/SGST cannot both be applied. Use IGST for inter-state or CGST+SGST for intra-state.');
  }

  // Validate CGST = SGST for intra-state
  if (cgst > 0 && sgst > 0) {
    if (Math.abs(cgst - sgst) > 0.01) {
      errors.push(`CGST (₹${cgst}) and SGST (₹${sgst}) must be equal for intra-state supplies`);
    }
  }

  // Validate total calculation
  const calculatedTotal = subtotal + cgst + sgst + igst + cess;
  if (Math.abs(calculatedTotal - grandTotal) > 0.50) {
    warnings.push(
      `Grand total mismatch: Calculated ₹${calculatedTotal.toFixed(2)} vs Stated ₹${grandTotal.toFixed(2)}`
    );
  }

  // Validate GST rates (5%, 12%, 18%, 28%)
  const totalTax = cgst + sgst + igst;
  if (subtotal > 0) {
    const effectiveRate = (totalTax / subtotal) * 100;
    const standardRates = [0, 5, 12, 18, 28];
    const closestRate = standardRates.reduce((prev, curr) =>
      Math.abs(curr - effectiveRate) < Math.abs(prev - effectiveRate) ? curr : prev
    );

    if (Math.abs(effectiveRate - closestRate) > 0.5 && effectiveRate > 0.5) {
      warnings.push(
        `Effective GST rate ${effectiveRate.toFixed(2)}% doesn't match standard rates (5%, 12%, 18%, 28%)`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate invoice number format
 * Checks for sequential numbering and financial year compliance
 */
export function validateInvoiceNumber(invoiceNumber: string, invoiceDate: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!invoiceNumber || invoiceNumber.trim() === '') {
    errors.push('Invoice number is required');
    return { isValid: false, errors, warnings };
  }

  // Check for duplicate slashes (common OCR error)
  if (/\/\//.test(invoiceNumber)) {
    warnings.push('Invoice number contains consecutive slashes - possible OCR error');
  }

  // Check if financial year is mentioned and matches invoice date
  if (invoiceDate) {
    const date = new Date(invoiceDate);
    const invoiceYear = date.getFullYear();
    const invoiceMonth = date.getMonth() + 1; // 0-indexed

    // Financial year in India: April to March
    const financialYearStart = invoiceMonth >= 4 ? invoiceYear : invoiceYear - 1;
    const financialYearEnd = financialYearStart + 1;

    const fyPattern = new RegExp(`(${financialYearStart}|${String(financialYearStart).slice(-2)})`);

    if (!fyPattern.test(invoiceNumber)) {
      warnings.push(
        `Invoice number may not reflect current financial year (FY ${financialYearStart}-${String(financialYearEnd).slice(-2)})`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate invoice date
 * Ensures date is not in future and not too old (beyond 1 year for normal cases)
 */
export function validateInvoiceDate(invoiceDate: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!invoiceDate) {
    errors.push('Invoice date is required');
    return { isValid: false, errors, warnings };
  }

  const date = new Date(invoiceDate);
  const today = new Date();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  if (isNaN(date.getTime())) {
    errors.push(`Invalid invoice date format: ${invoiceDate}`);
    return { isValid: false, errors, warnings };
  }

  // Check if date is in future
  if (date > today) {
    errors.push('Invoice date cannot be in the future');
  }

  // Warn if invoice is very old
  if (date < oneYearAgo) {
    warnings.push('Invoice is more than 1 year old - verify if this is correct');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate line items
 * Ensures proper structure and calculations
 */
export function validateLineItems(lineItems: any[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!lineItems || lineItems.length === 0) {
    errors.push('Invoice must contain at least one line item');
    return { isValid: false, errors, warnings };
  }

  lineItems.forEach((item, index) => {
    const itemNum = index + 1;

    if (!item.description || item.description.trim() === '') {
      errors.push(`Line item ${itemNum}: Description is required`);
    }

    if (item.quantity !== undefined && item.quantity <= 0) {
      errors.push(`Line item ${itemNum}: Quantity must be greater than zero`);
    }

    if (item.rate !== undefined && item.rate < 0) {
      errors.push(`Line item ${itemNum}: Rate cannot be negative`);
    }

    // Validate amount calculation
    if (item.quantity && item.rate && item.amount) {
      const calculatedAmount = item.quantity * item.rate;
      if (Math.abs(calculatedAmount - item.amount) > 0.01) {
        warnings.push(
          `Line item ${itemNum}: Amount mismatch (${item.quantity} × ₹${item.rate} = ₹${calculatedAmount}, but stated as ₹${item.amount})`
        );
      }
    }

    // Check HSN/SAC if provided
    if (item.hsn_code) {
      const hsnValidation = validateHSNSAC(item.hsn_code, 'HSN');
      errors.push(...hsnValidation.errors);
      warnings.push(...hsnValidation.warnings);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Comprehensive invoice validation
 * Master function that runs all validations
 */
export function validateInvoiceData(invoiceData: InvoiceData): ValidationResult {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  // 1. Validate invoice number
  if (invoiceData.invoice_number && invoiceData.invoice_date) {
    const invNumValidation = validateInvoiceNumber(invoiceData.invoice_number, invoiceData.invoice_date);
    allErrors.push(...invNumValidation.errors);
    allWarnings.push(...invNumValidation.warnings);
  }

  // 2. Validate invoice date
  if (invoiceData.invoice_date) {
    const dateValidation = validateInvoiceDate(invoiceData.invoice_date);
    allErrors.push(...dateValidation.errors);
    allWarnings.push(...dateValidation.warnings);
  }

  // 3. Validate vendor GSTIN
  if (invoiceData.vendor_gstin) {
    const vendorGSTValidation = validateGSTIN(invoiceData.vendor_gstin);
    if (!vendorGSTValidation.isValid) {
      allErrors.push(`Vendor GSTIN: ${vendorGSTValidation.errors.join(', ')}`);
    }
  }

  // 4. Validate customer GSTIN
  if (invoiceData.customer_gstin) {
    const customerGSTValidation = validateGSTIN(invoiceData.customer_gstin);
    if (!customerGSTValidation.isValid) {
      allErrors.push(`Customer GSTIN: ${customerGSTValidation.errors.join(', ')}`);
    }
  }

  // 5. Validate GST calculation
  const gstValidation = validateGSTCalculation(invoiceData);
  allErrors.push(...gstValidation.errors);
  allWarnings.push(...gstValidation.warnings);

  // 6. Validate line items
  if (invoiceData.line_items) {
    const lineItemsValidation = validateLineItems(invoiceData.line_items);
    allErrors.push(...lineItemsValidation.errors);
    allWarnings.push(...lineItemsValidation.warnings);
  }

  // 7. Business logic validations
  if (!invoiceData.vendor_name) {
    allErrors.push('Vendor name is required');
  }

  if (!invoiceData.grand_total || invoiceData.grand_total <= 0) {
    allErrors.push('Grand total must be greater than zero');
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings
  };
}

/**
 * Determine place of supply from GSTIN
 * Returns state code from GSTIN
 */
export function extractStateFromGSTIN(gstin: string): string | null {
  if (!gstin || gstin.length < 2) return null;
  const stateCode = gstin.substring(0, 2);

  const stateMap: { [key: string]: string } = {
    '01': 'Jammu and Kashmir',
    '02': 'Himachal Pradesh',
    '03': 'Punjab',
    '04': 'Chandigarh',
    '05': 'Uttarakhand',
    '06': 'Haryana',
    '07': 'Delhi',
    '08': 'Rajasthan',
    '09': 'Uttar Pradesh',
    '10': 'Bihar',
    '11': 'Sikkim',
    '12': 'Arunachal Pradesh',
    '13': 'Nagaland',
    '14': 'Manipur',
    '15': 'Mizoram',
    '16': 'Tripura',
    '17': 'Meghalaya',
    '18': 'Assam',
    '19': 'West Bengal',
    '20': 'Jharkhand',
    '21': 'Odisha',
    '22': 'Chhattisgarh',
    '23': 'Madhya Pradesh',
    '24': 'Gujarat',
    '25': 'Daman and Diu',
    '26': 'Dadra and Nagar Haveli',
    '27': 'Maharashtra',
    '29': 'Karnataka',
    '30': 'Goa',
    '31': 'Lakshadweep',
    '32': 'Kerala',
    '33': 'Tamil Nadu',
    '34': 'Puducherry',
    '35': 'Andaman and Nicobar',
    '36': 'Telangana',
    '37': 'Andhra Pradesh',
  };

  return stateMap[stateCode] || null;
}

/**
 * Calculate accounting confidence score
 * Based on validation results and data completeness
 */
export function calculateAccountingConfidence(invoiceData: InvoiceData, validationResult: ValidationResult): number {
  let confidence = 1.0;

  // Deduct for errors (critical issues)
  confidence -= validationResult.errors.length * 0.15;

  // Deduct for warnings (minor issues)
  confidence -= validationResult.warnings.length * 0.05;

  // Deduct for missing critical fields
  if (!invoiceData.invoice_number) confidence -= 0.10;
  if (!invoiceData.invoice_date) confidence -= 0.10;
  if (!invoiceData.vendor_name) confidence -= 0.10;
  if (!invoiceData.vendor_gstin) confidence -= 0.05;
  if (!invoiceData.grand_total) confidence -= 0.10;

  // Bonus for complete line items
  if (invoiceData.line_items && invoiceData.line_items.length > 0) {
    const completeItems = invoiceData.line_items.filter(
      item => item.description && item.quantity && item.rate && item.amount
    );
    const completeness = completeItems.length / invoiceData.line_items.length;
    confidence += completeness * 0.05;
  }

  // Ensure confidence stays between 0 and 1
  return Math.max(0, Math.min(1, confidence));
}
