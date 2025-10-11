// Supabase Edge Function: send-template (WhatsApp Meta Cloud API)
// Uses mock mode if secrets are missing. Endpoint: POST /send-template
// Body: { to: string, template: string, params: Record<string, string|number|null> }
// Response: { success: boolean, messageId?: string, error?: string }

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const JSON_HEADERS = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        ...JSON_HEADERS,
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "content-type, authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: JSON_HEADERS });
  }

  try {
    const { to, template, params } = (await req.json()) as {
      to: string;
      template: string;
      params?: Record<string, string | number | null>;
    };

    if (!to || !template) {
      return new Response(JSON.stringify({ success: false, error: "Missing 'to' or 'template'" }), {
        status: 400,
        headers: JSON_HEADERS,
      });
    }

    const token = Deno.env.get("WHATSAPP_TOKEN");
    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

    if (!token || !phoneNumberId) {
      // Mock mode
      return new Response(
        JSON.stringify({ success: true, messageId: `mock_${Date.now()}` }),
        { status: 200, headers: JSON_HEADERS }
      );
    }

    // Build WhatsApp template payload
    const components = params
      ? [
          {
            type: "body",
            parameters: Object.values(params).map((v) => ({ type: "text", text: String(v ?? "") })),
          },
        ]
      : undefined;

    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: template,
        language: { code: "en" },
        ...(components ? { components } : {}),
      },
    } as any;

    const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return new Response(JSON.stringify({ success: false, error: data?.error?.message || `HTTP ${res.status}` }), {
        status: 200,
        headers: JSON_HEADERS,
      });
    }

    const messageId = data?.messages?.[0]?.id || data?.id || `wa_${Date.now()}`;
    return new Response(JSON.stringify({ success: true, messageId }), { status: 200, headers: JSON_HEADERS });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 200, headers: JSON_HEADERS });
  }
});
