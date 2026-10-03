// src/components/islands/self-check-storage.test.ts
// Section 9.2: a fake localStorage on globalThis, junk gives null, enqueue replaces by slug, drain
// removes sent and dropped items and keeps retried ones. Runs in the node environment.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { SavedSelfCheckState } from './SelfCheck';
import { QUEUE_KEY, STATE_KEY, drainQueue, enqueue, isAnswers, loadLocal, readQueue, saveLocal, type QueuedSubmit } from './self-check-storage';

/** A Storage with the methods the module uses, backed by a Map. */
function fakeStorage(): Storage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => {
      map.delete(k);
    },
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
  };
}

const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
let store: ReturnType<typeof fakeStorage>;

beforeEach(() => {
  store = fakeStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true, writable: true });
});

afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});

const state = (over: Partial<SavedSelfCheckState> = {}): SavedSelfCheckState => ({
  answers: { q1: [1], q2: [0, 2] },
  correctOnce: { q1: true },
  attempts: 2,
  passed: false,
  updatedAt: '2026-10-03T10:00:00.000Z',
  ...over,
});

const item = (slug: string, queuedAt = '2026-10-03T10:00:00.000Z'): QueuedSubmit => ({ moduleSlug: slug, answers: { q1: [0] }, queuedAt });

describe('keys', () => {
  test('match section 14.6', () => {
    expect(STATE_KEY('models')).toBe('aie:selfcheck:models');
    expect(QUEUE_KEY).toBe('aie:selfcheck:queue');
  });
});

describe('loadLocal and saveLocal', () => {
  test('round trip', () => {
    saveLocal('models', state());
    expect(store.map.get('aie:selfcheck:models')).toBe(JSON.stringify(state()));
    expect(loadLocal('models')).toEqual(state());
  });

  test('null when nothing is stored', () => {
    expect(loadLocal('models')).toBeNull();
  });

  test('null on junk: not JSON, wrong shape, bad answers, bad date', () => {
    store.map.set('aie:selfcheck:a', '{not json');
    expect(loadLocal('a')).toBeNull();
    store.map.set('aie:selfcheck:b', JSON.stringify({ answers: 'x' }));
    expect(loadLocal('b')).toBeNull();
    store.map.set('aie:selfcheck:c', JSON.stringify(state({ answers: { q1: ['one'] as unknown as number[] } })));
    expect(loadLocal('c')).toBeNull();
    store.map.set('aie:selfcheck:d', JSON.stringify(state({ answers: { q1: [-1] } })));
    expect(loadLocal('d')).toBeNull();
    store.map.set('aie:selfcheck:e', JSON.stringify(state({ updatedAt: 'yesterday' })));
    expect(loadLocal('e')).toBeNull();
    store.map.set('aie:selfcheck:f', JSON.stringify(state({ correctOnce: { q1: 'yes' as unknown as boolean } })));
    expect(loadLocal('f')).toBeNull();
    store.map.set('aie:selfcheck:g', JSON.stringify([1, 2]));
    expect(loadLocal('g')).toBeNull();
  });

  test('never throws when storage is missing or broken', () => {
    Reflect.deleteProperty(globalThis, 'localStorage');
    expect(loadLocal('models')).toBeNull();
    expect(() => saveLocal('models', state())).not.toThrow();
    const broken = fakeStorage();
    broken.getItem = () => {
      throw new Error('denied');
    };
    broken.setItem = () => {
      throw new Error('quota');
    };
    Object.defineProperty(globalThis, 'localStorage', { value: broken, configurable: true, writable: true });
    expect(loadLocal('models')).toBeNull();
    expect(() => saveLocal('models', state())).not.toThrow();
    expect(readQueue()).toEqual([]);
    expect(() => enqueue(item('models'))).not.toThrow();
  });

  test('isAnswers accepts index lists only', () => {
    expect(isAnswers({ q1: [0, 1] })).toBe(true);
    expect(isAnswers({})).toBe(true);
    expect(isAnswers({ q1: [1.5] })).toBe(false);
    expect(isAnswers([])).toBe(false);
    expect(isAnswers(null)).toBe(false);
  });
});

