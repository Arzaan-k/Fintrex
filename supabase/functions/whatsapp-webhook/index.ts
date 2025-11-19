// Supabase Edge Function: whatsapp-webhook with Button-Based Interactions
// - GET: verification (hub.mode, hub.verify_token, hub.challenge)
// - POST: handle inbound messages with interactive buttons
// - Complete document processing workflow with user confirmations

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN") || "";
const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || Deno.env.get("VERIFY_TOKEN") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const APP_URL = Deno.env.get("APP_URL") || "https://app.fintrex.ai";

const JSON_HEADERS = { "content-type": "application/json" } as const;

function ok(body: any = { status: "ok" }) { return new Response(JSON.stringify(body), { status: 200, headers: JSON_HEADERS }); }
function bad(body: any, status = 400) { return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS }); }

// Session management (in-memory - for production use Redis or database)
const sessions = new Map<string, {
  state: 'idle' | 'awaiting_document_type' | 'awaiting_document' | 'awaiting_confirmation' | 'processing';
  documentId?: string;
  clientId?: string;
  accountantId?: string;
  documentType?: 'invoice' | 'receipt' | 'kyc_document' | 'other';
  lastActivity: number;
}>();

async function downloadMedia(mediaId: string) {
  const metaRes = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }
  });
  const meta = await metaRes.json();
  if (!metaRes.ok) throw new Error(meta?.error?.message || `Failed media meta ${mediaId}`);
  const url = meta.url as string;
  const fileRes = await fetch(url, { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } });
  if (!fileRes.ok) throw new Error(`Failed media download ${mediaId}`);
  const arr = new Uint8Array(await fileRes.arrayBuffer());
  const contentType = fileRes.headers.get("content-type") || "application/octet-stream";
  return { bytes: arr, contentType };
}

function normalizePhone(msisdn: string): string {
  if (msisdn.startsWith("+")) return msisdn;
  return `+${msisdn}`;
}

// Send WhatsApp message (text or interactive buttons)
async function sendWhatsAppMessage(phoneNumberId: string, to: string, message: any): Promise<boolean> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
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
      console.error("❌ Failed to send WhatsApp message:", await response.text());
      return false;
    }

    console.log("✅ WhatsApp message sent successfully");
    return true;
  } catch (error) {
    console.error("❌ Error sending WhatsApp message:", error);
    return false;
  }
}

// Send welcome message with menu buttons
async function sendWelcomeMessage(phoneNumberId: string, to: string, userName?: string) {
  await sendWhatsAppMessage(phoneNumberId, to, {
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text: `Hi ${userName || 'there'}! 👋\n\nWelcome to *Fintrex AI Bookkeeping*.\n\nI can help you:\n• Process invoices automatically\n• Extract data with 95%+ accuracy\n• Generate GST reports\n• Track expenses\n\nWhat would you like to do?`,
      },
      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: "upload_invoice",
              title: "📄 Upload Invoice",
            },
          },
          {
            type: "reply",
            reply: {
              id: "check_status",
              title: "📊 Check Status",
            },
          },
          {
            type: "reply",
            reply: {
              id: "help",
              title: "❓ Help",
            },
          },
        ],
      },
    },
  });
}

// Send document type selection
async function sendDocumentTypeSelection(phoneNumberId: string, to: string) {
  await sendWhatsAppMessage(phoneNumberId, to, {
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text: "📋 *Select Document Type*\n\nWhat type of document would you like to upload?",
      },
      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: "doctype_invoice",
              title: "📄 Invoice",
            },
          },
          {
            type: "reply",
            reply: {
              id: "doctype_receipt",
              title: "🧾 Receipt",
            },
          },
          {
            type: "reply",
            reply: {
              id: "doctype_kyc",
              title: "🆔 KYC Document",
            },
          },
        ],
      },
    },
  });

  const session = sessions.get(to) || { state: 'idle', lastActivity: Date.now() };
  session.state = 'awaiting_document_type';
  session.lastActivity = Date.now();
  sessions.set(to, session);
}

