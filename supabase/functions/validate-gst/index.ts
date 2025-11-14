// Supabase Edge Function: validate-gst
// Real-time GST

IN validation against government database
// Endpoint: POST /validate-gst
// Body: { gstin: string }
// Response: { valid: boolean, details: {...} }

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GSTValidationResult {
  valid: boolean;
  format_valid: boolean;
  checksum_valid: boolean;
  status?: 'Active' | 'Cancelled' | 'Suspended' | 'Unknown';
  legal_name?: string;
  trade_name?: string;
  registration_date?: string;
  state_jurisdiction?: string;
  state_code?: string;
  business_type?: string;
  taxpayer_type?: string;
  constitution_of_business?: string;
  address?: string;
  last_updated?: string;
  error?: string;
  source: 'checksum' | 'api' | 'cached';
}

/**
 * Validate GSTIN format
 */
function isValidGSTINFormat(gstin: string): boolean {
  if (!gstin || gstin.length !== 15) return false;

  // Pattern: [0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}
  const pattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return pattern.test(gstin);
}

/**
 * Validate GSTIN checksum
 */
function validateGSTINChecksum(gstin: string): boolean {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const checksum = gstin[14];

  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const value = chars.indexOf(gstin[i]);
    if (value === -1) return false;

    const factor = (i % 2 === 0) ? 1 : 2;
    let product = value * factor;

    if (product > 9) {
      product = Math.floor(product / 10) + (product % 10);
    }

    sum += product;
  }

  const calculatedChecksum = (10 - (sum % 10)) % 10;
  return chars[calculatedChecksum] === checksum;
}

/**
 * Extract details from GSTIN
 */
function extractGSTINDetails(gstin: string): { state_code: string; pan: string; entity_code: string } {
  return {
    state_code: gstin.substring(0, 2),
    pan: gstin.substring(2, 12),
    entity_code: gstin.substring(12, 13),
  };
}

/**
 * Get state name from code
 */
function getStateName(code: string): string {
  const stateMap: Record<string, string> = {
    '01': 'Jammu and Kashmir',
    '02': 'Himachal Pradesh',
    '03': 'Punjab',
    '04': 'Chandigarh',
    '05': 'Uttarakhand',
    '06': 'Haryana',
    '07': 'Delhi',
    '08': 'Rajasthan',
    '09': 'Uttar Pradesh',
    '10': 'Bihar',
    '11': 'Sikkim',
    '12': 'Arunachal Pradesh',
    '13': 'Nagaland',
    '14': 'Manipur',
    '15': 'Mizoram',
    '16': 'Tripura',
    '17': 'Meghalaya',
    '18': 'Assam',
    '19': 'West Bengal',
    '20': 'Jharkhand',
    '21': 'Odisha',
    '22': 'Chhattisgarh',
    '23': 'Madhya Pradesh',
    '24': 'Gujarat',
    '26': 'Dadra and Nagar Haveli and Daman and Diu',
    '27': 'Maharashtra',
    '29': 'Karnataka',
    '30': 'Goa',
    '31': 'Lakshadweep',
    '32': 'Kerala',
    '33': 'Tamil Nadu',
    '34': 'Puducherry',
    '35': 'Andaman and Nicobar Islands',
    '36': 'Telangana',
    '37': 'Andhra Pradesh',
  };

  return stateMap[code] || 'Unknown';
}

/**
 * Validate GSTIN via external API (if configured)
 * Options:
 * 1. Official GST Portal API (requires registration)
 * 2. KnowYourGST API (https://knowyourgst.com/api)
 * 3. Masters India API (https://api.mastersindia.co/)
 */
