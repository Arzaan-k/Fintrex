/**
 * Smart Categorization System
 * AI-POWERED auto-categorization of expenses and vendors
 * Learns from corrections and improves over time
 */

import { supabase } from "@/integrations/supabase/client";

export interface VendorMapping {
  id?: string;
  accountant_id: string;
  vendor_name: string;
  normalized_name: string;
  category: string;
  account_code?: string;
  account_name?: string;
  confidence: number;
  usage_count: number;
  last_used: string;
  created_at?: string;
}

export interface CategorySuggestion {
  category: string;
  account_code: string;
  account_name: string;
  confidence: number;
  reason: string;
}

/**
 * Normalize vendor name (remove noise, standardize)
 */
export function normalizeVendorName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ') // Multiple spaces to single
    .replace(/[^\w\s]/g, '') // Remove special chars
    .replace(/\b(pvt|ltd|limited|private|inc|corp|llc|llp)\b/g, '') // Remove company suffixes
    .trim();
}

/**
 * Get or create vendor mapping
 */
export async function getVendorMapping(vendorName: string): Promise<VendorMapping | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const normalized = normalizeVendorName(vendorName);

  const { data, error } = await supabase
    .from('vendor_mappings')
    .select('*')
    .eq('accountant_id', user.id)
    .eq('normalized_name', normalized)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching vendor mapping:', error);
  }

  return data;
}

/**
 * Save or update vendor mapping
 */
export async function saveVendorMapping(mapping: Omit<VendorMapping, 'id' | 'created_at'>): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const normalized = normalizeVendorName(mapping.vendor_name);

  // Check if exists
  const existing = await getVendorMapping(mapping.vendor_name);

  if (existing) {
    // Update
    await supabase
      .from('vendor_mappings')
      .update({
        category: mapping.category,
        account_code: mapping.account_code,
        account_name: mapping.account_name,
        confidence: Math.min(existing.confidence + 0.1, 1.0), // Increase confidence
        usage_count: existing.usage_count + 1,
        last_used: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    // Create
    await supabase
      .from('vendor_mappings')
      .insert({
        accountant_id: user.id,
        vendor_name: mapping.vendor_name,
        normalized_name: normalized,
        category: mapping.category,
        account_code: mapping.account_code,
        account_name: mapping.account_name,
        confidence: mapping.confidence,
        usage_count: 1,
        last_used: new Date().toISOString(),
      });
  }
}

/**
 * AI-Powered Smart Categorization
 */
export async function suggestCategory(
  vendorName: string,
  description: string,
  amount: number
): Promise<CategorySuggestion> {
  // 1. Check vendor mapping (highest priority)
  const vendorMapping = await getVendorMapping(vendorName);
  if (vendorMapping && vendorMapping.confidence > 0.8) {
    return {
      category: vendorMapping.category,
      account_code: vendorMapping.account_code || '5200',
      account_name: vendorMapping.account_name || 'Operating Expenses',
      confidence: vendorMapping.confidence,
      reason: `Previously categorized as "${vendorMapping.category}" (${vendorMapping.usage_count} times)`,
    };
  }

  // 2. Keyword-based categorization
  const keywords = buildCategoryKeywords();
  const text = `${vendorName} ${description}`.toLowerCase();

  for (const [category, data] of Object.entries(keywords)) {
    for (const keyword of data.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        return {
          category: data.displayName,
          account_code: data.accountCode,
          account_name: data.accountName,
          confidence: 0.85,
          reason: `Matched keyword: "${keyword}"`,
        };
      }
    }
  }

  // 3. Amount-based heuristics
  if (amount > 100000) {
    return {
      category: 'Capital Expenses',
      account_code: '1500',
      account_name: 'Fixed Assets',
      confidence: 0.6,
      reason: 'Large amount (>₹1L) - likely capital expense',
    };
  }

  if (amount < 100) {
    return {
      category: 'Petty Cash',
      account_code: '5910',
      account_name: 'Other Expenses',
      confidence: 0.5,
      reason: 'Small amount (<₹100) - likely petty cash',
    };
  }

  // 4. Default fallback
  return {
    category: 'Uncategorized',
    account_code: '5200',
    account_name: 'Operating Expenses',
    confidence: 0.3,
    reason: 'No match found - default category',
  };
}

