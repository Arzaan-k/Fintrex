/**
 * Trial Balance Report
 * AUTO-GENERATED from journal entries
 * Foundation for all other financial reports
 */

import { supabase } from "@/integrations/supabase/client";

export interface TrialBalanceRow {
  account_code: string;
  account_name: string;
  account_type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  debit_total: number;
  credit_total: number;
  balance: number;
}

export interface TrialBalanceSummary {
  total_debits: number;
  total_credits: number;
  difference: number;
  is_balanced: boolean;
  row_count: number;
}

export interface TrialBalanceReport {
  client_id: string;
  client_name: string;
  as_of_date: string;
  rows: TrialBalanceRow[];
  summary: TrialBalanceSummary;
  generated_at: string;
}

/**
 * Generate Trial Balance (AUTO-GENERATED)
 */
export async function generateTrialBalance(
  clientId: string,
  asOfDate?: Date
): Promise<TrialBalanceReport> {
  const date = asOfDate || new Date();
  const dateString = date.toISOString().split('T')[0];

  console.log(`📊 Generating Trial Balance for client ${clientId} as of ${dateString}...`);

  // Get client name
  const { data: client } = await supabase
    .from('clients')
    .select('client_name, business_name')
    .eq('id', clientId)
    .single();

  // Call database function to get trial balance
  const { data, error } = await supabase.rpc('get_trial_balance', {
    p_client_id: clientId,
    p_as_of_date: dateString
  });

  if (error) {
    console.error('❌ Trial balance generation failed:', error);
    throw error;
  }

  const rows: TrialBalanceRow[] = data || [];

  // Calculate summary
  const totalDebits = rows.reduce((sum, row) => sum + (row.debit_total || 0), 0);
  const totalCredits = rows.reduce((sum, row) => sum + (row.credit_total || 0), 0);
  const difference = Math.abs(totalDebits - totalCredits);
  const isBalanced = difference < 0.01; // Within 1 paisa tolerance

  const summary: TrialBalanceSummary = {
    total_debits: totalDebits,
    total_credits: totalCredits,
    difference,
    is_balanced: isBalanced,
    row_count: rows.length,
  };

  console.log(`✅ Trial Balance generated: ${rows.length} accounts, Balanced: ${isBalanced}`);

  return {
    client_id: clientId,
    client_name: client?.client_name || client?.business_name || 'Unknown Client',
    as_of_date: dateString,
    rows,
    summary,
    generated_at: new Date().toISOString(),
  };
}

/**
 * Get Trial Balance grouped by account type
 */
export async function getTrialBalanceGrouped(
  clientId: string,
  asOfDate?: Date
): Promise<Record<string, TrialBalanceRow[]>> {
  const report = await generateTrialBalance(clientId, asOfDate);

  return {
    asset: report.rows.filter(r => r.account_type === 'asset'),
    liability: report.rows.filter(r => r.account_type === 'liability'),
    equity: report.rows.filter(r => r.account_type === 'equity'),
    income: report.rows.filter(r => r.account_type === 'income'),
    expense: report.rows.filter(r => r.account_type === 'expense'),
  };
}

/**
 * Validate Trial Balance (ensure debits = credits)
 */
export async function validateTrialBalance(
  clientId: string,
  asOfDate?: Date
): Promise<{
  is_valid: boolean;
  error_message?: string;
  difference?: number;
}> {
  const report = await generateTrialBalance(clientId, asOfDate);

  if (!report.summary.is_balanced) {
    return {
      is_valid: false,
      error_message: `Trial balance is not balanced. Difference: ₹${report.summary.difference.toFixed(2)}`,
      difference: report.summary.difference,
    };
  }

  return { is_valid: true };
}

/**
 * Export Trial Balance to CSV
 */
export async function exportTrialBalanceToCSV(
  clientId: string,
  asOfDate?: Date
): Promise<string> {
  const report = await generateTrialBalance(clientId, asOfDate);

  const headers = [
    'Account Code',
    'Account Name',
    'Type',
    'Debit',
    'Credit',
    'Balance'
  ].join(',');

  const rows = report.rows.map(row => [
    row.account_code,
    `"${row.account_name}"`,
    row.account_type,
    row.debit_total.toFixed(2),
    row.credit_total.toFixed(2),
    row.balance.toFixed(2)
  ].join(','));

  const summary = [
    '',
    'TOTAL',
    '',
    report.summary.total_debits.toFixed(2),
    report.summary.total_credits.toFixed(2),
    (report.summary.total_debits - report.summary.total_credits).toFixed(2)
  ].join(',');

  const metadata = [
    `"Trial Balance"`,
    '',
    '',
    '',
    '',
    ''
  ].join(',');

  const clientInfo = [
    `"Client: ${report.client_name}"`,
    '',
    '',
    '',
    '',
    ''
  ].join(',');

  const dateInfo = [
    `"As of: ${report.as_of_date}"`,
    '',
    '',
    '',
    '',
    ''
  ].join(',');

  const generatedInfo = [
    `"Generated: ${new Date(report.generated_at).toLocaleString()}"`,
    '',
    '',
    '',
    '',
    ''
  ].join(',');

  return [
    metadata,
    clientInfo,
    dateInfo,
    generatedInfo,
    '',
    headers,
    ...rows,
    '',
    summary,
  ].join('\n');
}

/**
 * Format number in Indian accounting format (Lakhs/Crores)
 */
export function formatIndianCurrency(amount: number): string {
  const absAmount = Math.abs(amount);
  const isNegative = amount < 0;

  if (absAmount >= 10000000) {
    // Crores (1 Crore = 10 Million)
    return `${isNegative ? '-' : ''}₹${(absAmount / 10000000).toFixed(2)}Cr`;
  } else if (absAmount >= 100000) {
    // Lakhs (1 Lakh = 100 Thousand)
    return `${isNegative ? '-' : ''}₹${(absAmount / 100000).toFixed(2)}L`;
  } else if (absAmount >= 1000) {
    // Thousands
    return `${isNegative ? '-' : ''}₹${(absAmount / 1000).toFixed(2)}K`;
  } else {
    return `${isNegative ? '-' : ''}₹${absAmount.toFixed(2)}`;
  }
}

/**
 * Format number with Indian number system (commas)
 */
export function formatIndianNumber(amount: number): string {
  const absAmount = Math.abs(amount);
  const isNegative = amount < 0;

  const parts = absAmount.toFixed(2).split('.');
  let intPart = parts[0];
  const decPart = parts[1];

  // Indian number system: X,XX,XXX (groups of 2 except last 3)
  let lastThree = intPart.substring(intPart.length - 3);
  const otherNumbers = intPart.substring(0, intPart.length - 3);

  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }

  const formatted = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;

  return `${isNegative ? '-' : ''}₹${formatted}.${decPart}`;
}
