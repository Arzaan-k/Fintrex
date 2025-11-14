/**
 * Duplicate Detection System
 * AI-POWERED detection of duplicate invoices and transactions
 * Prevents double-entry of same invoice
 */

import { supabase } from "@/integrations/supabase/client";

export interface DuplicateMatch {
  invoice_id: string;
  invoice_number: string;
  invoice_date: string;
  vendor_name: string;
  amount: number;
  similarity_score: number; // 0-1
  match_reasons: string[];
  uploaded_at: string;
}

export interface DuplicateDetectionResult {
  is_duplicate: boolean;
  confidence: number; // 0-1
  matches: DuplicateMatch[];
  suggestion: 'reject' | 'review' | 'accept';
}

/**
 * Detect duplicate invoices using multiple strategies
 */
export async function detectDuplicate(
  invoiceNumber: string,
  vendorName: string,
  amount: number,
  invoiceDate: string,
  clientId: string
): Promise<DuplicateDetectionResult> {
  console.log(`🔍 Checking for duplicates: ${invoiceNumber} - ₹${amount}`);

  // Get all existing invoices for this client and vendor
  const { data: existingInvoices, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('client_id', clientId)
    .eq('invoice_type', 'purchase'); // Only check purchase invoices

  if (error) {
    console.error('Error fetching invoices for duplicate detection:', error);
    return {
      is_duplicate: false,
      confidence: 0,
      matches: [],
      suggestion: 'accept',
    };
  }

  if (!existingInvoices || existingInvoices.length === 0) {
    return {
      is_duplicate: false,
      confidence: 0,
      matches: [],
      suggestion: 'accept',
    };
  }

  const matches: DuplicateMatch[] = [];

  // Strategy 1: Exact match (invoice number + vendor + amount)
  const exactMatches = existingInvoices.filter(inv =>
    normalizeInvoiceNumber(inv.invoice_number) === normalizeInvoiceNumber(invoiceNumber) &&
    normalizeVendorName(inv.vendor_name || '') === normalizeVendorName(vendorName) &&
    Math.abs((inv.total_amount || 0) - amount) < 0.01
  );

  exactMatches.forEach(inv => {
    matches.push({
      invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      invoice_date: inv.invoice_date,
      vendor_name: inv.vendor_name || '',
      amount: inv.total_amount || 0,
      similarity_score: 1.0,
      match_reasons: ['Exact match: invoice number, vendor, and amount'],
      uploaded_at: inv.created_at || '',
    });
  });

  // Strategy 2: Fuzzy match (similar invoice number + same vendor + similar amount)
  const fuzzyMatches = existingInvoices.filter(inv => {
    const invNumSimilarity = calculateStringSimilarity(
      normalizeInvoiceNumber(inv.invoice_number),
      normalizeInvoiceNumber(invoiceNumber)
    );
    const vendorSimilarity = calculateStringSimilarity(
      normalizeVendorName(inv.vendor_name || ''),
      normalizeVendorName(vendorName)
    );
    const amountDiff = Math.abs((inv.total_amount || 0) - amount);
    const amountSimilarity = amountDiff < amount * 0.01 ? 1.0 : 0.0; // Within 1%

    const overallScore = (invNumSimilarity * 0.4) + (vendorSimilarity * 0.3) + (amountSimilarity * 0.3);

    return overallScore > 0.8 && !exactMatches.includes(inv);
  });

  fuzzyMatches.forEach(inv => {
    const reasons = [];
    const invNumSimilarity = calculateStringSimilarity(
      normalizeInvoiceNumber(inv.invoice_number),
      normalizeInvoiceNumber(invoiceNumber)
    );
    const vendorSimilarity = calculateStringSimilarity(
      normalizeVendorName(inv.vendor_name || ''),
      normalizeVendorName(vendorName)
    );

    if (invNumSimilarity > 0.9) reasons.push('Very similar invoice number');
    if (vendorSimilarity > 0.9) reasons.push('Same vendor');
    if (Math.abs((inv.total_amount || 0) - amount) < amount * 0.01) reasons.push('Same amount (±1%)');

    const score = (invNumSimilarity * 0.4) + (vendorSimilarity * 0.3) + (Math.abs((inv.total_amount || 0) - amount) < amount * 0.01 ? 0.3 : 0);

    matches.push({
      invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      invoice_date: inv.invoice_date,
      vendor_name: inv.vendor_name || '',
      amount: inv.total_amount || 0,
      similarity_score: score,
      match_reasons: reasons,
      uploaded_at: inv.created_at || '',
    });
  });

  // Strategy 3: Date + Amount match (suspicious if same date and amount from same vendor)
  const dateAmountMatches = existingInvoices.filter(inv =>
    inv.invoice_date === invoiceDate &&
    Math.abs((inv.total_amount || 0) - amount) < 0.01 &&
    normalizeVendorName(inv.vendor_name || '') === normalizeVendorName(vendorName) &&
    !exactMatches.includes(inv) &&
    !fuzzyMatches.includes(inv)
  );

  dateAmountMatches.forEach(inv => {
    matches.push({
      invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      invoice_date: inv.invoice_date,
      vendor_name: inv.vendor_name || '',
      amount: inv.total_amount || 0,
      similarity_score: 0.7,
      match_reasons: ['Same date and amount from same vendor'],
      uploaded_at: inv.created_at || '',
    });
  });

  // Determine overall result
  const isDuplicate = matches.length > 0;
  const highestScore = matches.length > 0 ? Math.max(...matches.map(m => m.similarity_score)) : 0;

  let suggestion: 'reject' | 'review' | 'accept' = 'accept';
  if (highestScore >= 0.95) {
    suggestion = 'reject'; // Almost certainly a duplicate
  } else if (highestScore >= 0.7) {
    suggestion = 'review'; // Possible duplicate, needs human review
  } else {
    suggestion = 'accept';
  }

  console.log(`${isDuplicate ? '⚠️ DUPLICATE DETECTED' : '✅ No duplicates'}: ${matches.length} matches, highest score: ${highestScore.toFixed(2)}`);

  return {
    is_duplicate: isDuplicate,
    confidence: highestScore,
    matches: matches.sort((a, b) => b.similarity_score - a.similarity_score),
    suggestion,
  };
}

/**
 * Normalize invoice number for comparison
 */
function normalizeInvoiceNumber(invNum: string): string {
  return invNum
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric
    .trim();
}

/**
 * Normalize vendor name for comparison
 */
function normalizeVendorName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .replace(/\b(pvt|ltd|limited|private|inc|corp|llc|llp)\b/g, '')
    .trim();
}

