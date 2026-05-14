import nodemailer from "nodemailer";

/**
 * Outbound mail message shape consumed by {@link EmailTransport}.
 * Mirrors a minimal nodemailer envelope (`from` / `to` / `subject`
 * + a paired `text` and `html` body) plus optional `headers` for
 * `List-Unsubscribe` and similar transactional metadata (ADR-0023).
 */
export interface OutboundMail {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  headers?: Record<string, string>;
}

/**
 * Transport boundary — every send-mail path in the dispatcher goes
 * through one of these. Production binds {@link createNodemailerTransport};
 * tests bind the in-memory `FakeEmailTransport` from
 * `tests/helpers/fake-email-transport.ts`. Interface-only file —
 * excluded from coverage per Constitution V.2.
 */
export interface EmailTransport {
  send(msg: OutboundMail): Promise<void>;
}

/**
 * Build a nodemailer-backed transport bound to the SMTP env vars
 * documented in `.env.example` (`SMTP_HOST`, `SMTP_PORT`,
 * `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE`). The returned
 * transport throws on send when SMTP is unreachable; the dispatcher
 * is responsible for translating that into a retry row.
 */
export function createNodemailerTransport(): EmailTransport {
  const host = process.env["SMTP_HOST"] ?? "localhost";
  const port = Number(process.env["SMTP_PORT"] ?? 1025);
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASSWORD"];
  const secure = process.env["SMTP_SECURE"] === "true";
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    ...(user && pass ? { auth: { user, pass } } : {}),
  });
  return {
    async send(msg: OutboundMail): Promise<void> {
      await transporter.sendMail(msg);
    },
  };
}
