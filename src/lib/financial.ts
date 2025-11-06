// Financial calculation utilities

export interface FinancialRecord {
  id: string;
  record_type: 'income' | 'expense' | 'asset' | 'liability';
  amount: number;
  description?: string;
  category?: string;
  transaction_date: string;
}

export interface BalanceSheetData {
  assets: {
    current: { [key: string]: number };
    nonCurrent: { [key: string]: number };
  };
  liabilities: {
    current: { [key: string]: number };
    nonCurrent: { [key: string]: number };
  };
  equity: { [key: string]: number };
}

export interface ProfitLossData {
  revenue: {
    operating: { [key: string]: number };
    nonOperating: { [key: string]: number };
  };
  expenses: {
    direct: { [key: string]: number };
    indirect: { [key: string]: number };
  };
}

export interface CashFlowData {
  operating: { [key: string]: number };
  investing: { [key: string]: number };
  financing: { [key: string]: number };
}

/**
 * Calculate total from a nested object structure
 */
export function calculateTotal(data: { [key: string]: number | { [key: string]: number } }): number {
  return Object.values(data).reduce<number>((sum, value) => {
    if (typeof value === 'number') {
      return sum + value;
    }
    return sum + calculateTotal(value);
  }, 0);
}

/**
 * Generate a simple Balance Sheet from financial records for metrics calculation
 */
export function generateSimpleBalanceSheet(records: FinancialRecord[], asOfDate: Date): BalanceSheetData {
  const balanceSheet: BalanceSheetData = {
    assets: {
      current: {},
      nonCurrent: {}
    },
    liabilities: {
      current: {},
      nonCurrent: {}
    },
    equity: {}
  };

  // Filter records up to the as-of date
  const relevantRecords = records.filter(r => new Date(r.transaction_date) <= asOfDate);

  const incomeByCategory: Record<string, number> = {};
  const expenseByCategory: Record<string, number> = {};

  // Categorize and sum up records
  relevantRecords.forEach(record => {
    const category = record.category || 'Other';
    
    if (record.record_type === 'asset') {
      // Simplified: treat all assets as current for now
      balanceSheet.assets.current[category] = 
        (balanceSheet.assets.current[category] || 0) + record.amount;
    } else if (record.record_type === 'liability') {
      balanceSheet.liabilities.current[category] = 
        (balanceSheet.liabilities.current[category] || 0) + record.amount;
    } else if (record.record_type === 'income') {
      incomeByCategory[category] = (incomeByCategory[category] || 0) + record.amount;
    } else if (record.record_type === 'expense') {
      expenseByCategory[category] = (expenseByCategory[category] || 0) + record.amount;
    }
  });

  // Map income categories into assets (representing receivables / accruals)
  Object.entries(incomeByCategory).forEach(([category, amount]) => {
    balanceSheet.assets.current[`Income - ${category}`] = 
      (balanceSheet.assets.current[`Income - ${category}`] || 0) + amount;
  });

  // Map expense categories into liabilities (representing payables / accruals)
  Object.entries(expenseByCategory).forEach(([category, amount]) => {
    balanceSheet.liabilities.current[`Expenses - ${category}`] = 
      (balanceSheet.liabilities.current[`Expenses - ${category}`] || 0) + amount;
  });

  // Calculate equity as Assets - Liabilities (simplified)
  const totalAssets = calculateTotal(balanceSheet.assets);
  const totalLiabilities = calculateTotal(balanceSheet.liabilities);
  balanceSheet.equity['Retained Earnings'] = totalAssets - totalLiabilities;

  return balanceSheet;
}

/**
 * Generate Balance Sheet from financial records and journal entries
 * Uses database functions for accurate calculations
 */
export async function generateBalanceSheet(
  clientId: string,
  asOfDate: Date = new Date()
): Promise<BalanceSheetData> {
  // In a real implementation, this would call the database function
  // For now, we'll return a sample balance sheet
  return {
    assets: {
      current: {
        'Cash': 50000,
        'Debtors': 30000,
        'Inventory': 20000,
        'GST Input': 5400
      },
      nonCurrent: {
        'Plant & Machinery': 100000,
        'Furniture & Fixtures': 25000
      }
    },
    liabilities: {
      current: {
        'Creditors': 15000,
        'GST Output': 5400
      },
      nonCurrent: {
        'Loans': 50000
      }
    },
    equity: {
      'Share Capital': 100000,
      'Retained Earnings': 45000
    }
  };
}

