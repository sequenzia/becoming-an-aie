// src/actions/index.failure.test.ts
// A handler whose library call throws a plain Error (a database failure, a missing variable) must answer
// the generic INTERNAL_SERVER_ERROR, never the thrown text (CWE-209; docs/decisions.md, 2026-10-03).
// The database module is mocked in this file only; src/actions/index.test.ts keeps the real PGlite.
import { describe, expect, test, vi } from 'vitest';
import { SERVER_ERROR_MESSAGE } from '../lib/actions-guard';
import { fakeActionContext } from '../../test/fake-action-context';

vi.mock('../db', () => ({
  getDb: async () => {
    throw new Error('Failed query: insert into "notify_subscriber" ("email", "created_at") values ($1, $2)\nparams: leak@example.com,2026-10-03T05:05:34.739Z');
  },
}));

describe('notify handlers when the database throws', () => {
  test('notifySubscribe answers the generic message and logs the real one', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { server } = await import('./index');
      const fd = new FormData();
      fd.set('email', 'leak@example.com');
      const result = await server.notifySubscribe.call(fakeActionContext({ clientAddress: '203.0.113.90' }), fd);
      expect(result.data).toBeUndefined();
      expect(result.error?.code).toBe('INTERNAL_SERVER_ERROR');
      expect(result.error?.status).toBe(500);
      expect(result.error?.message).toBe(SERVER_ERROR_MESSAGE);
      expect(JSON.stringify(result.error)).not.toContain('Failed query');
      const logged = errors.mock.calls.flat().join('\n');
      expect(logged).toContain('[actions] notifySubscribe failed: Error: Failed query');
      // The bound parameters are the learner's address: redacted before the line is written (decision entry 2026-10-03).
      expect(logged).toContain('params: [redacted]');
      expect(logged).not.toContain('leak@example.com');
    } finally {
      errors.mockRestore();
    }
  });

  test('notifyConfirm and notifyUnsubscribe answer the same generic message', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { server } = await import('./index');
      const confirm = await server.notifyConfirm.call(fakeActionContext({ clientAddress: '203.0.113.91' }), { token: 'abc.def' });
      expect(confirm.error?.code).toBe('INTERNAL_SERVER_ERROR');
      expect(confirm.error?.message).toBe(SERVER_ERROR_MESSAGE);
      const unsubscribe = await server.notifyUnsubscribe.call(fakeActionContext({ clientAddress: '203.0.113.91' }), { token: 'abc.def' });
      expect(unsubscribe.error?.message).toBe(SERVER_ERROR_MESSAGE);
    } finally {
      errors.mockRestore();
    }
  });
});
