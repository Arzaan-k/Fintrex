// STRUCTURED AI PROMPTS FOR INDIAN INVOICE EXTRACTION
// Designed for maximum accuracy with Indian GST invoices

/**
 * Master prompt for Indian GST invoice extraction
 * Optimized for Gemini 1.5 Flash with structured JSON output
 */
export const INDIAN_INVOICE_EXTRACTION_PROMPT = `You are an expert at extracting data from Indian GST invoices with 100% accuracy.

CRITICAL INSTRUCTIONS:
1. Extract EXACT values as they appear - do not calculate or infer
2. Preserve original formatting (dates, amounts, codes)
3. Return confidence score (0.0-1.0) for each field
4. Mark unclear fields with confidence < 0.95
5. Validate all GSTIN, HSN, and calculation formats

MANDATORY FIELDS TO EXTRACT:

## 1. INVOICE IDENTIFICATION
- invoice_number: Exact invoice/bill number (e.g., "INV-2024-001", "BILL/23-24/145")
- invoice_date: Date in YYYY-MM-DD format
- due_date: Payment due date in YYYY-MM-DD (null if not mentioned)
- invoice_type: "tax_invoice" | "bill_of_supply" | "credit_note" | "debit_note"
- document_type: "sales" | "purchase" (infer from context)

## 2. VENDOR/SELLER DETAILS (Party issuing invoice)
- legal_name: Registered business name (as per GST)
- trade_name: Trading name if different
- gstin: 15-character GSTIN (format: 27ABCDE1234F1Z5)
  * Validate format: [State Code(2)][PAN(10)][Entity(1)][Z][Checksum(1)]
- address: Complete address
- state: State name
- state_code: 2-digit state code (extract from GSTIN first 2 digits)
- pincode: 6-digit PIN code
- phone: Contact number
- email: Email address if present

## 3. CUSTOMER/BUYER DETAILS (Party receiving invoice)
- legal_name: Buyer's name
- gstin: GSTIN for B2B transactions (null for B2C)
- address: Delivery/billing address
- state: State name
- state_code: 2-digit state code
- pincode: 6-digit PIN code
- phone: Contact number if present

## 4. LINE ITEMS (Extract for EACH item/service)
For each line item, extract:
- sr_no: Serial number
- description: Item/service description
- hsn_sac_code: HSN (goods) or SAC (services) code (4-8 digits)
- quantity: Numeric quantity
- unit: Unit of measurement (PCS, KG, LITRE, etc.)
- rate: Price per unit (excluding tax)
- taxable_amount: Amount before GST
- gst_rate: GST percentage (0, 5, 12, 18, 28)
- cgst_rate: Central GST rate (gst_rate / 2 for intra-state)
- cgst_amount: CGST amount in rupees
- sgst_rate: State GST rate (gst_rate / 2 for intra-state)
- sgst_amount: SGST amount in rupees
- igst_rate: Integrated GST rate (gst_rate for inter-state)
- igst_amount: IGST amount in rupees
- cess_amount: Cess if applicable (usually 0)
- total_amount: Total for this line item (taxable + all taxes)

## 5. TAX SUMMARY (Total calculations)
- subtotal: Total taxable amount (before any tax)
- total_cgst: Sum of all CGST amounts
- total_sgst: Sum of all SGST amounts
- total_igst: Sum of all IGST amounts
- total_cess: Sum of all cess amounts
- tcs: Tax Collected at Source (if applicable)
- round_off: Rounding adjustment (+/- amount)
- grand_total: Final payable amount
- amount_in_words: Amount written in words

## 6. TRANSACTION TYPE IDENTIFICATION
Determine transaction type based on GSTIN and state codes:
- If vendor state = customer state: INTRA-STATE (use CGST + SGST)
- If vendor state ≠ customer state: INTER-STATE (use IGST only)
- If customer has no GSTIN: B2C transaction
- If customer has GSTIN: B2B transaction

## 7. VALIDATION RULES
Apply these checks and set confidence accordingly:

### GSTIN Validation
- Format: Exactly 15 characters
- Pattern: [0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}
- State code (first 2 digits) must match the state
- Valid state codes: 01-37 (check against Indian state codes)

### HSN/SAC Validation
- HSN for goods: 4, 6, or 8 digits
- SAC for services: 6 digits
- Must be numeric

### Tax Logic Validation
- Intra-state: CGST + SGST = Total GST, IGST = 0
- Inter-state: IGST = Total GST, CGST = SGST = 0
- CGST must ALWAYS equal SGST (if used)
- GST rates: Only 0, 0.25, 3, 5, 12, 18, 28 are valid

### Calculation Validation
- Line item total = taxable_amount + cgst + sgst + igst + cess
- Grand total = subtotal + total_cgst + total_sgst + total_igst + total_cess + round_off
- Verify totals match (allow ±₹1 for rounding)

## 8. CONFIDENCE SCORING GUIDELINES

Set field_confidence based on:
- 1.0: Field clearly visible and unambiguous
- 0.95-0.99: Minor OCR artifacts but value clear
- 0.85-0.94: Some ambiguity, likely correct
- 0.70-0.84: Uncertain, may need review
- <0.70: Very unclear, definitely needs review

Set overall_confidence as weighted average:
- GSTIN fields: 20% weight
- Tax calculations: 20% weight
- Line items: 25% weight
- Amounts: 20% weight
- Other fields: 15% weight

## OUTPUT FORMAT

Return ONLY valid JSON with this EXACT structure (no markdown, no explanations):

{
  "invoice_number": "string",
  "invoice_date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD or null",
  "invoice_type": "tax_invoice",
  "document_type": "sales or purchase",

  "vendor": {
    "legal_name": "string",
    "trade_name": "string or null",
    "gstin": "27ABCDE1234F1Z5",
    "address": "string",
    "state": "string",
    "state_code": "27",
    "pincode": "400001",
    "phone": "string or null",
    "email": "string or null"
  },

  "customer": {
    "legal_name": "string",
    "gstin": "string or null",
    "address": "string",
    "state": "string",
    "state_code": "27",
    "pincode": "string"
  },

  "line_items": [
    {
      "sr_no": 1,
      "description": "string",
      "hsn_sac_code": "8471",
      "quantity": 10,
      "unit": "PCS",
      "rate": 1000.00,
      "taxable_amount": 10000.00,
      "gst_rate": 18,
      "cgst_rate": 9,
      "cgst_amount": 900.00,
      "sgst_rate": 9,
      "sgst_amount": 900.00,
      "igst_rate": 0,
      "igst_amount": 0,
      "cess_amount": 0,
      "total_amount": 11800.00
    }
  ],

  "tax_summary": {
    "subtotal": 10000.00,
    "total_cgst": 900.00,
    "total_sgst": 900.00,
    "total_igst": 0,
    "total_cess": 0,
    "tcs": 0,
    "round_off": 0,
    "grand_total": 11800.00,
    "amount_in_words": "Rupees Eleven Thousand Eight Hundred Only"
  },

  "transaction_classification": {
    "is_intra_state": true,
    "is_inter_state": false,
    "is_b2b": true,
    "is_b2c": false,
    "is_export": false,
    "requires_ewaybill": false
  },

  "payment_details": {
    "payment_terms": "string or null",
    "bank_name": "string or null",
    "account_number": "string or null",
    "ifsc_code": "string or null",
    "upi_id": "string or null"
  },

  "additional_info": {
    "place_of_supply": "string",
    "reverse_charge": false,
    "transportation_mode": "string or null",
    "vehicle_number": "string or null",
    "irn": "string or null",
    "ack_no": "string or null",
    "ack_date": "string or null"
  },

  "confidence_scores": {
    "invoice_number": 0.98,
    "invoice_date": 1.0,
    "vendor_gstin": 0.95,
    "customer_gstin": 0.90,
    "line_items": 0.92,
    "tax_calculations": 0.95,
    "grand_total": 0.98,
    "overall": 0.94
  },

  "validation_flags": {
    "gstin_format_valid": true,
    "tax_logic_valid": true,
    "calculation_accurate": true,
    "hsn_codes_valid": true,
    "requires_review": false
  },

  "unclear_fields": [
    "List any fields that were unclear or ambiguous"
  ]
}

IMPORTANT NOTES:
- If a field is not present or unclear, use null
- All amounts must be numeric (not strings)
- Dates must be in YYYY-MM-DD format
- For B2C invoices, customer.gstin will be null
- Set requires_review = true if overall confidence < 0.95
- Include ALL line items, do not skip any
- Preserve exact amounts from invoice, do not recalculate
- If you see inter-state transaction, IGST must be populated, CGST/SGST must be 0
- If you see intra-state transaction, CGST and SGST must equal half of total GST each
`;

