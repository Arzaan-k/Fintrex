// VALIDATION ENGINE FOR INDIAN GST INVOICES
// Implements 6 critical validation rules for accuracy and compliance

export interface ValidationRule {
  name: string;
  check: (invoice: any) => ValidationResult;
  severity: 'critical' | 'warning' | 'info';
  description: string;
}

export interface ValidationResult {
  valid: boolean;
  message?: string;
  details?: any;
}

export interface ValidationReport {
  valid: boolean;
  overall_score: number;
  rules_passed: number;
  rules_failed: number;
  critical_errors: ValidationError[];
  warnings: ValidationError[];
  info_messages: ValidationError[];
  validation_details: Record<string, ValidationResult>;
}

export interface ValidationError {
  rule: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  field?: string;
}

/**
 * RULE 1: GSTIN Format and Checksum Validation
 */
export const GSTIN_VALIDATION_RULE: ValidationRule = {
  name: 'GSTIN Format and Checksum',
  severity: 'critical',
  description: 'Validates GSTIN format and checksum digit',
  check: (invoice) => {
    const errors: string[] = [];

    // Validate vendor GSTIN
    if (invoice.vendor?.gstin) {
      const vendorValidation = validateGSTIN(invoice.vendor.gstin);
      if (!vendorValidation.valid) {
        errors.push(`Vendor GSTIN: ${vendorValidation.message}`);
      }
    } else {
      errors.push('Vendor GSTIN is missing');
    }

    // Validate customer GSTIN (if B2B)
    if (invoice.customer?.gstin) {
      const customerValidation = validateGSTIN(invoice.customer.gstin);
      if (!customerValidation.valid) {
        errors.push(`Customer GSTIN: ${customerValidation.message}`);
      }
    }

    return {
      valid: errors.length === 0,
      message: errors.length > 0 ? errors.join('; ') : 'GSTIN validation passed',
      details: { errors }
    };
  }
};

/**
 * RULE 2: Intra-State Tax Logic (CGST = SGST)
 */
export const INTRA_STATE_TAX_RULE: ValidationRule = {
  name: 'Intra-State Tax Logic',
  severity: 'critical',
  description: 'For intra-state transactions, CGST must equal SGST',
  check: (invoice) => {
    const vendorState = invoice.vendor?.state_code || extractStateFromGSTIN(invoice.vendor?.gstin);
    const customerState = invoice.customer?.state_code || extractStateFromGSTIN(invoice.customer?.gstin);

    // Only check if both states are available
    if (!vendorState || !customerState) {
      return { valid: true, message: 'State codes not available for validation' };
    }

    const isIntraState = vendorState === customerState;
    const cgst = invoice.tax_summary?.total_cgst || 0;
    const sgst = invoice.tax_summary?.total_sgst || 0;
    const igst = invoice.tax_summary?.total_igst || 0;

    if (isIntraState) {
      // Intra-state must use CGST + SGST
      if (igst > 0) {
        return {
          valid: false,
          message: `Intra-state transaction (${vendorState}) should not have IGST (₹${igst})`,
        };
      }

      // CGST must equal SGST
      const difference = Math.abs(cgst - sgst);
      if (difference > 0.5) {
        return {
          valid: false,
          message: `CGST (₹${cgst}) must equal SGST (₹${sgst}) for intra-state transactions`,
          details: { cgst, sgst, difference }
        };
      }

      return {
        valid: true,
        message: `Intra-state tax logic valid: CGST = SGST = ₹${cgst.toFixed(2)}`,
      };
    }

    return { valid: true, message: 'Inter-state transaction' };
  }
};

/**
 * RULE 3: Inter-State Tax Logic (IGST only)
 */
