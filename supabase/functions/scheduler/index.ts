// Supabase Edge Function: scheduler (notifications)
// Intended to be run on a schedule via Supabase Scheduled Triggers.
// Mock-ready: if no secrets, it will log what it would do.
// Responsibilities:
// 1) Send KYC reminders to clients with pending checklist items.
// 2) Send monthly GST reminders near filing window.

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const JSON_HEADERS = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
};

const BACKEND_BASE = Deno.env.get("BACKEND_BASE") || ""; // e.g., https://<project>.functions.supabase.co
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

async function sendTemplate(to: string, template: string, params: Record<string, any>) {
  if (!BACKEND_BASE) {
    console.log("[scheduler] mock send", { to, template, params });
    return { success: true, messageId: `mock_${Date.now()}` };
  }
  const base = BACKEND_BASE.replace(/\/$/, "");
  const res = await fetch(`${base}/send-template`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, template, params }),
  });
  const data = await res.json().catch(() => ({}));
  return data;
}

async function loadRealTargets() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // KYC: clients with any pending checklist
  const { data: pendingKyc, error: kErr } = await supabase
    .from("kyc_checklists" as any)
    .select("client_id, status, clients:client_id(phone_number, contact_person)")
    .eq("status", "pending")
    .limit(1000);
  if (kErr) throw kErr;

  const kycMap = new Map<string, { phone: string; name: string; pendingCount: number }>();
  for (const row of pendingKyc || []) {
    const cid = row.client_id as string;
    const phone = row.clients?.phone_number as string | undefined;
    const name = row.clients?.contact_person as string | undefined;
    if (!phone) continue;
    const entry = kycMap.get(cid) || { phone, name: name || "Client", pendingCount: 0 };
    entry.pendingCount += 1;
    kycMap.set(cid, entry);
  }

  // GST: clients with invoices in previous month or current month
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const { data: gstClients, error: gErr } = await supabase
    .from("invoices" as any)
    .select("client_id, clients!inner(phone_number, contact_person)")
    .gte("invoice_date", prevStart.toISOString())
    .lt("invoice_date", start.toISOString())
    .limit(2000);
  if (gErr) throw gErr;
  const gstMap = new Map<string, { phone: string; name: string }>();
  for (const row of gstClients || []) {
    const cid = row.client_id as string;
    const phone = row.clients?.phone_number as string | undefined;
    const name = row.clients?.contact_person as string | undefined;
    if (!phone) continue;
    if (!gstMap.has(cid)) gstMap.set(cid, { phone, name: name || "Client" });
  }

  return { kycTargets: Array.from(kycMap.values()), gstTargets: Array.from(gstMap.values()), prevPeriod: `${prevStart.getFullYear()}-${String(prevStart.getMonth()+1).padStart(2,'0')}` };
}

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

  try {
    const today = new Date();
    const period = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

    const real = await loadRealTargets();
    let kycSent = 0;
    let gstSent = 0;

    if (real) {
      for (const t of real.kycTargets) {
        const res = await sendTemplate(t.phone, "kyc_reminder", { client_name: t.name, pending_count: t.pendingCount });
        if (res?.success) kycSent++;
      }
      for (const t of real.gstTargets) {
        const res = await sendTemplate(t.phone, "gst_filing_reminder", { client_name: t.name, period: real.prevPeriod });
        if (res?.success) gstSent++;
      }
    } else {
      // Mock fallback
      const kycTargets = [
        { phone: "+910000000001", name: "Client A", pendingCount: 2 },
        { phone: "+910000000002", name: "Client B", pendingCount: 1 },
      ];
      for (const t of kycTargets) {
        const res = await sendTemplate(t.phone, "kyc_reminder", { client_name: t.name, pending_count: t.pendingCount });
        if (res?.success) kycSent++;
      }
      const gstTargets = [ { phone: "+910000000003", name: "Client C" } ];
      for (const t of gstTargets) {
        const res = await sendTemplate(t.phone, "gst_filing_reminder", { client_name: t.name, period });
        if (res?.success) gstSent++;
      }
    }

    return new Response(JSON.stringify({ ok: true, period, kycSent, gstSent }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: JSON_HEADERS });
  }
});