/**
 * Build category keywords mapping
 */
function buildCategoryKeywords(): Record<string, {
  displayName: string;
  accountCode: string;
  accountName: string;
  keywords: string[];
}> {
  return {
    travel: {
      displayName: 'Travel & Conveyance',
      accountCode: '5250',
      accountName: 'Travel & Conveyance',
      keywords: [
        'uber', 'ola', 'taxi', 'cab', 'flight', 'airline', 'indigo', 'air india',
        'spicejet', 'hotel', 'accommodation', 'train', 'irctc', 'bus', 'travel',
        'makemytrip', 'goibibo', 'cleartrip', 'booking', 'airbnb', 'oyo', 'stay',
      ],
    },
    salary: {
      displayName: 'Salaries & Wages',
      accountCode: '5210',
      accountName: 'Salaries & Wages',
      keywords: [
        'salary', 'wage', 'payroll', 'staff', 'employee', 'compensation', 'bonus',
      ],
    },
    rent: {
      displayName: 'Rent',
      accountCode: '5220',
      accountName: 'Rent',
      keywords: [
        'rent', 'lease', 'office space', 'shop rent', 'property',
      ],
    },
    utilities: {
      displayName: 'Utilities',
      accountCode: '5230',
      accountName: 'Electricity',
      keywords: [
        'electricity', 'power', 'bescom', 'mseb', 'tneb', 'adani power', 'tata power',
        'water', 'gas', 'lpg', 'utility', 'municipal',
      ],
    },
    telecom: {
      displayName: 'Telephone & Internet',
      accountCode: '5240',
      accountName: 'Telephone & Internet',
      keywords: [
        'airtel', 'jio', 'vi', 'vodafone', 'idea', 'bsnl', 'broadband', 'internet',
        'wifi', 'phone', 'mobile', 'telecom', 'act fibernet', 'hathway', 'tikona',
      ],
    },
    it_services: {
      displayName: 'IT & Software',
      accountCode: '5300',
      accountName: 'Professional Fees',
      keywords: [
        'aws', 'amazon web services', 'google cloud', 'gcp', 'azure', 'microsoft',
        'github', 'gitlab', 'netlify', 'vercel', 'heroku', 'digitalocean', 'software',
        'saas', 'subscription', 'domain', 'hosting', 'server', 'cloud',
      ],
    },
    marketing: {
      displayName: 'Advertising & Marketing',
      accountCode: '5290',
      accountName: 'Advertising & Marketing',
      keywords: [
        'google ads', 'facebook ads', 'meta', 'instagram', 'linkedin ads', 'twitter ads',
        'advertising', 'marketing', 'seo', 'campaign', 'promotion', 'branding',
      ],
    },
    stationery: {
      displayName: 'Printing & Stationery',
      accountCode: '5260',
      accountName: 'Printing & Stationery',
      keywords: [
        'stationery', 'printing', 'paper', 'pen', 'notebook', 'amazon basics',
        'office depot', 'staples', 'xerox', 'print',
      ],
    },
    repairs: {
      displayName: 'Repairs & Maintenance',
      accountCode: '5270',
      accountName: 'Repairs & Maintenance',
      keywords: [
        'repair', 'maintenance', 'fixing', 'service', 'mechanic', 'plumber',
        'electrician', 'technician', 'spare parts',
      ],
    },
    insurance: {
      displayName: 'Insurance',
      accountCode: '5280',
      accountName: 'Insurance',
      keywords: [
        'insurance', 'policy', 'lic', 'hdfc ergo', 'icici lombard', 'bajaj allianz',
        'tata aig', 'new india assurance', 'premium',
      ],
    },
    legal: {
      displayName: 'Professional Fees',
      accountCode: '5300',
      accountName: 'Professional Fees',
      keywords: [
        'legal', 'lawyer', 'advocate', 'attorney', 'consultant', 'ca', 'chartered accountant',
        'auditor', 'tax advisor', 'compliance', 'professional',
      ],
    },
    bank: {
      displayName: 'Bank Charges',
      accountCode: '5310',
      accountName: 'Bank Charges',
      keywords: [
        'bank charge', 'bank fee', 'transaction fee', 'processing fee', 'atm charge',
        'hdfc', 'icici', 'sbi', 'axis', 'kotak', 'yes bank',
      ],
    },
    food: {
      displayName: 'Food & Beverages',
      accountCode: '5200',
      accountName: 'Operating Expenses',
      keywords: [
        'swiggy', 'zomato', 'restaurant', 'food', 'cafe', 'coffee', 'starbucks',
        'mcdonald', 'kfc', 'dominos', 'pizza', 'meal', 'lunch', 'dinner',
      ],
    },
  };
}

