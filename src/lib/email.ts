import nodemailer from 'nodemailer';

import { PASSWORD_RESET_EXPIRATION_MINUTES } from '@/constants';

const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const emailFrom = process.env.EMAIL_FROM;
const nextAuthUrl = process.env.NEXTAUTH_URL;

function getTransporter() {
  if (
    !smtpHost ||
    !smtpPort ||
    !smtpUser ||
    !smtpPass ||
    !emailFrom ||
    smtpUser.includes('placeholder')
  ) {
    return null;
  }
  return nodemailer.createTransport({
    host: smtpHost,
    port: Number(smtpPort),
    secure: Number(smtpPort) === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });
}

export async function sendEmail({
  to,
  subject,
  text,
  html
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const transporter = getTransporter();
  if (!transporter) {
    console.log('\n========================================');
    console.log(`[SMTP Unconfigured / Dev Mode] Email to: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Content:\n${text}`);
    console.log('========================================\n');
    return;
  }
  return transporter.sendMail({
    from: emailFrom,
    to,
    subject,
    text,
    html
  });
}

export async function sendResetPasswordEmail(
  to: string,
  token: string
): Promise<void> {
  const origin = nextAuthUrl ?? 'http://localhost:3000';
  const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
  const subject = 'Reset your ShopFastStore password';
  const text = `You requested a password reset. Click here to reset your password: ${resetUrl}\n\nThis link will expire in ${PASSWORD_RESET_EXPIRATION_MINUTES} minutes.\n\nIf you did not request this, ignore this message.`;
  const html = `<p>You requested a password reset. Click <a href="${resetUrl}" style="text-decoration: underline;">here</a> to reset your password.</p><p>This link will expire in ${PASSWORD_RESET_EXPIRATION_MINUTES} minutes.</p><p>If you did not request this, ignore this email.</p>`;

  console.log(`\n🔑 PASSWORD RESET LINK FOR ${to}:`);
  console.log(`👉 ${resetUrl}`);
  console.log(`⏱️ Expiry: ${PASSWORD_RESET_EXPIRATION_MINUTES} minutes\n`);

  await sendEmail({ to, subject, text, html });
}
