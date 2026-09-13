import nodemailer from 'nodemailer';

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
 
export async function sendFacebookVerificationOtpEmail(
  to: string,
  otp: string
): Promise<void> {
  const subject = 'Verify your email for Facebook login';
  const text = `Your verification code for linking your Facebook account is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you did not attempt to sign in with Facebook, please ignore this email.`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #1e293b; margin-bottom: 16px;">Verify Your Email</h2>
      <p style="color: #475569; font-size: 16px; line-height: 24px;">
        You're connecting your Facebook account to ShopFastStore. Please use the following one-time verification code to verify your email address:
      </p>
      <div style="background-color: #f1f5f9; border-radius: 8px; padding: 16px; text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0284c7;">${otp}</span>
      </div>
      <p style="color: #64748b; font-size: 14px; line-height: 20px;">
        ⏱️ This code will expire in <strong>10 minutes</strong>.
      </p>
      <p style="color: #94a3b8; font-size: 12px; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
        If you did not request this email, please safely disregard it.
      </p>
    </div>
  `;

  console.log(`\n🔑 FACEBOOK EMAIL OTP FOR ${to}:`);
  console.log(`👉 ${otp}`);
  console.log('\n⏱️ Expiry: 10 minutes\n');

  await sendEmail({ to, subject, text, html });
}

