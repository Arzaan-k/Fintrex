/**
 * Anomaly Detection System
 * AI-POWERED detection of unusual patterns, errors, and fraud
 * Alerts CAs to potential issues automatically
 */

import { supabase } from "@/integrations/supabase/client";

export interface Anomaly {
  id: string;
  type: 'amount_spike' | 'missing_sequence' | 'date_anomaly' | 'tax_mismatch' | 'frequency_anomaly' | 'unusual_vendor';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affected_documents: string[];
  detected_at: string;
  suggested_action: string;
  metadata: Record<string, any>;
}

export interface AnomalyDetectionResult {
  anomalies: Anomaly[];
  total_checked: number;
  anomalies_found: number;
  risk_score: number; // 0-100
}

/**
 * Detect all anomalies for a client
 */
export async function detectAnomalies(
  clientId: string,
  options?: {
    start_date?: string;
    end_date?: string;
    check_types?: Anomaly['type'][];
  }
): Promise<AnomalyDetectionResult> {
  console.log(`🔍 Running anomaly detection for client ${clientId}...`);

  const anomalies: Anomaly[] = [];

  // Get all invoices for analysis
  let query = supabase
    .from('invoices')
    .select('*')
    .eq('client_id', clientId)
    .order('invoice_date', { ascending: true });

  if (options?.start_date) {
    query = query.gte('invoice_date', options.start_date);
  }
  if (options?.end_date) {
    query = query.lte('invoice_date', options.end_date);
  }

  const { data: invoices, error } = await query;

  if (error || !invoices) {
    console.error('Error fetching invoices for anomaly detection:', error);
    return { anomalies: [], total_checked: 0, anomalies_found: 0, risk_score: 0 };
  }

  const totalChecked = invoices.length;

  // Run all detection strategies
  const checkTypes = options?.check_types || [
    'amount_spike',
    'missing_sequence',
    'date_anomaly',
    'tax_mismatch',
    'frequency_anomaly',
  ];

  if (checkTypes.includes('amount_spike')) {
    anomalies.push(...detectAmountSpikes(invoices));
  }

  if (checkTypes.includes('missing_sequence')) {
    anomalies.push(...detectMissingSequences(invoices));
  }

  if (checkTypes.includes('date_anomaly')) {
    anomalies.push(...detectDateAnomalies(invoices));
  }

  if (checkTypes.includes('tax_mismatch')) {
    anomalies.push(...detectTaxMismatches(invoices));
  }

  if (checkTypes.includes('frequency_anomaly')) {
    anomalies.push(...detectFrequencyAnomalies(invoices));
  }

  // Calculate overall risk score
  const riskScore = calculateRiskScore(anomalies);

  console.log(`✅ Anomaly detection complete: ${anomalies.length} anomalies found (Risk: ${riskScore}/100)`);

  return {
    anomalies: anomalies.sort((a, b) => severityToNumber(b.severity) - severityToNumber(a.severity)),
    total_checked: totalChecked,
    anomalies_found: anomalies.length,
    risk_score: riskScore,
  };
}

/**
 * Detect unusual amount spikes (statistical outliers)
 */
function detectAmountSpikes(invoices: any[]): Anomaly[] {
  const anomalies: Anomaly[] = [];

  if (invoices.length < 10) return anomalies; // Need enough data

  // Calculate mean and standard deviation
  const amounts = invoices.map(inv => inv.total_amount || 0);
  const mean = amounts.reduce((sum, val) => sum + val, 0) / amounts.length;
  const variance = amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / amounts.length;
  const stdDev = Math.sqrt(variance);

  // Detect outliers (>3 standard deviations from mean)
  invoices.forEach(inv => {
    const amount = inv.total_amount || 0;
    const zScore = (amount - mean) / stdDev;

    if (Math.abs(zScore) > 3) {
      anomalies.push({
        id: `spike_${inv.id}`,
        type: 'amount_spike',
        severity: zScore > 4 ? 'high' : 'medium',
        title: 'Unusual Amount Detected',
        description: `Invoice ${inv.invoice_number} has an amount (₹${amount.toFixed(2)}) that is ${Math.abs(zScore).toFixed(1)}σ from the mean (₹${mean.toFixed(2)})`,
        affected_documents: [inv.id],
        detected_at: new Date().toISOString(),
        suggested_action: 'Verify this is a legitimate large transaction and not a data entry error',
        metadata: {
          amount,
          mean,
          std_dev: stdDev,
          z_score: zScore,
        },
      });
    }
  });

  return anomalies;
}

/**
 * Detect missing invoice sequences
 */
