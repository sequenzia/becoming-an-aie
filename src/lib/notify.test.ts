// src/lib/notify.test.ts
// Blueprint section 7.5 tests on PGlite with a spy mailer, plus the matrix lines AC-5.1.3, AC-5.1.4,
// EC-5.1.1, EC-5.1.2 (as deviation 15.3.6), EC-5.1.3, and the enumeration-safety rule.
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { createPgliteDb, type DbHandle } from '../db/client';
import { notifySubscriber } from '../db/schema';
import { CONFIRM_TOKEN_MAX_AGE_MS, TOKEN_CLOCK_SKEW_MS } from './limits';
import type { Mailer, OutboundMessage } from './mailer';
import { CONFIRM_LINK_DAYS, confirm, normalizeEmail, subscribe, unsubscribe } from './notify';
import { signToken, verifyToken } from './tokens';

const SECRET = 'test-placeholder-token-not-real-0000000000';
const OTHER_SECRET = 'another-secret-that-is-long-enough-0000000';
const SITE = 'http://localhost:4321';
const T0 = Date.parse('2026-09-16T09:00:00Z');
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

let h: DbHandle;
let sent: OutboundMessage[] = [];
const spy: Mailer = {
  name: 'spy',
  send: async (m) => {
    sent.push(m);
  },
};
const rejecting: Mailer = {
  name: 'rejecting',
  send: async () => {
    throw new Error('provider down');
  },
};

beforeAll(async () => {
  h = await createPgliteDb();
  await h.migrate();
});

afterAll(async () => {
  await h.close();
});

beforeEach(() => {
  sent = [];
});

const opts = (now: number) => ({ tokenSecret: SECRET, siteUrl: SITE, now });
const readRow = async (email: string) => (await h.db.select().from(notifySubscriber).where(eq(notifySubscriber.email, email)))[0] ?? null;
const tokenOf = (url: string) => new URL(url).searchParams.get('token') ?? '';
const lastMessage = () => sent[sent.length - 1]!;
const tamper = (token: string) => {
  const [data, mac] = token.split('.') as [string, string];
  const flipped = mac.endsWith('A') ? `${mac.slice(0, -1)}B` : `${mac.slice(0, -1)}A`;
  return `${data}.${flipped}`;
};

describe('normalizeEmail', () => {
  test('trims and lowercases', () => {
    expect(normalizeEmail('  Learner@Example.COM ')).toBe('learner@example.com');
    expect(normalizeEmail('plain@example.com')).toBe('plain@example.com');
  });
});

