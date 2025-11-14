/**
 * Profit & Loss Statement (P&L / Income Statement)
 * AUTO-GENERATED from Trial Balance
 * Revenue - Expenses = Net Profit/Loss
 */

import { supabase } from "@/integrations/supabase/client";
import { generateTrialBalance } from "./trial-balance";

export interface PLAccount {
  code: string;
  name: string;
  amount: number;
}

export interface PLData {
  revenue: {
    sales: PLAccount[];
    other_income: PLAccount[];
    total: number;
  };
  cost_of_sales: {
    accounts: PLAccount[];
    total: number;
  };
  gross_profit: number;
  operating_expenses: {
    accounts: PLAccount[];
    total: number;
  };
  operating_profit: number;
  other_expenses: {
    accounts: PLAccount[];
    total: number;
  };
  profit_before_tax: number;
  tax_expense: number;
  net_profit: number;
  profit_margin: number; // Net profit / Revenue %
}

export interface ProfitLossReport {
  client_id: string;
  client_name: string;
  start_date: string;
  end_date: string;
  data: PLData;
  generated_at: string;
}

/**
 * Generate Profit & Loss Statement (AUTO-GENERATED)
 */
export async function generateProfitLoss(
  clientId: string,
  startDate: Date,
  endDate: Date
): Promise<ProfitLossReport> {
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  console.log(`📊 Generating P&L for client ${clientId} from ${startStr} to ${endStr}...`);

  // Get client info
  const { data: client } = await supabase
    .from('clients')
    .select('client_name, business_name')
    .eq('id', clientId)
    .single();

  // Get journal entries for the period
  const { data: entries, error } = await supabase
    .from('journal_entries')
    .select(`
      id,
      entry_date,
      line_items:journal_line_items(
        account_name,
        account_code,
        debit_amount,
        credit_amount
      )
    `)
    .eq('client_id', clientId)
    .eq('status', 'posted')
    .gte('entry_date', startStr)
    .lte('entry_date', endStr);

  if (error) throw error;

  // Aggregate account balances
  const accountTotals = new Map<string, { name: string; code: string; debit: number; credit: number }>();

  (entries || []).forEach(entry => {
    (entry.line_items || []).forEach((item: any) => {
      const key = item.account_code || item.account_name;
      const existing = accountTotals.get(key) || {
        name: item.account_name,
        code: item.account_code,
        debit: 0,
        credit: 0,
      };

      existing.debit += item.debit_amount || 0;
      existing.credit += item.credit_amount || 0;

      accountTotals.set(key, existing);
    });
  });

  // Categorize accounts
  const salesAccounts: PLAccount[] = [];
  const otherIncomeAccounts: PLAccount[] = [];
  const cosAccounts: PLAccount[] = [];
  const opexAccounts: PLAccount[] = [];
  const otherExpenseAccounts: PLAccount[] = [];

  accountTotals.forEach((totals, key) => {
    const code = totals.code || '';
    const balance = totals.credit - totals.debit; // Income = credit, Expense = debit

    const account: PLAccount = {
      code: totals.code,
      name: totals.name,
      amount: Math.abs(balance),
    };

    // Categorize by account code
    if (code >= '4100' && code < '4200') {
      // Sales (4100-4199)
      if (balance > 0) salesAccounts.push(account);
    } else if (code >= '4200' && code < '5000') {
      // Other Income (4200-4999)
      if (balance > 0) otherIncomeAccounts.push(account);
    } else if (code >= '5100' && code < '5200') {
      // Cost of Sales (5100-5199)
      if (balance < 0) cosAccounts.push(account);
    } else if (code >= '5200' && code < '5900') {
      // Operating Expenses (5200-5899)
      if (balance < 0) opexAccounts.push(account);
    } else if (code >= '5900' && code < '6000') {
      // Other Expenses (5900-5999)
      if (balance < 0) otherExpenseAccounts.push(account);
    }
  });

  // Calculate totals
  const totalSales = salesAccounts.reduce((sum, a) => sum + a.amount, 0);
  const totalOtherIncome = otherIncomeAccounts.reduce((sum, a) => sum + a.amount, 0);
  const totalRevenue = totalSales + totalOtherIncome;

  const totalCOS = cosAccounts.reduce((sum, a) => sum + a.amount, 0);
  const grossProfit = totalRevenue - totalCOS;

  const totalOpex = opexAccounts.reduce((sum, a) => sum + a.amount, 0);
  const operatingProfit = grossProfit - totalOpex;

  const totalOtherExpenses = otherExpenseAccounts.reduce((sum, a) => sum + a.amount, 0);
  const profitBeforeTax = operatingProfit - totalOtherExpenses;

  // Estimate tax expense (simplified - should be from tax accounts)
  const taxExpense = 0; // TODO: Get from tax accounts

  const netProfit = profitBeforeTax - taxExpense;

  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  console.log(`✅ P&L generated: Revenue=₹${totalRevenue.toFixed(2)}, Net Profit=₹${netProfit.toFixed(2)} (${profitMargin.toFixed(2)}%)`);

  return {
    client_id: clientId,
    client_name: client?.client_name || client?.business_name || 'Unknown Client',
    start_date: startStr,
    end_date: endStr,
    data: {
      revenue: {
        sales: salesAccounts,
        other_income: otherIncomeAccounts,
        total: totalRevenue,
      },
      cost_of_sales: {
        accounts: cosAccounts,
        total: totalCOS,
      },
      gross_profit: grossProfit,
      operating_expenses: {
        accounts: opexAccounts,
        total: totalOpex,
      },
      operating_profit: operatingProfit,
      other_expenses: {
        accounts: otherExpenseAccounts,
        total: totalOtherExpenses,
      },
      profit_before_tax: profitBeforeTax,
      tax_expense: taxExpense,
      net_profit: netProfit,
      profit_margin: profitMargin,
    },
    generated_at: new Date().toISOString(),
  };
}