export const INTER_STATE_TAX_RULE: ValidationRule = {
  name: 'Inter-State Tax Logic',
  severity: 'critical',
  description: 'For inter-state transactions, only IGST should be used',
  check: (invoice) => {
    const vendorState = invoice.vendor?.state_code || extractStateFromGSTIN(invoice.vendor?.gstin);
    const customerState = invoice.customer?.state_code || extractStateFromGSTIN(invoice.customer?.gstin);

    if (!vendorState || !customerState) {
      return { valid: true, message: 'State codes not available for validation' };
    }

    const isInterState = vendorState !== customerState;
    const cgst = invoice.tax_summary?.total_cgst || 0;
    const sgst = invoice.tax_summary?.total_sgst || 0;
    const igst = invoice.tax_summary?.total_igst || 0;

    if (isInterState) {
      // Inter-state must use IGST only
      if (cgst > 0 || sgst > 0) {
        return {
          valid: false,
          message: `Inter-state transaction (${vendorState} → ${customerState}) should not have CGST (₹${cgst}) or SGST (₹${sgst})`,
        };
      }

      if (igst === 0) {
        return {
          valid: false,
          message: `Inter-state transaction must have IGST, but found ₹0`,
        };
      }

      return {
        valid: true,
        message: `Inter-state tax logic valid: IGST = ₹${igst.toFixed(2)}`,
      };
    }

    return { valid: true, message: 'Intra-state transaction' };
  }
};

/**
 * RULE 4: Tax Calculation Accuracy
 */
export const TAX_CALCULATION_RULE: ValidationRule = {
  name: 'Tax Calculation Accuracy',
  severity: 'critical',
  description: 'Grand total must equal subtotal + all taxes',
  check: (invoice) => {
    const subtotal = invoice.tax_summary?.subtotal || 0;
    const cgst = invoice.tax_summary?.total_cgst || 0;
    const sgst = invoice.tax_summary?.total_sgst || 0;
    const igst = invoice.tax_summary?.total_igst || 0;
    const cess = invoice.tax_summary?.total_cess || 0;
    const tcs = invoice.tax_summary?.tcs || 0;
    const round_off = invoice.tax_summary?.round_off || 0;
    const grand_total = invoice.tax_summary?.grand_total || 0;

    const calculated_total = subtotal + cgst + sgst + igst + cess + tcs + round_off;
    const difference = Math.abs(calculated_total - grand_total);

    // Allow ₹1 difference for rounding
    if (difference > 1) {
      return {
        valid: false,
        message: `Tax calculation mismatch: Calculated ₹${calculated_total.toFixed(2)} vs Grand Total ₹${grand_total.toFixed(2)} (diff: ₹${difference.toFixed(2)})`,
        details: {
          subtotal,
          cgst,
          sgst,
          igst,
          cess,
          tcs,
          round_off,
          calculated_total,
          grand_total,
          difference
        }
      };
    }

    return {
      valid: true,
      message: `Tax calculation accurate: ₹${grand_total.toFixed(2)}`,
      details: { difference: difference.toFixed(2) }
    };
  }
};

/**
 * RULE 5: HSN/SAC Code Validation
 */
export const HSN_CODE_RULE: ValidationRule = {
  name: 'HSN/SAC Code Format',
  severity: 'warning',
  description: 'HSN codes must be 4-8 digits, SAC codes must be 6 digits',
  check: (invoice) => {
    const lineItems = invoice.line_items || [];

    if (lineItems.length === 0) {
      return { valid: false, message: 'No line items found' };
    }

    const invalidCodes: string[] = [];

    for (const item of lineItems) {
      const code = item.hsn_sac_code?.toString().replace(/[^0-9]/g, '');

      if (!code) {
        invalidCodes.push(`Item "${item.description}": Missing HSN/SAC code`);
        continue;
      }

      const length = code.length;

      // HSN: 4, 6, or 8 digits
      // SAC: 6 digits
      if (length < 4 || length > 8 || length === 5 || length === 7) {
        invalidCodes.push(`Item "${item.description}": Invalid code "${item.hsn_sac_code}" (must be 4, 6, or 8 digits)`);
      }
    }

    return {
      valid: invalidCodes.length === 0,
      message: invalidCodes.length > 0
        ? invalidCodes.join('; ')
        : `All ${lineItems.length} HSN/SAC codes valid`,
      details: { invalid_count: invalidCodes.length, total_items: lineItems.length }
    };
  }
};

