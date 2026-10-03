// src/lib/tokens.test.ts
import { createHmac } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { signToken, verifyToken } from './tokens';

const SECRET = 'test-placeholder-token-not-real-0000000000';
const NOW = Date.parse('2026-09-15T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

/** Signs arbitrary data the way tokens.ts does, so a test can craft a well-signed bad payload. */
const signData = (data: string, secret: string) => createHmac('sha256', secret).update(data).digest().toString('base64url');
const b64u = (s: string) => Buffer.from(s, 'utf8').toString('base64url');

describe('tokens', () => {
  test('round trip returns the email and the issue time', () => {
    const token = signToken({ p: 'confirm', e: 'learner@example.com', t: NOW }, SECRET);
    expect(token.split('.')).toHaveLength(2);
    const result = verifyToken(token, SECRET, { purpose: 'confirm', now: NOW + 1000 });
    expect(result).toEqual({ ok: true, email: 'learner@example.com', issuedAt: NOW });
  });

  test('a tampered signature is rejected', () => {
    const token = signToken({ p: 'confirm', e: 'learner@example.com', t: NOW }, SECRET);
    const [data, mac] = token.split('.') as [string, string];
    const flipped = mac.endsWith('A') ? `${mac.slice(0, -1)}B` : `${mac.slice(0, -1)}A`;
    expect(verifyToken(`${data}.${flipped}`, SECRET, { purpose: 'confirm' })).toEqual({ ok: false, reason: 'signature' });
    expect(verifyToken(token, 'another-secret-that-is-long-enough-000000', { purpose: 'confirm' })).toEqual({
      ok: false,
      reason: 'signature',
    });
  });

  test('a tampered payload fails the signature check', () => {
    const token = signToken({ p: 'confirm', e: 'learner@example.com', t: NOW }, SECRET);
    const [, mac] = token.split('.') as [string, string];
    const other = b64u(JSON.stringify({ p: 'confirm', e: 'other@example.com', t: NOW }));
    expect(verifyToken(`${other}.${mac}`, SECRET, { purpose: 'confirm' })).toEqual({ ok: false, reason: 'signature' });
  });

  test('the wrong purpose is rejected', () => {
    const token = signToken({ p: 'unsubscribe', e: 'learner@example.com', t: NOW }, SECRET);
    expect(verifyToken(token, SECRET, { purpose: 'confirm' })).toEqual({ ok: false, reason: 'purpose' });
    expect(verifyToken(token, SECRET, { purpose: 'unsubscribe' }).ok).toBe(true);
  });

  test('expiry applies only when maxAgeMs is given', () => {
    const token = signToken({ p: 'confirm', e: 'learner@example.com', t: NOW }, SECRET);
    expect(verifyToken(token, SECRET, { purpose: 'confirm', maxAgeMs: 30 * DAY, now: NOW + 29 * DAY }).ok).toBe(true);
    expect(verifyToken(token, SECRET, { purpose: 'confirm', maxAgeMs: 30 * DAY, now: NOW + 30 * DAY }).ok).toBe(true);
    expect(verifyToken(token, SECRET, { purpose: 'confirm', maxAgeMs: 30 * DAY, now: NOW + 30 * DAY + 1 })).toEqual({
      ok: false,
      reason: 'expired',
    });
    expect(verifyToken(token, SECRET, { purpose: 'confirm', now: NOW + 400 * DAY }).ok).toBe(true);
  });

  test('malformed input is rejected without throwing', () => {
    expect(verifyToken('', SECRET, { purpose: 'confirm' })).toEqual({ ok: false, reason: 'malformed' });
    expect(verifyToken('no-dot', SECRET, { purpose: 'confirm' })).toEqual({ ok: false, reason: 'malformed' });
    expect(verifyToken('a.b.c', SECRET, { purpose: 'confirm' })).toEqual({ ok: false, reason: 'malformed' });
    expect(verifyToken('.abc', SECRET, { purpose: 'confirm' })).toEqual({ ok: false, reason: 'malformed' });
    // A correctly signed token whose payload is not JSON.
    const junk = b64u('not json');
    expect(verifyToken(`${junk}.${signData(junk, SECRET)}`, SECRET, { purpose: 'confirm' })).toEqual({
      ok: false,
      reason: 'malformed',
    });
    // A correctly signed token whose payload lacks the fields.
    const partial = b64u(JSON.stringify({ p: 'confirm' }));
    expect(verifyToken(`${partial}.${signData(partial, SECRET)}`, SECRET, { purpose: 'confirm' })).toEqual({
      ok: false,
      reason: 'malformed',
    });
    // A correctly signed JSON null.
    const nul = b64u('null');
    expect(verifyToken(`${nul}.${signData(nul, SECRET)}`, SECRET, { purpose: 'confirm' })).toEqual({
      ok: false,
      reason: 'malformed',
    });
  });
});
