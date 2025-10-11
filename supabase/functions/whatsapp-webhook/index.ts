// Supabase Edge Function: whatsapp-webhook (Meta Cloud inbound)
// - GET: verification (hub.mode, hub.verify_token, hub.challenge)
// - POST: handle inbound messages; if media, fetch and store; create document rows
// Mock-ready: if required secrets are missing, it will return 200 and log payload.

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN") || ""; // App token for Graph API
const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || Deno.env.get("VERIFY_TOKEN") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const JSON_HEADERS = { "content-type": "application/json" } as const;

function ok(body: any = { status: "ok" }) { return new Response(JSON.stringify(body), { status: 200, headers: JSON_HEADERS }); }
function bad(body: any, status = 400) { return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS }); }

async function downloadMedia(mediaId: string) {
  // Step 1: GET metadata to get URL
  const metaRes = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }
  });
  const meta = await metaRes.json();
  if (!metaRes.ok) throw new Error(meta?.error?.message || `Failed media meta ${mediaId}`);
  const url = meta.url as string;
  // Step 2: GET actual bytes
  const fileRes = await fetch(url, { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } });
  if (!fileRes.ok) throw new Error(`Failed media download ${mediaId}`);
  const arr = new Uint8Array(await fileRes.arrayBuffer());
  const contentType = fileRes.headers.get("content-type") || "application/octet-stream";
  return { bytes: arr, contentType };
}

function normalizePhone(msisdn: string): string {
  // Meta sends e.g., "9198XXXXXXXX"; store as "+<number>" for matching variants
  if (msisdn.startsWith("+")) return msisdn;
  return `+${msisdn}`;
}

async function sendWhatsAppReply(phoneNumberId: string, to: string, message: string): Promise<boolean> {
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
          type: "text",
          text: { body: message },
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

serve(async (req: Request): Promise<Response> => {
  const u = new URL(req.url);
  if (req.method === "GET") {
    // Verification
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

  // If secrets missing, just log and return ok
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
        const messages = value?.messages || [];
        for (const msg of messages) {
          const from = normalizePhone(msg.from as string);
          const type = msg.type as string;

          // First, get business phone number to find accountant
          const businessPhone = value?.metadata?.display_phone_number;
          let accountantId: string | undefined;
          let autoSettings: any = {};
          
          if (businessPhone) {
            // Find accountant by WhatsApp business number
            const { data: accountant } = await supabase
              .from("profiles")
              .select("id, settings, firm_name, full_name")
              .eq("whatsapp_number", businessPhone)
              .single();
            
            if (accountant) {
              accountantId = accountant.id;
              autoSettings = accountant.settings || {};
              console.log(`✅ Found accountant: ${accountant.full_name || accountant.firm_name}`);
            }
          }
          
          // Try to map to a client by phone under this accountant
          let clientId: string | undefined;
          const phoneVariants = [from, from.replace(/^\+/, ''), from.replace(/^\+?91/, '')];
          
          if (accountantId) {
            const { data: clients } = await supabase
              .from("clients")
              .select("id, phone_number, client_name")
              .eq("accountant_id", accountantId)
              .in("phone_number", phoneVariants)
              .limit(1);
            
            clientId = clients?.[0]?.id;
            
            // Auto-create client if not found and automation is enabled
            if (!clientId && autoSettings?.automation?.auto_process_documents !== false) {
              const { data: newClient } = await supabase
                .from("clients")
                .insert({
                  accountant_id: accountantId,
                  client_name: `Client_${from.slice(-4)}`,
                  phone_number: from,
                  status: "pending_kyc",
                  kyc_status: "pending",
                  created_via: "whatsapp"
                })
                .select()
                .single();
              
              if (newClient) {
                clientId = newClient.id;
                console.log(`✅ Auto-created client: ${newClient.client_name}`);
                
                // Send greeting message if enabled
                if (autoSettings?.automation?.auto_send_acknowledgments !== false) {
                  const greeting = autoSettings?.branding?.greeting_message || 
                    `Hello! Welcome to our accounting services. Send us your documents and we'll process them automatically.`;
                  await sendWhatsAppReply(value?.metadata?.phone_number_id, from, greeting);
                }
              }
            }
          }

          // Handle media messages
          if (type === "image" || type === "document") {
            const media = type === "image" ? msg.image : msg.document;
            const mediaId = media?.id as string | undefined;
            const fileName = media?.filename || `${mediaId || 'media'}_${Date.now()}`;
            if (mediaId && clientId) {
              try {
                const { bytes, contentType } = await downloadMedia(mediaId);
                
                // Create File object from bytes for processing
                const blob = new Blob([bytes], { type: contentType });
                const file = new File([blob], fileName, { type: contentType });
                
                // Store in processing queue for automated handling
                const { data: job } = await supabase.from("processing_queue").insert({
                  client_id: clientId,
                  sender_phone: from,
                  source: 'whatsapp',
                  file_name: fileName,
                  mime_type: contentType,
                  status: 'pending',
                  metadata: {
                    message_id: msg.id,
                    timestamp: msg.timestamp,
                    caption: media?.caption
                  }
                }).select().single();
                
                // Upload file to storage
                const path = `${clientId}/${Date.now()}_${fileName}`;
                const uploadRes = await supabase.storage.from("documents").upload(path, bytes, { contentType, upsert: false });
                if (uploadRes.error) throw uploadRes.error;
                
                // Update job with file path
                await supabase.from("processing_queue").update({ file_path: path }).eq('id', job.id);
                
                // Send acknowledgment if enabled
                if (autoSettings?.automation?.auto_send_acknowledgments !== false) {
                  const ackMessage = autoSettings?.branding?.acknowledgment_message || 
                    "✅ Document received! We're processing it now. You'll be notified once it's ready.";
                  await sendWhatsAppReply(value?.metadata?.phone_number_id, from, ackMessage);
                }
                
                // Trigger automated processing if enabled
                if (autoSettings?.automation?.auto_process_documents !== false) {
                  await supabase.functions.invoke('process-document-auto', {
                    body: { 
                      jobId: job.id, 
                      clientId: clientId, 
                      accountantId: accountantId,
                      filePath: path,
                      settings: autoSettings
                    }
                  });
                }
                
                console.log(`✅ Document queued for automated processing: ${job.id}`);
              } catch (e) {
                console.error("[whatsapp-webhook] media handling failed", e);
              }
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