// Send upload instructions
async function sendUploadInstructions(phoneNumberId: string, to: string, documentType: string = 'invoice') {
  const typeText = documentType === 'invoice' ? 'invoice' :
                   documentType === 'receipt' ? 'receipt' :
                   documentType === 'kyc_document' ? 'KYC document' : 'document';

  await sendWhatsAppMessage(phoneNumberId, to, {
    type: "text",
    text: {
      body: `📸 *Upload Your ${typeText.charAt(0).toUpperCase() + typeText.slice(1)}*\n\nPlease send:\n• A photo of your ${typeText}\n• A PDF document\n• A scanned image\n\nMake sure the image is clear and all text is readable for best results! ✨`,
    },
  });

  const session = sessions.get(to) || { state: 'idle', lastActivity: Date.now() };
  session.state = 'awaiting_document';
  session.documentType = documentType as any;
  session.lastActivity = Date.now();
  sessions.set(to, session);
}

// Send extraction results with confirmation buttons
async function sendExtractionResults(
  phoneNumberId: string,
  to: string,
  documentId: string,
  extractData: any,
  supabase: any
) {
  const { extracted_data, overall_confidence, auto_approved } = extractData;

  if (auto_approved) {
    await sendWhatsAppMessage(phoneNumberId, to, {
      type: "interactive",
      interactive: {
        type: "button",
        body: {
          text: `✅ *Invoice Processed Successfully!*\n\n` +
                `📄 *Invoice Details:*\n` +
                `Invoice No: ${extracted_data?.invoice_number || 'N/A'}\n` +
                `Date: ${extracted_data?.invoice_date || 'N/A'}\n` +
                `Vendor: ${extracted_data?.vendor_name || 'N/A'}\n` +
                `Amount: ₹${extracted_data?.grand_total || '0'}\n\n` +
                `🎯 Confidence: ${Math.round((overall_confidence || 0) * 100)}%\n\n` +
                `Your invoice has been automatically approved and added to your books! 📊`,
        },
        action: {
          buttons: [
            {
              type: "reply",
              reply: {
                id: `view_${documentId}`,
                title: "👁️ View Details",
              },
            },
            {
              type: "reply",
              reply: {
                id: "upload_another",
                title: "📄 Upload Another",
              },
            },
            {
              type: "reply",
              reply: {
                id: "main_menu",
                title: "🏠 Main Menu",
              },
            },
          ],
        },
      },
    });
  } else {
    await sendWhatsAppMessage(phoneNumberId, to, {
      type: "interactive",
      interactive: {
        type: "button",
        body: {
          text: `⚠️ *Review Required*\n\n` +
                `I've extracted the following details:\n\n` +
                `📄 *Invoice Details:*\n` +
                `Invoice No: ${extracted_data?.invoice_number || 'N/A'}\n` +
                `Date: ${extracted_data?.invoice_date || 'N/A'}\n` +
                `Vendor: ${extracted_data?.vendor_name || 'N/A'}\n` +
                `Amount: ₹${extracted_data?.grand_total || '0'}\n\n` +
                `🎯 Confidence: ${Math.round((overall_confidence || 0) * 100)}%\n\n` +
                `Please verify the details are correct.`,
        },
        action: {
          buttons: [
            {
              type: "reply",
              reply: {
                id: `approve_${documentId}`,
                title: "✅ Approve",
              },
            },
            {
              type: "reply",
              reply: {
                id: `review_${documentId}`,
                title: "✏️ Need Changes",
              },
            },
            {
              type: "reply",
              reply: {
                id: `reject_${documentId}`,
                title: "❌ Reject",
              },
            },
          ],
        },
      },
    });

    const session = sessions.get(to) || { state: 'idle', lastActivity: Date.now() };
    session.state = 'awaiting_confirmation';
    session.documentId = documentId;
    session.lastActivity = Date.now();
    sessions.set(to, session);
  }
}

