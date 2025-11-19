// WhatsApp Session Management
// Persistent session storage using Supabase instead of in-memory Map

export interface WhatsAppSession {
  id?: string;
  phone_number: string;
  client_id?: string;
  accountant_id?: string;
  state: SessionState;
  document_id?: string;
  document_type?: string;
  kyc_checklist_item_id?: string;
  context?: any;
  last_activity: string;
  expires_at: string;
}

export type SessionState =
  | 'idle'
  | 'awaiting_document_type'
  | 'awaiting_document'
  | 'awaiting_confirmation'
  | 'processing'
  | 'kyc_flow'
  | 'awaiting_kyc_document'
  | 'payment_tracking';

/**
 * Get or create session for a phone number
 */
export async function getOrCreateSession(
  supabase: any,
  phoneNumber: string,
  clientId?: string,
  accountantId?: string
): Promise<WhatsAppSession> {
  // Try to get existing active session
  const { data: existingSessions } = await supabase
    .from('whatsapp_sessions')
    .select('*')
    .eq('phone_number', phoneNumber)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1);

  if (existingSessions && existingSessions.length > 0) {
    const session = existingSessions[0];

    // Update last activity and extend expiry
    await supabase
      .from('whatsapp_sessions')
      .update({
        last_activity: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        client_id: clientId || session.client_id,
        accountant_id: accountantId || session.accountant_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id);

    return {
      ...session,
      client_id: clientId || session.client_id,
      accountant_id: accountantId || session.accountant_id,
    };
  }

  // Create new session
  const newSession = {
    phone_number: phoneNumber,
    client_id: clientId,
    accountant_id: accountantId,
    state: 'idle' as SessionState,
    context: {},
    last_activity: new Date().toISOString(),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: createdSession, error } = await supabase
    .from('whatsapp_sessions')
    .insert(newSession)
    .select()
    .single();

  if (error) {
    console.error('Error creating session:', error);
    throw new Error('Failed to create session');
  }

  return createdSession;
}

/**
 * Update session state
 */
export async function updateSession(
  supabase: any,
  phoneNumber: string,
  updates: Partial<WhatsAppSession>
): Promise<void> {
  const updateData = {
    ...updates,
    last_activity: new Date().toISOString(),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('whatsapp_sessions')
    .update(updateData)
    .eq('phone_number', phoneNumber)
    .gt('expires_at', new Date().toISOString());

  if (error) {
    console.error('Error updating session:', error);
  }
}

/**
 * Get current session
 */
export async function getSession(
  supabase: any,
  phoneNumber: string
): Promise<WhatsAppSession | null> {
  const { data: sessions } = await supabase
    .from('whatsapp_sessions')
    .select('*')
    .eq('phone_number', phoneNumber)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1);

  return sessions && sessions.length > 0 ? sessions[0] : null;
}

/**
 * Clear session (logout/reset)
 */
export async function clearSession(
  supabase: any,
  phoneNumber: string
): Promise<void> {
  await supabase
    .from('whatsapp_sessions')
    .update({
      state: 'idle',
      document_id: null,
      document_type: null,
      kyc_checklist_item_id: null,
      context: {},
      updated_at: new Date().toISOString(),
    })
    .eq('phone_number', phoneNumber);

  console.log(`🧹 Cleared session for ${phoneNumber}`);
}

/**
 * Delete expired sessions (cleanup job)
 */
export async function cleanupExpiredSessions(supabase: any): Promise<number> {
  const { data: deleted } = await supabase
    .from('whatsapp_sessions')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select('id');

  const count = deleted ? deleted.length : 0;
  if (count > 0) {
    console.log(`🧹 Cleaned up ${count} expired sessions`);
  }

  return count;
}

/**
 * Set session context (flexible data storage)
 */
export async function setSessionContext(
  supabase: any,
  phoneNumber: string,
  key: string,
  value: any
): Promise<void> {
  const session = await getSession(supabase, phoneNumber);
  if (!session) return;

  const context = session.context || {};
  context[key] = value;

  await updateSession(supabase, phoneNumber, { context });
}

