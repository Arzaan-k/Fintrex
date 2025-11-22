// WhatsApp Notification Service
// Handles all automated notifications from the system to clients via WhatsApp
// deno-lint-ignore-file no-explicit-any

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN") || "";
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const APP_URL = Deno.env.get("APP_URL") || "https://app.fintrex.ai";

const JSON_HEADERS = { "content-type": "application/json" } as const;

function ok(body: any = { status: "ok" }) {
  return new Response(JSON.stringify(body), { status: 200, headers: JSON_HEADERS });
}

function bad(body: any, status = 400) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

// Send WhatsApp message via Meta API
async function sendWhatsAppMessage(to: string, message: any): Promise<boolean> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: to,
          ...message,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Failed to send WhatsApp message:", errorText);
      return false;
    }

    const result = await response.json();
    console.log(`✅ WhatsApp message sent successfully to ${to}:`, result);
    return true;
  } catch (error) {
    console.error("❌ Error sending WhatsApp message:", error);
    return false;
  }
}

// Notification: Document status update
async function notifyDocumentStatus(payload: any, supabase: any): Promise<boolean> {
  const { document_id, status, client_id } = payload;

  // Get document details
  const { data: document } = await supabase
    .from('documents')
    .select('*, clients(phone_number, business_name, contact_person)')
    .eq('id', document_id)
    .single();

  if (!document || !document.clients?.phone_number) {
    console.log(`⚠️ No phone number for document ${document_id}`);
    return false;
  }

  const phoneNumber = document.clients.phone_number;
  let messageText = '';

  switch (status) {
    case 'processing':
      messageText = `⏳ *Processing Update*\n\nYour document "${document.file_name}" is being processed.\n\nWe're extracting data using AI. This usually takes 5-15 seconds.`;
      break;

    case 'completed':
      messageText = `✅ *Document Completed!*\n\nYour document "${document.file_name}" has been successfully processed and added to your books! 📊\n\nYou can view it in your dashboard.`;
      break;

    case 'failed':
      messageText = `❌ *Processing Failed*\n\nSorry, we couldn't process "${document.file_name}".\n\nPlease try uploading again or contact support.`;
      break;

    case 'review_pending':
      messageText = `⚠️ *Review Required*\n\nYour document "${document.file_name}" needs manual review.\n\nYour accountant will verify the details soon.`;
      break;

    default:
      messageText = `📄 *Status Update*\n\nYour document "${document.file_name}" status: ${status}`;
  }

  return await sendWhatsAppMessage(phoneNumber, {
    type: "text",
    text: { body: messageText },
  });
}

// Notification: Payment reminder
async function notifyPaymentReminder(payload: any, supabase: any): Promise<boolean> {
  const { invoice_id, client_id, due_date, reminder_type } = payload;

  // Get invoice and client details
  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, clients(phone_number, business_name, contact_person)')
    .eq('id', invoice_id)
    .single();

  if (!invoice || !invoice.clients?.phone_number) {
    console.log(`⚠️ No phone number for invoice ${invoice_id}`);
    return false;
  }

  const phoneNumber = invoice.clients.phone_number;
  const daysUntilDue = Math.ceil((new Date(due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  let messageText = '';
  let buttons = [];

  if (reminder_type === 'overdue') {
    messageText = `🔴 *Payment Overdue!*\n\n` +
                  `Invoice: ${invoice.invoice_number}\n` +
                  `Vendor: ${invoice.vendor_name}\n` +
                  `Amount: ₹${invoice.grand_total}\n` +
                  `Due Date: ${new Date(due_date).toLocaleDateString()}\n\n` +
                  `This payment is overdue by ${Math.abs(daysUntilDue)} days.\n\n` +
                  `Please process the payment as soon as possible.`;
  } else if (daysUntilDue <= 3) {
    messageText = `⚠️ *Payment Due Soon!*\n\n` +
                  `Invoice: ${invoice.invoice_number}\n` +
                  `Vendor: ${invoice.vendor_name}\n` +
                  `Amount: ₹${invoice.grand_total}\n` +
                  `Due Date: ${new Date(due_date).toLocaleDateString()}\n\n` +
                  `Payment is due in ${daysUntilDue} day(s).\n\n` +
                  `Please ensure timely payment to avoid penalties.`;
  } else {
    messageText = `📅 *Payment Reminder*\n\n` +
                  `Invoice: ${invoice.invoice_number}\n` +
                  `Vendor: ${invoice.vendor_name}\n` +
                  `Amount: ₹${invoice.grand_total}\n` +
                  `Due Date: ${new Date(due_date).toLocaleDateString()}\n\n` +
                  `Payment is due in ${daysUntilDue} days.`;
  }

  return await sendWhatsAppMessage(phoneNumber, {
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: messageText },
      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: `mark_paid_${invoice_id}`,
              title: "✅ Mark as Paid",
            },
          },
          {
            type: "reply",
            reply: {
              id: `view_invoice_${invoice_id}`,
              title: "👁️ View Invoice",
            },
          },
        ],
      },
    },
  });
}