describe('subscribe (AC-5.1.3)', () => {
  test('stores the address lowercased and trimmed, unconfirmed, with createdAt', async () => {
    const result = await subscribe(h.db, spy, '  New.Learner@Example.COM ', opts(T0));
    expect(result).toEqual({ ok: true });
    const row = await readRow('new.learner@example.com');
    expect(row).not.toBeNull();
    expect(row!.createdAt.getTime()).toBe(T0);
    expect(row!.confirmedAt).toBeNull();
    expect(row!.unsubscribedAt).toBeNull();
    expect(await readRow('  New.Learner@Example.COM ')).toBeNull();
  });

  test('hands the mailer one confirm message whose links verify with the secret', async () => {
    await subscribe(h.db, spy, 'links@example.com', opts(T0));
    expect(sent).toHaveLength(1);
    const m = sent[0]!;
    expect(m.kind).toBe('confirm');
    expect(m.to).toBe('links@example.com');
    expect(m.subject).toBe('Confirm your address');
    expect(m.links.confirm).toMatch(new RegExp(`^${SITE}/notify/confirm\\?token=`));
    expect(m.links.unsubscribe).toMatch(new RegExp(`^${SITE}/notify/unsubscribe\\?token=`));
    expect(m.text).toContain(m.links.confirm);
    expect(m.text).toContain(m.links.unsubscribe);
    // The lifetime sentence is derived from CONFIRM_TOKEN_MAX_AGE_MS, the same constant /notify/confirm renders.
    expect(CONFIRM_LINK_DAYS).toBe(30);
    expect(m.text).toContain(`The link works for ${CONFIRM_LINK_DAYS} days.`);
    expect(verifyToken(tokenOf(m.links.confirm!), SECRET, { purpose: 'confirm', now: T0 })).toEqual({
      ok: true,
      email: 'links@example.com',
      issuedAt: T0,
    });
    expect(verifyToken(tokenOf(m.links.unsubscribe), SECRET, { purpose: 'unsubscribe', now: T0 })).toEqual({
      ok: true,
      email: 'links@example.com',
      issuedAt: T0,
    });
  });

  test('drops a trailing slash on the site URL', async () => {
    await subscribe(h.db, spy, 'slash@example.com', { ...opts(T0), siteUrl: `${SITE}/` });
    expect(lastMessage().links.confirm).toMatch(new RegExp(`^${SITE}/notify/confirm\\?token=`));
  });

  test('a duplicate unconfirmed address keeps its createdAt, gets a fresh token, and the same response', async () => {
    const first = await subscribe(h.db, spy, 'twice@example.com', opts(T0));
    const firstToken = tokenOf(lastMessage().links.confirm!);
    const second = await subscribe(h.db, spy, 'Twice@example.com', opts(T0 + HOUR));
    expect(second).toEqual(first);
    expect(sent).toHaveLength(2);
    const secondToken = tokenOf(lastMessage().links.confirm!);
    expect(secondToken).not.toBe(firstToken);
    expect(verifyToken(secondToken, SECRET, { purpose: 'confirm', now: T0 + HOUR })).toMatchObject({ ok: true, issuedAt: T0 + HOUR });
    const row = await readRow('twice@example.com');
    expect(row!.createdAt.getTime()).toBe(T0);
    expect(row!.confirmedAt).toBeNull();
  });

  test('EC-5.1.1: a confirmed address gets no second message and the same response', async () => {
    const first = await subscribe(h.db, spy, 'confirmed@example.com', opts(T0));
    const token = tokenOf(lastMessage().links.confirm!);
    expect(await confirm(h.db, token, SECRET, T0 + HOUR)).toEqual({ ok: true, state: 'confirmed' });
    const second = await subscribe(h.db, spy, 'confirmed@example.com', opts(T0 + 2 * HOUR));
    expect(second).toEqual(first);
    expect(sent).toHaveLength(1);
    const row = await readRow('confirmed@example.com');
    expect(row!.confirmedAt!.getTime()).toBe(T0 + HOUR);
  });

  test('EC-5.1.3: a rejecting mailer leaves the row unconfirmed and the response unchanged', async () => {
    const lines: string[] = [];
    const result = await subscribe(h.db, rejecting, 'unlucky@example.com', { ...opts(T0), log: (l) => lines.push(l) });
    expect(result).toEqual({ ok: true });
    const row = await readRow('unlucky@example.com');
    expect(row).not.toBeNull();
    expect(row!.confirmedAt).toBeNull();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('rejecting');
    expect(lines[0]).toContain('provider down');
    expect(lines[0]).not.toContain('unlucky@example.com');
  });

  test('the response never reveals list membership', async () => {
    const fresh = await subscribe(h.db, spy, 'member-a@example.com', opts(T0));
    const duplicate = await subscribe(h.db, spy, 'member-a@example.com', opts(T0 + MINUTE));
    await confirm(h.db, tokenOf(lastMessage().links.confirm!), SECRET, T0 + 2 * MINUTE);
    const confirmedAgain = await subscribe(h.db, spy, 'member-a@example.com', opts(T0 + 3 * MINUTE));
    await unsubscribe(h.db, tokenOf(sent[0]!.links.unsubscribe), SECRET, T0 + 4 * MINUTE);
    const afterUnsubscribe = await subscribe(h.db, spy, 'member-a@example.com', opts(T0 + 5 * MINUTE));
    const failed = await subscribe(h.db, rejecting, 'member-b@example.com', { ...opts(T0), log: () => {} });
    for (const r of [duplicate, confirmedAgain, afterUnsubscribe, failed]) expect(r).toEqual(fresh);
  });
});