/**
 * Get session context value
 */
export async function getSessionContext(
  supabase: any,
  phoneNumber: string,
  key: string
): Promise<any> {
  const session = await getSession(supabase, phoneNumber);
  if (!session || !session.context) return null;

  return session.context[key];
}

/**
 * Check if rate limit is exceeded for this phone number
 */
export async function checkRateLimit(
  supabase: any,
  phoneNumber: string,
  maxRequests: number = 20,
  windowMinutes: number = 60
): Promise<boolean> {
  const { data: rateLimitData } = await supabase
    .from('whatsapp_rate_limits')
    .select('*')
    .eq('phone_number', phoneNumber)
    .single();

  // If blocked, check if block has expired
  if (rateLimitData?.blocked_until) {
    const blockedUntil = new Date(rateLimitData.blocked_until);
    if (blockedUntil > new Date()) {
      console.log(`🚫 Rate limit: ${phoneNumber} is blocked until ${blockedUntil.toISOString()}`);
      return false;
    }
  }

  // Check if window has reset
  const windowStart = rateLimitData?.window_start ? new Date(rateLimitData.window_start) : null;
  const windowAge = windowStart ? (Date.now() - windowStart.getTime()) / 1000 / 60 : Infinity;

  if (!windowStart || windowAge >= windowMinutes) {
    // Start new window
    await supabase
      .from('whatsapp_rate_limits')
      .upsert({
        phone_number: phoneNumber,
        request_count: 1,
        window_start: new Date().toISOString(),
        blocked_until: null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'phone_number'
      });

    return true;
  }

  // Check if limit exceeded
  const currentCount = rateLimitData?.request_count || 0;

  if (currentCount >= maxRequests) {
    // Block for 1 hour
    await supabase
      .from('whatsapp_rate_limits')
      .update({
        blocked_until: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('phone_number', phoneNumber);

    console.log(`🚫 Rate limit exceeded for ${phoneNumber}: ${currentCount} requests in ${Math.round(windowAge)} minutes`);
    return false;
  }

  // Increment counter
  await supabase
    .from('whatsapp_rate_limits')
    .update({
      request_count: currentCount + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('phone_number', phoneNumber);

  return true;
}

/**
 * Log WhatsApp message for analytics
 */
export async function logWhatsAppMessage(
  supabase: any,
  phoneNumber: string,
  direction: 'inbound' | 'outbound',
  messageType: string,
  messageContent: any,
  clientId?: string,
  accountantId?: string,
  whatsappMessageId?: string
): Promise<void> {
  await supabase
    .from('whatsapp_messages')
    .insert({
      phone_number: phoneNumber,
      direction,
      message_type: messageType,
      client_id: clientId,
      accountant_id: accountantId,
      message_content: messageContent,
      whatsapp_message_id: whatsappMessageId,
      status: direction === 'inbound' ? 'received' : 'sent',
      created_at: new Date().toISOString(),
    });
}

/**
 * Get session stats for analytics
 */
export async function getSessionStats(
  supabase: any,
  accountantId?: string,
  startDate?: string,
  endDate?: string
): Promise<any> {
  let query = supabase
    .from('whatsapp_sessions')
    .select('state, created_at');

  if (accountantId) {
    query = query.eq('accountant_id', accountantId);
  }

  if (startDate) {
    query = query.gte('created_at', startDate);
  }

  if (endDate) {
    query = query.lte('created_at', endDate);
  }

  const { data: sessions } = await query;

  if (!sessions) return {};

  const stats = {
    total: sessions.length,
    byState: {} as { [key: string]: number },
    avgSessionsPerDay: 0,
  };

  sessions.forEach(session => {
    stats.byState[session.state] = (stats.byState[session.state] || 0) + 1;
  });

  if (startDate && endDate) {
    const days = (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24);
    stats.avgSessionsPerDay = days > 0 ? stats.total / days : stats.total;
  }

  return stats;
}
