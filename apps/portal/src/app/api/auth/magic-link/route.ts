/**
 * POST /api/auth/magic-link
 * 
 * Request a magic link authentication email.
 * 
 * Calls the authz /auth/login/initiate endpoint which handles the full flow:
 * - Email validation and domain allowlist checking
 * - User lookup/creation
 * - Magic link token + TOTP code generation
 * - Sending the email via bridge-api (server-to-server)
 * 
 * Busibox Portal never sees the magic link token or TOTP code — they stay
 * entirely within the backend (authz -> bridge-api).
 * 
 * The endpoint NEVER leaks whether an email/user exists.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, parseJsonBody, validateRequiredFields } from '@jazzmind/busibox-app/lib/next/middleware';
import { logMagicLinkSent, logLoginFailed } from '@jazzmind/busibox-app/lib/authz/audit';
import { isEmailDomainAllowed, getEmailDomainRejectionMessage } from '@jazzmind/busibox-app/lib/authz/email-validation';
import { initiateLogin } from '@jazzmind/busibox-app';
import { getAuthzOptions } from '@jazzmind/busibox-app/lib/authz/next-client';

export async function POST(request: NextRequest) {
  try {
    const body = await parseJsonBody(request);
    
    // Validate request body
    const validationError = validateRequiredFields(body, ['email']);
    if (validationError) {
      return apiError(validationError, 400);
    }

    const { email } = body;
    const normalizedEmail = email.toLowerCase().trim();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return apiError('Invalid email address', 400);
    }

    // Check if email domain is allowed (local check for fast rejection)
    // Note: authz also checks this, but we check locally first for faster feedback
    if (!isEmailDomainAllowed(normalizedEmail)) {
      await logLoginFailed(normalizedEmail, 'Email domain not allowed');
      return apiError(getEmailDomainRejectionMessage(normalizedEmail), 403);
    }

    const authOptions = getAuthzOptions();

    // Call authz to initiate login.
    // Authz handles the full flow: generate tokens, build magic link URL,
    // send the email via bridge-api. The response only contains { message, expires_in }.
    try {
      await initiateLogin(normalizedEmail, authOptions);
    } catch (initError: unknown) {
      console.error('[AUTH] Failed to initiate login:', initError);
      await logLoginFailed(normalizedEmail, 'Login initiation failed');
      return apiError('Failed to send magic link. Please try again.', 500);
    }

    await logMagicLinkSent(normalizedEmail, 'unknown');

    return apiSuccess({
      message: 'Sign-in link and code sent! Check your email.',
      email: normalizedEmail,
    });
  } catch (error) {
    console.error('[API] Magic link request error:', error);
    return apiError('An unexpected error occurred', 500);
  }
}