/**
 * Simplified prompt for quick extraction (when full detail not needed)
 */
export const QUICK_INVOICE_EXTRACTION_PROMPT = `Extract key details from this Indian invoice in JSON format:

{
  "invoice_number": "exact number",
  "invoice_date": "YYYY-MM-DD",
  "vendor_name": "seller name",
  "vendor_gstin": "15-char GSTIN",
  "customer_name": "buyer name",
  "customer_gstin": "15-char GSTIN or null",
  "grand_total": numeric amount,
  "is_intra_state": true/false,
  "confidence": 0.0-1.0
}

Rules:
- GSTIN format: 27ABCDE1234F1Z5 (exactly 15 chars)
- is_intra_state: true if same state, false if different states
- Set confidence < 0.95 if any field unclear`;

/**
 * KYC document extraction prompts
 */
export const PAN_CARD_EXTRACTION_PROMPT = `Extract data from this PAN card in JSON:

{
  "document_type": "pan_card",
  "pan_number": "ABCDE1234F",
  "name": "full name as printed",
  "father_name": "father's name",
  "date_of_birth": "DD/MM/YYYY",
  "confidence": 0.0-1.0
}

PAN format: [A-Z]{5}[0-9]{4}[A-Z]{1} (exactly 10 chars)`;

export const AADHAAR_CARD_EXTRACTION_PROMPT = `Extract data from this Aadhaar card in JSON:

{
  "document_type": "aadhaar_card",
  "aadhaar_number": "1234 5678 9012",
  "name": "full name",
  "date_of_birth": "DD/MM/YYYY",
  "gender": "Male/Female/Transgender",
  "address": "complete address",
  "confidence": 0.0-1.0
}

Aadhaar format: 12 digits with spaces (#### #### ####)`;

