// Financial API - Integration with Supabase Edge Functions
// Provides type-safe methods for generating financials and exporting data

import { supabase } from './supabase';

export interface BalanceSheetData {
  id: string;
  client_id: string;
  as_of_date: string;
  status: 'draft' | 'reviewed' | 'final';
  data: any;
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  generated_at: string;
  generated_by: string;
}

export interface ProfitLossData {
  id: string;
  client_id: string;
  start_date: string;
  end_date: string;
  status: 'draft' | 'reviewed' | 'final';
  data: any;
  total_revenue: number;
  total_expenses: number;
  net_profit: number;
  generated_at: string;
  generated_by: string;
}

/**
 * Generate balance sheet for a client
 */
export async function generateBalanceSheet(
  clientId: string,
  asOfDate?: string
): Promise<BalanceSheetData> {
  const { data, error } = await supabase.functions.invoke('generate-financials', {
    body: {
      clientId,
      asOfDate: asOfDate || new Date().toISOString().split('T')[0],
      type: 'balance_sheet',
    },
  });

  if (error) {
    console.error('Error generating balance sheet:', error);
    throw error;
  }

  return data.data;
}

/**
 * Generate P&L statement for a client
 */
export async function generateProfitLoss(
  clientId: string,
  startDate?: string,
  endDate?: string
): Promise<ProfitLossData> {
  const { data, error } = await supabase.functions.invoke('generate-financials', {
    body: {
      clientId,
      startDate: startDate || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
      endDate: endDate || new Date().toISOString().split('T')[0],
      type: 'profit_loss',
    },
  });

  if (error) {
    console.error('Error generating P&L:', error);
    throw error;
  }

  return data.data;
}

/**
 * Export journal entries to Tally XML
 */
export async function exportToTallyXML(
  clientId: string,
  startDate?: string,
  endDate?: string
): Promise<Blob> {
  const { data, error } = await supabase.functions.invoke('export-to-accounting', {
    body: {
      clientId,
      exportType: 'tally_xml',
      dataType: 'journal',
      startDate,
      endDate,
    },
  });

  if (error) {
    console.error('Error exporting to Tally XML:', error);
    throw error;
  }

  return new Blob([data], { type: 'application/xml' });
}

/**
 * Export journal entries to Tally CSV
 */
export async function exportToTallyCSV(
  clientId: string,
  startDate?: string,
  endDate?: string
): Promise<Blob> {
  const { data, error } = await supabase.functions.invoke('export-to-accounting', {
    body: {
      clientId,
      exportType: 'tally_csv',
      dataType: 'journal',
      startDate,
      endDate,
    },
  });

  if (error) {
    console.error('Error exporting to Tally CSV:', error);
    throw error;
  }

  return new Blob([data], { type: 'text/csv' });
}

/**
 * Export journal entries to ZohoBooks JSON
 */
export async function exportToZohoBooks(
  clientId: string,
  startDate?: string,
  endDate?: string
): Promise<Blob> {
  const { data, error } = await supabase.functions.invoke('export-to-accounting', {
    body: {
      clientId,
      exportType: 'zohobooks',
      dataType: 'journal',
      startDate,
      endDate,
    },
  });

  if (error) {
    console.error('Error exporting to ZohoBooks:', error);
    throw error;
  }

  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
}

/**
 * Export trial balance to CSV
 */
export async function exportTrialBalanceCSV(
  clientId: string,
  asOfDate?: string
): Promise<Blob> {
  const { data, error } = await supabase.functions.invoke('export-to-accounting', {
    body: {
      clientId,
      exportType: 'csv',
      dataType: 'trial_balance',
      asOfDate: asOfDate || new Date().toISOString().split('T')[0],
    },
  });

  if (error) {
    console.error('Error exporting trial balance:', error);
    throw error;
  }

  return new Blob([data], { type: 'text/csv' });
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Get recent balance sheets for a client
 */
export async function getBalanceSheets(clientId: string, limit: number = 10) {
  const { data, error } = await supabase
    .from('balance_sheets')
    .select('*')
    .eq('client_id', clientId)
    .order('as_of_date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching balance sheets:', error);
    throw error;
  }

  return data;
}

/**
 * Get recent P&L statements for a client
 */
export async function getProfitLossStatements(clientId: string, limit: number = 10) {
  const { data, error } = await supabase
    .from('profit_loss_statements')
    .select('*')
    .eq('client_id', clientId)
    .order('end_date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching P&L statements:', error);
    throw error;
  }

  return data;
}

/**
 * Get financial summary for dashboard
 */
export async function getFinancialSummary(clientId: string) {
  try {
    // Get latest balance sheet
    const { data: latestBS } = await supabase
      .from('balance_sheets')
      .select('*')
      .eq('client_id', clientId)
      .order('as_of_date', { ascending: false })
      .limit(1)
      .single();

    // Get latest P&L (this year)
    const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    const { data: latestPL } = await supabase
      .from('profit_loss_statements')
      .select('*')
      .eq('client_id', clientId)
      .eq('start_date', yearStart)
      .lte('end_date', today)
      .order('end_date', { ascending: false })
      .limit(1)
      .single();

    // Get invoice stats
    const { data: invoices } = await supabase
      .from('invoices')
      .select('invoice_type, payment_status, total_amount')
      .eq('client_id', clientId);

    const salesInvoices = invoices?.filter(i => i.invoice_type === 'sales') || [];
    const purchaseInvoices = invoices?.filter(i => i.invoice_type === 'purchase') || [];

    const totalSales = salesInvoices.reduce((sum, inv) => sum + (parseFloat(inv.total_amount as any) || 0), 0);
    const totalPurchases = purchaseInvoices.reduce((sum, inv) => sum + (parseFloat(inv.total_amount as any) || 0), 0);

    const unpaidInvoices = invoices?.filter(i => i.payment_status === 'unpaid') || [];
    const unpaidAmount = unpaidInvoices.reduce((sum, inv) => sum + (parseFloat(inv.total_amount as any) || 0), 0);

    return {
      balanceSheet: latestBS,
      profitLoss: latestPL,
      invoiceStats: {
        totalSales,
        totalPurchases,
        unpaidCount: unpaidInvoices.length,
        unpaidAmount,
        salesCount: salesInvoices.length,
        purchaseCount: purchaseInvoices.length,
      },
    };
  } catch (error) {
    console.error('Error getting financial summary:', error);
    return null;
  }
}

/**
 * Get journal entries for a client
 */
export async function getJournalEntries(
  clientId: string,
  startDate?: string,
  endDate?: string,
  limit: number = 50
) {
  let query = supabase
    .from('journal_entries')
    .select(`
      *,
      line_items:journal_line_items(*)
    `)
    .eq('client_id', clientId)
    .order('entry_date', { ascending: false })
    .limit(limit);

  if (startDate) {
    query = query.gte('entry_date', startDate);
  }
  if (endDate) {
    query = query.lte('entry_date', endDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching journal entries:', error);
    throw error;
  }

  return data;
}