// Notification: Journal entry created
async function notifyJournalEntry(payload: any, supabase: any): Promise<boolean> {
  const { journal_entry_id, client_id } = payload;

  // Get journal entry and client details
  const { data: entry } = await supabase
    .from('journal_entries')
    .select('*, clients(phone_number, business_name, contact_person)')
    .eq('id', journal_entry_id)
    .single();

  if (!entry || !entry.clients?.phone_number) {
    console.log(`⚠️ No phone number for journal entry ${journal_entry_id}`);
    return false;
  }

  const phoneNumber = entry.clients.phone_number;

  const messageText = `📊 *Transaction Recorded*\n\n` +
                      `A new transaction has been added to your books:\n\n` +
                      `Date: ${new Date(entry.transaction_date).toLocaleDateString()}\n` +
                      `Description: ${entry.description || 'N/A'}\n` +
                      `Amount: ₹${entry.debit_amount || entry.credit_amount}\n\n` +
                      `Your books are up to date! ✅`;

  return await sendWhatsAppMessage(phoneNumber, {
    type: "text",
    text: { body: messageText },
  });
}

// Notification: Anomaly detected
async function notifyAnomaly(payload: any, supabase: any): Promise<boolean> {
  const { document_id, anomaly_type, details, client_id } = payload;

  // Get document and client details
  const { data: document } = await supabase
    .from('documents')
    .select('*, clients(phone_number, business_name, contact_person)')
    .eq('id', document_id)
    .single();

  if (!document || !document.clients?.phone_number) {
    console.log(`⚠️ No phone number for document ${document_id}`);
    return false;
  }

  const phoneNumber = document.clients.phone_number;

  let anomalyDescription = '';
  switch (anomaly_type) {
    case 'amount_spike':
      anomalyDescription = `Unusual amount detected - significantly higher than typical invoices`;
      break;
    case 'duplicate':
      anomalyDescription = `Possible duplicate invoice detected`;
      break;
    case 'missing_sequence':
      anomalyDescription = `Invoice number sequence gap detected`;
      break;
    case 'tax_mismatch':
      anomalyDescription = `Tax calculation mismatch detected`;
      break;
    default:
      anomalyDescription = `Unusual pattern detected`;
  }

  const messageText = `⚠️ *Anomaly Alert*\n\n` +
                      `Document: ${document.file_name}\n\n` +
                      `Issue: ${anomalyDescription}\n\n` +
                      `${details || 'Please review this document carefully.'}\n\n` +
                      `Your accountant has been notified for review.`;

  return await sendWhatsAppMessage(phoneNumber, {
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: messageText },
      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: `review_anomaly_${document_id}`,
              title: "✏️ Review",
            },
          },
          {
            type: "reply",
            reply: {
              id: `ignore_anomaly_${document_id}`,
              title: "✅ Ignore",
            },
          },
        ],
      },
    },
  });
}

