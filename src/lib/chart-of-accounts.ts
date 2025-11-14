/**
 * Chart of Accounts System
 * Provides comprehensive Indian accounting structure
 */

import { supabase } from "@/integrations/supabase/client";

export interface ChartOfAccount {
  id: string;
  accountant_id: string;
  account_code: string;
  account_name: string;
  account_type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  category?: string;
  sub_category?: string;
  parent_account_id?: string;
  opening_balance: number;
  current_balance: number;
  is_active: boolean;
  is_system_account: boolean;
  display_order: number;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface AccountCategory {
  name: string;
  accounts: ChartOfAccount[];
  total: number;
}

/**
 * Get all accounts for current user
 */
export async function getChartOfAccounts(): Promise<ChartOfAccount[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .eq('accountant_id', user.id)
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get accounts by type
 */
export async function getAccountsByType(
  accountType: ChartOfAccount['account_type']
): Promise<ChartOfAccount[]> {
  const accounts = await getChartOfAccounts();
  return accounts.filter(acc => acc.account_type === accountType);
}

/**
 * Get accounts grouped by type
 */
export async function getAccountsGroupedByType(): Promise<Record<string, ChartOfAccount[]>> {
  const accounts = await getChartOfAccounts();

  return {
    asset: accounts.filter(a => a.account_type === 'asset'),
    liability: accounts.filter(a => a.account_type === 'liability'),
    equity: accounts.filter(a => a.account_type === 'equity'),
    income: accounts.filter(a => a.account_type === 'income'),
    expense: accounts.filter(a => a.account_type === 'expense'),
  };
}

/**
 * Get account by code
 */
export async function getAccountByCode(code: string): Promise<ChartOfAccount | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .eq('accountant_id', user.id)
    .eq('account_code', code)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data;
}

/**
 * Get account by name
 */
export async function getAccountByName(name: string): Promise<ChartOfAccount | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .eq('accountant_id', user.id)
    .eq('account_name', name)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data;
}

/**
 * Initialize Indian chart of accounts for current user
 */
export async function initializeIndianChartOfAccounts(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Call the SQL function
  const { error } = await supabase.rpc('initialize_indian_chart_of_accounts', {
    p_accountant_id: user.id
  });

  if (error) throw error;
}

/**
 * Check if user has chart of accounts set up
 */