function detectMissingSequences(invoices: any[]): Anomaly[] {
  const anomalies: Anomaly[] = [];

  // Group by vendor
  const invoicesByVendor = new Map<string, any[]>();
  invoices.forEach(inv => {
    const vendor = inv.vendor_name || 'Unknown';
    if (!invoicesByVendor.has(vendor)) {
      invoicesByVendor.set(vendor, []);
    }
    invoicesByVendor.get(vendor)!.push(inv);
  });

  // Check each vendor for sequence gaps
  invoicesByVendor.forEach((vendorInvoices, vendor) => {
    if (vendorInvoices.length < 5) return; // Need enough invoices

    // Extract numbers from invoice numbers
    const numbers = vendorInvoices
      .map(inv => {
        const match = inv.invoice_number.match(/\d+/);
        return match ? parseInt(match[0]) : null;
      })
      .filter(n => n !== null)
      .sort((a, b) => a! - b!) as number[];

    // Check for gaps
    for (let i = 1; i < numbers.length; i++) {
      const gap = numbers[i] - numbers[i - 1];
      if (gap > 1) {
        const missingNumbers = [];
        for (let j = numbers[i - 1] + 1; j < numbers[i]; j++) {
          missingNumbers.push(j);
        }

        if (missingNumbers.length <= 5) { // Only report small gaps
          anomalies.push({
            id: `sequence_${vendor}_${i}`,
            type: 'missing_sequence',
            severity: 'medium',
            title: 'Missing Invoice Sequence',
            description: `Invoices from "${vendor}" are missing sequence numbers: ${missingNumbers.join(', ')}`,
            affected_documents: [vendorInvoices[i - 1].id, vendorInvoices[i].id],
            detected_at: new Date().toISOString(),
            suggested_action: 'Check if these invoices were never received or were deleted',
            metadata: {
              vendor,
              missing_numbers: missingNumbers,
              gap_size: missingNumbers.length,
            },
          });
        }
      }
    }
  });

  return anomalies;
}

/**
 * Detect date anomalies
 */