// Notification: GST filing reminder
async function notifyGSTFiling(payload: any, supabase: any): Promise<boolean> {
  const { client_id, filing_period, filing_type, due_date } = payload;

  // Get client details
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', client_id)
    .single();

  if (!client || !client.phone_number) {
    console.log(`⚠️ No phone number for client ${client_id}`);
    return false;
  }

  const phoneNumber = client.phone_number;
  const daysUntilDue = Math.ceil((new Date(due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  const messageText = `📋 *GST Filing Reminder*\n\n` +
                      `Filing Type: ${filing_type}\n` +
                      `Period: ${filing_period}\n` +
                      `Due Date: ${new Date(due_date).toLocaleDateString()}\n\n` +
                      `⏰ Due in ${daysUntilDue} days\n\n` +
                      `Your accountant will prepare and file your GST return.`;

  return await sendWhatsAppMessage(phoneNumber, {
    type: "text",
    text: { body: messageText },
  });
}

// Notification: Monthly financial summary
async function notifyMonthlySummary(payload: any, supabase: any): Promise<boolean> {
  const { client_id, month, year } = payload;

  // Get client details
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', client_id)
    .single();

  if (!client || !client.phone_number) {
    console.log(`⚠️ No phone number for client ${client_id}`);
    return false;
  }

  // Get financial summary for the month
  const startDate = new Date(year, month - 1, 1).toISOString();
  const endDate = new Date(year, month, 0).toISOString();

  const { data: income } = await supabase
    .from('financial_records')
    .select('amount')
    .eq('client_id', client_id)
    .eq('record_type', 'income')
    .gte('transaction_date', startDate)
    .lte('transaction_date', endDate);

  const { data: expenses } = await supabase
    .from('financial_records')
    .select('amount')
    .eq('client_id', client_id)
    .eq('record_type', 'expense')
    .gte('transaction_date', startDate)
    .lte('transaction_date', endDate);

  const totalIncome = income?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
  const totalExpenses = expenses?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
  const netProfit = totalIncome - totalExpenses;

  const monthName = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long' });

  const messageText = `📊 *Monthly Financial Summary*\n\n` +
                      `Period: ${monthName} ${year}\n\n` +
                      `💰 Total Income: ₹${totalIncome.toLocaleString()}\n` +
                      `💸 Total Expenses: ₹${totalExpenses.toLocaleString()}\n` +
                      `${netProfit >= 0 ? '✅' : '⚠️'} Net Profit: ₹${netProfit.toLocaleString()}\n\n` +
                      `📈 View detailed reports in your dashboard: ${APP_URL}/financials`;

  return await sendWhatsAppMessage(client.phone_number, {
    type: "text",
    text: { body: messageText },
  });
}

// Notification: KYC document request
async function notifyKYCRequest(payload: any, supabase: any): Promise<boolean> {
  const { client_id, document_type, due_date } = payload;

  // Get client details
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', client_id)
    .single();

  if (!client || !client.phone_number) {
    console.log(`⚠️ No phone number for client ${client_id}`);
    return false;
  }

  const phoneNumber = client.phone_number;
  const daysUntilDue = due_date ? Math.ceil((new Date(due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  const messageText = `🆔 *KYC Document Required*\n\n` +
                      `Please upload: ${document_type}\n\n` +
                      (daysUntilDue ? `⏰ Required within ${daysUntilDue} days\n\n` : '') +
                      `To upload, reply with "upload" or send the document directly.`;

  return await sendWhatsAppMessage(phoneNumber, {
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: messageText },
      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: "upload_kyc",
              title: "📤 Upload Now",
            },
          },
        ],
      },
    },
  });
}

