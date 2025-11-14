/**
 * Balance Sheet Report (Proper Accounting)
 * AUTO-GENERATED from Trial Balance
 * Assets = Liabilities + Equity (ALWAYS BALANCED)
 */

import { supabase } from "@/integrations/supabase/client";
import { generateTrialBalance, TrialBalanceRow } from "./trial-balance";

export interface BalanceSheetSection {
  [category: string]: {
    accounts: Array<{
      code: string;
      name: string;
      amount: number;
    }>;
    total: number;
  };
}

export interface BalanceSheetData {
  assets: {
    current_assets: {
      accounts: Array<{ code: string; name: string; amount: number }>;
      total: number;
    };
    non_current_assets: {
      accounts: Array<{ code: string; name: string; amount: number }>;
      total: number;
    };
    total: number;
  };
  liabilities: {
    current_liabilities: {
      accounts: Array<{ code: string; name: string; amount: number }>;
      total: number;
    };
    non_current_liabilities: {
      accounts: Array<{ code: string; name: string; amount: number }>;
      total: number;
    };
    total: number;
  };
  equity: {
    accounts: Array<{ code: string; name: string; amount: number }>;
    total: number;
  };
  total_liabilities_equity: number;
  is_balanced: boolean;
  difference: number;
}

export interface BalanceSheetReport {
  client_id: string;
  client_name: string;
  as_of_date: string;
  data: BalanceSheetData;
  generated_at: string;
}

/**
 * Generate Balance Sheet from Trial Balance (AUTO-GENERATED)
 */
export async function generateBalanceSheet(
  clientId: string,
  asOfDate?: Date
): Promise<BalanceSheetReport> {
  const date = asOfDate || new Date();
  const dateString = date.toISOString().split('T')[0];

  console.log(`📊 Generating Balance Sheet for client ${clientId} as of ${dateString}...`);

  // Get trial balance
  const trialBalance = await generateTrialBalance(clientId, date);

  // Get client info
  const { data: client } = await supabase
    .from('clients')
    .select('client_name, business_name')
    .eq('id', clientId)
    .single();

  // Categorize accounts
  const assetRows = trialBalance.rows.filter(r => r.account_type === 'asset');
  const liabilityRows = trialBalance.rows.filter(r => r.account_type === 'liability');
  const equityRows = trialBalance.rows.filter(r => r.account_type === 'equity');

  // Calculate net profit from income and expense
  const incomeRows = trialBalance.rows.filter(r => r.account_type === 'income');
  const expenseRows = trialBalance.rows.filter(r => r.account_type === 'expense');

  const totalIncome = incomeRows.reduce((sum, r) => sum + r.credit_total - r.debit_total, 0);
  const totalExpense = expenseRows.reduce((sum, r) => sum + r.debit_total - r.credit_total, 0);
  const netProfit = totalIncome - totalExpense;

  // Group assets by category
  const currentAssets = assetRows
    .filter(r => r.account_code >= '1100' && r.account_code < '1500')
    .map(r => ({
      code: r.account_code,
      name: r.account_name,
      amount: r.debit_total - r.credit_total, // Assets have debit balance
    }));

  const nonCurrentAssets = assetRows
    .filter(r => r.account_code >= '1500' || r.account_code < '1100')
    .map(r => ({
      code: r.account_code,
      name: r.account_name,
      amount: r.debit_total - r.credit_total,
    }));

  // Group liabilities by category
  const currentLiabilities = liabilityRows
    .filter(r => r.account_code >= '2100' && r.account_code < '2500')
    .map(r => ({
      code: r.account_code,
      name: r.account_name,
      amount: r.credit_total - r.debit_total, // Liabilities have credit balance
    }));

  const nonCurrentLiabilities = liabilityRows
    .filter(r => r.account_code >= '2500' || r.account_code < '2100')
    .map(r => ({
      code: r.account_code,
      name: r.account_name,
      amount: r.credit_total - r.debit_total,
    }));

  // Equity accounts + Retained Earnings (Net Profit)
  const equityAccounts = equityRows.map(r => ({
    code: r.account_code,
    name: r.account_name,
    amount: r.credit_total - r.debit_total, // Equity has credit balance
  }));

  // Add current year profit to equity
  if (netProfit !== 0) {
    equityAccounts.push({
      code: '3250',
      name: 'Current Year Profit',
      amount: netProfit,
    });
  }

  // Calculate totals
  const totalCurrentAssets = currentAssets.reduce((sum, a) => sum + a.amount, 0);
  const totalNonCurrentAssets = nonCurrentAssets.reduce((sum, a) => sum + a.amount, 0);
  const totalAssets = totalCurrentAssets + totalNonCurrentAssets;

  const totalCurrentLiabilities = currentLiabilities.reduce((sum, l) => sum + l.amount, 0);
  const totalNonCurrentLiabilities = nonCurrentLiabilities.reduce((sum, l) => sum + l.amount, 0);
  const totalLiabilities = totalCurrentLiabilities + totalNonCurrentLiabilities;

  const totalEquity = equityAccounts.reduce((sum, e) => sum + e.amount, 0);

  const totalLiabilitiesEquity = totalLiabilities + totalEquity;

  const difference = Math.abs(totalAssets - totalLiabilitiesEquity);
  const isBalanced = difference < 0.01; // Within 1 paisa tolerance

  console.log(`✅ Balance Sheet generated: Assets=₹${totalAssets.toFixed(2)}, L+E=₹${totalLiabilitiesEquity.toFixed(2)}, Balanced=${isBalanced}`);

  return {
    client_id: clientId,
    client_name: client?.client_name || client?.business_name || 'Unknown Client',
    as_of_date: dateString,
    data: {
      assets: {
        current_assets: {
          accounts: currentAssets,
          total: totalCurrentAssets,
        },
        non_current_assets: {
          accounts: nonCurrentAssets,
          total: totalNonCurrentAssets,
        },
        total: totalAssets,
      },
      liabilities: {
        current_liabilities: {
          accounts: currentLiabilities,
          total: totalCurrentLiabilities,
        },
        non_current_liabilities: {
          accounts: nonCurrentLiabilities,
          total: totalNonCurrentLiabilities,
        },
        total: totalLiabilities,
      },
      equity: {
        accounts: equityAccounts,
        total: totalEquity,
      },
      total_liabilities_equity: totalLiabilitiesEquity,
      is_balanced: isBalanced,
      difference,
    },
    generated_at: new Date().toISOString(),
  };
}

