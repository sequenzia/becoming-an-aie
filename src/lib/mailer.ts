// src/lib/mailer.ts
export type MessageKind = 'confirm' | 'launch';

export interface OutboundMessage {
  kind: MessageKind;
  to: string;
  subject: string;
  text: string;
  links: { confirm?: string; unsubscribe: string };
}

export interface Mailer {
  readonly name: string;
  send(message: OutboundMessage): Promise<void>;
}

/** The only implementation until a provider is chosen. Logs one line, never throws. */
export class NoopMailer implements Mailer {
  readonly name = 'noop';
  constructor(private readonly log: (line: string) => void = (l) => console.info(l)) {}
  async send(m: OutboundMessage): Promise<void> {
    const confirm = m.links.confirm ? ` confirm=${m.links.confirm}` : '';
    this.log(`[mailer:noop] kind=${m.kind} to=${m.to}${confirm} unsubscribe=${m.links.unsubscribe}`);
  }
}

let current: Mailer | null = null;

/**
 * The mailer for the configured provider. Only 'none' exists (EMAIL_PROVIDER is an enum of one value), so
 * every call gives the noop. A second provider adds a branch on `provider` here and nowhere else
 * (docs/decisions.md, 2026-10-03).
 */
export function getMailer(provider: 'none' = 'none'): Mailer {
  if (provider !== 'none') throw new Error(`Unknown mail provider ${String(provider)}.`);
  current ??= new NoopMailer();
  return current;
}

/** Test seam. */
export function setMailerForTests(m: Mailer | null) {
  current = m;
}