// Handle button interactions
async function handleButtonClick(
  phoneNumberId: string,
  from: string,
  buttonId: string,
  supabase: any,
  accountantId?: string,
  clientId?: string
) {
  console.log(`Button clicked: ${buttonId} by ${from}`);

  // Main menu buttons
  if (buttonId === 'upload_invoice') {
    await sendDocumentTypeSelection(phoneNumberId, from);
    return;
  }

  // Document type selection buttons
  if (buttonId === 'doctype_invoice') {
    await sendUploadInstructions(phoneNumberId, from, 'invoice');
    return;
  }

  if (buttonId === 'doctype_receipt') {
    await sendUploadInstructions(phoneNumberId, from, 'receipt');
    return;
  }

  if (buttonId === 'doctype_kyc') {
    await sendUploadInstructions(phoneNumberId, from, 'kyc_document');
    return;
  }

  if (buttonId === 'check_status') {
    await sendStatusUpdate(phoneNumberId, from, supabase, clientId);
    return;
  }

  if (buttonId === 'help') {
    await sendHelpMessage(phoneNumberId, from);
    return;
  }

  if (buttonId === 'main_menu') {
    await sendWelcomeMessage(phoneNumberId, from);
    return;
  }

  if (buttonId === 'upload_another') {
    await sendUploadInstructions(phoneNumberId, from);
    return;
  }

  // Document action buttons
  if (buttonId.startsWith('approve_')) {
    const documentId = buttonId.replace('approve_', '');
    await approveDocument(phoneNumberId, from, documentId, supabase);
    return;
  }

  if (buttonId.startsWith('review_')) {
    const documentId = buttonId.replace('review_', '');
    await sendReviewLink(phoneNumberId, from, documentId);
    return;
  }

  if (buttonId.startsWith('reject_')) {
    const documentId = buttonId.replace('reject_', '');
    await rejectDocument(phoneNumberId, from, documentId, supabase);
    return;
  }

  if (buttonId.startsWith('view_')) {
    const documentId = buttonId.replace('view_', '');
    await sendDocumentDetails(phoneNumberId, from, documentId, supabase);
    return;
  }
}

// Approve document
async function approveDocument(phoneNumberId: string, from: string, documentId: string, supabase: any) {
  const { error } = await supabase
    .from('documents')
    .update({
      review_status: 'approved',
      reviewed_at: new Date().toISOString(),
      status: 'completed',
    })
    .eq('id', documentId);

  if (error) {
    await sendWhatsAppMessage(phoneNumberId, from, {
      type: "text",
      text: { body: '❌ Failed to approve document. Please try again.' },
    });
    return;
  }

  await sendWhatsAppMessage(phoneNumberId, from, {
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text: '✅ *Document Approved!*\n\nYour invoice has been added to your books successfully! 📊',
      },
      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: 'upload_another',
              title: '📄 Upload Another',
            },
          },
          {
            type: "reply",
            reply: {
              id: 'main_menu',
              title: '🏠 Main Menu',
            },
          },
        ],
      },
    },
  });

  sessions.delete(from);
}

// Send review link
async function sendReviewLink(phoneNumberId: string, from: string, documentId: string) {
  const reviewUrl = `${APP_URL}/review-queue`;

  await sendWhatsAppMessage(phoneNumberId, from, {
    type: "text",
    text: {
      body: `✏️ *Review on Web*\n\nPlease review and edit the document details on our web portal:\n\n${reviewUrl}\n\nYou can make corrections and approve the document there. 💻`,
    },
  });

  sessions.delete(from);
}

// Reject document
async function rejectDocument(phoneNumberId: string, from: string, documentId: string, supabase: any) {
  const { error } = await supabase
    .from('documents')
    .update({
      review_status: 'rejected',
      reviewed_at: new Date().toISOString(),
      status: 'failed',
    })
    .eq('id', documentId);

  if (error) {
    await sendWhatsAppMessage(phoneNumberId, from, {
      type: "text",
      text: { body: '❌ Failed to reject document. Please try again.' },
    });
    return;
  }

  await sendWhatsAppMessage(phoneNumberId, from, {
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text: '❌ *Document Rejected*\n\nThe document has been rejected and removed.',
      },
      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: 'upload_another',
              title: '📄 Upload Another',
            },
          },
          {
            type: "reply",
            reply: {
              id: 'main_menu',
              title: '🏠 Main Menu',
            },
          },
        ],
      },
    },
  });

  sessions.delete(from);
}

