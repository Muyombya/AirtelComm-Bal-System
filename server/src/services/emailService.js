import nodemailer from "nodemailer";
import { env } from "../config/environment.js";

function requireSmtpConfig() {
  const missing = [];
  if (!env.smtp.host) missing.push("SMTP_HOST");
  if (!env.smtp.user) missing.push("SMTP_USER");
  if (!env.smtp.password) missing.push("SMTP_PASSWORD");
  if (!env.smtp.from) missing.push("SMTP_FROM");
  if (missing.length) {
    const error = new Error(`Email service is not configured. Missing: ${missing.join(", ")}.`);
    error.statusCode = 503;
    throw error;
  }
}

export async function sendEmailWithAttachment({ to, cc, subject, text, attachment }) {
  requireSmtpConfig();
  const transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: { user: env.smtp.user, pass: env.smtp.password }
  });

  return transporter.sendMail({
    from: env.smtp.from,
    to,
    cc: cc || undefined,
    subject,
    text,
    attachments: [attachment]
  });
}