// Notification: Document request reminder
async function notifyDocumentRequest(payload: any, supabase: any): Promise<boolean> {
  const { client_id, document_type, priority, reminder_count } = payload;

  // Get client details
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', client_id)
    .single();

  if (!client || !client.phone_number) {
    console.log(`⚠️ No phone number for client ${client_id}`);
    return false;
  }

  const phoneNumber = client.phone_number;
  const isUrgent = priority === 'high' || reminder_count >= 2;

  const messageText = `${isUrgent ? '🔴' : '📄'} *Document Request ${reminder_count > 0 ? `(Reminder #${reminder_count})` : ''}*\n\n` +
                      `Please upload: ${document_type}\n\n` +
                      (isUrgent ? '⚠️ This is urgent - please upload as soon as possible.\n\n' : '') +
                      `Reply with "upload" or send the document directly.`;

  return await sendWhatsAppMessage(phoneNumber, {
    type: "text",
    text: { body: messageText },
  });
}

// Notification: Payment confirmation
async function notifyPaymentConfirmation(payload: any, supabase: any): Promise<boolean> {
  const { invoice_id, client_id, payment_amount, payment_date } = payload;

  // Get invoice and client details
  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, clients(phone_number, business_name, contact_person)')
    .eq('id', invoice_id)
    .single();

  if (!invoice || !invoice.clients?.phone_number) {
    console.log(`⚠️ No phone number for invoice ${invoice_id}`);
    return false;
  }

  const phoneNumber = invoice.clients.phone_number;

  const messageText = `✅ *Payment Recorded*\n\n` +
                      `Invoice: ${invoice.invoice_number}\n` +
                      `Vendor: ${invoice.vendor_name}\n` +
                      `Amount Paid: ₹${payment_amount}\n` +
                      `Payment Date: ${new Date(payment_date).toLocaleDateString()}\n\n` +
                      `Your payment has been recorded in your books! 📊`;

  return await sendWhatsAppMessage(phoneNumber, {
    type: "text",
    text: { body: messageText },
  });
}

// Main handler
serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return bad({ error: "Method not allowed" }, 405);
  }

  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Missing required environment variables");
    return bad({ error: "Server configuration error" }, 500);
  }

  try {
    const payload = await req.json();
    const { notification_type, ...notificationPayload } = payload;

    console.log(`📨 Processing notification: ${notification_type}`, notificationPayload);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });

    let success = false;

    switch (notification_type) {
      case 'document_status':
        success = await notifyDocumentStatus(notificationPayload, supabase);
        break;

      case 'payment_reminder':
        success = await notifyPaymentReminder(notificationPayload, supabase);
        break;

      case 'journal_entry':
        success = await notifyJournalEntry(notificationPayload, supabase);
        break;

      case 'anomaly':
        success = await notifyAnomaly(notificationPayload, supabase);
        break;

      case 'gst_filing':
        success = await notifyGSTFiling(notificationPayload, supabase);
        break;

      case 'monthly_summary':
        success = await notifyMonthlySummary(notificationPayload, supabase);
        break;

      case 'kyc_request':
        success = await notifyKYCRequest(notificationPayload, supabase);
        break;

      case 'document_request':
        success = await notifyDocumentRequest(notificationPayload, supabase);
        break;

      case 'payment_confirmation':
        success = await notifyPaymentConfirmation(notificationPayload, supabase);
        break;

      default:
        console.error(`❌ Unknown notification type: ${notification_type}`);
        return bad({ error: `Unknown notification type: ${notification_type}` }, 400);
    }

    if (success) {
      console.log(`✅ Notification sent successfully: ${notification_type}`);
      return ok({ success: true, notification_type });
    } else {
      console.error(`❌ Failed to send notification: ${notification_type}`);
      return ok({ success: false, notification_type, message: "Failed to send notification" });
    }

  } catch (error) {
    console.error("❌ Error processing notification:", error);
    return bad({ error: String(error) }, 500);
  }
});
