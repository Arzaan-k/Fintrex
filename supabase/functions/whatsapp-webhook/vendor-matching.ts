// Vendor matching and normalization logic
// Uses fuzzy matching to identify and normalize vendor names

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching of vendor names
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate similarity score between two strings (0 to 1)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1.0;

  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  return 1.0 - distance / maxLength;
}

/**
 * Normalize vendor name for comparison
 * Removes common suffixes, special characters, and standardizes format
 */
export function normalizeVendorName(name: string): string {
  if (!name) return '';

  let normalized = name
    .toLowerCase()
    .trim()
    // Remove common business suffixes
    .replace(/\s+(pvt\.?|pvt\s+ltd\.?|private\s+limited|limited|ltd\.?|llp|llc|inc\.?|corporation|corp\.?)$/i, '')
    // Remove special characters but keep spaces
    .replace(/[^\w\s]/g, '')
    // Remove extra spaces
    .replace(/\s+/g, ' ')
    .trim();

  return normalized;
}

/**
 * Extract keywords from vendor name for matching
 */
function extractKeywords(name: string): string[] {
  const normalized = normalizeVendorName(name);
  const words = normalized.split(' ');

  // Remove common words that don't help in matching
  const stopWords = ['the', 'and', 'of', 'for', 'in', 'on', 'at', 'to', 'a', 'an'];

  return words.filter(word => word.length > 2 && !stopWords.includes(word));
}

/**
 * Match vendor by GSTIN
 * Exact match - highest priority
 */
export async function matchVendorByGSTIN(
  supabase: any,
  accountantId: string,
  gstin: string
): Promise<any | null> {
  if (!gstin || gstin.length !== 15) return null;

  const { data: vendors } = await supabase
    .from('vendor_master')
    .select('*')
    .eq('accountant_id', accountantId)
    .eq('gstin', gstin)
    .eq('is_active', true)
    .limit(1);

  return vendors && vendors.length > 0 ? vendors[0] : null;
}

/**
 * Match vendor by PAN
 * Exact match - high priority
 */
export async function matchVendorByPAN(
  supabase: any,
  accountantId: string,
  pan: string
): Promise<any | null> {
  if (!pan || pan.length !== 10) return null;

  const { data: vendors } = await supabase
    .from('vendor_master')
    .select('*')
    .eq('accountant_id', accountantId)
    .eq('pan', pan)
    .eq('is_active', true)
    .limit(1);

  return vendors && vendors.length > 0 ? vendors[0] : null;
}

/**
 * Match vendor by name using fuzzy matching
 * Returns best match if similarity > threshold
 */
export async function matchVendorByName(
  supabase: any,
  accountantId: string,
  vendorName: string,
  threshold: number = 0.85
): Promise<{ vendor: any; similarity: number } | null> {
  if (!vendorName || vendorName.trim() === '') return null;

  // Get all vendors for this accountant
  const { data: vendors } = await supabase
    .from('vendor_master')
    .select('*')
    .eq('accountant_id', accountantId)
    .eq('is_active', true);

  if (!vendors || vendors.length === 0) return null;

  const normalizedInput = normalizeVendorName(vendorName);
  let bestMatch: any = null;
  let bestSimilarity = 0;

  for (const vendor of vendors) {
    // Check primary name
    const primarySimilarity = calculateSimilarity(normalizedInput, normalizeVendorName(vendor.primary_name));

    if (primarySimilarity > bestSimilarity) {
      bestSimilarity = primarySimilarity;
      bestMatch = vendor;
    }

    // Check alternate names
    if (vendor.alternate_names && Array.isArray(vendor.alternate_names)) {
      for (const altName of vendor.alternate_names) {
        const altSimilarity = calculateSimilarity(normalizedInput, normalizeVendorName(altName));
        if (altSimilarity > bestSimilarity) {
          bestSimilarity = altSimilarity;
          bestMatch = vendor;
        }
      }
    }

    // Keyword matching for partial matches
    const inputKeywords = extractKeywords(vendorName);
    const vendorKeywords = extractKeywords(vendor.primary_name);

    if (inputKeywords.length > 0 && vendorKeywords.length > 0) {
      const matchingKeywords = inputKeywords.filter(kw => vendorKeywords.includes(kw));
      const keywordSimilarity = matchingKeywords.length / Math.max(inputKeywords.length, vendorKeywords.length);

      if (keywordSimilarity > 0.7 && keywordSimilarity > bestSimilarity) {
        bestSimilarity = keywordSimilarity;
        bestMatch = vendor;
      }
    }
  }

  if (bestSimilarity >= threshold) {
    return { vendor: bestMatch, similarity: bestSimilarity };
  }

  return null;
}

/**
 * Find or create vendor with intelligent matching
 * Priority: GSTIN > PAN > Fuzzy Name Match > Create New
 */
