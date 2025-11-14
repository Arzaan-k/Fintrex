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
  state: 'idle' | 'awaiting_document' | 'awaiting_confirmation' | 'processing';
  documentId?: string;
  clientId?: string;
  accountantId?: string;
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

// Send upload instructions
async function sendUploadInstructions(phoneNumberId: string, to: string) {
  await sendWhatsAppMessage(phoneNumberId, to, {
    type: "text",
    text: {
      body: "📸 *Upload Your Document*\n\nPlease send:\n• A photo of your invoice/receipt\n• A PDF document\n• A scanned image\n\nMake sure the image is clear and all text is readable for best results! ✨",
    },
  });

  const session = sessions.get(to) || { state: 'idle', lastActivity: Date.now() };
  session.state = 'awaiting_document';
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
    await sendUploadInstructions(phoneNumberId, from);
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

// Process uploaded document
async function processDocument(
  phoneNumberId: string,
  from: string,
  mediaId: string,
  mimeType: string,
  filename: string,
  supabase: any,
  clientId: string,
  accountantId?: string
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
        document_type: 'invoice',
        upload_source: 'whatsapp',
        status: 'processing',
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

    if (!ocrResponse.ok) throw new Error('OCR processing failed');
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

    if (!extractResponse.ok) throw new Error('Invoice extraction failed');
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
    const mode = u.searchParams.get("hub.mode");
    const token = u.searchParams.get("hub.verify_token");
    const challenge = u.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token && challenge) {
      if (!VERIFY_TOKEN || token !== VERIFY_TOKEN) return bad({ error: "verify_token mismatch" }, 403);
      return new Response(challenge, { status: 200 });
    }
    return bad({ error: "invalid verification" }, 400);
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

          const businessPhone = value?.metadata?.display_phone_number;
          let accountantId: string | undefined;

          if (businessPhone) {
            const { data: accountant } = await supabase
              .from("profiles")
              .select("id, settings, firm_name, full_name")
              .eq("whatsapp_number", businessPhone)
              .single();

            if (accountant) {
              accountantId = accountant.id;
            }
          }

          // Smart client matching - match by phone number or email
          let clientId: string | undefined;
          let clientName: string | undefined;
          let isExistingClient = false;

          // Create phone variants for flexible matching
          const phoneVariants = [
            from,                                    // Full format: +919876543210
            from.replace(/^\+/, ''),                 // Without +: 919876543210
            from.replace(/^\+?91/, ''),              // Without country code: 9876543210
            from.replace(/^\+?91/, '0'),             // With 0 prefix: 09876543210
          ];

          if (accountantId) {
            // Try to find existing client by phone number
            const { data: clients } = await supabase
              .from("clients")
              .select("id, phone_number, email, client_name, status")
              .eq("accountant_id", accountantId)
              .or(`phone_number.in.(${phoneVariants.join(',')}),phone.in.(${phoneVariants.join(',')})`)
              .limit(1);

            if (clients && clients.length > 0) {
              // Found existing client - use this account
              clientId = clients[0].id;
              clientName = clients[0].client_name;
              isExistingClient = true;

              console.log(`✅ Matched to existing client: ${clientName} (${clientId})`);

              // Send personalized welcome for existing clients
              await sendWhatsAppMessage(phoneNumberId, from, {
                type: "text",
                text: {
                  body: `Welcome back, ${clientName}! 👋\n\nYour documents will be automatically linked to your account.\n\nSend me an invoice to get started! 📄`
                }
              });
            } else {
              // No existing client found - do NOT auto-create
              // Instead, notify the accountant that an unknown number is trying to send documents
              console.log(`⚠️ Unknown phone number ${from} - no client account found`);

              await sendWhatsAppMessage(phoneNumberId, from, {
                type: "text",
                text: {
                  body: `⚠️ *Account Not Found*\n\nYour phone number is not registered in our system.\n\nPlease ask your accountant to add you as a client first, or provide your registered phone number/email.\n\nFor support, contact your accountant.`
                }
              });

              // Notify accountant about unregistered attempt (optional - can be implemented later)
              // This could create a notification or log entry for the accountant to review

              // Skip further processing - no client ID available
              continue; // Skip to next message
            }
          }

          // Only process messages if we have a valid client ID
          if (!clientId) {
            console.log(`⚠️ No client ID - skipping message processing for ${from}`);
            continue; // Skip to next message
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
              if (mediaId) {
                await processDocument(phoneNumberId, from, mediaId, media?.mime_type, fileName, supabase, clientId, accountantId);
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
