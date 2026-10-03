// src/lib/notify.ts
// The notify-me list: subscribe, confirm, unsubscribe (blueprint section 7.5).
//
// No mail is sent until a provider is chosen. The mailer passed in is the noop from ./mailer, which
// logs the confirm and unsubscribe links. Addresses are stored unconfirmed with created_at.
//
// The future send path (not built) must select subscribers with
//   confirmed_at IS NOT NULL AND unsubscribed_at IS NULL
// so an unconfirmed or unsubscribed address never receives a launch message (NFR-6.6.2).
//
// Both token pages change the row from their frontmatter (Astro.callAction), so they act on any method
// Astro routes to the page: GET, HEAD, and OPTIONS alike. Accepted while no mail is sent. Once a provider
// exists, /notify/confirm and /notify/unsubscribe should render a page with a POST button instead of acting
// on GET. Mail link scanners and prefetchers issue GET and HEAD and would confirm, or unsubscribe, on the
// recipient's behalf. RFC 8058 one-click unsubscribe is a POST as well, so GET has no reason to stay
// (docs/deploy-openshift.md, deferred work).
//
// Enumeration safety: no result says whether an address is on the list. subscribe answers { ok: true }
// for a new, a duplicate, a confirmed, and an unsubscribed address alike. confirm answers 'invalid'
// for a bad signature, an expired token, an unknown address, and a replayed token alike. unsubscribe
// answers 'unsubscribed' whether or not a row matched.
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { notifySubscriber } from '../db/schema';
import { CONFIRM_TOKEN_MAX_AGE_MS, TOKEN_CLOCK_SKEW_MS } from './limits';
import type { Mailer } from './mailer';
import { signToken, verifyToken } from './tokens';

/** The confirm token lifetime in whole days, for the mail text and /notify/confirm. One source: limits.ts. */
export const CONFIRM_LINK_DAYS = Math.round(CONFIRM_TOKEN_MAX_AGE_MS / (24 * 60 * 60 * 1000));

export interface SubscribeOptions {
  tokenSecret: string;
  /** Public origin. A trailing slash is dropped. The links in the message are built from it. */
  siteUrl: string;
  /** Milliseconds since the epoch. Defaults to Date.now(). Tests pass a fixed clock. */
  now?: number;
  /** Where a mailer failure is recorded. Defaults to console.error. */
  log?: (line: string) => void;
}

export type SubscribeResult = { ok: true };
export type ConfirmResult = { ok: true; state: 'confirmed' | 'invalid' };
export type UnsubscribeResult = { ok: true; state: 'unsubscribed' | 'invalid' };

const INVALID = { ok: true, state: 'invalid' } as const;

/** Trim and lowercase. The stored address and every token use this form. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function linkUrl(siteUrl: string, path: string, token: string): string {
  return `${siteUrl.replace(/\/$/, '')}${path}?${new URLSearchParams({ token }).toString()}`;
}

/**
 * Stores the address unconfirmed and hands the mailer a confirm message with fresh tokens.
 * The result never says whether the address was new (AC-5.1.3, EC-5.1.1, EC-5.1.3).
 */
export async function subscribe(db: Db, mailer: Mailer, rawEmail: string, opts: SubscribeOptions): Promise<SubscribeResult> {
  const email = normalizeEmail(rawEmail);
  const now = opts.now ?? Date.now();
  const log = opts.log ?? ((line: string) => console.error(line));

  // created_at comes from the same clock as the tokens, so the replay rule in confirm() compares
  // like with like. On conflict the existing row keeps its created_at.
  await db
    .insert(notifySubscriber)
    .values({ email, createdAt: new Date(now) })
    .onConflictDoNothing({ target: notifySubscriber.email });
  const [row] = await db.select().from(notifySubscriber).where(eq(notifySubscriber.email, email)).limit(1);

  // EC-5.1.1: a confirmed, subscribed address gets no second message. The response is the same.
  if (row?.confirmedAt && !row.unsubscribedAt) return { ok: true };

  // Fresh tokens on every subscribe. An earlier token is never reused.
  const confirmUrl = linkUrl(opts.siteUrl, '/notify/confirm', signToken({ p: 'confirm', e: email, t: now }, opts.tokenSecret));
  const unsubscribeUrl = linkUrl(opts.siteUrl, '/notify/unsubscribe', signToken({ p: 'unsubscribe', e: email, t: now }, opts.tokenSecret));

  try {
    await mailer.send({
      kind: 'confirm',
      to: email,
      subject: 'Confirm your address',
      text: [
        'You asked to hear when modules of Becoming an AI Engineer launch.',
        `Confirm your address by opening this link: ${confirmUrl}`,
        `The link works for ${CONFIRM_LINK_DAYS} days.`,
        `If you did not ask for this, ignore this message or remove the address here: ${unsubscribeUrl}`,
      ].join('\n'),
      links: { confirm: confirmUrl, unsubscribe: unsubscribeUrl },
    });
  } catch (err) {
    // EC-5.1.3: the row is stored unconfirmed either way, and the learner sees the same response.
    // The retry queue waits for the provider choice.
    log(`[notify] mailer ${mailer.name} failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  return { ok: true };
}

/**
 * Sets confirmed_at for the address in a valid confirm token and clears unsubscribed_at.
 * Replay rule (deviation 15.3.6): a token issued before the row's unsubscribed_at, or before its
 * created_at minus the clock skew, is invalid. An old link from a forwarded message, a pod log line,
 * or browser history cannot reverse a later unsubscribe or re-subscribe a deleted and re-added address.
 */
export async function confirm(db: Db, token: string, tokenSecret: string, now: number = Date.now()): Promise<ConfirmResult> {
  const verified = verifyToken(token, tokenSecret, { purpose: 'confirm', maxAgeMs: CONFIRM_TOKEN_MAX_AGE_MS, now });
  if (!verified.ok) return INVALID;
  const email = normalizeEmail(verified.email);
  const [row] = await db.select().from(notifySubscriber).where(eq(notifySubscriber.email, email)).limit(1);
  if (!row) return INVALID;
  if (verified.issuedAt < row.createdAt.getTime() - TOKEN_CLOCK_SKEW_MS) return INVALID;
  if (row.unsubscribedAt && verified.issuedAt < row.unsubscribedAt.getTime()) return INVALID;
  await db
    .update(notifySubscriber)
    .set({ confirmedAt: new Date(now), unsubscribedAt: null })
    .where(eq(notifySubscriber.email, email));
  return { ok: true, state: 'confirmed' };
}

/**
 * Sets unsubscribed_at for the address in a valid unsubscribe token. The token never expires.
 * Every valid call stamps now, so a later unsubscribe outranks every confirm token minted before it.
 * The result is 'unsubscribed' whether or not a row matched (AC-5.1.4).
 */
export async function unsubscribe(db: Db, token: string, tokenSecret: string, now: number = Date.now()): Promise<UnsubscribeResult> {
  const verified = verifyToken(token, tokenSecret, { purpose: 'unsubscribe', now });
  if (!verified.ok) return INVALID;
  await db
    .update(notifySubscriber)
    .set({ unsubscribedAt: new Date(now) })
    .where(eq(notifySubscriber.email, normalizeEmail(verified.email)));
  return { ok: true, state: 'unsubscribed' };
}
