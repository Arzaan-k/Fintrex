/**
 * Cash Flow Statement
 * AUTO-GENERATED from journal entries
 * Operating, Investing, Financing Activities
 */

import { supabase } from "@/integrations/supabase/client";

export interface CashFlowData {
  operating_activities: {
    net_profit: number;
    adjustments: {
      depreciation: number;
      other: number;
    };
    working_capital_changes: {
      receivables_change: number;
      payables_change: number;
      inventory_change: number;
    };
    total: number;
  };
  investing_activities: {
    asset_purchases: number;
    asset_sales: number;
    investments: number;
    total: number;
  };
  financing_activities: {
    loans_received: number;
    loans_repaid: number;
    capital_contributed: number;
    dividends_paid: number;
    total: number;
  };
  net_cash_flow: number;
  opening_cash: number;
  closing_cash: number;
}

export interface CashFlowReport {
  client_id: string;
  client_name: string;
  start_date: string;
  end_date: string;
  data: CashFlowData;
  generated_at: string;
}

/**
 * Generate Cash Flow Statement (AUTO-GENERATED)
 */
export async function generateCashFlow(
  clientId: string,
  startDate: Date,
  endDate: Date
): Promise<CashFlowReport> {
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  console.log(`📊 Generating Cash Flow for client ${clientId} from ${startStr} to ${endStr}...`);

  // Get client info
  const { data: client } = await supabase
    .from('clients')
    .select('client_name, business_name')
    .eq('id', clientId)
    .single();

  // Get journal entries for the period
  const { data: entries } = await supabase
    .from('journal_entries')
    .select(`
      id,
      entry_date,
      entry_type,
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

  // Initialize cash flow components
  let netProfit = 0;
  let depreciation = 0;
  let receivablesChange = 0;
  let payablesChange = 0;
  let inventoryChange = 0;
  let assetPurchases = 0;
  let assetSales = 0;
  let investments = 0;
  let loansReceived = 0;
  let loansRepaid = 0;
  let capitalContributed = 0;
  let dividendsPaid = 0;

  // Analyze journal entries
  (entries || []).forEach(entry => {
    (entry.line_items || []).forEach((item: any) => {
      const code = item.account_code || '';
      const debit = item.debit_amount || 0;
      const credit = item.credit_amount || 0;

      // Operating Activities
      if (code >= '4000' && code < '5000') {
        // Income accounts (credit balance)
        netProfit += (credit - debit);
      } else if (code >= '5000' && code < '6000') {
        // Expense accounts (debit balance)
        netProfit -= (debit - credit);
      }

      // Depreciation
      if (code === '5320' || item.account_name.toLowerCase().includes('depreciation')) {
        depreciation += (debit - credit);
      }

      // Working Capital Changes
      if (code === '1130') { // Accounts Receivable
        receivablesChange += (debit - credit);
      }
      if (code === '2110') { // Accounts Payable
        payablesChange += (credit - debit);
      }
      if (code === '1140') { // Inventory
        inventoryChange += (debit - credit);
      }

      // Investing Activities
      if (code >= '1500' && code < '1900') { // Fixed Assets
        if (debit > credit) {
          assetPurchases += (debit - credit);
        } else {
          assetSales += (credit - debit);
        }
      }
      if (code === '1900') { // Investments
        investments += (debit - credit);
      }

      // Financing Activities
      if (code >= '2500' && code < '2600') { // Long-term Loans
        if (credit > debit) {
          loansReceived += (credit - debit);
        } else {
          loansRepaid += (debit - credit);
        }
      }
      if (code === '3100') { // Share Capital
        capitalContributed += (credit - debit);
      }
      if (code === '3300') { // Drawings/Dividends
        dividendsPaid += (debit - credit);
      }
    });
  });

  // Calculate totals
  const operatingCashFlow = netProfit + depreciation - receivablesChange + payablesChange - inventoryChange;
  const investingCashFlow = -assetPurchases + assetSales - investments;
  const financingCashFlow = loansReceived - loansRepaid + capitalContributed - dividendsPaid;
  const netCashFlow = operatingCashFlow + investingCashFlow + financingCashFlow;

  // Get opening and closing cash balances
  const openingCash = await getCashBalance(clientId, new Date(startDate.getTime() - 86400000)); // Day before
  const closingCash = openingCash + netCashFlow;

  console.log(`✅ Cash Flow generated: Net Cash Flow: ₹${netCashFlow.toFixed(2)}`);

  return {
    client_id: clientId,
    client_name: client?.client_name || client?.business_name || 'Unknown Client',
    start_date: startStr,
    end_date: endStr,
    data: {
      operating_activities: {
        net_profit: netProfit,
        adjustments: {
          depreciation,
          other: 0,
        },
        working_capital_changes: {
          receivables_change: -receivablesChange, // Negative means increase (use of cash)
          payables_change: payablesChange, // Positive means increase (source of cash)
          inventory_change: -inventoryChange,
        },
        total: operatingCashFlow,
      },
      investing_activities: {
        asset_purchases: -assetPurchases,
        asset_sales: assetSales,
        investments: -investments,
        total: investingCashFlow,
      },
      financing_activities: {
        loans_received: loansReceived,
        loans_repaid: -loansRepaid,
        capital_contributed: capitalContributed,
        dividends_paid: -dividendsPaid,
        total: financingCashFlow,
      },
      net_cash_flow: netCashFlow,
      opening_cash: openingCash,
      closing_cash: closingCash,
    },
    generated_at: new Date().toISOString(),
  };
}

/**
 * Get cash balance as of date
 */
async function getCashBalance(clientId: string, asOfDate: Date): Promise<number> {
  const dateStr = asOfDate.toISOString().split('T')[0];

  const { data: entries } = await supabase
    .from('journal_entries')
    .select(`
      line_items:journal_line_items(
        account_code,
        debit_amount,
        credit_amount
      )
    `)
    .eq('client_id', clientId)
    .eq('status', 'posted')
    .lte('entry_date', dateStr);

  let cashBalance = 0;

  (entries || []).forEach(entry => {
    (entry.line_items || []).forEach((item: any) => {
      // Cash accounts: 1110 (Cash in Hand), 1120 (Cash at Bank)
      if (item.account_code === '1110' || item.account_code === '1120') {
        cashBalance += (item.debit_amount || 0) - (item.credit_amount || 0);
      }
    });
  });

  return cashBalance;
}

/**
 * Export Cash Flow to CSV
 */
export async function exportCashFlowToCSV(
  clientId: string,
  startDate: Date,
  endDate: Date
): Promise<string> {
  const report = await generateCashFlow(clientId, startDate, endDate);
  const data = report.data;

  const lines: string[] = [];

  // Header
  lines.push(`"CASH FLOW STATEMENT"`);
  lines.push(`"${report.client_name}"`);
  lines.push(`"Period: ${report.start_date} to ${report.end_date}"`);
  lines.push('');

  // Operating Activities
  lines.push('"CASH FLOWS FROM OPERATING ACTIVITIES",""');
  lines.push(`"Net Profit","${data.operating_activities.net_profit.toFixed(2)}"`);
  lines.push('"Adjustments:",""');
  lines.push(`"  Depreciation","${data.operating_activities.adjustments.depreciation.toFixed(2)}"`);
  lines.push('"Working Capital Changes:",""');
  lines.push(`"  Receivables Decrease/(Increase)","${data.operating_activities.working_capital_changes.receivables_change.toFixed(2)}"`);
  lines.push(`"  Payables Increase/(Decrease)","${data.operating_activities.working_capital_changes.payables_change.toFixed(2)}"`);
  lines.push(`"  Inventory Decrease/(Increase)","${data.operating_activities.working_capital_changes.inventory_change.toFixed(2)}"`);
  lines.push(`"Net Cash from Operating Activities","${data.operating_activities.total.toFixed(2)}"`);
  lines.push('');

  // Investing Activities
  lines.push('"CASH FLOWS FROM INVESTING ACTIVITIES",""');
  lines.push(`"Purchase of Fixed Assets","${data.investing_activities.asset_purchases.toFixed(2)}"`);
  lines.push(`"Sale of Fixed Assets","${data.investing_activities.asset_sales.toFixed(2)}"`);
  lines.push(`"Investments","${data.investing_activities.investments.toFixed(2)}"`);
  lines.push(`"Net Cash from Investing Activities","${data.investing_activities.total.toFixed(2)}"`);
  lines.push('');

  // Financing Activities
  lines.push('"CASH FLOWS FROM FINANCING ACTIVITIES",""');
  lines.push(`"Loans Received","${data.financing_activities.loans_received.toFixed(2)}"`);
  lines.push(`"Loan Repayments","${data.financing_activities.loans_repaid.toFixed(2)}"`);
  lines.push(`"Capital Contributed","${data.financing_activities.capital_contributed.toFixed(2)}"`);
  lines.push(`"Dividends Paid","${data.financing_activities.dividends_paid.toFixed(2)}"`);
  lines.push(`"Net Cash from Financing Activities","${data.financing_activities.total.toFixed(2)}"`);
  lines.push('');

  // Summary
  lines.push(`"NET INCREASE/(DECREASE) IN CASH","${data.net_cash_flow.toFixed(2)}"`);
  lines.push(`"Cash at Beginning of Period","${data.opening_cash.toFixed(2)}"`);
  lines.push(`"Cash at End of Period","${data.closing_cash.toFixed(2)}"`);

  return lines.join('\n');
}