/**
 * Get Balance Sheet for comparison (two periods)
 */
export async function generateComparativeBalanceSheet(
  clientId: string,
  currentDate: Date,
  previousDate: Date
): Promise<{
  current: BalanceSheetReport;
  previous: BalanceSheetReport;
  changes: {
    assets: number;
    liabilities: number;
    equity: number;
  };
}> {
  const [current, previous] = await Promise.all([
    generateBalanceSheet(clientId, currentDate),
    generateBalanceSheet(clientId, previousDate),
  ]);

  const changes = {
    assets: current.data.assets.total - previous.data.assets.total,
    liabilities: current.data.liabilities.total - previous.data.liabilities.total,
    equity: current.data.equity.total - previous.data.equity.total,
  };

  return { current, previous, changes };
}

/**
 * Export Balance Sheet to CSV
 */
export async function exportBalanceSheetToCSV(
  clientId: string,
  asOfDate?: Date
): Promise<string> {
  const report = await generateBalanceSheet(clientId, asOfDate);
  const data = report.data;

  const lines: string[] = [];

  // Header
  lines.push(`"BALANCE SHEET"`);
  lines.push(`"${report.client_name}"`);
  lines.push(`"As of ${report.as_of_date}"`);
  lines.push('');

  // Assets
  lines.push('"ASSETS",""');
  lines.push('"Current Assets",""');
  data.assets.current_assets.accounts.forEach(acc => {
    lines.push(`"  ${acc.name}","${acc.amount.toFixed(2)}"`);
  });
  lines.push(`"Total Current Assets","${data.assets.current_assets.total.toFixed(2)}"`);
  lines.push('');

  lines.push('"Non-Current Assets",""');
  data.assets.non_current_assets.accounts.forEach(acc => {
    lines.push(`"  ${acc.name}","${acc.amount.toFixed(2)}"`);
  });
  lines.push(`"Total Non-Current Assets","${data.assets.non_current_assets.total.toFixed(2)}"`);
  lines.push('');
  lines.push(`"TOTAL ASSETS","${data.assets.total.toFixed(2)}"`);
  lines.push('');
  lines.push('');

  // Liabilities
  lines.push('"LIABILITIES",""');
  lines.push('"Current Liabilities",""');
  data.liabilities.current_liabilities.accounts.forEach(acc => {
    lines.push(`"  ${acc.name}","${acc.amount.toFixed(2)}"`);
  });
  lines.push(`"Total Current Liabilities","${data.liabilities.current_liabilities.total.toFixed(2)}"`);
  lines.push('');

  lines.push('"Non-Current Liabilities",""');
  data.liabilities.non_current_liabilities.accounts.forEach(acc => {
    lines.push(`"  ${acc.name}","${acc.amount.toFixed(2)}"`);
  });
  lines.push(`"Total Non-Current Liabilities","${data.liabilities.non_current_liabilities.total.toFixed(2)}"`);
  lines.push('');
  lines.push(`"TOTAL LIABILITIES","${data.liabilities.total.toFixed(2)}"`);
  lines.push('');

  // Equity
  lines.push('"EQUITY",""');
  data.equity.accounts.forEach(acc => {
    lines.push(`"  ${acc.name}","${acc.amount.toFixed(2)}"`);
  });
  lines.push(`"TOTAL EQUITY","${data.equity.total.toFixed(2)}"`);
  lines.push('');
  lines.push(`"TOTAL LIABILITIES + EQUITY","${data.total_liabilities_equity.toFixed(2)}"`);
  lines.push('');
  lines.push(`"Balance Check","${data.is_balanced ? 'BALANCED ✓' : 'UNBALANCED ✗'}"`);

  if (!data.is_balanced) {
    lines.push(`"Difference","${data.difference.toFixed(2)}"`);
  }

  return lines.join('\n');
}

/**
 * Calculate financial ratios
 */
export async function calculateFinancialRatios(
  clientId: string,
  asOfDate?: Date
): Promise<{
  current_ratio: number;
  quick_ratio: number;
  debt_to_equity: number;
  working_capital: number;
}> {
  const report = await generateBalanceSheet(clientId, asOfDate);
  const data = report.data;

  const currentRatio = data.liabilities.current_liabilities.total > 0
    ? data.assets.current_assets.total / data.liabilities.current_liabilities.total
    : 0;

  // Quick ratio excludes inventory
  const inventory = data.assets.current_assets.accounts
    .find(a => a.name.toLowerCase().includes('inventory'))?.amount || 0;
  const quickAssets = data.assets.current_assets.total - inventory;
  const quickRatio = data.liabilities.current_liabilities.total > 0
    ? quickAssets / data.liabilities.current_liabilities.total
    : 0;

  const debtToEquity = data.equity.total > 0
    ? data.liabilities.total / data.equity.total
    : 0;

  const workingCapital = data.assets.current_assets.total - data.liabilities.current_liabilities.total;

  return {
    current_ratio: currentRatio,
    quick_ratio: quickRatio,
    debt_to_equity: debtToEquity,
    working_capital: workingCapital,
  };
}