describe('confirm', () => {
  test('sets confirmedAt only through the endpoint and clears unsubscribedAt', async () => {
    await subscribe(h.db, spy, 'confirm-me@example.com', opts(T0));
    const token = tokenOf(lastMessage().links.confirm!);
    expect((await readRow('confirm-me@example.com'))!.confirmedAt).toBeNull();
    expect(await confirm(h.db, token, SECRET, T0 + HOUR)).toEqual({ ok: true, state: 'confirmed' });
    const row = await readRow('confirm-me@example.com');
    expect(row!.confirmedAt!.getTime()).toBe(T0 + HOUR);
    expect(row!.unsubscribedAt).toBeNull();
  });

  test('a tampered token, the wrong purpose, and malformed input are invalid without throwing', async () => {
    await subscribe(h.db, spy, 'tamper@example.com', opts(T0));
    const m = lastMessage();
    const confirmToken = tokenOf(m.links.confirm!);
    expect(await confirm(h.db, tamper(confirmToken), SECRET, T0)).toEqual({ ok: true, state: 'invalid' });
    expect(await confirm(h.db, tokenOf(m.links.unsubscribe), SECRET, T0)).toEqual({ ok: true, state: 'invalid' });
    expect(await confirm(h.db, confirmToken, OTHER_SECRET, T0)).toEqual({ ok: true, state: 'invalid' });
    expect(await confirm(h.db, '', SECRET, T0)).toEqual({ ok: true, state: 'invalid' });
    expect(await confirm(h.db, 'not.a.token.at.all', SECRET, T0)).toEqual({ ok: true, state: 'invalid' });
    expect((await readRow('tamper@example.com'))!.confirmedAt).toBeNull();
  });

  test('a confirm token older than 30 days is invalid, one at the boundary still works', async () => {
    await subscribe(h.db, spy, 'expiry@example.com', opts(T0));
    const token = tokenOf(lastMessage().links.confirm!);
    expect(CONFIRM_TOKEN_MAX_AGE_MS).toBe(30 * DAY);
    expect(await confirm(h.db, token, SECRET, T0 + 30 * DAY + 1)).toEqual({ ok: true, state: 'invalid' });
    expect((await readRow('expiry@example.com'))!.confirmedAt).toBeNull();
    expect(await confirm(h.db, token, SECRET, T0 + 30 * DAY)).toEqual({ ok: true, state: 'confirmed' });
  });

  test('a well-signed token for an address that is not on the list reads exactly like a bad one', async () => {
    const unknown = signToken({ p: 'confirm', e: 'nobody@example.com', t: T0 }, SECRET);
    const known = signToken({ p: 'confirm', e: 'tamper@example.com', t: T0 }, SECRET);
    expect(await confirm(h.db, unknown, SECRET, T0 + MINUTE)).toEqual(await confirm(h.db, tamper(known), SECRET, T0 + MINUTE));
    expect(await readRow('nobody@example.com')).toBeNull();
  });

  test('replay: an old confirm token cannot reverse a later unsubscribe (deviation 15.3.6)', async () => {
    await subscribe(h.db, spy, 'replay@example.com', opts(T0));
    const first = lastMessage();
    const oldConfirm = tokenOf(first.links.confirm!);
    expect(await confirm(h.db, oldConfirm, SECRET, T0 + HOUR)).toEqual({ ok: true, state: 'confirmed' });
    expect(await unsubscribe(h.db, tokenOf(first.links.unsubscribe), SECRET, T0 + 2 * HOUR)).toEqual({ ok: true, state: 'unsubscribed' });
    expect(await confirm(h.db, oldConfirm, SECRET, T0 + 3 * HOUR)).toEqual({ ok: true, state: 'invalid' });
    let row = await readRow('replay@example.com');
    expect(row!.unsubscribedAt!.getTime()).toBe(T0 + 2 * HOUR);
    expect(row!.confirmedAt!.getTime()).toBe(T0 + HOUR);

    // EC-5.1.2 by the fresh-token path: subscribing again mints a newer token that confirms.
    await subscribe(h.db, spy, 'replay@example.com', opts(T0 + 4 * HOUR));
    expect(sent).toHaveLength(2);
    row = await readRow('replay@example.com');
    expect(row!.unsubscribedAt!.getTime()).toBe(T0 + 2 * HOUR);
    const freshConfirm = tokenOf(lastMessage().links.confirm!);
    expect(freshConfirm).not.toBe(oldConfirm);
    expect(await confirm(h.db, freshConfirm, SECRET, T0 + 5 * HOUR)).toEqual({ ok: true, state: 'confirmed' });
    row = await readRow('replay@example.com');
    expect(row!.confirmedAt!.getTime()).toBe(T0 + 5 * HOUR);
    expect(row!.unsubscribedAt).toBeNull();
    // The old token can no longer change anything the learner did not choose: with no unsubscribe on
    // record it may re-stamp confirmedAt, and the row stays confirmed and subscribed.
    await confirm(h.db, oldConfirm, SECRET, T0 + 6 * HOUR);
    row = await readRow('replay@example.com');
    expect(row!.confirmedAt).not.toBeNull();
    expect(row!.unsubscribedAt).toBeNull();
  });

  test('a token issued before the row existed is invalid, within the clock skew it is not', async () => {
    await subscribe(h.db, spy, 'skew@example.com', opts(T0));
    const early = signToken({ p: 'confirm', e: 'skew@example.com', t: T0 - TOKEN_CLOCK_SKEW_MS - 1 }, SECRET);
    expect(await confirm(h.db, early, SECRET, T0 + MINUTE)).toEqual({ ok: true, state: 'invalid' });
    const withinSkew = signToken({ p: 'confirm', e: 'skew@example.com', t: T0 - TOKEN_CLOCK_SKEW_MS }, SECRET);
    expect(await confirm(h.db, withinSkew, SECRET, T0 + MINUTE)).toEqual({ ok: true, state: 'confirmed' });
  });

  test('an address that was removed and added again does not honor its old token', async () => {
    await subscribe(h.db, spy, 'readded@example.com', opts(T0));
    const oldConfirm = tokenOf(lastMessage().links.confirm!);
    await h.db.delete(notifySubscriber).where(eq(notifySubscriber.email, 'readded@example.com'));
    await subscribe(h.db, spy, 'readded@example.com', opts(T0 + DAY));
    expect(await confirm(h.db, oldConfirm, SECRET, T0 + DAY + HOUR)).toEqual({ ok: true, state: 'invalid' });
    expect((await readRow('readded@example.com'))!.confirmedAt).toBeNull();
    expect(await confirm(h.db, tokenOf(lastMessage().links.confirm!), SECRET, T0 + DAY + HOUR)).toEqual({ ok: true, state: 'confirmed' });
  });
});