describe('queue', () => {
  test('enqueue replaces an existing item for the same slug and keeps others', () => {
    enqueue(item('models', '2026-10-03T10:00:00.000Z'));
    enqueue(item('context-and-knowledge'));
    enqueue({ moduleSlug: 'models', answers: { q1: [1] }, queuedAt: '2026-10-03T11:00:00.000Z' });
    const queue = readQueue();
    expect(queue).toHaveLength(2);
    expect(queue.map((q) => q.moduleSlug)).toEqual(['context-and-knowledge', 'models']);
    expect(queue[1]).toEqual({ moduleSlug: 'models', answers: { q1: [1] }, queuedAt: '2026-10-03T11:00:00.000Z' });
  });

  test('readQueue drops junk entries and tolerates a junk value', () => {
    store.map.set(QUEUE_KEY, JSON.stringify([item('models'), { moduleSlug: '', answers: {}, queuedAt: 'x' }, 'junk', { moduleSlug: 'a', answers: { q: ['x'] }, queuedAt: 'x' }]));
    expect(readQueue()).toEqual([item('models')]);
    store.map.set(QUEUE_KEY, '{');
    expect(readQueue()).toEqual([]);
    store.map.set(QUEUE_KEY, JSON.stringify({ not: 'a list' }));
    expect(readQueue()).toEqual([]);
  });

  test('drain removes sent and dropped items and keeps retried ones, in order', async () => {
    enqueue(item('sent-one'));
    enqueue(item('keep-me'));
    enqueue(item('drop-me'));
    enqueue(item('throws'));
    const seen: string[] = [];
    await drainQueue(async (q) => {
      seen.push(q.moduleSlug);
      if (q.moduleSlug === 'sent-one') return 'sent';
      if (q.moduleSlug === 'drop-me') return 'drop';
      if (q.moduleSlug === 'throws') throw new Error('offline');
      return 'retry';
    });
    expect(seen).toEqual(['sent-one', 'keep-me', 'drop-me', 'throws']);
    expect(readQueue().map((q) => q.moduleSlug)).toEqual(['keep-me', 'throws']);
  });

  test('drain removes the key when nothing is left', async () => {
    enqueue(item('models'));
    await drainQueue(async () => 'sent');
    expect(store.map.has(QUEUE_KEY)).toBe(false);
    expect(readQueue()).toEqual([]);
  });

  test('drain does nothing and does not call send on an empty queue', async () => {
    const send = vi.fn(async () => 'sent' as const);
    await drainQueue(send);
    expect(send).not.toHaveBeenCalled();
  });

  test('an item enqueued during a drain survives it, and overlapping drains share one run', async () => {
    enqueue(item('first'));
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const send = vi.fn(async () => {
      await gate;
      return 'sent' as const;
    });
    const run = drainQueue(send);
    const again = drainQueue(send);
    expect(again).toBe(run);
    enqueue(item('second', '2026-10-03T12:00:00.000Z'));
    release();
    await run;
    expect(send).toHaveBeenCalledTimes(1);
    expect(readQueue().map((q) => q.moduleSlug)).toEqual(['second']);
    // The next drain is a new run and sees the survivor.
    await drainQueue(async () => 'sent');
    expect(readQueue()).toEqual([]);
  });

  test('a newer item for a slug replaced during the drain is kept', async () => {
    enqueue(item('models', '2026-10-03T10:00:00.000Z'));
    await drainQueue(async (q) => {
      // The learner checks again while the old item is in flight.
      if (q.queuedAt === '2026-10-03T10:00:00.000Z') enqueue(item('models', '2026-10-03T10:05:00.000Z'));
      return 'sent';
    });
    expect(readQueue()).toEqual([item('models', '2026-10-03T10:05:00.000Z')]);
  });
});