/**
 * Generate comparative P&L (two periods)
 */
export async function generateComparativePL(
  clientId: string,
  currentStart: Date,
  currentEnd: Date,
  previousStart: Date,
  previousEnd: Date
): Promise<{
  current: ProfitLossReport;
  previous: ProfitLossReport;
  changes: {
    revenue: number;
    revenue_pct: number;
    net_profit: number;
    net_profit_pct: number;
  };
}> {
  const [current, previous] = await Promise.all([
    generateProfitLoss(clientId, currentStart, currentEnd),
    generateProfitLoss(clientId, previousStart, previousEnd),
  ]);

  const revenueChange = current.data.revenue.total - previous.data.revenue.total;
  const revenueChangePct = previous.data.revenue.total > 0
    ? (revenueChange / previous.data.revenue.total) * 100
    : 0;

  const profitChange = current.data.net_profit - previous.data.net_profit;
  const profitChangePct = previous.data.net_profit !== 0
    ? (profitChange / Math.abs(previous.data.net_profit)) * 100
    : 0;

  return {
    current,
    previous,
    changes: {
      revenue: revenueChange,
      revenue_pct: revenueChangePct,
      net_profit: profitChange,
      net_profit_pct: profitChangePct,
    },
  };
}

/**
 * Export P&L to CSV
 */
