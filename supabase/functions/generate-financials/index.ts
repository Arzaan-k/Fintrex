// Supabase Edge Function: generate-financials
// Generates Balance Sheet and P&L Statement from journal entries
// Endpoint: POST /generate-financials
// Body: { clientId: string, asOfDate?: string, startDate?: string, endDate?: string, type: 'balance_sheet' | 'profit_loss' }

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const JSON_HEADERS = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization, apikey, x-client-info",
};

interface AccountBalance {
  account_code: string;
  account_name: string;
  account_type: string;
  category: string;
  balance: number;
}

/**
 * Get account balances from journal entries
 */
async function getAccountBalances(
  supabase: any,
  clientId: string,
  accountantId: string,
  asOfDate: string
): Promise<AccountBalance[]> {
  // Get all journal line items up to the as-of date
  const { data: lineItems, error } = await supabase
    .from('journal_line_items')
    .select(`
      account_name,
      account_code,
      debit_amount,
      credit_amount,
      entry_id,
      journal_entries!inner (
        client_id,
        entry_date,
        status
      )
    `)
    .eq('journal_entries.client_id', clientId)
    .eq('journal_entries.status', 'posted')
    .lte('journal_entries.entry_date', asOfDate);

  if (error) {
    console.error('Error fetching line items:', error);
    throw error;
  }

  // Get chart of accounts for the accountant
  const { data: accounts, error: accountsError } = await supabase
    .from('chart_of_accounts')
    .select('account_code, account_name, account_type, category')
    .eq('accountant_id', accountantId);

  if (accountsError) {
    console.error('Error fetching accounts:', accountsError);
    throw accountsError;
  }

  // Create account map
  const accountMap = new Map<string, any>();
  accounts?.forEach((acc: any) => {
    accountMap.set(acc.account_name, acc);
  });

  // Aggregate balances by account
  const balanceMap = new Map<string, number>();
  lineItems?.forEach((item: any) => {
    const accountName = item.account_name;
    const debit = parseFloat(item.debit_amount || 0);
    const credit = parseFloat(item.credit_amount || 0);
    const current = balanceMap.get(accountName) || 0;

    // For assets and expenses: debit increases, credit decreases
    // For liabilities, equity, and income: credit increases, debit decreases
    balanceMap.set(accountName, current + debit - credit);
  });

  // Convert to array with account details
  const balances: AccountBalance[] = [];
  balanceMap.forEach((balance, accountName) => {
    const account = accountMap.get(accountName);
    if (account) {
      balances.push({
        account_code: account.account_code,
        account_name: accountName,
        account_type: account.account_type,
        category: account.category || '',
        balance: balance,
      });
    }
  });

  return balances;
}

/**
 * Generate Balance Sheet
 */