// Send status update
async function sendStatusUpdate(phoneNumberId: string, from: string, supabase: any, clientId?: string) {
  if (!clientId) {
    await sendWhatsAppMessage(phoneNumberId, from, {
      type: "text",
      text: { body: 'No documents found. Upload your first invoice to get started! 📄' },
    });
    return;
  }

  const { data: documents } = await supabase
    .from('documents')
    .select('id, file_name, status, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (!documents || documents.length === 0) {
    await sendWhatsAppMessage(phoneNumberId, from, {
      type: "text",
      text: { body: 'No documents found. Upload your first invoice to get started! 📄' },
    });
    return;
  }

  const statusText = documents.map((doc: any, i: number) =>
    `${i + 1}. ${doc.file_name}\n   Status: ${doc.status}\n   Date: ${new Date(doc.created_at).toLocaleDateString()}`
  ).join('\n\n');

  await sendWhatsAppMessage(phoneNumberId, from, {
    type: "text",
    text: {
      body: `📊 *Your Recent Documents*\n\n${statusText}\n\nTotal: ${documents.length} document(s)`,
    },
  });
}

// Send document details
async function sendDocumentDetails(phoneNumberId: string, from: string, documentId: string, supabase: any) {
  const { data: document } = await supabase
    .from('documents')
    .select('*, invoices(*)')
    .eq('id', documentId)
    .single();

  if (!document) {
    await sendWhatsAppMessage(phoneNumberId, from, {
      type: "text",
      text: { body: '❌ Document not found.' },
    });
    return;
  }

  const invoice = document.invoices?.[0];

  await sendWhatsAppMessage(phoneNumberId, from, {
    type: "text",
    text: {
      body: `📄 *Document Details*\n\n` +
            `File: ${document.file_name}\n` +
            `Status: ${document.status}\n` +
            `Uploaded: ${new Date(document.created_at).toLocaleString()}\n\n` +
            (invoice ?
              `💰 *Invoice Info*\n` +
              `Invoice #: ${invoice.invoice_number}\n` +
              `Date: ${invoice.invoice_date}\n` +
              `Vendor: ${invoice.vendor_name}\n` +
              `Amount: ₹${invoice.grand_total}\n` +
              `GSTIN: ${invoice.vendor_gstin || 'N/A'}`
              : 'No invoice data extracted yet.'),
    },
  });
}

// Send help message
async function sendHelpMessage(phoneNumberId: string, from: string) {
  await sendWhatsAppMessage(phoneNumberId, from, {
    type: "text",
    text: {
      body: `❓ *Help & Instructions*\n\n` +
            `*How to use Fintrex:*\n\n` +
            `1️⃣ Upload your invoice/receipt\n` +
            `2️⃣ Wait for AI processing (5-15 sec)\n` +
            `3️⃣ Review and approve the details\n` +
            `4️⃣ Done! It's added to your books\n\n` +
            `*Tips for best results:*\n` +
            `• Take clear, well-lit photos\n` +
            `• Ensure all text is readable\n` +
            `• Upload PDF for better accuracy\n\n` +
            `*Need human help?*\n` +
            `Reply with "support" to talk to our team.`,
    },
  });
}

