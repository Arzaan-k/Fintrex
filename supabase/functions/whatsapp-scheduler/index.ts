// WhatsApp Notification Scheduler
// Runs periodically (e.g., via cron job) to send scheduled notifications
// - Monthly financial summaries
// - Payment reminders (3 days before, on due date, overdue)
// - GST filing reminders
// - KYC document reminders
// - Document request escalations

// deno-lint-ignore-file no-explicit-any

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const JSON_HEADERS = { "content-type": "application/json" } as const;

function ok(body: any = { status: "ok" }) {
  return new Response(JSON.stringify(body), { status: 200, headers: JSON_HEADERS });
}

function bad(body: any, status = 400) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

// Call WhatsApp notification service
async function sendNotification(notificationType: string, payload: any): Promise<boolean> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-notify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        notification_type: notificationType,
        ...payload,
      }),
    });

    const result = await response.json();
    return result.success === true;
  } catch (error) {
    console.error(`❌ Failed to send ${notificationType} notification:`, error);
    return false;
  }
}

// Check and send payment reminders
async function processPaymentReminders(supabase: any): Promise<number> {
  console.log('📅 Processing payment reminders...');

  const today = new Date();
  const threeDaysFromNow = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);

  // Get pending payment reminders that are due within 3 days or overdue
  const { data: reminders, error } = await supabase
    .from('payment_reminders')
    .select('*, invoices(invoice_number, vendor_name, grand_total, clients(phone_number))')
    .in('status', ['pending', 'reminded'])
    .lte('due_date', threeDaysFromNow.toISOString().split('T')[0])
    .order('due_date', { ascending: true });

  if (error) {
    console.error('❌ Error fetching payment reminders:', error);
    return 0;
  }

  if (!reminders || reminders.length === 0) {
    console.log('✅ No payment reminders to process');
    return 0;
  }

  let sentCount = 0;

  for (const reminder of reminders) {
    const dueDate = new Date(reminder.due_date);
    const isOverdue = dueDate < today;
    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Determine if we should send a reminder
    let shouldSend = false;
    let newStatus = reminder.status;
    let reminderType = 'upcoming';

    if (isOverdue && reminder.status !== 'overdue') {
      // First time marking as overdue
      shouldSend = true;
      newStatus = 'overdue';
      reminderType = 'overdue';
    } else if (isOverdue && reminder.reminder_count < 3) {
      // Send reminder for overdue invoices (max 3 reminders)
      const daysSinceLastReminder = reminder.last_reminder_sent
        ? Math.ceil((today.getTime() - new Date(reminder.last_reminder_sent).getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      if (daysSinceLastReminder >= 3) {
        shouldSend = true;
        reminderType = 'overdue';
      }
    } else if (daysUntilDue <= 3 && daysUntilDue >= 0) {
      // Send reminder 3 days before, 1 day before, and on due date
      const daysSinceLastReminder = reminder.last_reminder_sent
        ? Math.ceil((today.getTime() - new Date(reminder.last_reminder_sent).getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      if (daysSinceLastReminder >= 1 || !reminder.last_reminder_sent) {
        shouldSend = true;
        newStatus = 'reminded';
        reminderType = 'upcoming';
      }
    }

    if (shouldSend) {
      const success = await sendNotification('payment_reminder', {
        invoice_id: reminder.invoice_id,
        client_id: reminder.client_id,
        due_date: reminder.due_date,
        reminder_type: reminderType,
      });

      if (success) {
        await supabase
          .from('payment_reminders')
          .update({
            status: newStatus,
            reminder_count: reminder.reminder_count + 1,
            last_reminder_sent: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', reminder.id);

        sentCount++;
        console.log(`✅ Sent payment reminder for invoice ${reminder.invoices?.invoice_number}`);
      }
    }
  }

  console.log(`✅ Sent ${sentCount} payment reminders`);
  return sentCount;
}

// Send monthly financial summaries
async function sendMonthlySummaries(supabase: any): Promise<number> {
  console.log('📊 Processing monthly financial summaries...');

  const today = new Date();
  const isFirstDayOfMonth = today.getDate() === 1;

  if (!isFirstDayOfMonth) {
    console.log('✅ Not first day of month, skipping monthly summaries');
    return 0;
  }

  // Get previous month
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const month = lastMonth.getMonth() + 1;
  const year = lastMonth.getFullYear();

  // Get all active clients
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, phone_number, business_name')
    .eq('status', 'active')
    .not('phone_number', 'is', null);

  if (error) {
    console.error('❌ Error fetching clients:', error);
    return 0;
  }

  if (!clients || clients.length === 0) {
    console.log('✅ No active clients to send summaries to');
    return 0;
  }

  let sentCount = 0;

  for (const client of clients) {
    const success = await sendNotification('monthly_summary', {
      client_id: client.id,
      month,
      year,
    });

    if (success) {
      sentCount++;
      console.log(`✅ Sent monthly summary to ${client.business_name}`);
    }

    // Add small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`✅ Sent ${sentCount} monthly summaries`);
  return sentCount;
}

// Send GST filing reminders
async function sendGSTFilingReminders(supabase: any): Promise<number> {
  console.log('📋 Processing GST filing reminders...');

  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  // GST filing deadlines:
  // GSTR-1: 11th of next month
  // GSTR-3B: 20th of next month
  // Send reminders 5 days before deadline

  const remindersToSend: any[] = [];

  // Check if we should send GSTR-1 reminders (on 6th of the month)
  if (today.getDate() === 6) {
    const { data: clients } = await supabase
      .from('clients')
      .select('id, business_name, gst_number, phone_number')
      .eq('status', 'active')
      .not('gst_number', 'is', null)
      .not('phone_number', 'is', null);

    if (clients && clients.length > 0) {
      for (const client of clients) {
        remindersToSend.push({
          client_id: client.id,
          filing_period: `${currentMonth < 10 ? '0' : ''}${currentMonth}/${currentYear}`,
          filing_type: 'GSTR-1',
          due_date: new Date(currentYear, currentMonth, 11).toISOString().split('T')[0],
        });
      }
    }
  }

  // Check if we should send GSTR-3B reminders (on 15th of the month)
  if (today.getDate() === 15) {
    const { data: clients } = await supabase
      .from('clients')
      .select('id, business_name, gst_number, phone_number')
      .eq('status', 'active')
      .not('gst_number', 'is', null)
      .not('phone_number', 'is', null);

    if (clients && clients.length > 0) {
      for (const client of clients) {
        remindersToSend.push({
          client_id: client.id,
          filing_period: `${currentMonth < 10 ? '0' : ''}${currentMonth}/${currentYear}`,
          filing_type: 'GSTR-3B',
          due_date: new Date(currentYear, currentMonth, 20).toISOString().split('T')[0],
        });
      }
    }
  }

  let sentCount = 0;

  for (const reminder of remindersToSend) {
    const success = await sendNotification('gst_filing', reminder);

    if (success) {
      sentCount++;
      console.log(`✅ Sent ${reminder.filing_type} reminder to client ${reminder.client_id}`);
    }

    // Add small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`✅ Sent ${sentCount} GST filing reminders`);
  return sentCount;
}

// Send KYC document reminders
async function sendKYCReminders(supabase: any): Promise<number> {
  console.log('🆔 Processing KYC reminders...');

  // Get KYC checklist items that are pending and due soon
  const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  const { data: kycItems, error } = await supabase
    .from('client_kyc_checklists')
    .select('*, clients(phone_number, business_name)')
    .eq('status', 'pending')
    .lte('due_date', threeDaysFromNow.toISOString().split('T')[0])
    .lt('reminder_count', 3)
    .order('due_date', { ascending: true });

  if (error) {
    console.error('❌ Error fetching KYC items:', error);
    return 0;
  }

  if (!kycItems || kycItems.length === 0) {
    console.log('✅ No KYC reminders to send');
    return 0;
  }

  let sentCount = 0;

  for (const item of kycItems) {
    const daysSinceLastReminder = item.last_reminder_sent
      ? Math.ceil((Date.now() - new Date(item.last_reminder_sent).getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    // Send reminder every 2 days (max 3 reminders)
    if (daysSinceLastReminder >= 2 || !item.last_reminder_sent) {
      const success = await sendNotification('kyc_request', {
        client_id: item.client_id,
        document_type: item.document_type,
        due_date: item.due_date,
      });

      if (success) {
        await supabase
          .from('client_kyc_checklists')
          .update({
            reminder_count: item.reminder_count + 1,
            last_reminder_sent: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        sentCount++;
        console.log(`✅ Sent KYC reminder for ${item.document_type} to ${item.clients?.business_name}`);
      }
    }
  }

  console.log(`✅ Sent ${sentCount} KYC reminders`);
  return sentCount;
}

// Send document request reminders
async function sendDocumentRequestReminders(supabase: any): Promise<number> {
  console.log('📄 Processing document request reminders...');

  const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  const { data: requests, error } = await supabase
    .from('document_requests')
    .select('*, clients(phone_number, business_name)')
    .eq('status', 'pending')
    .lte('expires_at', threeDaysFromNow.toISOString())
    .lt('reminder_count', 3)
    .order('priority', { ascending: false })
    .order('expires_at', { ascending: true });

  if (error) {
    console.error('❌ Error fetching document requests:', error);
    return 0;
  }

  if (!requests || requests.length === 0) {
    console.log('✅ No document request reminders to send');
    return 0;
  }

  let sentCount = 0;

  for (const request of requests) {
    const daysSinceLastReminder = request.last_reminder_sent
      ? Math.ceil((Date.now() - new Date(request.last_reminder_sent).getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    const daysUntilExpiry = Math.ceil((new Date(request.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const isUrgent = request.priority === 'high' || daysUntilExpiry <= 1;

    // Send reminders based on urgency
    const reminderInterval = isUrgent ? 1 : 2;

    if (daysSinceLastReminder >= reminderInterval || !request.last_reminder_sent) {
      const success = await sendNotification('document_request', {
        client_id: request.client_id,
        document_type: request.document_type,
        priority: request.priority,
        reminder_count: request.reminder_count + 1,
      });

      if (success) {
        await supabase
          .from('document_requests')
          .update({
            reminder_count: request.reminder_count + 1,
            last_reminder_sent: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', request.id);

        sentCount++;
        console.log(`✅ Sent document request reminder for ${request.document_type} to ${request.clients?.business_name}`);
      }
    }
  }

  console.log(`✅ Sent ${sentCount} document request reminders`);
  return sentCount;
}

// Cleanup expired sessions
async function cleanupExpiredSessions(supabase: any): Promise<number> {
  console.log('🧹 Cleaning up expired sessions...');

  const { data: deleted, error } = await supabase
    .from('whatsapp_sessions')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select('id');

  if (error) {
    console.error('❌ Error cleaning up sessions:', error);
    return 0;
  }

  const count = deleted ? deleted.length : 0;
  console.log(`✅ Cleaned up ${count} expired sessions`);
  return count;
}

// Main handler
serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST" && req.method !== "GET") {
    return bad({ error: "Method not allowed" }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Missing required environment variables");
    return bad({ error: "Server configuration error" }, 500);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });

    console.log('🚀 Starting WhatsApp notification scheduler...');

    const results = {
      timestamp: new Date().toISOString(),
      payment_reminders: 0,
      monthly_summaries: 0,
      gst_filing_reminders: 0,
      kyc_reminders: 0,
      document_request_reminders: 0,
      sessions_cleaned: 0,
    };

    // Run all scheduled tasks
    results.payment_reminders = await processPaymentReminders(supabase);
    results.monthly_summaries = await sendMonthlySummaries(supabase);
    results.gst_filing_reminders = await sendGSTFilingReminders(supabase);
    results.kyc_reminders = await sendKYCReminders(supabase);
    results.document_request_reminders = await sendDocumentRequestReminders(supabase);
    results.sessions_cleaned = await cleanupExpiredSessions(supabase);

    const totalNotifications =
      results.payment_reminders +
      results.monthly_summaries +
      results.gst_filing_reminders +
      results.kyc_reminders +
      results.document_request_reminders;

    console.log(`✅ Scheduler completed: ${totalNotifications} notifications sent, ${results.sessions_cleaned} sessions cleaned`);

    return ok({
      success: true,
      total_notifications_sent: totalNotifications,
      ...results,
    });

  } catch (error) {
    console.error("❌ Error in scheduler:", error);
    return bad({ error: String(error) }, 500);
  }
});
