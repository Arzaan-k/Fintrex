// Simple WhatsApp integration simulator used across the app
// In production, replace with Cloud API (Meta) or BSP (Twilio/360Dialog) SDK calls.

export type WhatsAppTemplateParams = Record<string, string | number | null>;

export type WhatsAppSendResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

export async function sendTemplate(
  toPhone: string,
  templateName: string,
  params: WhatsAppTemplateParams
): Promise<WhatsAppSendResult> {
  // If a backend proxy is configured, use it for real WhatsApp Cloud API/BSP calls
  const proxyBase = (import.meta as any).env?.VITE_WHATSAPP_PROXY_URL as string | undefined;
  if (proxyBase) {
    try {
      const base = proxyBase.replace(/\/$/, "");
      const res = await fetch(`${base}/send-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: toPhone, template: templateName, params }),
      });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        // eslint-disable-next-line no-console
        console.error("[WhatsApp] Proxy error", data);
        return { success: false, error: data?.error || `HTTP ${res.status}` };
      }
      // Normalize a few common proxy response shapes
      const messageId = data?.messageId || data?.messages?.[0]?.id || data?.id;
      return { success: true, messageId };
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error("[WhatsApp] Proxy request failed", e);
      // fall through to simulator
    }
  }

  // Fallback simulator (dev mode)
  await new Promise((r) => setTimeout(r, 500));
  // eslint-disable-next-line no-console
  console.log("[WhatsApp] Simulated template send", { toPhone, templateName, params });
  return { success: true };
}
