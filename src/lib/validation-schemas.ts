// COMPREHENSIVE VALIDATION SCHEMAS
// All form validation using Zod for type safety and security

import { z } from "zod";

// ============================================
// AUTHENTICATION SCHEMAS
// ============================================

// Password requirements: 8+ chars, uppercase, lowercase, number, special char
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

export const loginSchema = z.object({
  email: z.string().email("Invalid email address").trim().toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

export const signupSchema = z.object({
  email: z.string().email("Invalid email address").trim().toLowerCase(),
  password: passwordSchema,
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const resetPasswordSchema = z.object({
  email: z.string().email("Invalid email address").trim().toLowerCase(),
});

// ============================================
// CLIENT SCHEMAS
// ============================================

// PAN validation: ABCDE1234F
const panSchema = z.string().regex(
  /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
  "Invalid PAN format (e.g., ABCDE1234F)"
).optional().or(z.literal(''));

// GSTIN validation: 27ABCDE1234F1Z5
const gstinSchema = z.string().regex(
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
  "Invalid GSTIN format (e.g., 27ABCDE1234F1Z5)"
).optional().or(z.literal(''));

// Aadhaar validation: 1234 5678 9012
const aadhaarSchema = z.string().regex(
  /^\d{4}\s?\d{4}\s?\d{4}$/,
  "Invalid Aadhaar format (12 digits)"
).optional().or(z.literal(''));

// Indian mobile: 10 digits starting with 6-9
const mobileSchema = z.string().regex(
  /^[6-9]\d{9}$/,
  "Invalid mobile number (10 digits starting with 6-9)"
).optional().or(z.literal(''));

export const clientSchema = z.object({
  name: z.string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must not exceed 100 characters")
    .trim(),
  email: z.string()
    .email("Invalid email address")
    .trim()
    .toLowerCase()
    .optional()
    .or(z.literal('')),
  phone: mobileSchema,
  pan: panSchema,
  gstin: gstinSchema,
  aadhaar: aadhaarSchema,
  business_name: z.string()
    .max(200, "Business name must not exceed 200 characters")
    .trim()
    .optional()
    .or(z.literal('')),
  address: z.string()
    .max(500, "Address must not exceed 500 characters")
    .trim()
    .optional()
    .or(z.literal('')),
  city: z.string()
    .max(100, "City must not exceed 100 characters")
    .trim()
    .optional()
    .or(z.literal('')),
  state: z.string()
    .max(100, "State must not exceed 100 characters")
    .trim()
    .optional()
    .or(z.literal('')),
  pincode: z.string()
    .regex(/^[1-9]\d{5}$/, "Invalid pincode (6 digits)")
    .optional()
    .or(z.literal('')),
  status: z.enum(["active", "kyc_pending", "inactive"]).default("kyc_pending"),
});

// ============================================
// DOCUMENT SCHEMAS
// ============================================

export const documentUploadSchema = z.object({
  client_id: z.string().uuid("Invalid client ID"),
  file: z.custom<File>((v) => v instanceof File, {
    message: "File is required"
  }).refine((file) => {
    // Max 25MB
    return file.size <= 25 * 1024 * 1024;
  }, "File size must not exceed 25MB")
  .refine((file) => {
    // Allowed types
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    return allowedTypes.includes(file.type);
  }, "File must be PDF, JPG, or PNG"),
  document_type: z.enum([
    "pan_card",
    "aadhaar",
    "gst_certificate",
    "bank_statement",
    "invoice",
    "receipt",
    "other"
  ]).optional(),
});

// ============================================
// INVOICE SCHEMAS
// ============================================

const lineItemSchema = z.object({
  description: z.string().min(1, "Description is required").max(500),
  quantity: z.number().positive("Quantity must be positive"),
  rate: z.number().nonnegative("Rate must be non-negative"),
  amount: z.number().nonnegative("Amount must be non-negative"),
  hsn_code: z.string().regex(/^\d{4,8}$/, "Invalid HSN code").optional().or(z.literal('')),
  gst_rate: z.number().min(0).max(100, "GST rate must be between 0-100").optional(),
});

export const invoiceSchema = z.object({
  invoice_number: z.string()
    .min(1, "Invoice number is required")
    .max(50, "Invoice number must not exceed 50 characters")
    .trim(),
  invoice_date: z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "Invalid date format (YYYY-MM-DD)"
  ),
  due_date: z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "Invalid date format (YYYY-MM-DD)"
  ).optional().or(z.literal('')),
  client_id: z.string().uuid("Invalid client ID"),
  vendor_name: z.string().min(1, "Vendor name is required").max(200).trim(),
  vendor_gstin: gstinSchema,
  vendor_address: z.string().max(500).trim().optional().or(z.literal('')),
  customer_name: z.string().min(1, "Customer name is required").max(200).trim(),
  customer_gstin: gstinSchema,
  customer_address: z.string().max(500).trim().optional().or(z.literal('')),
  line_items: z.array(lineItemSchema).min(1, "At least one line item is required"),
  subtotal: z.number().nonnegative("Subtotal must be non-negative"),
  cgst: z.number().nonnegative("CGST must be non-negative"),
  sgst: z.number().nonnegative("SGST must be non-negative"),
  igst: z.number().nonnegative("IGST must be non-negative"),
  cess: z.number().nonnegative("Cess must be non-negative").optional().or(z.literal(0)),
  total_amount: z.number().positive("Total amount must be positive"),
  status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]).default("draft"),
}).refine((data) => {
  // Validate that total_amount equals subtotal + taxes
  const calculatedTotal = data.subtotal + data.cgst + data.sgst + data.igst + (data.cess || 0);
  return Math.abs(calculatedTotal - data.total_amount) < 0.01; // Allow 1 paisa difference for rounding
}, {
  message: "Total amount must equal subtotal + taxes",
  path: ["total_amount"],
}).refine((data) => {
  // Validate that either (CGST+SGST) OR IGST is used, not both
  const hasIntraState = data.cgst > 0 || data.sgst > 0;
  const hasInterState = data.igst > 0;
  return !(hasIntraState && hasInterState);
}, {
  message: "Cannot have both CGST/SGST and IGST. Use CGST+SGST for intra-state or IGST for inter-state",
  path: ["igst"],
});