export async function hasChartOfAccounts(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { count, error } = await supabase
    .from('chart_of_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('accountant_id', user.id);

  if (error) throw error;
  return (count || 0) > 0;
}

/**
 * Create new account
 */
export async function createAccount(
  account: Omit<ChartOfAccount, 'id' | 'accountant_id' | 'created_at' | 'updated_at'>
): Promise<ChartOfAccount> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('chart_of_accounts')
    .insert({
      ...account,
      accountant_id: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update account
 */
export async function updateAccount(
  id: string,
  updates: Partial<Omit<ChartOfAccount, 'id' | 'accountant_id' | 'created_at'>>
): Promise<ChartOfAccount> {
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete account (only if not system account and no transactions)
 */
export async function deleteAccount(id: string): Promise<void> {
  // First check if it's a system account
  const { data: account } = await supabase
    .from('chart_of_accounts')
    .select('is_system_account')
    .eq('id', id)
    .single();

  if (account?.is_system_account) {
    throw new Error('Cannot delete system accounts');
  }

  // Check if account has transactions
  const { count } = await supabase
    .from('journal_line_items')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', id);

  if (count && count > 0) {
    throw new Error('Cannot delete account with transactions. Deactivate instead.');
  }

  const { error } = await supabase
    .from('chart_of_accounts')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/**
 * Deactivate account
 */
export async function deactivateAccount(id: string): Promise<void> {
  await updateAccount(id, { is_active: false });
}

/**
 * Get account balance
 */
export async function getAccountBalance(
  accountId: string,
  asOfDate?: Date
): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Query journal line items for this account
  let query = supabase
    .from('journal_line_items')
    .select(`
      debit_amount,
      credit_amount,
      journal_entries!inner(entry_date, status)
    `)
    .eq('account_id', accountId)
    .eq('journal_entries.status', 'posted');

  if (asOfDate) {
    query = query.lte('journal_entries.entry_date', asOfDate.toISOString().split('T')[0]);
  }

  const { data, error } = await query;

  if (error) throw error;

  // Calculate balance (debits - credits)
  const balance = (data || []).reduce((sum, item) => {
    return sum + (item.debit_amount || 0) - (item.credit_amount || 0);
  }, 0);

  return balance;
}

/**
 * Suggested account mapping based on description/category
 */
export function suggestAccountForExpense(
  category: string,
  description: string
): { accountCode: string; accountName: string } | null {
  const categoryLower = category?.toLowerCase() || '';
  const descLower = description?.toLowerCase() || '';

  // Keyword-based mapping
  const mappings: Record<string, { accountCode: string; accountName: string }> = {
    salary: { accountCode: '5210', accountName: 'Salaries & Wages' },
    wage: { accountCode: '5210', accountName: 'Salaries & Wages' },
    rent: { accountCode: '5220', accountName: 'Rent' },
    electric: { accountCode: '5230', accountName: 'Electricity' },
    power: { accountCode: '5230', accountName: 'Electricity' },
    phone: { accountCode: '5240', accountName: 'Telephone & Internet' },
    internet: { accountCode: '5240', accountName: 'Telephone & Internet' },
    broadband: { accountCode: '5240', accountName: 'Telephone & Internet' },
    travel: { accountCode: '5250', accountName: 'Travel & Conveyance' },
    transport: { accountCode: '5250', accountName: 'Travel & Conveyance' },
    flight: { accountCode: '5250', accountName: 'Travel & Conveyance' },
    uber: { accountCode: '5250', accountName: 'Travel & Conveyance' },
    stationery: { accountCode: '5260', accountName: 'Printing & Stationery' },
    printing: { accountCode: '5260', accountName: 'Printing & Stationery' },
    repair: { accountCode: '5270', accountName: 'Repairs & Maintenance' },
    maintenance: { accountCode: '5270', accountName: 'Repairs & Maintenance' },
    insurance: { accountCode: '5280', accountName: 'Insurance' },
    advertising: { accountCode: '5290', accountName: 'Advertising & Marketing' },
    marketing: { accountCode: '5290', accountName: 'Advertising & Marketing' },
    legal: { accountCode: '5300', accountName: 'Professional Fees' },
    consultant: { accountCode: '5300', accountName: 'Professional Fees' },
    bank: { accountCode: '5310', accountName: 'Bank Charges' },
  };

  // Check description first
  for (const [keyword, account] of Object.entries(mappings)) {
    if (descLower.includes(keyword)) {
      return account;
    }
  }

  // Check category
  for (const [keyword, account] of Object.entries(mappings)) {
    if (categoryLower.includes(keyword)) {
      return account;
    }
  }

  // Default to Operating Expenses
  return { accountCode: '5200', accountName: 'Operating Expenses' };
}

/**
 * Suggested account for income
 */
export function suggestAccountForIncome(
  category: string,
  description: string
): { accountCode: string; accountName: string } {
  const categoryLower = category?.toLowerCase() || '';
  const descLower = description?.toLowerCase() || '';

  if (descLower.includes('interest') || categoryLower.includes('interest')) {
    return { accountCode: '4210', accountName: 'Interest Income' };
  }

  if (descLower.includes('dividend') || categoryLower.includes('dividend')) {
    return { accountCode: '4220', accountName: 'Dividend Income' };
  }

  if (descLower.includes('rent') || categoryLower.includes('rent')) {
    return { accountCode: '4230', accountName: 'Rental Income' };
  }

  if (descLower.includes('service') || categoryLower.includes('service')) {
    return { accountCode: '4120', accountName: 'Sales - Services' };
  }

  // Default to Sales
  return { accountCode: '4100', accountName: 'Sales' };
}

/**
 * Export accounts to CSV
 */
export async function exportAccountsToCSV(): Promise<string> {
  const accounts = await getChartOfAccounts();

  const headers = [
    'Account Code',
    'Account Name',
    'Type',
    'Category',
    'Opening Balance',
    'Current Balance',
    'Active',
    'Description'
  ].join(',');

  const rows = accounts.map(acc => [
    acc.account_code,
    `"${acc.account_name}"`,
    acc.account_type,
    acc.category || '',
    acc.opening_balance,
    acc.current_balance,
    acc.is_active ? 'Yes' : 'No',
    `"${acc.description || ''}"`
  ].join(','));

  return [headers, ...rows].join('\n');
}