export async function findOrCreateVendor(
  supabase: any,
  accountantId: string,
  vendorData: {
    name: string;
    gstin?: string;
    pan?: string;
    phone?: string;
    email?: string;
    address?: string;
  }
): Promise<{ vendor: any; isNew: boolean; matchType: string }> {
  // 1. Try exact GSTIN match
  if (vendorData.gstin) {
    const vendorByGSTIN = await matchVendorByGSTIN(supabase, accountantId, vendorData.gstin);
    if (vendorByGSTIN) {
      // Update alternate names if this is a new variation
      const normalizedInput = normalizeVendorName(vendorData.name);
      const normalizedPrimary = normalizeVendorName(vendorByGSTIN.primary_name);

      if (normalizedInput !== normalizedPrimary) {
        const alternateNames = vendorByGSTIN.alternate_names || [];
        if (!alternateNames.some((alt: string) => normalizeVendorName(alt) === normalizedInput)) {
          alternateNames.push(vendorData.name);

          await supabase
            .from('vendor_master')
            .update({ alternate_names: alternateNames, updated_at: new Date().toISOString() })
            .eq('id', vendorByGSTIN.id);
        }
      }

      return { vendor: vendorByGSTIN, isNew: false, matchType: 'gstin' };
    }
  }

  // 2. Try exact PAN match
  if (vendorData.pan) {
    const vendorByPAN = await matchVendorByPAN(supabase, accountantId, vendorData.pan);
    if (vendorByPAN) {
      return { vendor: vendorByPAN, isNew: false, matchType: 'pan' };
    }
  }

  // 3. Try fuzzy name match
  const vendorByName = await matchVendorByName(supabase, accountantId, vendorData.name);
  if (vendorByName) {
    console.log(`📋 Matched vendor "${vendorData.name}" to "${vendorByName.vendor.primary_name}" with ${(vendorByName.similarity * 100).toFixed(1)}% similarity`);
    return { vendor: vendorByName.vendor, isNew: false, matchType: 'fuzzy_name' };
  }

  // 4. Create new vendor
  console.log(`✨ Creating new vendor: ${vendorData.name}`);

  const newVendor = {
    accountant_id: accountantId,
    primary_name: vendorData.name,
    alternate_names: [],
    gstin: vendorData.gstin || null,
    pan: vendorData.pan || null,
    phone_number: vendorData.phone || null,
    email: vendorData.email || null,
    address: vendorData.address || null,
    is_active: true,
    total_transactions: 0,
    total_amount: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: createdVendor, error } = await supabase
    .from('vendor_master')
    .insert(newVendor)
    .select()
    .single();

  if (error) {
    console.error('Error creating vendor:', error);
    throw new Error(`Failed to create vendor: ${error.message}`);
  }

  return { vendor: createdVendor, isNew: true, matchType: 'new' };
}

/**
 * Update vendor transaction stats
 */
export async function updateVendorStats(
  supabase: any,
  vendorId: string,
  transactionAmount: number
): Promise<void> {
  await supabase.rpc('increment_vendor_stats', {
    p_vendor_id: vendorId,
    p_amount: transactionAmount
  });

  // If RPC doesn't exist, use direct update
  const { data: vendor } = await supabase
    .from('vendor_master')
    .select('total_transactions, total_amount')
    .eq('id', vendorId)
    .single();

  if (vendor) {
    await supabase
      .from('vendor_master')
      .update({
        total_transactions: (vendor.total_transactions || 0) + 1,
        total_amount: (vendor.total_amount || 0) + transactionAmount,
        updated_at: new Date().toISOString()
      })
      .eq('id', vendorId);
  }
}

/**
 * Get vendor suggestions for autocomplete
 */
export async function getVendorSuggestions(
  supabase: any,
  accountantId: string,
  searchTerm: string,
  limit: number = 5
): Promise<any[]> {
  if (!searchTerm || searchTerm.trim().length < 2) return [];

  const normalizedSearch = normalizeVendorName(searchTerm);

  const { data: vendors } = await supabase
    .from('vendor_master')
    .select('*')
    .eq('accountant_id', accountantId)
    .eq('is_active', true)
    .order('total_transactions', { ascending: false })
    .limit(50); // Get top vendors first

  if (!vendors) return [];

  // Score and sort by relevance
  const scoredVendors = vendors.map(vendor => {
    const nameSimilarity = calculateSimilarity(normalizedSearch, normalizeVendorName(vendor.primary_name));

    // Boost score for frequently used vendors
    const frequencyBoost = Math.min(vendor.total_transactions / 100, 0.2);

    return {
      ...vendor,
      relevanceScore: nameSimilarity + frequencyBoost
    };
  });

  return scoredVendors
    .filter(v => v.relevanceScore > 0.3)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit);
}

/**
 * Merge duplicate vendors
 */
export async function mergeDuplicateVendors(
  supabase: any,
  primaryVendorId: string,
  duplicateVendorId: string
): Promise<void> {
  // Get both vendors
  const { data: vendors } = await supabase
    .from('vendor_master')
    .select('*')
    .in('id', [primaryVendorId, duplicateVendorId]);

  if (!vendors || vendors.length !== 2) {
    throw new Error('Both vendors must exist to merge');
  }

  const primary = vendors.find(v => v.id === primaryVendorId);
  const duplicate = vendors.find(v => v.id === duplicateVendorId);

  // Merge alternate names
  const mergedAlternateNames = [
    ...new Set([
      ...primary.alternate_names || [],
      ...duplicate.alternate_names || [],
      duplicate.primary_name
    ])
  ];

  // Update all invoices to point to primary vendor
  await supabase
    .from('invoices')
    .update({ vendor_id: primaryVendorId })
    .eq('vendor_id', duplicateVendorId);

  // Update primary vendor with merged data
  await supabase
    .from('vendor_master')
    .update({
      alternate_names: mergedAlternateNames,
      total_transactions: primary.total_transactions + duplicate.total_transactions,
      total_amount: primary.total_amount + duplicate.total_amount,
      gstin: primary.gstin || duplicate.gstin,
      pan: primary.pan || duplicate.pan,
      phone_number: primary.phone_number || duplicate.phone_number,
      email: primary.email || duplicate.email,
      updated_at: new Date().toISOString()
    })
    .eq('id', primaryVendorId);

  // Deactivate duplicate vendor
  await supabase
    .from('vendor_master')
    .update({
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', duplicateVendorId);

  console.log(`✅ Merged vendor ${duplicateVendorId} into ${primaryVendorId}`);
}
