import nodemailer from "nodemailer";

const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const emailFrom = process.env.EMAIL_FROM;
const nextAuthUrl = process.env.NEXTAUTH_URL;

if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !emailFrom) {
  throw new Error(
    "SMTP environment variables are required: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM",
  );
}

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: Number(smtpPort),
  secure: Number(smtpPort) === 465,
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
});

export async function sendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  return transporter.sendMail({
    from: emailFrom,
    to,
    subject,
    text,
    html,
  });
}

export async function sendResetPasswordEmail(
  to: string,
  token: string,
): Promise<void> {
  const origin = nextAuthUrl ?? "http://localhost:3000";
  const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
  const subject = "Reset your E-commerce password";
  const text = `You requested a password reset. Click the link below to choose a new password:\n\n${resetUrl}\n\nIf you did not request this, ignore this message.`;
  const html = `<p>You requested a password reset.</p><p><a href="${resetUrl}">Click here to reset your password</a></p><p>If you did not request this, ignore this email.</p>`;

  await sendEmail({ to, subject, text, html });
}
