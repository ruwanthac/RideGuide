import nodemailer from 'nodemailer';
import { env } from '../config/env';

let smtpTransporter: nodemailer.Transporter | null = null;
let warnedMissingConfig = false;

function isSmtpConfigured(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.EMAIL_FROM);
}

function getSmtpTransporter(): nodemailer.Transporter | null {
  if (!isSmtpConfigured()) return null;
  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      host: env.SMTP_HOST!,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: { user: env.SMTP_USER!, pass: env.SMTP_PASS! },
    });
  }
  return smtpTransporter;
}

export function isEmailConfigured(): boolean {
  return isSmtpConfigured();
}

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; skipped: true }
  | { ok: false; error: string };

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}): Promise<SendEmailResult> {
  if (!isSmtpConfigured()) {
    if (!warnedMissingConfig) {
      console.warn(
        '[email] SMTP not configured: set SMTP_HOST, SMTP_USER, SMTP_PASS, and EMAIL_FROM (e.g. Brevo: smtp-relay.brevo.com:587)'
      );
      warnedMissingConfig = true;
    }
    return { ok: false, skipped: true };
  }

  const transport = getSmtpTransporter();
  if (!transport) return { ok: false, skipped: true };

  try {
    const info = await transport.sendMail({
      from: env.EMAIL_FROM!,
      to: params.to,
      subject: params.subject,
      html: params.html,
      ...(params.text !== undefined ? { text: params.text } : {}),
      ...(params.replyTo !== undefined ? { replyTo: params.replyTo } : {}),
    });

    const raw = info.messageId ?? '';
    const id = raw.replace(/^<|>$/g, '') || 'smtp';
    return { ok: true, id };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[email] sendMail failed:', message);
    return { ok: false, error: message };
  }
}
