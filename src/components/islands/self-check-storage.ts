// src/components/islands/self-check-storage.ts
// Local state and the offline queue for the self-check island (blueprint section 9.2, keys in 14.6).
// Every read and write touches localStorage inside try/catch: a private window, a full quota, or a
// browser with storage disabled must never break the island. A read that fails gives null or [].
// The same module runs in the browser and, with a fake Storage on globalThis, in the node test
// environment, so it reaches localStorage through globalThis and never through window.
import type { SavedSelfCheckState } from './SelfCheck';

export const STATE_KEY = (slug: string) => `aie:selfcheck:${slug}`;
export const QUEUE_KEY = 'aie:selfcheck:queue';

export interface QueuedSubmit {
  moduleSlug: string;
  answers: Record<string, number[]>;
  queuedAt: string;
}

export type SendOutcome = 'sent' | 'retry' | 'drop';

function storage(): Storage | null {
  try {
    const s = (globalThis as { localStorage?: Storage }).localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isIndexList(v: unknown): v is number[] {
  return Array.isArray(v) && v.every((n) => Number.isInteger(n) && (n as number) >= 0);
}

/** Answers are option indices per question id. Anything else in storage is junk. */
export function isAnswers(v: unknown): v is Record<string, number[]> {
  return isRecord(v) && Object.values(v).every(isIndexList);
}

function isSavedState(v: unknown): v is SavedSelfCheckState {
  if (!isRecord(v)) return false;
  if (!isAnswers(v.answers)) return false;
  if (!isRecord(v.correctOnce) || !Object.values(v.correctOnce).every((b) => typeof b === 'boolean')) return false;
  if (!Number.isInteger(v.attempts) || (v.attempts as number) < 0) return false;
  if (typeof v.passed !== 'boolean') return false;
  if (typeof v.updatedAt !== 'string' || Number.isNaN(Date.parse(v.updatedAt))) return false;
  return true;
}

function isQueuedSubmit(v: unknown): v is QueuedSubmit {
  return isRecord(v) && typeof v.moduleSlug === 'string' && v.moduleSlug.length > 0 && isAnswers(v.answers) && typeof v.queuedAt === 'string';
}

/** The saved state for a module, or null when there is none, when it is junk, or when storage fails. */
export function loadLocal(slug: string): SavedSelfCheckState | null {
  try {
    const raw = storage()?.getItem(STATE_KEY(slug));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSavedState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Writes the state. A failure is ignored: grading already happened on screen. */
export function saveLocal(slug: string, state: SavedSelfCheckState): void {
  try {
    storage()?.setItem(STATE_KEY(slug), JSON.stringify(state));
  } catch {
    // Storage is a convenience. Nothing to do.
  }
}

export function readQueue(): QueuedSubmit[] {
  try {
    const raw = storage()?.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isQueuedSubmit) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedSubmit[]): void {
  try {
    const s = storage();
    if (!s) return;
    if (items.length === 0) s.removeItem(QUEUE_KEY);
    else s.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    // Same as saveLocal.
  }
}

/** Adds a submit to the queue. One item per module: a newer submit replaces the older one. */
export function enqueue(item: QueuedSubmit): void {
  const rest = readQueue().filter((q) => q.moduleSlug !== item.moduleSlug);
  writeQueue([...rest, item]);
}

const itemKey = (q: QueuedSubmit) => `${q.moduleSlug}\n${q.queuedAt}`;

let draining: Promise<void> | null = null;

/**
 * Sends every queued item once. `sent` and `drop` remove the item, `retry` keeps it, and a `send` that
 * throws counts as `retry`. Runs on island mount, on the `online` event, and on the Retry button. Two
 * overlapping calls share one run. An item enqueued while a run is in progress is kept: the queue is
 * read again before it is written back, and only the items this run saw are removed.
 */
export function drainQueue(send: (item: QueuedSubmit) => Promise<SendOutcome>): Promise<void> {
  if (draining) return draining;
  draining = (async () => {
    const items = readQueue();
    if (items.length === 0) return;
    const outcomes = new Map<string, SendOutcome>();
    for (const item of items) {
      let outcome: SendOutcome;
      try {
        outcome = await send(item);
      } catch {
        outcome = 'retry';
      }
      outcomes.set(itemKey(item), outcome);
    }
    const after = readQueue();
    writeQueue(
      after.filter((q) => {
        const outcome = outcomes.get(itemKey(q));
        return outcome === undefined || outcome === 'retry';
      }),
    );
  })().finally(() => {
    draining = null;
  });
  return draining;
}