/**
 * RULE 6: Date Logic Validation
 */
export const DATE_LOGIC_RULE: ValidationRule = {
  name: 'Date Logic Validation',
  severity: 'warning',
  description: 'Invoice date validations',
  check: (invoice) => {
    const errors: string[] = [];
    const invoiceDate = invoice.invoice_date ? new Date(invoice.invoice_date) : null;
    const dueDate = invoice.due_date ? new Date(invoice.due_date) : null;
    const today = new Date();

    if (!invoiceDate) {
      return { valid: false, message: 'Invoice date is missing' };
    }

    // Check if invoice date is not in future
    if (invoiceDate > today) {
      errors.push('Invoice date cannot be in the future');
    }

    // Check if invoice date is not too old (more than 1 year)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);
    if (invoiceDate < oneYearAgo) {
      errors.push(`Invoice date is more than 1 year old (${invoice.invoice_date})`);
    }

    // Check due date logic
    if (dueDate) {
      if (dueDate < invoiceDate) {
        errors.push('Due date cannot be before invoice date');
      }

      // Check if due date is reasonable (within 6 months)
      const sixMonthsLater = new Date(invoiceDate);
      sixMonthsLater.setMonth(invoiceDate.getMonth() + 6);
      if (dueDate > sixMonthsLater) {
        errors.push('Due date is more than 6 months after invoice date');
      }
    }

    return {
      valid: errors.length === 0,
      message: errors.length > 0 ? errors.join('; ') : 'Date logic valid',
      details: { errors }
    };
  }
};

/**
 * Additional Rule: B2B Transaction Validation
 */
export const B2B_VALIDATION_RULE: ValidationRule = {
  name: 'B2B Transaction Validation',
  severity: 'info',
  description: 'B2B transactions validation',
  check: (invoice) => {
    const grandTotal = invoice.tax_summary?.grand_total || 0;
    const customerGSTIN = invoice.customer?.gstin;

    // For transactions above ₹2.5L, customer GSTIN is required (B2B)
    if (grandTotal > 250000 && !customerGSTIN) {
      return {
        valid: false,
        message: `Transactions above ₹2.5L require customer GSTIN (B2B). Found: ₹${grandTotal.toLocaleString('en-IN')}`,
      };
    }

    // Check if classified correctly
    const hasCustomerGSTIN = Boolean(customerGSTIN);
    const classification = invoice.transaction_classification;

    if (classification) {
      if (hasCustomerGSTIN && classification.is_b2c) {
        return {
          valid: false,
          message: 'Invoice has customer GSTIN but classified as B2C',
        };
      }

      if (!hasCustomerGSTIN && classification.is_b2b) {
        return {
          valid: false,
          message: 'Invoice has no customer GSTIN but classified as B2B',
        };
      }
    }

    return {
      valid: true,
      message: hasCustomerGSTIN ? 'B2B transaction' : 'B2C transaction',
    };
  }
};

/**
 * All validation rules
 */
export const ALL_VALIDATION_RULES: ValidationRule[] = [
  GSTIN_VALIDATION_RULE,
  INTRA_STATE_TAX_RULE,
  INTER_STATE_TAX_RULE,
  TAX_CALCULATION_RULE,
  HSN_CODE_RULE,
  DATE_LOGIC_RULE,
  B2B_VALIDATION_RULE,
];

/**
 * Run all validations on an invoice
 */