/**
 * Learn from user correction
 */
export async function learnFromCorrection(
  vendorName: string,
  originalCategory: string,
  correctedCategory: string,
  correctedAccountCode: string,
  correctedAccountName: string
): Promise<void> {
  console.log(`🧠 Learning: ${vendorName} → ${correctedCategory} (was: ${originalCategory})`);

  await saveVendorMapping({
    accountant_id: '', // Will be filled by saveVendorMapping
    vendor_name: vendorName,
    normalized_name: normalizeVendorName(vendorName),
    category: correctedCategory,
    account_code: correctedAccountCode,
    account_name: correctedAccountName,
    confidence: 0.95, // High confidence after manual correction
    usage_count: 0,
    last_used: new Date().toISOString(),
  });
}

/**
 * Get vendor statistics
 */
export async function getVendorStats(): Promise<{
  total_vendors: number;
  high_confidence: number; // >0.8
  medium_confidence: number; // 0.5-0.8
  low_confidence: number; // <0.5
  top_vendors: Array<{ vendor_name: string; category: string; usage_count: number }>;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      total_vendors: 0,
      high_confidence: 0,
      medium_confidence: 0,
      low_confidence: 0,
      top_vendors: [],
    };
  }

  const { data: mappings } = await supabase
    .from('vendor_mappings')
    .select('*')
    .eq('accountant_id', user.id);

  if (!mappings) {
    return {
      total_vendors: 0,
      high_confidence: 0,
      medium_confidence: 0,
      low_confidence: 0,
      top_vendors: [],
    };
  }

  const total = mappings.length;
  const high = mappings.filter(m => m.confidence > 0.8).length;
  const medium = mappings.filter(m => m.confidence >= 0.5 && m.confidence <= 0.8).length;
  const low = mappings.filter(m => m.confidence < 0.5).length;

  const topVendors = mappings
    .sort((a, b) => b.usage_count - a.usage_count)
    .slice(0, 10)
    .map(m => ({
      vendor_name: m.vendor_name,
      category: m.category,
      usage_count: m.usage_count,
    }));

  return {
    total_vendors: total,
    high_confidence: high,
    medium_confidence: medium,
    low_confidence: low,
    top_vendors: topVendors,
  };
}

/**
 * Bulk categorize documents
 */
export async function bulkCategorize(documentIds: string[]): Promise<{
  success: number;
  failed: number;
  results: Array<{ document_id: string; category: CategorySuggestion; error?: string }>;
}> {
  const results: Array<{ document_id: string; category: CategorySuggestion; error?: string }> = [];
  let success = 0;
  let failed = 0;

  for (const docId of documentIds) {
    try {
      // Get document extracted data
      const { data: doc } = await supabase
        .from('documents')
        .select('extracted_data')
        .eq('id', docId)
        .single();

      if (!doc || !doc.extracted_data) {
        results.push({ document_id: docId, category: {} as any, error: 'No extracted data' });
        failed++;
        continue;
      }

      const extracted = doc.extracted_data as any;
      const vendorName = extracted.vendor?.name || 'Unknown';
      const description = extracted.description || '';
      const amount = extracted.totalAmount || 0;

      const suggestion = await suggestCategory(vendorName, description, amount);

      // Update document with suggested category
      await supabase
        .from('documents')
        .update({
          extracted_data: {
            ...extracted,
            suggested_category: suggestion.category,
            suggested_account: suggestion.account_name,
          }
        })
        .eq('id', docId);

      results.push({ document_id: docId, category: suggestion });
      success++;
    } catch (error: any) {
      results.push({ document_id: docId, category: {} as any, error: error.message });
      failed++;
    }
  }

  return { success, failed, results };
}