/**
 * Calculate string similarity (Levenshtein distance)
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Levenshtein distance algorithm
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Batch check for duplicates in multiple invoices
 */
export async function batchDetectDuplicates(
  invoices: Array<{
    invoice_number: string;
    vendor_name: string;
    amount: number;
    invoice_date: string;
    client_id: string;
  }>
): Promise<Array<{
  invoice: typeof invoices[0];
  result: DuplicateDetectionResult;
}>> {
  const results = [];

  for (const invoice of invoices) {
    const result = await detectDuplicate(
      invoice.invoice_number,
      invoice.vendor_name,
      invoice.amount,
      invoice.invoice_date,
      invoice.client_id
    );

    results.push({ invoice, result });
  }

  return results;
}

/**
 * Get duplicate statistics
 */
export async function getDuplicateStats(
  clientId: string,
  startDate?: string,
  endDate?: string
): Promise<{
  total_checked: number;
  duplicates_found: number;
  auto_rejected: number;
  flagged_for_review: number;
  amount_saved: number; // Total amount of prevented duplicates
}> {
  // This would query a duplicates_log table if we had one
  // For now, return placeholder
  return {
    total_checked: 0,
    duplicates_found: 0,
    auto_rejected: 0,
    flagged_for_review: 0,
    amount_saved: 0,
  };
}

/**
 * Mark invoice as duplicate
 */
export async function markAsDuplicate(
  invoiceId: string,
  originalInvoiceId: string,
  reason: string
): Promise<void> {
  await supabase
    .from('invoices')
    .update({
      payment_status: 'duplicate',
      // Could add metadata field to store duplicate info
    })
    .eq('id', invoiceId);

  console.log(`🚫 Invoice ${invoiceId} marked as duplicate of ${originalInvoiceId}: ${reason}`);
}
