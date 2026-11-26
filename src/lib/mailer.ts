import tls from 'tls';
import nodemailer from 'nodemailer';

export interface PasswordResetEmailParams {
  to: string;
  fullName: string;
  resetUrl: string;
  expiresInMinutes: number;
}

function sanitizeFromHeader(rawFrom: string, fallbackUser: string): string {
  const cleaned = rawFrom.trim().replace(/^["']+|["']+$/g, '');
  // If someone accidentally left trailing characters after closing angle bracket, e.g. `Name <a@b.com>"c`
  const angleMatch = cleaned.match(/^(.*?<[^<>@\s]+@[^<>@\s]+>)/);
  if (angleMatch) {
    return angleMatch[1].replace(/^["']+|["']+$/g, '').trim();
  }
  return cleaned || (fallbackUser ? `SRVS — USJ-R <${fallbackUser}>` : '');
}

function getTrustedCaCertificates(): string[] | undefined {
  const getCACerts = (tls as unknown as {
    getCACertificates?: (type?: 'default' | 'system' | 'bundled' | 'extra') => string[];
  }).getCACertificates;

  if (typeof getCACerts !== 'function') return undefined;

  try {
    const merged = new Set<string>([
      ...getCACerts('default'),
      ...getCACerts('system'),
    ]);
    return merged.size > 0 ? Array.from(merged) : undefined;
  } catch {
    return undefined;
  }
}

function getSmtpConfig() {
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = parseInt(process.env.SMTP_PORT || '465', 10) || 465;
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;
  const from = sanitizeFromHeader(process.env.SMTP_FROM || '', user);
  const rejectUnauthorized =
    process.env.SMTP_TLS_REJECT_UNAUTHORIZED === 'false' ? false : true;
  return { user, pass, host, port, secure, from, rejectUnauthorized };
}

export function isMailerConfigured(): boolean {
  const { user, pass } = getSmtpConfig();
  return Boolean(user && pass);
}

function isTlsCertChainError(err: any): boolean {
  const code = String(err?.code || '');
  const msg = String(err?.message || '').toLowerCase();
  return (
    code === 'SELF_SIGNED_CERT_IN_CHAIN' ||
    code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
    code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
    msg.includes('self-signed certificate') ||
    msg.includes('unable to verify the first certificate')
  );
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildTransporter(
  cfg: ReturnType<typeof getSmtpConfig>,
  opts: { allowInsecureTls?: boolean } = {}
) {
  const ca = opts.allowInsecureTls ? undefined : getTrustedCaCertificates();
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: {
      user: cfg.user,
      pass: cfg.pass,
    },
    tls: {
      servername: cfg.host,
      ...(ca ? { ca } : {}),
      rejectUnauthorized: opts.allowInsecureTls ? false : cfg.rejectUnauthorized,
    },
  });
}

export async function sendPasswordResetEmail({
  to,
  fullName,
  resetUrl,
  expiresInMinutes,
}: PasswordResetEmailParams): Promise<void> {
  const cfg = getSmtpConfig();
  if (!cfg.user || !cfg.pass) {
    throw new Error('MAILER_NOT_CONFIGURED');
  }

  const safeName = escapeHtml(fullName || 'User');
  const safeUrl = escapeHtml(resetUrl);

  const subject = 'Reset your SRVS password';
  const text = [
    `Hello ${fullName || 'User'},`,
    '',
    'We received a request to reset the password for your SRVS (Syllabus Repository & Versioning System) account.',
    '',
    'Open the link below to set a new password:',
    resetUrl,
    '',
    `This link will expire in ${expiresInMinutes} minutes and can only be used once.`,
    '',
    'If you did not request a password reset, you can safely ignore this email and your password will remain unchanged.',
    '',
    '— University of San Jose - Recoletos · SRVS',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your SRVS password</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="background-color:#005A36;padding:24px 28px;border-bottom:3px solid #C99700;">
              <p style="margin:0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#FEF08A;font-weight:700;">
                University of San Jose - Recoletos
              </p>
              <h1 style="margin:6px 0 0;font-size:20px;line-height:1.3;color:#ffffff;font-weight:700;">
                SRVS Password Reset
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">
                Hello <strong>${safeName}</strong>,
              </p>
              <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#334155;">
                We received a request to reset the password for your Syllabus Repository &amp; Versioning System (SRVS) account. Click the button below to choose a new password:
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 22px;">
                <tr>
                  <td style="border-radius:8px;background-color:#005A36;">
                    <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#475569;">
                This link will expire in <strong>${expiresInMinutes} minutes</strong> and can only be used once.
              </p>
              <p style="margin:0 0 18px;font-size:12px;line-height:1.6;color:#64748b;word-break:break-all;">
                If the button doesn&apos;t work, copy and paste this link into your browser:<br />
                <a href="${safeUrl}" style="color:#005A36;">${safeUrl}</a>
              </p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />
              <p style="margin:0;font-size:12px;line-height:1.5;color:#64748b;">
                If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const mailOptions = {
    from: cfg.from,
    to,
    subject,
    text,
    html,
  };

  try {
    const transporter = buildTransporter(cfg);
    await transporter.sendMail(mailOptions);
  } catch (err: any) {
    // Fallback for local dev environments where an antivirus Mail Shield (e.g., Avast)
    // intercepts SMTP TLS on a Node version without system CA loading.
    if (process.env.NODE_ENV !== 'production' && isTlsCertChainError(err)) {
      console.warn(
        '[mailer] Retrying SMTP send after local TLS certificate interception error:',
        err?.message || err
      );
      const fallbackTransporter = buildTransporter(cfg, { allowInsecureTls: true });
      await fallbackTransporter.sendMail(mailOptions);
      return;
    }
    throw err;
  }
}
