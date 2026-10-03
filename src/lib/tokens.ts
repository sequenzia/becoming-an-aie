// src/lib/tokens.ts
import { createHmac, timingSafeEqual } from 'node:crypto';

export type TokenPurpose = 'confirm' | 'unsubscribe';
export interface TokenPayload { p: TokenPurpose; e: string; t: number }

const b64u = (buf: Buffer) => buf.toString('base64url');
const sign = (data: string, secret: string) => b64u(createHmac('sha256', secret).update(data).digest());

export function signToken(payload: TokenPayload, secret: string): string {
  const data = b64u(Buffer.from(JSON.stringify(payload), 'utf8'));
  return `${data}.${sign(data, secret)}`;
}

export type VerifyResult =
  | { ok: true; email: string; issuedAt: number }
  | { ok: false; reason: 'malformed' | 'signature' | 'purpose' | 'expired' };

export function verifyToken(token: string, secret: string, opts: { purpose: TokenPurpose; maxAgeMs?: number; now?: number }): VerifyResult {
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: 'malformed' };
  const [data, mac] = parts;
  const expected = sign(data, secret);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'signature' };
  let payload: TokenPayload;
  try {
    payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as TokenPayload;
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (!payload || typeof payload.e !== 'string' || typeof payload.t !== 'number') return { ok: false, reason: 'malformed' };
  if (payload.p !== opts.purpose) return { ok: false, reason: 'purpose' };
  const now = opts.now ?? Date.now();
  if (opts.maxAgeMs !== undefined && now - payload.t > opts.maxAgeMs) return { ok: false, reason: 'expired' };
  return { ok: true, email: payload.e, issuedAt: payload.t };
}