export async function exportProfitLossToCSV(
  clientId: string,
  startDate: Date,
  endDate: Date
): Promise<string> {
  const report = await generateProfitLoss(clientId, startDate, endDate);
  const data = report.data;

  const lines: string[] = [];

  // Header
  lines.push(`"PROFIT & LOSS STATEMENT"`);
  lines.push(`"${report.client_name}"`);
  lines.push(`"Period: ${report.start_date} to ${report.end_date}"`);
  lines.push('');

  // Revenue
  lines.push('"REVENUE",""');
  data.revenue.sales.forEach(acc => {
    lines.push(`"  ${acc.name}","${acc.amount.toFixed(2)}"`);
  });
  if (data.revenue.other_income.length > 0) {
    lines.push('"Other Income",""');
    data.revenue.other_income.forEach(acc => {
      lines.push(`"  ${acc.name}","${acc.amount.toFixed(2)}"`);
    });
  }
  lines.push(`"Total Revenue","${data.revenue.total.toFixed(2)}"`);
  lines.push('');

  // Cost of Sales
  if (data.cost_of_sales.total > 0) {
    lines.push('"COST OF SALES",""');
    data.cost_of_sales.accounts.forEach(acc => {
      lines.push(`"  ${acc.name}","${acc.amount.toFixed(2)}"`);
    });
    lines.push(`"Total Cost of Sales","${data.cost_of_sales.total.toFixed(2)}"`);
    lines.push('');
    lines.push(`"GROSS PROFIT","${data.gross_profit.toFixed(2)}"`);
    lines.push('');
  }

  // Operating Expenses
  lines.push('"OPERATING EXPENSES",""');
  data.operating_expenses.accounts.forEach(acc => {
    lines.push(`"  ${acc.name}","${acc.amount.toFixed(2)}"`);
  });
  lines.push(`"Total Operating Expenses","${data.operating_expenses.total.toFixed(2)}"`);
  lines.push('');
  lines.push(`"OPERATING PROFIT","${data.operating_profit.toFixed(2)}"`);
  lines.push('');

  // Other Expenses
  if (data.other_expenses.total > 0) {
    lines.push('"OTHER EXPENSES",""');
    data.other_expenses.accounts.forEach(acc => {
      lines.push(`"  ${acc.name}","${acc.amount.toFixed(2)}"`);
    });
    lines.push(`"Total Other Expenses","${data.other_expenses.total.toFixed(2)}"`);
    lines.push('');
  }

  lines.push(`"PROFIT BEFORE TAX","${data.profit_before_tax.toFixed(2)}"`);

  if (data.tax_expense > 0) {
    lines.push(`"Tax Expense","${data.tax_expense.toFixed(2)}"`);
  }

  lines.push('');
  lines.push(`"NET PROFIT","${data.net_profit.toFixed(2)}"`);
  lines.push(`"Profit Margin","${data.profit_margin.toFixed(2)}%"`);

  return lines.join('\n');
}

/**
 * Get monthly P&L summary (for charts/trends)
 */
export async function getMonthlyPLSummary(
  clientId: string,
  year: number
): Promise<Array<{
  month: number;
  revenue: number;
  expenses: number;
  profit: number;
}>> {
  const summaries: Array<{ month: number; revenue: number; expenses: number; profit: number }> = [];

  for (let month = 1; month <= 12; month++) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of month

    try {
      const pl = await generateProfitLoss(clientId, startDate, endDate);
      summaries.push({
        month,
        revenue: pl.data.revenue.total,
        expenses: pl.data.cost_of_sales.total + pl.data.operating_expenses.total + pl.data.other_expenses.total,
        profit: pl.data.net_profit,
      });
    } catch (error) {
      console.error(`Failed to generate P&L for month ${month}:`, error);
      summaries.push({ month, revenue: 0, expenses: 0, profit: 0 });
    }
  }

  return summaries;
}

/**
 * Calculate key P&L metrics
 */
export async function calculatePLMetrics(
  clientId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  gross_margin: number; // (Gross Profit / Revenue) * 100
  operating_margin: number; // (Operating Profit / Revenue) * 100
  net_margin: number; // (Net Profit / Revenue) * 100
  expense_ratio: number; // (Total Expenses / Revenue) * 100
}> {
  const report = await generateProfitLoss(clientId, startDate, endDate);
  const data = report.data;

  const grossMargin = data.revenue.total > 0
    ? (data.gross_profit / data.revenue.total) * 100
    : 0;

  const operatingMargin = data.revenue.total > 0
    ? (data.operating_profit / data.revenue.total) * 100
    : 0;

  const netMargin = data.profit_margin; // Already calculated

  const totalExpenses = data.cost_of_sales.total + data.operating_expenses.total + data.other_expenses.total;
  const expenseRatio = data.revenue.total > 0
    ? (totalExpenses / data.revenue.total) * 100
    : 0;

  return {
    gross_margin: grossMargin,
    operating_margin: operatingMargin,
    net_margin: netMargin,
    expense_ratio: expenseRatio,
  };
}
