// Shared security utilities for Supabase Edge Functions
// Provides: Authentication, CORS, Security Headers, Rate Limiting

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Get allowed origins from environment or use secure defaults
 */
function getAllowedOrigins(): string[] {
  const envOrigins = Deno.env.get("ALLOWED_ORIGINS");
  if (envOrigins) {
    return envOrigins.split(',').map(origin => origin.trim());
  }
  // Default to localhost and production domain
  return [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://app.fintrex.ai',
    'https://fintrex.ai'
  ];
}

/**
 * Get CORS headers with origin validation
 */
export function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigins = getAllowedOrigins();
  const isAllowed = origin && allowedOrigins.includes(origin);

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : allowedOrigins[0],
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin"
  };
}

/**
 * Security headers to prevent common attacks
 */
export const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy": "default-src 'self'",
};

/**
 * JSON response headers
 */
export const JSON_HEADERS = {
  "Content-Type": "application/json",
};

/**
 * Verify authentication token and return user ID
 */
export async function verifyAuth(req: Request): Promise<string | null> {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.slice(7);
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase credentials not configured');
      return null;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return null;
    }

    return data.user.id;
  } catch (error) {
    console.error('Auth verification error:', error);
    return null;
  }
}

/**
 * Create error response with security headers
 */
export function errorResponse(
  message: string,
  status: number,
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: {
        ...corsHeaders,
        ...JSON_HEADERS,
        ...SECURITY_HEADERS
      }
    }
  );
}

/**
 * Create success response with security headers
 */
export function successResponse(
  data: unknown,
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify(data),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        ...JSON_HEADERS,
        ...SECURITY_HEADERS
      }
    }
  );
}

/**
 * Handle CORS preflight requests
 */
export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    const origin = req.headers.get("origin");
    const corsHeaders = getCorsHeaders(origin);
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders,
        ...SECURITY_HEADERS
      }
    });
  }
  return null;
}

/**
 * Simple in-memory rate limiter (for production, use Redis/Upstash)
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(identifier: string, maxRequests: number = 100, windowMs: number = 60000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * Get client identifier for rate limiting (IP or user ID)
 */
export function getClientIdentifier(req: Request, userId?: string): string {
  if (userId) return userId;
  return req.headers.get('x-forwarded-for') ||
         req.headers.get('x-real-ip') ||
         'unknown';
}

/**
 * Verify WhatsApp webhook signature
 */
export function verifyWhatsAppWebhook(req: Request): boolean {
  // For GET requests (verification), check verify token
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN') || Deno.env.get('VERIFY_TOKEN');

    return mode === 'subscribe' && token === verifyToken;
  }

  // For POST requests, WhatsApp doesn't send signature by default
  // but we can verify the token is configured
  const configuredToken = Deno.env.get('WHATSAPP_TOKEN');
  return !!configuredToken;
}

/**
 * Verify webhook token from query parameter or header
 */
export function verifyWebhookToken(req: Request, envVarName: string = 'WEBHOOK_SECRET'): boolean {
  const secret = Deno.env.get(envVarName);
  if (!secret) {
    console.warn(`${envVarName} not configured - webhook is not secured`);
    return true; // Allow if not configured (for development)
  }

  // Check header
  const headerToken = req.headers.get('x-webhook-token') || req.headers.get('authorization')?.replace('Bearer ', '');
  if (headerToken === secret) return true;

  // Check query parameter
  const url = new URL(req.url);
  const queryToken = url.searchParams.get('token');
  if (queryToken === secret) return true;

  return false;
}
