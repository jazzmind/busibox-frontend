/**
 * POST /api/email-settings/test — Send a test email via Bridge API.
 *
 * Bridge reads email config from config-api on demand, so we must pass a
 * config-api scoped token in the Authorization header so bridge can look up
 * the SMTP / Resend credentials.
 */

import { NextRequest } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { sendTestEmail } from '@jazzmind/busibox-app/lib/bridge/email';
import { getEmailConfigToken } from '@jazzmind/busibox-app/lib/bridge/email-config';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;
    const { user, sessionJwt } = authResult;

    if (!user.email) {
      return apiError('No email address on your account to send to', 400);
    }

    console.log('[API] Sending test email to', user.email, 'requested by admin', user.id);

    const configToken = await getEmailConfigToken(user.id, sessionJwt);
    const { provider } = await sendTestEmail(user.email, configToken);

    return apiSuccess({
      message: `Test email sent to ${user.email} via ${provider}`,
      provider,
      recipient: user.email,
    });
  } catch (error: any) {
    console.error('[API] Test email failed:', error);
    return apiError(error.message || 'Failed to send test email', 500);
  }
}