// ============================================
// FINANCIAL RECORD SCHEMAS
// ============================================

export const financialRecordSchema = z.object({
  record_type: z.enum(["income", "expense", "asset", "liability"]),
  amount: z.number().positive("Amount must be positive"),
  description: z.string()
    .min(3, "Description must be at least 3 characters")
    .max(500, "Description must not exceed 500 characters")
    .trim(),
  category: z.string()
    .min(2, "Category must be at least 2 characters")
    .max(100, "Category must not exceed 100 characters")
    .trim(),
  transaction_date: z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "Invalid date format (YYYY-MM-DD)"
  ),
  client_id: z.string().uuid("Invalid client ID"),
  invoice_id: z.string().uuid("Invalid invoice ID").optional().nullable(),
  payment_method: z.enum(["cash", "bank_transfer", "upi", "cheque", "card", "other"]).optional(),
  reference_number: z.string().max(100).trim().optional().or(z.literal('')),
  notes: z.string().max(1000).trim().optional().or(z.literal('')),
});

// ============================================
// JOURNAL ENTRY SCHEMAS (Double-Entry Bookkeeping)
// ============================================

const journalEntryLineSchema = z.object({
  account_id: z.string().uuid("Invalid account ID"),
  debit: z.number().nonnegative("Debit must be non-negative"),
  credit: z.number().nonnegative("Credit must be non-negative"),
  description: z.string().max(500).trim().optional().or(z.literal('')),
}).refine((data) => {
  // Either debit OR credit must be set, not both
  return (data.debit > 0 && data.credit === 0) || (data.credit > 0 && data.debit === 0);
}, {
  message: "Entry must have either debit or credit, not both",
  path: ["debit"],
});

export const journalEntrySchema = z.object({
  entry_date: z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "Invalid date format (YYYY-MM-DD)"
  ),
  description: z.string()
    .min(3, "Description must be at least 3 characters")
    .max(500, "Description must not exceed 500 characters")
    .trim(),
  reference_number: z.string().max(100).trim().optional().or(z.literal('')),
  client_id: z.string().uuid("Invalid client ID"),
  lines: z.array(journalEntryLineSchema).min(2, "Journal entry must have at least 2 lines"),
  notes: z.string().max(1000).trim().optional().or(z.literal('')),
}).refine((data) => {
  // Validate that total debits equal total credits
  const totalDebits = data.lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredits = data.lines.reduce((sum, line) => sum + line.credit, 0);
  return Math.abs(totalDebits - totalCredits) < 0.01; // Allow 1 paisa difference for rounding
}, {
  message: "Total debits must equal total credits",
  path: ["lines"],
});

// ============================================
// SETTINGS SCHEMAS
// ============================================

export const profileUpdateSchema = z.object({
  full_name: z.string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must not exceed 100 characters")
    .trim()
    .optional()
    .or(z.literal('')),
  phone: mobileSchema,
  firm_name: z.string()
    .max(200, "Firm name must not exceed 200 characters")
    .trim()
    .optional()
    .or(z.literal('')),
  address: z.string()
    .max(500, "Address must not exceed 500 characters")
    .trim()
    .optional()
    .or(z.literal('')),
});

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, "Current password is required"),
  new_password: passwordSchema,
  confirm_password: z.string().min(1, "Please confirm your new password"),
}).refine((data) => data.new_password === data.confirm_password, {
  message: "Passwords do not match",
  path: ["confirm_password"],
}).refine((data) => data.current_password !== data.new_password, {
  message: "New password must be different from current password",
  path: ["new_password"],
});

// ============================================
// GST RETURN SCHEMAS
// ============================================

export const gstReturnSchema = z.object({
  return_period: z.string().regex(
    /^\d{4}-\d{2}$/,
    "Invalid period format (YYYY-MM)"
  ),
  return_type: z.enum(["GSTR1", "GSTR3B", "GSTR4", "GSTR9"]),
  gstin: gstinSchema.refine((val) => val !== '', "GSTIN is required for GST returns"),
  filing_date: z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "Invalid date format (YYYY-MM-DD)"
  ).optional(),
  status: z.enum(["draft", "filed", "revised"]).default("draft"),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ClientInput = z.infer<typeof clientSchema>;
export type DocumentUploadInput = z.infer<typeof documentUploadSchema>;
export type InvoiceInput = z.infer<typeof invoiceSchema>;
export type FinancialRecordInput = z.infer<typeof financialRecordSchema>;
export type JournalEntryInput = z.infer<typeof journalEntrySchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type GSTReturnInput = z.infer<typeof gstReturnSchema>;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Validate data against schema and return formatted errors
 */
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: Record<string, string> = {};
  result.error.issues.forEach((issue) => {
    const path = issue.path.join('.');
    errors[path] = issue.message;
  });

  return { success: false, errors };
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(errors: Record<string, string>): string {
  return Object.entries(errors)
    .map(([field, message]) => `${field}: ${message}`)
    .join('\n');
}