async function generateBalanceSheet(
  supabase: any,
  clientId: string,
  accountantId: string,
  asOfDate: string
): Promise<any> {
  console.log(`📊 Generating balance sheet for client ${clientId} as of ${asOfDate}`);

  const balances = await getAccountBalances(supabase, clientId, accountantId, asOfDate);

  // Categorize accounts
  const currentAssets: any[] = [];
  const nonCurrentAssets: any[] = [];
  const currentLiabilities: any[] = [];
  const nonCurrentLiabilities: any[] = [];
  const equity: any[] = [];

  balances.forEach((acc) => {
    const item = {
      account_name: acc.account_name,
      account_code: acc.account_code,
      amount: Math.abs(acc.balance),
    };

    if (acc.account_type === 'asset') {
      if (acc.category?.includes('current') || acc.category === 'current_assets') {
        currentAssets.push(item);
      } else {
        nonCurrentAssets.push(item);
      }
    } else if (acc.account_type === 'liability') {
      if (acc.category?.includes('current') || acc.category === 'current_liabilities') {
        currentLiabilities.push(item);
      } else {
        nonCurrentLiabilities.push(item);
      }
    } else if (acc.account_type === 'equity') {
      equity.push(item);
    }
  });

  // Calculate totals
  const totalCurrentAssets = currentAssets.reduce((sum, a) => sum + a.amount, 0);
  const totalNonCurrentAssets = nonCurrentAssets.reduce((sum, a) => sum + a.amount, 0);
  const totalAssets = totalCurrentAssets + totalNonCurrentAssets;

  const totalCurrentLiabilities = currentLiabilities.reduce((sum, l) => sum + l.amount, 0);
  const totalNonCurrentLiabilities = nonCurrentLiabilities.reduce((sum, l) => sum + l.amount, 0);
  const totalLiabilities = totalCurrentLiabilities + totalNonCurrentLiabilities;

  const totalEquity = equity.reduce((sum, e) => sum + e.amount, 0);

  const balanceSheetData = {
    as_of_date: asOfDate,
    current_assets: currentAssets,
    non_current_assets: nonCurrentAssets,
    current_liabilities: currentLiabilities,
    non_current_liabilities: nonCurrentLiabilities,
    equity: equity,
    totals: {
      current_assets: totalCurrentAssets,
      non_current_assets: totalNonCurrentAssets,
      total_assets: totalAssets,
      current_liabilities: totalCurrentLiabilities,
      non_current_liabilities: totalNonCurrentLiabilities,
      total_liabilities: totalLiabilities,
      total_equity: totalEquity,
      total_liabilities_and_equity: totalLiabilities + totalEquity,
    },
  };

  // Save to database
  const { data: balanceSheet, error: saveError } = await supabase
    .from('balance_sheets')
    .upsert({
      client_id: clientId,
      as_of_date: asOfDate,
      status: 'final',
      data: balanceSheetData,
      total_assets: totalAssets,
      total_liabilities: totalLiabilities,
      total_equity: totalEquity,
      generated_by: accountantId,
      generated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (saveError) {
    console.error('Error saving balance sheet:', saveError);
    throw saveError;
  }

  console.log(`✅ Balance sheet generated and saved: ${balanceSheet.id}`);

  return balanceSheet;
}

/**
 * Generate Profit & Loss Statement
 */
async function generateProfitLoss(
  supabase: any,
  clientId: string,
  accountantId: string,
  startDate: string,
  endDate: string
): Promise<any> {
  console.log(`📊 Generating P&L for client ${clientId} from ${startDate} to ${endDate}`);

  // Get journal entries within date range
  const { data: lineItems, error } = await supabase
    .from('journal_line_items')
    .select(`
      account_name,
      account_code,
      debit_amount,
      credit_amount,
      entry_id,
      journal_entries!inner (
        client_id,
        entry_date,
        status
      )
    `)
    .eq('journal_entries.client_id', clientId)
    .eq('journal_entries.status', 'posted')
    .gte('journal_entries.entry_date', startDate)
    .lte('journal_entries.entry_date', endDate);

  if (error) {
    console.error('Error fetching line items:', error);
    throw error;
  }

  // Get chart of accounts
  const { data: accounts, error: accountsError } = await supabase
    .from('chart_of_accounts')
    .select('account_code, account_name, account_type, category')
    .eq('accountant_id', accountantId);

  if (accountsError) {
    console.error('Error fetching accounts:', accountsError);
    throw accountsError;
  }

  const accountMap = new Map<string, any>();
  accounts?.forEach((acc: any) => {
    accountMap.set(acc.account_name, acc);
  });

  // Aggregate income and expenses
  const revenueMap = new Map<string, number>();
  const expenseMap = new Map<string, number>();

  lineItems?.forEach((item: any) => {
    const accountName = item.account_name;
    const account = accountMap.get(accountName);
    if (!account) return;

    const debit = parseFloat(item.debit_amount || 0);
    const credit = parseFloat(item.credit_amount || 0);

    if (account.account_type === 'income') {
      // Income: credit increases (normal balance)
      const current = revenueMap.get(accountName) || 0;
      revenueMap.set(accountName, current + credit - debit);
    } else if (account.account_type === 'expense') {
      // Expense: debit increases (normal balance)
      const current = expenseMap.get(accountName) || 0;
      expenseMap.set(accountName, current + debit - credit);
    }
  });

  // Convert to arrays
  const revenue: any[] = [];
  revenueMap.forEach((amount, accountName) => {
    const account = accountMap.get(accountName);
    revenue.push({
      account_name: accountName,
      account_code: account?.account_code || '',
      amount: Math.abs(amount),
      category: account?.category || 'revenue',
    });
  });

  const expenses: any[] = [];
  expenseMap.forEach((amount, accountName) => {
    const account = accountMap.get(accountName);
    expenses.push({
      account_name: accountName,
      account_code: account?.account_code || '',
      amount: Math.abs(amount),
      category: account?.category || 'expenses',
    });
  });

  // Calculate totals
  const totalRevenue = revenue.reduce((sum, r) => sum + r.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = totalRevenue - totalExpenses;

  const plData = {
    start_date: startDate,
    end_date: endDate,
    revenue: revenue,
    expenses: expenses,
    totals: {
      total_revenue: totalRevenue,
      total_expenses: totalExpenses,
      gross_profit: totalRevenue, // Simplified - in reality would deduct COGS
      net_profit: netProfit,
      profit_margin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
    },
  };

  // Save to database
  const { data: plStatement, error: saveError } = await supabase
    .from('profit_loss_statements')
    .upsert({
      client_id: clientId,
      start_date: startDate,
      end_date: endDate,
      status: 'final',
      data: plData,
      total_revenue: totalRevenue,
      total_expenses: totalExpenses,
      net_profit: netProfit,
      generated_by: accountantId,
      generated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (saveError) {
    console.error('Error saving P&L statement:', saveError);
    throw saveError;
  }

  console.log(`✅ P&L statement generated and saved: ${plStatement.id}`);

  return plStatement;
}

/**
 * Main handler
 */
serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: JSON_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: JSON_HEADERS }
    );
  }

  try {
    const body = await req.json() as {
      clientId: string;
      accountantId?: string;
      asOfDate?: string;
      startDate?: string;
      endDate?: string;
      type: 'balance_sheet' | 'profit_loss';
    };

    if (!body.clientId || !body.type) {
      return new Response(
        JSON.stringify({ error: "clientId and type are required" }),
        { status: 400, headers: JSON_HEADERS }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Supabase configuration missing" }),
        { status: 500, headers: JSON_HEADERS }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });

    // Get accountant ID from client if not provided
    let accountantId = body.accountantId;
    if (!accountantId) {
      const { data: client } = await supabase
        .from('clients')
        .select('accountant_id')
        .eq('id', body.clientId)
        .single();

      accountantId = client?.accountant_id;
    }

    if (!accountantId) {
      return new Response(
        JSON.stringify({ error: "Could not determine accountant ID" }),
        { status: 400, headers: JSON_HEADERS }
      );
    }

    let result: any;

    if (body.type === 'balance_sheet') {
      const asOfDate = body.asOfDate || new Date().toISOString().split('T')[0];
      result = await generateBalanceSheet(supabase, body.clientId, accountantId, asOfDate);
    } else if (body.type === 'profit_loss') {
      const endDate = body.endDate || new Date().toISOString().split('T')[0];
      const startDate = body.startDate || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
      result = await generateProfitLoss(supabase, body.clientId, accountantId, startDate, endDate);
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid type. Must be 'balance_sheet' or 'profit_loss'" }),
        { status: 400, headers: JSON_HEADERS }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
      }),
      { status: 200, headers: JSON_HEADERS }
    );

  } catch (error) {
    console.error('❌ Error generating financials:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: JSON_HEADERS }
    );
  }
});
