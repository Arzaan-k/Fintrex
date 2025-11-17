// Supabase Edge Function: send-template (WhatsApp Meta Cloud API)
// Uses mock mode if secrets are missing. Endpoint: POST /send-template
// Body: { to: string, template: string, params: Record<string, string|number|null> }
// Response: { success: boolean, messageId?: string, error?: string }

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  getCorsHeaders,
  handleCors,
  verifyAuth,
  errorResponse,
  successResponse,
  checkRateLimit,
  getClientIdentifier
} from "../_shared/security.ts";

serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, corsHeaders);
  }

  // Verify authentication
  const userId = await verifyAuth(req);
  if (!userId) {
    return errorResponse("Unauthorized - valid authentication required", 401, corsHeaders);
  }

  // Rate limiting
  const clientId = getClientIdentifier(req, userId);
  if (!checkRateLimit(clientId, 50, 60000)) { // 50 requests per minute
    return errorResponse("Rate limit exceeded - please try again later", 429, corsHeaders);
  }

  try {
    const { to, template, params } = (await req.json()) as {
      to: string;
      template: string;
      params?: Record<string, string | number | null>;
    };

    if (!to || !template) {
      return errorResponse("Missing 'to' or 'template'", 400, corsHeaders);
    }

    const token = Deno.env.get("WHATSAPP_TOKEN");
    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

    if (!token || !phoneNumberId) {
      // Mock mode
      return successResponse(
        { success: true, messageId: `mock_${Date.now()}` },
        corsHeaders
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
      console.error('WhatsApp API error:', data);
      return successResponse(
        { success: false, error: 'Failed to send message - please try again' },
        corsHeaders
      );
    }

    const messageId = data?.messages?.[0]?.id || data?.id || `wa_${Date.now()}`;
    return successResponse({ success: true, messageId }, corsHeaders);
  } catch (e) {
    console.error('Template send error:', e);
    return errorResponse('Failed to send template message', 500, corsHeaders);
  }
});
