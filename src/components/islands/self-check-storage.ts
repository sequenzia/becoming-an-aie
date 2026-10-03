// src/components/islands/self-check-storage.ts
// placeholder, D replaces (blueprint section 9.2). Contracted signatures with neutral bodies.
import type { SavedSelfCheckState } from './SelfCheck';

export const STATE_KEY = (slug: string) => `aie:selfcheck:${slug}`;
export const QUEUE_KEY = 'aie:selfcheck:queue';

export interface QueuedSubmit {
  moduleSlug: string;
  answers: Record<string, number[]>;
  queuedAt: string;
}

export function loadLocal(_slug: string): SavedSelfCheckState | null {
  return null;
}

export function saveLocal(_slug: string, _state: SavedSelfCheckState): void {}

export function enqueue(_item: QueuedSubmit): void {}

export function readQueue(): QueuedSubmit[] {
  return [];
}

export async function drainQueue(_send: (item: QueuedSubmit) => Promise<'sent' | 'retry' | 'drop'>): Promise<void> {}
