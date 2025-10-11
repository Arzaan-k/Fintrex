// Smart Client Identification and Matching System
// Automatically identifies clients from phone numbers or email addresses

import { supabase } from '@/integrations/supabase/client';

export interface ClientMatchResult {
  matched: boolean;
  clientId?: string;
  accountantId?: string;
  confidence: number;
  client?: any;
  reason?: string;
}

/**
 * Match client by phone number (WhatsApp)
 * This is the primary identification method for WhatsApp messages
 */
export async function matchClientByPhone(
  phoneNumber: string,
  accountantId?: string
): Promise<ClientMatchResult> {
  try {
    // Normalize phone number (remove spaces, dashes, etc.)
    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    // Build query
    let query = supabase
      .from('clients')
      .select('*')
      .eq('phone_number', normalizedPhone);

    // If accountant ID is provided, filter by it
    if (accountantId) {
      query = query.eq('accountant_id', accountantId);
    }

    const { data, error } = await query.limit(1).single();

    if (error || !data) {
      return {
        matched: false,
        confidence: 0,
        reason: 'No client found with this phone number'
      };
    }

    return {
      matched: true,
      clientId: data.id,
      accountantId: data.accountant_id,
      confidence: 1.0,
      client: data
    };
  } catch (error) {
    console.error('Error matching client by phone:', error);
    return {
      matched: false,
      confidence: 0,
      reason: 'Error during matching'
    };
  }
}

/**
 * Match client by email address
 * Primary method for email-based document submission
 */
export async function matchClientByEmail(
  email: string,
  accountantId?: string
): Promise<ClientMatchResult> {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    let query = supabase
      .from('clients')
      .select('*')
      .eq('email', normalizedEmail);

    if (accountantId) {
      query = query.eq('accountant_id', accountantId);
    }

    const { data, error } = await query.limit(1).single();

    if (error || !data) {
      return {
        matched: false,
        confidence: 0,
        reason: 'No client found with this email'
      };
    }

    return {
      matched: true,
      clientId: data.id,
      accountantId: data.accountant_id,
      confidence: 1.0,
      client: data
    };
  } catch (error) {
    console.error('Error matching client by email:', error);
    return {
      matched: false,
      confidence: 0,
      reason: 'Error during matching'
    };
  }
}

/**
 * Match client by multiple identifiers
 * Tries phone, email, GSTIN, PAN in order
 */
export async function matchClientByIdentifiers(identifiers: {
  phone?: string;
  email?: string;
  gstin?: string;
  pan?: string;
  accountantId?: string;
}): Promise<ClientMatchResult> {
  // Try phone first (most reliable)
  if (identifiers.phone) {
    const phoneMatch = await matchClientByPhone(identifiers.phone, identifiers.accountantId);
    if (phoneMatch.matched) return phoneMatch;
  }

  // Try email
  if (identifiers.email) {
    const emailMatch = await matchClientByEmail(identifiers.email, identifiers.accountantId);
    if (emailMatch.matched) return emailMatch;
  }

  // Try GSTIN
  if (identifiers.gstin) {
    const gstinMatch = await matchClientByGSTIN(identifiers.gstin, identifiers.accountantId);
    if (gstinMatch.matched) return gstinMatch;
  }

  // Try PAN
  if (identifiers.pan) {
    const panMatch = await matchClientByPAN(identifiers.pan, identifiers.accountantId);
    if (panMatch.matched) return panMatch;
  }

  return {
    matched: false,
    confidence: 0,
    reason: 'No matching client found with provided identifiers'
  };
}

/**
 * Match client by GSTIN
 */
async function matchClientByGSTIN(gstin: string, accountantId?: string): Promise<ClientMatchResult> {
  try {
    let query = supabase
      .from('clients')
      .select('*')
      .eq('gst_number', gstin.toUpperCase());

    if (accountantId) {
      query = query.eq('accountant_id', accountantId);
    }

    const { data, error } = await query.limit(1).single();

    if (error || !data) {
      return { matched: false, confidence: 0 };
    }

    return {
      matched: true,
      clientId: data.id,
      accountantId: data.accountant_id,
      confidence: 0.95,
      client: data
    };
  } catch (error) {
    return { matched: false, confidence: 0 };
  }
}

/**
 * Match client by PAN
 */