describe('unsubscribe (AC-5.1.4)', () => {
  test('sets unsubscribedAt and is idempotent', async () => {
    await subscribe(h.db, spy, 'leave@example.com', opts(T0));
    const token = tokenOf(lastMessage().links.unsubscribe);
    expect(await unsubscribe(h.db, token, SECRET, T0 + HOUR)).toEqual({ ok: true, state: 'unsubscribed' });
    expect((await readRow('leave@example.com'))!.unsubscribedAt!.getTime()).toBe(T0 + HOUR);
    expect(await unsubscribe(h.db, token, SECRET, T0 + 2 * HOUR)).toEqual({ ok: true, state: 'unsubscribed' });
    const row = await readRow('leave@example.com');
    expect(row!.unsubscribedAt).not.toBeNull();
    expect(row!.unsubscribedAt!.getTime()).toBeGreaterThanOrEqual(T0 + HOUR);
  });

  test('an unsubscribe token never expires', async () => {
    await subscribe(h.db, spy, 'old-link@example.com', opts(T0));
    const token = tokenOf(lastMessage().links.unsubscribe);
    expect(await unsubscribe(h.db, token, SECRET, T0 + 400 * DAY)).toEqual({ ok: true, state: 'unsubscribed' });
    expect((await readRow('old-link@example.com'))!.unsubscribedAt!.getTime()).toBe(T0 + 400 * DAY);
  });

  test('a tampered token is invalid and changes nothing', async () => {
    await subscribe(h.db, spy, 'safe@example.com', opts(T0));
    const token = tokenOf(lastMessage().links.unsubscribe);
    expect(await unsubscribe(h.db, tamper(token), SECRET, T0 + HOUR)).toEqual({ ok: true, state: 'invalid' });
    expect(await unsubscribe(h.db, token, OTHER_SECRET, T0 + HOUR)).toEqual({ ok: true, state: 'invalid' });
    expect(await unsubscribe(h.db, tokenOf(lastMessage().links.confirm!), SECRET, T0 + HOUR)).toEqual({ ok: true, state: 'invalid' });
    expect(await unsubscribe(h.db, '', SECRET, T0 + HOUR)).toEqual({ ok: true, state: 'invalid' });
    expect((await readRow('safe@example.com'))!.unsubscribedAt).toBeNull();
  });

  test('a well-signed token for an address that is not on the list reads exactly like a listed one', async () => {
    await subscribe(h.db, spy, 'listed@example.com', opts(T0));
    const listed = await unsubscribe(h.db, tokenOf(lastMessage().links.unsubscribe), SECRET, T0 + HOUR);
    const unknown = signToken({ p: 'unsubscribe', e: 'ghost@example.com', t: T0 }, SECRET);
    expect(await unsubscribe(h.db, unknown, SECRET, T0 + HOUR)).toEqual(listed);
    expect(await readRow('ghost@example.com')).toBeNull();
  });

  test('a later unsubscribe outranks a confirm token minted between the two', async () => {
    await subscribe(h.db, spy, 'latest@example.com', opts(T0));
    const first = lastMessage();
    await unsubscribe(h.db, tokenOf(first.links.unsubscribe), SECRET, T0 + HOUR);
    await subscribe(h.db, spy, 'latest@example.com', opts(T0 + 2 * HOUR));
    const between = tokenOf(lastMessage().links.confirm!);
    await unsubscribe(h.db, tokenOf(first.links.unsubscribe), SECRET, T0 + 3 * HOUR);
    expect(await confirm(h.db, between, SECRET, T0 + 4 * HOUR)).toEqual({ ok: true, state: 'invalid' });
    expect((await readRow('latest@example.com'))!.unsubscribedAt!.getTime()).toBe(T0 + 3 * HOUR);
  });
});