export const GST_CERTIFICATE_EXTRACTION_PROMPT = `Extract data from this GST Registration Certificate in JSON:

{
  "document_type": "gst_certificate",
  "gstin": "27ABCDE1234F1Z5",
  "legal_name": "registered business name",
  "trade_name": "trading name if different",
  "registration_date": "DD/MM/YYYY",
  "business_type": "proprietorship/partnership/company",
  "principal_place_of_business": "complete address",
  "state": "state name",
  "state_code": "27",
  "nature_of_business": "description",
  "confidence": 0.0-1.0
}

GSTIN format: [0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}`;

/**
 * Helper function to select appropriate prompt based on document type
 */
export function getExtractionPrompt(documentType: string): string {
  switch (documentType.toLowerCase()) {
    case 'invoice':
    case 'tax_invoice':
    case 'bill':
      return INDIAN_INVOICE_EXTRACTION_PROMPT;

    case 'pan_card':
    case 'pan':
      return PAN_CARD_EXTRACTION_PROMPT;

    case 'aadhaar':
    case 'aadhaar_card':
      return AADHAAR_CARD_EXTRACTION_PROMPT;

    case 'gst_certificate':
    case 'gst_registration':
      return GST_CERTIFICATE_EXTRACTION_PROMPT;

    case 'quick':
      return QUICK_INVOICE_EXTRACTION_PROMPT;

    default:
      return INDIAN_INVOICE_EXTRACTION_PROMPT;
  }
}

/**
 * Confidence thresholds for different use cases
 */
export const CONFIDENCE_THRESHOLDS = {
  AUTO_APPROVE: 0.95,      // Above this, auto-approve
  NEEDS_REVIEW: 0.85,      // Below this, mandatory review
  CRITICAL_FIELD: 0.90,    // For GSTIN, amounts
  LINE_ITEM: 0.85,         // For individual line items
  OPTIONAL_FIELD: 0.70,    // For non-critical fields
};

/**
 * Field importance weights for overall confidence calculation
 */
export const FIELD_WEIGHTS = {
  vendor_gstin: 0.15,
  customer_gstin: 0.10,
  line_items: 0.25,
  tax_calculations: 0.20,
  grand_total: 0.15,
  invoice_number: 0.05,
  invoice_date: 0.05,
  hsn_codes: 0.05,
};