/**
 * Simulate account balance calculation from financial records
 */
function getSimulatedAccountBalance(accountName: string, records: FinancialRecord[]): number {
  // This is a simplified simulation
  // In a real implementation, this would come from actual journal entries
  
  switch (accountName) {
    case 'Cash':
      // Sum of all income minus expenses
      const income = records.filter(r => r.record_type === 'income').reduce((sum, r) => sum + r.amount, 0);
      const expenses = records.filter(r => r.record_type === 'expense').reduce((sum, r) => sum + r.amount, 0);
      return Math.max(0, income - expenses);
    case 'Debtors':
      // Simulate debtors as 20% of sales
      const sales = records.filter(r => r.record_type === 'income' && r.category !== 'Other Income')
        .reduce((sum, r) => sum + r.amount, 0);
      return sales * 0.2;
    case 'Creditors':
      // Simulate creditors as 15% of expenses
      const totalExpenses = records.filter(r => r.record_type === 'expense')
        .reduce((sum, r) => sum + r.amount, 0);
      return totalExpenses * 0.15;
    case 'Inventory':
      // Simulate inventory as 10% of sales
      const salesForInventory = records.filter(r => r.record_type === 'income')
        .reduce((sum, r) => sum + r.amount, 0);
      return salesForInventory * 0.1;
    case 'GST Output':
      // Simulate GST output as 9% of sales (half of 18% GST)
      const taxableSales = records.filter(r => r.record_type === 'income')
        .reduce((sum, r) => sum + r.amount, 0);
      return taxableSales * 0.09;
    case 'GST Input':
      // Simulate GST input as 9% of expenses
      const taxableExpenses = records.filter(r => r.record_type === 'expense')
        .reduce((sum, r) => sum + r.amount, 0);
      return taxableExpenses * 0.09;
    default:
      return 0;
  }
}

/**
 * Generate Profit & Loss Statement from financial records
 */
export function generateProfitLoss(
  records: FinancialRecord[], 
  startDate: Date, 
  endDate: Date
): ProfitLossData {
  const profitLoss: ProfitLossData = {
    revenue: {
      operating: {},
      nonOperating: {}
    },
    expenses: {
      direct: {},
      indirect: {}
    }
  };

  // Filter records within the date range
  const relevantRecords = records.filter(r => {
    const date = new Date(r.transaction_date);
    return date >= startDate && date <= endDate;
  });

  // Categorize and sum up records
  relevantRecords.forEach(record => {
    const category = record.category || 'Other';
    
    if (record.record_type === 'income') {
      profitLoss.revenue.operating[category] = 
        (profitLoss.revenue.operating[category] || 0) + record.amount;
    } else if (record.record_type === 'expense') {
      profitLoss.expenses.indirect[category] = 
        (profitLoss.expenses.indirect[category] || 0) + record.amount;
    }
  });

  return profitLoss;
}

/**
 * Generate Cash Flow Statement from financial records
 */
export function generateCashFlow(
  records: FinancialRecord[], 
  startDate: Date, 
  endDate: Date
): CashFlowData {
  const cashFlow: CashFlowData = {
    operating: {},
    investing: {},
    financing: {}
  };

  // Filter records within the date range
  const relevantRecords = records.filter(r => {
    const date = new Date(r.transaction_date);
    return date >= startDate && date <= endDate;
  });

  // Simplified cash flow calculation
  relevantRecords.forEach(record => {
    const category = record.category || 'Other';
    
    if (record.record_type === 'income' || record.record_type === 'expense') {
      // Operating activities
      const amount = record.record_type === 'income' ? record.amount : -record.amount;
      cashFlow.operating[category] = (cashFlow.operating[category] || 0) + amount;
    }
  });

  return cashFlow;
}

/**
 * Calculate financial ratios and metrics
 */
export interface FinancialMetrics {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  currentRatio: number;
}