// Notify accountant about unknown number attempting contact
async function notifyAccountantAboutUnknownNumber(
  phoneNumberId: string,
  unknownNumber: string,
  businessPhoneNumber: string,
  supabase: any
) {
  try {
    // Find accountant associated with this WhatsApp business number
    const { data: accountants } = await supabase
      .from('profiles')
      .select('id, full_name, email, whatsapp_number')
      .eq('whatsapp_number', businessPhoneNumber)
      .limit(1);

    if (!accountants || accountants.length === 0) {
      console.log(`⚠️ No accountant found for business number: ${businessPhoneNumber}`);
      return;
    }

    const accountant = accountants[0];

    // Create a notification record in the database
    const { error: notificationError } = await supabase
      .from('notifications')
      .insert({
        user_id: accountant.id,
        title: 'Unknown WhatsApp Contact Attempt',
        message: `An unknown phone number (${unknownNumber}) attempted to contact your WhatsApp business account. You may want to add them as a client if this is legitimate.`,
        type: 'warning',
        read: false,
        created_at: new Date().toISOString(),
      });

    if (notificationError) {
      console.error('❌ Failed to create notification:', notificationError);
    } else {
      console.log(`✅ Notified accountant ${accountant.full_name} about unknown number ${unknownNumber}`);
    }
  } catch (error) {
    console.error('❌ Error notifying accountant:', error);
  }
}

// Process uploaded document
async function processDocument(
  phoneNumberId: string,
  from: string,
  mediaId: string,
  mimeType: string,
  filename: string,
  supabase: any,
  clientId: string,
  accountantId?: string,
  documentType: string = 'invoice'
) {
  try {
    await sendWhatsAppMessage(phoneNumberId, from, {
      type: "text",
      text: {
        body: '⏳ Processing your document...\n\nThis usually takes 5-15 seconds.\nI\'ll extract all the details and verify them for you! 🤖',
      },
    });

    const { bytes, contentType } = await downloadMedia(mediaId);

    const path = `${clientId}/${Date.now()}_${filename}`;

    // Check for duplicate documents based on file size and name
    const { data: existingDocs } = await supabase
      .from('documents')
      .select('id, file_name, file_size, created_at')
      .eq('client_id', clientId)
      .eq('file_name', filename)
      .eq('file_size', bytes.length)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
      .limit(1);

    if (existingDocs && existingDocs.length > 0) {
      await sendWhatsAppMessage(phoneNumberId, from, {
        type: "text",
        text: {
          body: '⚠️ *Duplicate Document Detected*\n\nYou already uploaded this document recently.\n\nIf you want to upload it again, please rename the file or wait 24 hours.',
        },
      });
      sessions.delete(from);
      return;
    }

    const uploadRes = await supabase.storage.from("documents").upload(path, bytes, { contentType, upsert: false });
    if (uploadRes.error) throw uploadRes.error;

    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert({
        client_id: clientId,
        file_name: filename,
        file_path: path,
        file_type: contentType,
        file_size: bytes.length,
        document_type: documentType,
        upload_source: 'whatsapp',
        status: 'processing',
        review_status: 'pending',
        reviewed_at: null,
      })
      .select()
      .single();

    if (docError) throw docError;

    const session = sessions.get(from) || { state: 'idle', lastActivity: Date.now() };
    session.state = 'processing';
    session.documentId = document.id;
    session.clientId = clientId;
    session.accountantId = accountantId;
    session.lastActivity = Date.now();
    sessions.set(from, session);

    // Handle different document types
    if (documentType === 'kyc_document') {
      // For KYC documents, just upload and notify - no extraction needed
      await supabase
        .from('documents')
        .update({
          status: 'completed',
          review_status: 'pending',
        })
        .eq('id', document.id);

      await sendWhatsAppMessage(phoneNumberId, from, {
        type: "interactive",
        interactive: {
          type: "button",
          body: {
            text: '✅ *KYC Document Uploaded Successfully!*\n\nYour KYC document has been uploaded and is pending review by your accountant.\n\nYou will be notified once it is verified.',
          },
          action: {
            buttons: [
              {
                type: "reply",
                reply: {
                  id: 'upload_another',
                  title: '📄 Upload Another',
                },
              },
              {
                type: "reply",
                reply: {
                  id: 'main_menu',
                  title: '🏠 Main Menu',
                },
              },
            ],
          },
        },
      });

      sessions.delete(from);
      return;
    }

    // For invoices and receipts, perform OCR and extraction
    // Call OCR function
    const ocrResponse = await fetch(`${SUPABASE_URL}/functions/v1/ocr-secure`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        documentId: document.id,
        filePath: path,
      }),
    });

    if (!ocrResponse.ok) {
      const errorText = await ocrResponse.text();
      console.error('OCR processing failed:', errorText);
      throw new Error(`OCR processing failed: ${errorText}`);
    }

    const ocrData = await ocrResponse.json();

    // Call extraction function
    const extractResponse = await fetch(`${SUPABASE_URL}/functions/v1/extract-invoice`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        documentId: document.id,
        ocrText: ocrData.text,
        ocrProvider: ocrData.provider,
        confidence: ocrData.confidence,
      }),
    });

    if (!extractResponse.ok) {
      const errorText = await extractResponse.text();
      console.error('Invoice extraction failed:', errorText);
      throw new Error(`Invoice extraction failed: ${errorText}`);
    }

    const extractData = await extractResponse.json();

    await sendExtractionResults(phoneNumberId, from, document.id, extractData, supabase);

  } catch (error) {
    console.error('Document processing error:', error);
    await sendWhatsAppMessage(phoneNumberId, from, {
      type: "text",
      text: {
        body: `❌ *Processing Failed*\n\nSorry, I couldn't process your document.\n\nError: ${error.message}\n\nPlease try again or contact support.`,
      },
    });
    sessions.delete(from);
  }
}