function detectDateAnomalies(invoices: any[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const today = new Date();

  invoices.forEach(inv => {
    const invoiceDate = new Date(inv.invoice_date);
    const dueDate = inv.due_date ? new Date(inv.due_date) : null;

    // Check for future-dated invoices
    if (invoiceDate > today) {
      anomalies.push({
        id: `future_date_${inv.id}`,
        type: 'date_anomaly',
        severity: 'high',
        title: 'Future-Dated Invoice',
        description: `Invoice ${inv.invoice_number} has a date in the future: ${inv.invoice_date}`,
        affected_documents: [inv.id],
        detected_at: new Date().toISOString(),
        suggested_action: 'Verify the invoice date is correct',
        metadata: { invoice_date: inv.invoice_date, today: today.toISOString().split('T')[0] },
      });
    }

    // Check for due date before invoice date
    if (dueDate && dueDate < invoiceDate) {
      anomalies.push({
        id: `due_before_invoice_${inv.id}`,
        type: 'date_anomaly',
        severity: 'medium',
        title: 'Due Date Before Invoice Date',
        description: `Invoice ${inv.invoice_number} has due date (${inv.due_date}) before invoice date (${inv.invoice_date})`,
        affected_documents: [inv.id],
        detected_at: new Date().toISOString(),
        suggested_action: 'Correct the due date',
        metadata: { invoice_date: inv.invoice_date, due_date: inv.due_date },
      });
    }

    // Check for very old invoices
    const ageInDays = (today.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24);
    if (ageInDays > 365 && inv.payment_status === 'unpaid') {
      anomalies.push({
        id: `old_unpaid_${inv.id}`,
        type: 'date_anomaly',
        severity: 'medium',
        title: 'Old Unpaid Invoice',
        description: `Invoice ${inv.invoice_number} is ${Math.floor(ageInDays)} days old and still unpaid`,
        affected_documents: [inv.id],
        detected_at: new Date().toISOString(),
        suggested_action: 'Consider writing off as bad debt or following up for payment',
        metadata: { age_days: Math.floor(ageInDays), amount: inv.total_amount },
      });
    }
  });

  return anomalies;
}

/**
 * Detect tax calculation mismatches
 */
function detectTaxMismatches(invoices: any[]): Anomaly[] {
  const anomalies: Anomaly[] = [];

  invoices.forEach(inv => {
    const subtotal = inv.subtotal || 0;
    const cgst = inv.cgst || 0;
    const sgst = inv.sgst || 0;
    const igst = inv.igst || 0;
    const cess = inv.cess || 0;
    const total = inv.total_amount || 0;

    // Check if total = subtotal + taxes (±₹1 tolerance)
    const calculatedTotal = subtotal + cgst + sgst + igst + cess;
    const diff = Math.abs(total - calculatedTotal);

    if (diff > 1) {
      anomalies.push({
        id: `tax_mismatch_${inv.id}`,
        type: 'tax_mismatch',
        severity: diff > 100 ? 'high' : 'medium',
        title: 'Tax Calculation Mismatch',
        description: `Invoice ${inv.invoice_number}: Total (₹${total.toFixed(2)}) ≠ Subtotal + Taxes (₹${calculatedTotal.toFixed(2)}). Difference: ₹${diff.toFixed(2)}`,
        affected_documents: [inv.id],
        detected_at: new Date().toISOString(),
        suggested_action: 'Recalculate taxes or verify invoice data',
        metadata: {
          subtotal,
          cgst,
          sgst,
          igst,
          cess,
          calculated_total: calculatedTotal,
          actual_total: total,
          difference: diff,
        },
      });
    }

    // Check for intra-state tax logic (CGST+SGST or IGST, not both)
    if (igst > 0 && (cgst > 0 || sgst > 0)) {
      anomalies.push({
        id: `tax_logic_${inv.id}`,
        type: 'tax_mismatch',
        severity: 'high',
        title: 'Invalid GST Tax Combination',
        description: `Invoice ${inv.invoice_number}: Has both IGST (₹${igst.toFixed(2)}) and CGST/SGST (₹${(cgst + sgst).toFixed(2)}). This is invalid per GST rules.`,
        affected_documents: [inv.id],
        detected_at: new Date().toISOString(),
        suggested_action: 'Use either IGST (inter-state) OR CGST+SGST (intra-state), not both',
        metadata: { cgst, sgst, igst },
      });
    }
  });

  return anomalies;
}

/**
 * Detect unusual frequency patterns
 */
function detectFrequencyAnomalies(invoices: any[]): Anomaly[] {
  const anomalies: Anomaly[] = [];

  // Group by vendor and check frequency
  const invoicesByVendor = new Map<string, any[]>();
  invoices.forEach(inv => {
    const vendor = inv.vendor_name || 'Unknown';
    if (!invoicesByVendor.has(vendor)) {
      invoicesByVendor.set(vendor, []);
    }
    invoicesByVendor.get(vendor)!.push(inv);
  });

  invoicesByVendor.forEach((vendorInvoices, vendor) => {
    if (vendorInvoices.length < 3) return;

    // Check for suspiciously identical amounts
    const amountCounts = new Map<number, number>();
    vendorInvoices.forEach(inv => {
      const amount = inv.total_amount || 0;
      amountCounts.set(amount, (amountCounts.get(amount) || 0) + 1);
    });

    amountCounts.forEach((count, amount) => {
      if (count >= 5) { // Same amount 5+ times
        anomalies.push({
          id: `freq_${vendor}_${amount}`,
          type: 'frequency_anomaly',
          severity: 'low',
          title: 'Repetitive Invoice Amount',
          description: `Vendor "${vendor}" has ${count} invoices with the exact same amount: ₹${amount.toFixed(2)}`,
          affected_documents: vendorInvoices.filter(inv => inv.total_amount === amount).map(inv => inv.id),
          detected_at: new Date().toISOString(),
          suggested_action: 'Verify these are legitimate separate transactions (e.g., subscription payments)',
          metadata: { vendor, amount, occurrence_count: count },
        });
      }
    });
  });

  return anomalies;
}

/**
 * Calculate overall risk score based on anomalies
 */
function calculateRiskScore(anomalies: Anomaly[]): number {
  if (anomalies.length === 0) return 0;

  const severityWeights = {
    low: 10,
    medium: 25,
    high: 50,
    critical: 100,
  };

  const totalScore = anomalies.reduce((sum, anomaly) => {
    return sum + severityWeights[anomaly.severity];
  }, 0);

  // Normalize to 0-100
  const maxPossibleScore = anomalies.length * 100;
  return Math.min(100, Math.round((totalScore / maxPossibleScore) * 100));
}

/**
 * Convert severity to number for sorting
 */
function severityToNumber(severity: Anomaly['severity']): number {
  const map = { low: 1, medium: 2, high: 3, critical: 4 };
  return map[severity];
}

/**
 * Get anomaly summary stats
 */
export async function getAnomalyStats(
  clientId: string
): Promise<{
  total_anomalies: number;
  by_type: Record<Anomaly['type'], number>;
  by_severity: Record<Anomaly['severity'], number>;
  risk_trend: number; // -1 improving, 0 stable, 1 worsening
}> {
  // This would query an anomalies_log table if we had one
  // For now, run detection and return current stats
  const result = await detectAnomalies(clientId);

  const byType: Record<Anomaly['type'], number> = {
    amount_spike: 0,
    missing_sequence: 0,
    date_anomaly: 0,
    tax_mismatch: 0,
    frequency_anomaly: 0,
    unusual_vendor: 0,
  };

  const bySeverity: Record<Anomaly['severity'], number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };

  result.anomalies.forEach(anomaly => {
    byType[anomaly.type]++;
    bySeverity[anomaly.severity]++;
  });

  return {
    total_anomalies: result.anomalies_found,
    by_type: byType,
    by_severity: bySeverity,
    risk_trend: 0, // Would compare with previous period
  };
}