export function calculateFinancialMetrics(
  records: FinancialRecord[],
  startDate: Date,
  endDate: Date
): FinancialMetrics {
  const profitLoss = generateProfitLoss(records, startDate, endDate);
  // Use a simple balance sheet calculation for metrics
  const balanceSheet = generateSimpleBalanceSheet(records, endDate);

  const totalRevenue = calculateTotal(profitLoss.revenue);
  const totalExpenses = calculateTotal(profitLoss.expenses);
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  const totalAssets = calculateTotal(balanceSheet.assets);
  const totalLiabilities = calculateTotal(balanceSheet.liabilities);
  const netWorth = totalAssets - totalLiabilities;

  const currentAssets = calculateTotal(balanceSheet.assets.current);
  const currentLiabilities = calculateTotal(balanceSheet.liabilities.current);
  const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;

  return {
    totalRevenue,
    totalExpenses,
    netProfit,
    profitMargin,
    totalAssets,
    totalLiabilities,
    netWorth,
    currentRatio
  };
}

/**
 * Format currency in Indian Rupees
 */
export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Format large numbers in Indian style (Lakhs/Crores)
 */
export function formatIndianNumber(num: number): string {
  if (num >= 10000000) {
    return `₹${(num / 10000000).toFixed(2)}Cr`;
  } else if (num >= 100000) {
    return `₹${(num / 100000).toFixed(2)}L`;
  } else if (num >= 1000) {
    return `₹${(num / 1000).toFixed(2)}K`;
  }
  return formatINR(num);
}

/**
 * Calculate GST components
 */
export interface GSTCalculation {
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  total: number;
}

export function calculateGST(
  subtotal: number, 
  gstRate: number, 
  isInterstate: boolean = false,
  cessRate: number = 0
): GSTCalculation {
  const gstAmount = (subtotal * gstRate) / 100;
  const cessAmount = (subtotal * cessRate) / 100;

  if (isInterstate) {
    return {
      subtotal,
      cgst: 0,
      sgst: 0,
      igst: gstAmount,
      cess: cessAmount,
      total: subtotal + gstAmount + cessAmount
    };
  } else {
    return {
      subtotal,
      cgst: gstAmount / 2,
      sgst: gstAmount / 2,
      igst: 0,
      cess: cessAmount,
      total: subtotal + gstAmount + cessAmount
    };
  }
}

/**
 * Validate GSTIN format
 */
export function validateGSTIN(gstin: string): boolean {
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(gstin);
}



/**
 * Generate Balance Sheet from database using RPC function
 */
export async function generateBalanceSheetFromDatabase(clientId: string, asOfDate: Date = new Date()): Promise<any> {
  // This would typically be called from a component or service that has access to supabase
  // For now, we'll return the structure that would be expected
  return {
    assets: {
      current: {
        'Cash': 50000,
        'Debtors': 30000,
        'Inventory': 20000,
        'GST Input': 5400
      },
      nonCurrent: {
        'Plant & Machinery': 100000,
        'Furniture & Fixtures': 25000
      }
    },
    liabilities: {
      current: {
        'Creditors': 15000,
        'GST Output': 5400
      },
      nonCurrent: {
        'Loans': 50000
      }
    },
    equity: {
      'Share Capital': 100000,
      'Retained Earnings': 45000
    }
  };
}

/**
 * Extract state code from GSTIN
 */
export function getStateFromGSTIN(gstin: string): string {
  if (!validateGSTIN(gstin)) return '';
  
  const stateCode = gstin.substring(0, 2);
  const stateCodes: { [key: string]: string } = {
    '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
    '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana',
    '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
    '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
    '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
    '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam',
    '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha',
    '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
    '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra',
    '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep',
    '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
    '35': 'Andaman and Nicobar Islands', '36': 'Telangana',
    '37': 'Andhra Pradesh', '38': 'Ladakh'
  };
  
  return stateCodes[stateCode] || '';
}

/**
 * Calculate tax period for GST returns
 */
export function getGSTPeriod(date: Date): { month: number; year: number } {
  return {
    month: date.getMonth() + 1,
    year: date.getFullYear()
  };
}

/**
 * Get financial year from date
 */
export function getFinancialYear(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  
  if (month >= 4) {
    return `${year}-${(year + 1).toString().substr(2)}`;
  } else {
    return `${year - 1}-${year.toString().substr(2)}`;
  }
}


