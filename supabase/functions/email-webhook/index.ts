// Email Webhook Handler for Document Reception
// Receives emails with attachments and processes them automatically
// Supports multiple email providers (Gmail, Outlook, custom SMTP/IMAP)

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

interface EmailMessage {
  from: string;
  to: string;
  subject: string;
  body: string;
  attachments: Array<{
    filename: string;
    contentType: string;
    content: Uint8Array;
    size: number;
  }>;
  messageId: string;
  timestamp: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  if (req.method !== "POST") {
    return bad({ error: "method not allowed" }, 405);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Parse incoming email webhook
    // This supports multiple email webhook formats (SendGrid, Mailgun, custom)
    const payload = await req.json();
    
    let emailMessage: EmailMessage;

    // Detect webhook provider and parse accordingly
    if (payload.email) {
      // Custom format
      emailMessage = payload.email;
    } else if (payload.from && payload.to) {
      // Direct format
      emailMessage = payload as EmailMessage;
    } else if (payload.envelope) {
      // SendGrid format
      emailMessage = parseSendGridWebhook(payload);
    } else if (payload.sender) {
      // Mailgun format
      emailMessage = parseMailgunWebhook(payload);
    } else {
      console.log("Unknown email webhook format:", JSON.stringify(payload).slice(0, 500));
      return ok({ message: "Unknown format, logged for inspection" });
    }

    console.log(`📧 Email received from ${emailMessage.from} to ${emailMessage.to}`);
    console.log(`📎 Attachments: ${emailMessage.attachments.length}`);

    // Extract accountant email domain from "to" address
    // Expected format: {firmslug-userid}@fintrex.email or custom domain
    const toAddress = emailMessage.to.toLowerCase();
    
    // Find accountant by matching email configuration
    const { data: accountants } = await supabase
      .from("profiles")
      .select("id, email, settings, firm_name, full_name")
      .not("settings", "is", null);

    let accountant: any = null;
    
    // Try to match accountant by email settings or generated email
    for (const acc of accountants || []) {
      const settings = acc.settings || {};
      const firmSlug = (acc.firm_name || acc.email?.split('@')[0] || 'accountant')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      const generatedEmail = `${firmSlug}-${acc.id.slice(0, 8)}@fintrex.email`;
      
      if (toAddress.includes(generatedEmail) || 
          (settings.email_config?.custom_email && toAddress.includes(settings.email_config.custom_email))) {
        accountant = acc;
        break;
      }
    }

    if (!accountant) {
      console.error(`❌ No accountant found for email: ${toAddress}`);
      return ok({ message: "No accountant matched" });
    }

    console.log(`✅ Found accountant: ${accountant.full_name || accountant.firm_name}`);
    
    const autoSettings = accountant.settings || {};

    // Find or create client by sender email
    const senderEmail = emailMessage.from.toLowerCase().match(/[\w\.-]+@[\w\.-]+/)?.[0] || emailMessage.from;
    
    let client = await findOrCreateClientByEmail(supabase, senderEmail, accountant.id, autoSettings);
    
    if (!client) {
      console.error(`❌ Failed to find or create client for: ${senderEmail}`);
      return ok({ message: "Client creation failed" });
    }

    console.log(`✅ Client: ${client.client_name}`);

    // Process each attachment
    for (const attachment of emailMessage.attachments) {
      try {
        await processAttachment(
          supabase,
          attachment,
          client.id,
          accountant.id,
          emailMessage,
          autoSettings
        );
      } catch (error) {
        console.error(`❌ Error processing attachment ${attachment.filename}:`, error);
      }
    }

    // Send email acknowledgment if enabled
    if (autoSettings?.automation?.auto_send_acknowledgments !== false) {
      await sendEmailAcknowledgment(
        senderEmail,
        accountant,
        emailMessage.attachments.length,
        autoSettings
      );
    }

    return ok({ 
      message: "Email processed successfully",
      attachments: emailMessage.attachments.length 
    });

  } catch (error) {
    console.error("❌ Error processing email webhook:", error);
    return bad({ error: String(error) }, 500);
  }
});

async function findOrCreateClientByEmail(
  supabase: any,
  email: string,
  accountantId: string,
  settings: any
): Promise<any> {
  // Try to find existing client by email
  const { data: existingClient } = await supabase
    .from("clients")
    .select("*")
    .eq("accountant_id", accountantId)
    .eq("email", email)
    .single();

  if (existingClient) {
    console.log(`✅ Found existing client: ${existingClient.client_name}`);
    return existingClient;
  }

  // Auto-create client if automation is enabled
  if (settings?.automation?.auto_process_documents !== false) {
    const { data: newClient, error } = await supabase
      .from("clients")
      .insert({
        accountant_id: accountantId,
        client_name: `Client_${email.split('@')[0]}`,
        email: email,
        status: "pending_kyc",
        kyc_status: "pending",
        created_via: "email",
      })
      .select()
      .single();

    if (error) {
      console.error("❌ Error creating client:", error);
      return null;
    }

    console.log(`✅ Auto-created client: ${newClient.client_name}`);
    return newClient;
  }

  return null;
}

