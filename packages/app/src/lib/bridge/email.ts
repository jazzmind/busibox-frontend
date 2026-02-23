/**
 * Email Sending — Bridge API Client
 *
 * All outbound email is delegated to the Bridge API service.
 * Busibox Portal no longer holds SMTP or Resend secrets.
 *
 * Bridge API endpoints (internal network, no auth required):
 *   POST /api/v1/email/send-magic-link        — magic link + TOTP code
 *   POST /api/v1/email/send-magic-link-simple  — simple magic link
 *   POST /api/v1/email/send                    — generic email
 *   POST /api/v1/email/send-welcome            — welcome email
 *   POST /api/v1/email/send-account-deactivated
 *   POST /api/v1/email/send-account-reactivated
 *   POST /api/v1/email/test                    — test email
 */

import { getBridgeApiUrl } from '../next/api-url';

// ---------------------------------------------------------------------------
// Low-level bridge call
// ---------------------------------------------------------------------------

async function bridgePost<T = any>(path: string, body: Record<string, unknown>): Promise<T> {
  const url = `${getBridgeApiUrl()}${path}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    let detail = text;
    try {
      const json = JSON.parse(text);
      detail = json.detail || json.error || text;
    } catch { /* use raw text */ }
    throw new Error(`Bridge API ${resp.status} ${path}: ${detail}`);
  }

  return resp.json();
}

// ---------------------------------------------------------------------------
// Public API — mirrors the old email.ts exports
// ---------------------------------------------------------------------------

/**
 * Send a magic-link + TOTP code email via Bridge API.
 */
export async function sendMagicLinkWithCodeEmail(
  email: string,
  magicLinkUrl: string,
  totpCode: string,
) {
  console.log('[EMAIL] Sending magic link + TOTP via Bridge API for', email);
  const result = await bridgePost('/api/v1/email/send-magic-link', {
    to: email,
    magic_link_url: magicLinkUrl,
    totp_code: totpCode,
  });
  return { data: result, error: null };
}

/**
 * Send a simple magic-link email (no TOTP) via Bridge API.
 */
export async function sendMagicLinkEmail(email: string, magicLinkUrl: string) {
  console.log('[EMAIL] Sending magic link via Bridge API for', email);
  const result = await bridgePost('/api/v1/email/send-magic-link-simple', {
    to: email,
    magic_link_url: magicLinkUrl,
  });
  return { data: result, error: null };
}

/**
 * Send a welcome email via Bridge API.
 */
export async function sendWelcomeEmail(email: string, userName?: string) {
  const portalUrl =
    process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const result = await bridgePost('/api/v1/email/send-welcome', {
    to: email,
    user_name: userName || null,
    portal_url: portalUrl,
  });
  return { data: result, error: null };
}

/**
 * Send an account-deactivated email via Bridge API.
 */
export async function sendAccountDeactivatedEmail(email: string) {
  const result = await bridgePost('/api/v1/email/send-account-deactivated', {
    to: email,
  });
  return { data: result, error: null };
}

/**
 * Send an account-reactivated email via Bridge API.
 */
export async function sendAccountReactivatedEmail(email: string) {
  const portalUrl =
    process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const result = await bridgePost('/api/v1/email/send-account-reactivated', {
    to: email,
    portal_url: portalUrl,
  });
  return { data: result, error: null };
}

/**
 * Send a test email via Bridge API.
 * Returns the provider that was used.
 */
export async function sendTestEmail(to: string): Promise<{ provider: string }> {
  const result = await bridgePost<{ provider: string; success: boolean }>(
    '/api/v1/email/test',
    { to },
  );
  return { provider: result.provider };
}

/**
 * Send a generic email via Bridge API.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
) {
  const result = await bridgePost('/api/v1/email/send', { to, subject, html, text });
  return { data: result, error: null };
}
