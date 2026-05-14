import type { EmailTransport, OutboundMail } from "@/server/infra/email-transport";

/**
 * In-memory recorder used by every unit and integration test that
 * needs to assert outbound mail without booting nodemailer. Records
 * each {@link OutboundMail} in `sent`; clearable per-test via
 * {@link FakeEmailTransport.clear}.
 */
export class FakeEmailTransport implements EmailTransport {
  /** Every message that {@link send} accepted, in call order. */
  public readonly sent: OutboundMail[] = [];
  /** Optional throw-on-next-send hook to simulate transport failure. */
  public throwOnNextSend: Error | null = null;

  /** Records the message (or throws once if {@link throwOnNextSend} is set). */
  async send(msg: OutboundMail): Promise<void> {
    if (this.throwOnNextSend) {
      const err = this.throwOnNextSend;
      this.throwOnNextSend = null;
      throw err;
    }
    this.sent.push(msg);
  }

  /** Reset the recorder between tests. */
  clear(): void {
    this.sent.length = 0;
    this.throwOnNextSend = null;
  }
}