serve(async (req: Request): Promise<Response> => {
  const u = new URL(req.url);
  if (req.method === "GET") {
    // WhatsApp webhook verification
    const mode = u.searchParams.get("hub.mode");
    const token = u.searchParams.get("hub.verify_token");
    const challenge = u.searchParams.get("hub.challenge");

    console.log("[webhook-verify] mode:", mode, "token_present:", !!token, "challenge_present:", !!challenge);

    if (mode === "subscribe" && token && challenge) {
      if (!VERIFY_TOKEN) {
        console.error("[webhook-verify] VERIFY_TOKEN not configured");
        return new Response("Server configuration error", { status: 500 });
      }

      if (token !== VERIFY_TOKEN) {
        console.error("[webhook-verify] Token mismatch");
        return new Response("Forbidden", { status: 403 });
      }

      console.log("[webhook-verify] ✅ Verification successful");
      // CRITICAL: Must return challenge as plain text
      return new Response(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" }
      });
    }

    console.error("[webhook-verify] Invalid verification request");
    return new Response("Bad Request", { status: 400 });
  }

  if (req.method !== "POST") return bad({ error: "method not allowed" }, 405);

  if (!WHATSAPP_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const body = await req.text();
    console.log("[whatsapp-webhook] mock payload", body.slice(0, 2000));
    return ok();
  }

  try {
    const payload = await req.json();
    const entries = payload?.entry || [];
    if (!Array.isArray(entries) || entries.length === 0) return ok();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    for (const entry of entries) {
      const changes = entry?.changes || [];
      for (const ch of changes) {
        const value = ch?.value;
        const phoneNumberId = value?.metadata?.phone_number_id;
        const messages = value?.messages || [];

        for (const msg of messages) {
          const from = normalizePhone(msg.from as string);
          const type = msg.type as string;

          console.log(`📞 Incoming WhatsApp message from: ${from}`);

          // Create phone variants for flexible matching
          const phoneVariants = [
            from,                                    // Full format: +919876543210
            from.replace(/^\+/, ''),                 // Without +: 919876543210
            from.replace(/^\+?91/, ''),              // Without country code: 9876543210
            from.replace(/^\+?91/, '0'),             // With 0 prefix: 09876543210
          ].filter((v, i, arr) => arr.indexOf(v) === i); // Remove duplicates

          console.log(`🔍 Searching for client with phone variants: ${JSON.stringify(phoneVariants)}`);

          // Find client by phone number using .in() for better matching
          // Match active and kyc_pending clients (exclude inactive/suspended)
          const { data: clients, error: clientError } = await supabase
            .from("clients")
            .select("id, phone_number, email, business_name, contact_person, status, accountant_id")
            .in("phone_number", phoneVariants)
            .in("status", ["active", "kyc_pending"])
            .limit(1);

          if (clientError) {
            console.error(`❌ Error querying clients:`, clientError);
            console.error(`❌ Error details:`, JSON.stringify(clientError));
            continue;
          }

          console.log(`🔎 Client search result: ${clients?.length || 0} matches found`);
          if (clients && clients.length > 0) {
            console.log(`📋 Found client data:`, JSON.stringify(clients[0]));
          }

          let clientId: string | undefined;
          let clientName: string | undefined;
          let accountantId: string | undefined;

          if (clients && clients.length > 0) {
            // Found existing client - use this account
            const client = clients[0];
            clientId = client.id;
            clientName = client.business_name || client.contact_person || 'there';
            accountantId = client.accountant_id;

            console.log(`✅ Matched to existing client: ${clientName} (ID: ${clientId})`);

            // Send personalized welcome for existing clients
            await sendWhatsAppMessage(phoneNumberId, from, {
              type: "text",
              text: {
                body: `Welcome back, ${clientName}! 👋\n\nYour documents will be automatically linked to your account.\n\nSend me an invoice to get started! 📄`
              }
            });
          } else {
            // No existing client found
            console.log(`⚠️ Unknown phone number ${from} - no client account found`);
            console.log(`📊 Searched variants: ${phoneVariants.join(', ')}`);

            // Get business phone number from metadata
            const businessPhoneNumber = value?.metadata?.display_phone_number || phoneNumberId;

            // Notify accountant about this unknown contact attempt
            await notifyAccountantAboutUnknownNumber(
              phoneNumberId,
              from,
              businessPhoneNumber,
              supabase
            );

            await sendWhatsAppMessage(phoneNumberId, from, {
              type: "text",
              text: {
                body: `⚠️ *Account Not Found*\n\nYour phone number (${from}) is not registered in our system.\n\nPlease ask your accountant to add you as a client first.\n\nFor support, contact your accountant.`
              }
            });

            // Skip further processing - no client ID available
            continue;
          }

          // At this point, clientId is guaranteed to be set
          // Add type assertion for safety
          if (!clientId) {
            console.error(`❌ CRITICAL: Client was found but ID is missing! From: ${from}`);
            continue;
          }

          // Handle message types
          if (type === "text") {
            const text = msg.text?.body?.toLowerCase() || '';
            if (text.includes('hi') || text.includes('hello') || text.includes('start')) {
              await sendWelcomeMessage(phoneNumberId, from, clientName);
            } else if (text.includes('help')) {
              await sendHelpMessage(phoneNumberId, from);
            } else if (text.includes('status')) {
              await sendStatusUpdate(phoneNumberId, from, supabase, clientId);
            } else {
              await sendWelcomeMessage(phoneNumberId, from, clientName);
            }
          } else if (type === "image" || type === "document") {
            const session = sessions.get(from);
            if (session?.state === 'awaiting_document') {
              const media = type === "image" ? msg.image : msg.document;
              const mediaId = media?.id;
              const fileName = media?.filename || `${mediaId || 'media'}_${Date.now()}.${type === 'image' ? 'jpg' : 'pdf'}`;
              const documentType = session.documentType || 'invoice';
              if (mediaId) {
                await processDocument(phoneNumberId, from, mediaId, media?.mime_type, fileName, supabase, clientId, accountantId, documentType);
              }
            } else {
              await sendWhatsAppMessage(phoneNumberId, from, {
                type: "text",
                text: { body: 'Please use the "Upload Invoice" button to start uploading documents. 📄' },
              });
            }
          } else if (type === "interactive") {
            if (msg.interactive?.type === 'button_reply') {
              await handleButtonClick(
                phoneNumberId,
                from,
                msg.interactive.button_reply.id,
                supabase,
                accountantId,
                clientId
              );
            }
          }
        }
      }
    }

    return ok();
  } catch (e) {
    console.error("[whatsapp-webhook] error", e);
    return bad({ error: String(e) }, 200);
  }
});