async function validateViaAPI(gstin: string): Promise<GSTValidationResult> {
  // Check for API configuration
  const apiProvider = Deno.env.get("GST_API_PROVIDER"); // 'knowyourgst' | 'mastersindia' | 'gstn'
  const apiKey = Deno.env.get("GST_API_KEY");

  if (!apiProvider || !apiKey) {
    console.log('⚠️ GST API not configured - using checksum validation only');
    return {
      valid: false,
      format_valid: isValidGSTINFormat(gstin),
      checksum_valid: validateGSTINChecksum(gstin),
      source: 'checksum',
      error: 'API not configured'
    };
  }

  try {
    let apiUrl: string;
    let headers: Record<string, string>;

    switch (apiProvider) {
      case 'knowyourgst':
        apiUrl = `https://api.knowyourgst.com/v1/gstin/${gstin}`;
        headers = {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        };
        break;

      case 'mastersindia':
        apiUrl = `https://api.mastersindia.co/gstinDetails?gstin=${gstin}`;
        headers = {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        };
        break;

      case 'gstn':
        // Official GSTN API (requires more complex auth)
        apiUrl = `https://api.gstsystem.in/taxpayerapi/v1.0/publicapi/search?gstin=${gstin}`;
        headers = {
          'apikey': apiKey,
          'username': Deno.env.get("GST_USERNAME") || '',
          'Content-Type': 'application/json'
        };
        break;

      default:
        throw new Error(`Unknown API provider: ${apiProvider}`);
    }

    console.log(`🔍 Validating GSTIN via ${apiProvider}...`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    // Parse response based on provider
    let result: GSTValidationResult;

    switch (apiProvider) {
      case 'knowyourgst':
        result = {
          valid: data.valid && data.status === 'Active',
          format_valid: true,
          checksum_valid: true,
          status: data.status,
          legal_name: data.legalName || data.legal_name,
          trade_name: data.tradeName || data.trade_name,
          registration_date: data.registrationDate || data.registration_date,
          state_jurisdiction: data.state,
          state_code: gstin.substring(0, 2),
          business_type: data.businessType || data.business_type,
          taxpayer_type: data.taxpayerType || data.taxpayer_type,
          constitution_of_business: data.constitutionOfBusiness,
          address: data.address,
          last_updated: new Date().toISOString(),
          source: 'api'
        };
        break;

      case 'mastersindia':
      case 'gstn':
        result = {
          valid: data.sts === 'Active' || data.status === 'Active',
          format_valid: true,
          checksum_valid: true,
          status: data.sts || data.status,
          legal_name: data.lgnm || data.legalName,
          trade_name: data.tradeNam || data.tradeName,
          registration_date: data.rgdt || data.registrationDate,
          state_jurisdiction: data.stj || data.state,
          state_code: gstin.substring(0, 2),
          business_type: data.dty || data.businessType,
          taxpayer_type: data.ctb || data.taxpayerType,
          address: data.pradr?.addr || data.address,
          last_updated: new Date().toISOString(),
          source: 'api'
        };
        break;

      default:
        throw new Error('Unknown provider');
    }

    console.log(`✅ GSTIN validated: ${result.status} - ${result.legal_name}`);
    return result;

  } catch (error) {
    console.error('❌ API validation failed:', error);

    // Fallback to checksum validation
    return {
      valid: validateGSTINChecksum(gstin),
      format_valid: isValidGSTINFormat(gstin),
      checksum_valid: validateGSTINChecksum(gstin),
      source: 'checksum',
      error: error instanceof Error ? error.message : 'API call failed'
    };
  }
}

/**
 * Main handler
 */
serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json() as { gstin: string };

    if (!body.gstin) {
      return new Response(
        JSON.stringify({ error: "gstin is required" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const gstin = body.gstin.replace(/\s/g, '').toUpperCase();

    console.log(`📋 Validating GSTIN: ${gstin}`);

    // Step 1: Format validation
    const format_valid = isValidGSTINFormat(gstin);
    if (!format_valid) {
      return new Response(
        JSON.stringify({
          valid: false,
          format_valid: false,
          checksum_valid: false,
          error: 'Invalid GSTIN format (must be 15 characters: 2 digits, 5 letters, 4 digits, 1 letter, 1 alphanumeric, Z, 1 alphanumeric)',
          source: 'checksum'
        }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Checksum validation
    const checksum_valid = validateGSTINChecksum(gstin);

    // Step 3: Extract details
    const details = extractGSTINDetails(gstin);
    const state_name = getStateName(details.state_code);

    // Step 4: Try API validation (if configured)
    const apiResult = await validateViaAPI(gstin);

    // Step 5: Combine results
    const result: GSTValidationResult = {
      ...apiResult,
      format_valid,
      checksum_valid,
      state_code: details.state_code,
      state_jurisdiction: apiResult.state_jurisdiction || state_name,
    };

    // If API failed but checksum is valid, still return partial success
    if (!result.valid && checksum_valid && result.source === 'checksum') {
      result.valid = true;
      result.status = 'Unknown';
    }

    console.log(`📊 Validation result: ${result.valid ? '✅ Valid' : '❌ Invalid'} (${result.source})`);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('❌ Validation error:', error);
    return new Response(
      JSON.stringify({
        valid: false,
        format_valid: false,
        checksum_valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'checksum'
      }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