async function matchClientByPAN(pan: string, accountantId?: string): Promise<ClientMatchResult> {
  try {
    let query = supabase
      .from('clients')
      .select('*')
      .eq('pan_number', pan.toUpperCase());

    if (accountantId) {
      query = query.eq('accountant_id', accountantId);
    }

    const { data, error } = await query.limit(1).single();

    if (error || !data) {
      return { matched: false, confidence: 0 };
    }

    return {
      matched: true,
      clientId: data.id,
      accountantId: data.accountant_id,
      confidence: 0.9,
      client: data
    };
  } catch (error) {
    return { matched: false, confidence: 0 };
  }
}

/**
 * Get accountant by WhatsApp number
 * Each accountant has a dedicated WhatsApp number
 */
export async function getAccountantByWhatsAppNumber(whatsappNumber: string) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('whatsapp_number', normalizePhoneNumber(whatsappNumber))
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error getting accountant by WhatsApp:', error);
    return null;
  }
}

/**
 * Get accountant by email address
 */
export async function getAccountantByEmail(email: string) {
  try {
    // Check if email matches accountant's dedicated email
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email.toLowerCase())
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error getting accountant by email:', error);
    return null;
  }
}

/**
 * Normalize phone number to standard format
 * Handles: +91XXXXXXXXXX, 91XXXXXXXXXX, 0XXXXXXXXXX, XXXXXXXXXX
 */
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let normalized = phone.replace(/\D/g, '');

  // Remove leading 0 if present
  if (normalized.startsWith('0')) {
    normalized = normalized.substring(1);
  }

  // Add country code if not present
  if (normalized.length === 10) {
    normalized = '91' + normalized;
  }

  // Remove 91 prefix and re-add to ensure consistency
  if (normalized.startsWith('91') && normalized.length === 12) {
    return normalized;
  }

  return normalized;
}

/**
 * Create a temporary client entry for first-time senders
 * This is created when someone sends documents but no profile exists
 */
export async function createTemporaryClient(
  accountantId: string,
  contactInfo: {
    phone?: string;
    email?: string;
    name?: string;
  }
): Promise<{ clientId: string; client: any }> {
  const tempClient = {
    accountant_id: accountantId,
    business_name: contactInfo.name || `Pending Profile - ${contactInfo.phone || contactInfo.email}`,
    contact_person: contactInfo.name || 'Unknown',
    phone_number: contactInfo.phone ? normalizePhoneNumber(contactInfo.phone) : '',
    email: contactInfo.email || null,
    status: 'kyc_pending',
    total_documents: 0,
    completed_documents: 0
  };

  const { data, error } = await supabase
    .from('clients')
    .insert(tempClient)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create temporary client: ${error.message}`);
  }

  return {
    clientId: data.id,
    client: data
  };
}

/**
 * Update client profile from KYC documents
 * Automatically updates client info when KYC docs are processed
 */
export async function updateClientFromKYCData(
  clientId: string,
  kycData: {
    panNumber?: string;
    gstin?: string;
    businessName?: string;
    contactPerson?: string;
    address?: string;
    email?: string;
    phone?: string;
  }
): Promise<boolean> {
  try {
    const updates: any = {};

    if (kycData.panNumber) updates.pan_number = kycData.panNumber.toUpperCase();
    if (kycData.gstin) updates.gst_number = kycData.gstin.toUpperCase();
    if (kycData.businessName) updates.business_name = kycData.businessName;
    if (kycData.contactPerson) updates.contact_person = kycData.contactPerson;
    if (kycData.email) updates.email = kycData.email;
    if (kycData.phone) updates.phone_number = normalizePhoneNumber(kycData.phone);

    const { error } = await supabase
      .from('clients')
      .update(updates)
      .eq('id', clientId);

    if (error) {
      console.error('Error updating client from KYC:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error updating client:', error);
    return false;
  }
}

/**
 * Check if client has completed KYC
 */
export async function isKYCComplete(clientId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('status, pan_number, gst_number')
      .eq('id', clientId)
      .single();

    if (error || !data) return false;

    // KYC is complete if status is active and has PAN/GSTIN
    return data.status === 'active' && (data.pan_number || data.gst_number);
  } catch (error) {
    return false;
  }
}

/**
 * Smart matching with confidence scoring
 * Used when multiple potential matches exist
 */
export async function smartMatch(
  extractedData: any,
  accountantId: string
): Promise<ClientMatchResult> {
  const identifiers = {
    phone: extractedData.phone || extractedData.phoneNumber,
    email: extractedData.email,
    gstin: extractedData.gstin || extractedData.gstNumber,
    pan: extractedData.pan || extractedData.panNumber,
    accountantId
  };

  return await matchClientByIdentifiers(identifiers);
}