export function validateInvoice(invoice: any): ValidationReport {
  const results: Record<string, ValidationResult> = {};
  const critical_errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const info_messages: ValidationError[] = [];

  let rules_passed = 0;
  let rules_failed = 0;

  for (const rule of ALL_VALIDATION_RULES) {
    const result = rule.check(invoice);
    results[rule.name] = result;

    if (result.valid) {
      rules_passed++;
    } else {
      rules_failed++;

      const error: ValidationError = {
        rule: rule.name,
        severity: rule.severity,
        message: result.message || 'Validation failed',
      };

      if (rule.severity === 'critical') {
        critical_errors.push(error);
      } else if (rule.severity === 'warning') {
        warnings.push(error);
      } else {
        info_messages.push(error);
      }
    }
  }

  const total_rules = ALL_VALIDATION_RULES.length;
  const overall_score = rules_passed / total_rules;

  return {
    valid: critical_errors.length === 0,
    overall_score,
    rules_passed,
    rules_failed,
    critical_errors,
    warnings,
    info_messages,
    validation_details: results,
  };
}

/**
 * Helper: Validate GSTIN format and checksum
 */
export function validateGSTIN(gstin: string): ValidationResult {
  if (!gstin) {
    return { valid: false, message: 'GSTIN is empty' };
  }

  // Remove spaces and convert to uppercase
  const cleanGSTIN = gstin.replace(/\s/g, '').toUpperCase();

  // Format validation: 15 characters
  if (cleanGSTIN.length !== 15) {
    return { valid: false, message: `Invalid length: ${cleanGSTIN.length} (must be 15)` };
  }

  // Pattern validation: [0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}
  const pattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!pattern.test(cleanGSTIN)) {
    return { valid: false, message: 'Invalid GSTIN format' };
  }

  // State code validation (01-37)
  const stateCode = parseInt(cleanGSTIN.substring(0, 2));
  if (stateCode < 1 || stateCode > 37) {
    return { valid: false, message: `Invalid state code: ${stateCode}` };
  }

  // Checksum validation
  const checksumValid = validateGSTINChecksum(cleanGSTIN);
  if (!checksumValid) {
    return { valid: false, message: 'Invalid checksum digit' };
  }

  return { valid: true, message: 'GSTIN valid' };
}

/**
 * Helper: Validate GSTIN checksum digit
 */
function validateGSTINChecksum(gstin: string): boolean {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const checksum = gstin[14];

  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const value = chars.indexOf(gstin[i]);
    if (value === -1) return false;

    const factor = (i % 2 === 0) ? 1 : 2;
    let product = value * factor;

    if (product > 9) {
      product = Math.floor(product / 10) + (product % 10);
    }

    sum += product;
  }

  const calculatedChecksum = (10 - (sum % 10)) % 10;
  return chars[calculatedChecksum] === checksum;
}

/**
 * Helper: Extract state code from GSTIN
 */
function extractStateFromGSTIN(gstin?: string): string | null {
  if (!gstin || gstin.length < 2) return null;
  return gstin.substring(0, 2);
}

/**
 * Get validation summary for display
 */
export function getValidationSummary(report: ValidationReport): string {
  if (report.valid) {
    return `✅ All validations passed (${report.rules_passed}/${report.rules_passed + report.rules_failed})`;
  }

  const parts: string[] = [];

  if (report.critical_errors.length > 0) {
    parts.push(`❌ ${report.critical_errors.length} critical error(s)`);
  }

  if (report.warnings.length > 0) {
    parts.push(`⚠️ ${report.warnings.length} warning(s)`);
  }

  return parts.join(', ');
}

/**
 * Check if invoice needs review based on validation
 */
export function needsReviewDueToValidation(report: ValidationReport): boolean {
  // Needs review if any critical errors
  if (report.critical_errors.length > 0) {
    return true;
  }

  // Needs review if more than 2 warnings
  if (report.warnings.length > 2) {
    return true;
  }

  // Needs review if overall score < 80%
  if (report.overall_score < 0.8) {
    return true;
  }

  return false;
}