async function processAttachment(
  supabase: any,
  attachment: any,
  clientId: string,
  accountantId: string,
  emailMessage: EmailMessage,
  settings: any
) {
  const fileName = attachment.filename || `attachment_${Date.now()}`;
  const filePath = `${accountantId}/${clientId}/${Date.now()}_${fileName}`;

  console.log(`📎 Processing attachment: ${fileName}`);

  // Upload to Supabase Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("documents")
    .upload(filePath, attachment.content, {
      contentType: attachment.contentType || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    console.error("❌ Upload error:", uploadError);
    throw uploadError;
  }

  console.log(`✅ File uploaded: ${filePath}`);

  // Get public URL
  const { data: urlData } = supabase.storage
    .from("documents")
    .getPublicUrl(filePath);

  // Create document record
  const { data: document, error: docError } = await supabase
    .from("documents")
    .insert({
      accountant_id: accountantId,
      client_id: clientId,
      file_name: fileName,
      file_path: filePath,
      file_url: urlData.publicUrl,
      file_size: attachment.size,
      mime_type: attachment.contentType,
      status: "pending",
      source: "email",
      metadata: {
        email_message_id: emailMessage.messageId,
        sender_email: emailMessage.from,
        subject: emailMessage.subject,
        received_at: emailMessage.timestamp,
      },
    })
    .select()
    .single();

  if (docError) {
    console.error("❌ Document record error:", docError);
    throw docError;
  }

  console.log(`✅ Document record created: ${document.id}`);

  // Trigger automated processing if enabled
  if (settings?.automation?.auto_process_documents !== false) {
    await supabase.functions.invoke("process-document-auto", {
      body: {
        documentId: document.id,
        clientId: clientId,
        accountantId: accountantId,
        filePath: filePath,
        settings: settings,
      },
    });
    
    console.log(`✅ Document processing triggered for: ${document.id}`);
  }
}

async function sendEmailAcknowledgment(
  to: string,
  accountant: any,
  attachmentCount: number,
  settings: any
) {
  try {
    const message = settings?.branding?.acknowledgment_message || 
      `✅ We've received ${attachmentCount} document${attachmentCount > 1 ? 's' : ''} from you. We're processing them now and will notify you once complete.`;
    
    const firmName = accountant.firm_name || accountant.full_name || "Our Team";
    
    console.log(`📧 Sending acknowledgment to: ${to}`);
    
    // Here you would integrate with your email service (SendGrid, AWS SES, etc.)
    // For now, we'll log it
    console.log(`Email to ${to}: ${message}`);
    
    // TODO: Integrate with email service provider
    // Example for SendGrid:
    // await fetch("https://api.sendgrid.com/v3/mail/send", {
    //   method: "POST",
    //   headers: {
    //     Authorization: `Bearer ${SENDGRID_API_KEY}`,
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify({
    //     personalizations: [{ to: [{ email: to }] }],
    //     from: { email: `noreply@fintrex.email`, name: firmName },
    //     subject: "Documents Received",
    //     content: [{ type: "text/plain", value: message }],
    //   }),
    // });
    
    return true;
  } catch (error) {
    console.error("❌ Error sending acknowledgment:", error);
    return false;
  }
}

function parseSendGridWebhook(payload: any): EmailMessage {
  // Parse SendGrid inbound parse webhook format
  return {
    from: payload.from,
    to: payload.to,
    subject: payload.subject || "",
    body: payload.text || payload.html || "",
    attachments: parseAttachmentsFromSendGrid(payload.attachments || {}),
    messageId: payload.headers?.["message-id"] || "",
    timestamp: new Date().toISOString(),
  };
}

function parseMailgunWebhook(payload: any): EmailMessage {
  // Parse Mailgun webhook format
  return {
    from: payload.sender,
    to: payload.recipient,
    subject: payload.subject || "",
    body: payload["body-plain"] || payload["body-html"] || "",
    attachments: parseAttachmentsFromMailgun(payload.attachments || []),
    messageId: payload["Message-Id"] || "",
    timestamp: new Date(payload.timestamp * 1000).toISOString(),
  };
}

function parseAttachmentsFromSendGrid(attachments: any): any[] {
  // SendGrid sends attachments as a JSON object
  return Object.keys(attachments).map((filename) => ({
    filename,
    contentType: attachments[filename].type,
    content: new Uint8Array(Buffer.from(attachments[filename].content, "base64")),
    size: attachments[filename].content.length,
  }));
}

function parseAttachmentsFromMailgun(attachments: any[]): any[] {
  // Mailgun sends attachments as an array
  return attachments.map((att: any) => ({
    filename: att.filename,
    contentType: att["content-type"],
    content: new Uint8Array(Buffer.from(att.content, "base64")),
    size: att.size,
  }));
}
