// src/actions/index.failure.test.ts
// A handler whose library call throws a plain Error (a database failure, a missing variable) must answer
// the generic INTERNAL_SERVER_ERROR, never the thrown text (CWE-209; docs/decisions.md, 2026-10-03).
// The database module is mocked in this file only; src/actions/index.test.ts keeps the real PGlite.
// src/lib/modules is the fixture store, so the entry checks pass and every handler reaches getDb().
import { describe, expect, test, vi } from 'vitest';
import { SERVER_ERROR_MESSAGE } from '../lib/actions-guard';
import { fakeActionContext } from '../../test/fake-action-context';
import { fixtureSpec } from '../../test/module-fixtures';
import { itemIds } from '../lib/plan';

vi.mock('../db', () => ({
  getDb: async () => {
    throw new Error('Failed query: insert into "notify_subscriber" ("email", "created_at") values ($1, $2)\nparams: leak@example.com,2026-10-03T05:05:34.739Z');
  },
}));

vi.mock('../lib/modules', async () => {
  const { fixtureModuleStore } = await import('../../test/module-fixtures');
  return fixtureModuleStore();
});

const user = {
  id: 'failing-learner',
  name: 'Learner',
  email: 'failing-learner@example.com',
  emailVerified: true,
  image: null,
  createdAt: new Date('2026-09-15T00:00:00Z'),
  updatedAt: new Date('2026-09-15T00:00:00Z'),
} as NonNullable<App.Locals['user']>;

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

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

describe('learner handlers when the database throws', () => {
  test('every write answers the generic message with its handler name in the log', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { server } = await import('./index');
      const ctx = () => fakeActionContext({ user, clientAddress: '203.0.113.92' });
      const ratings = Object.fromEntries(itemIds(fixtureSpec()).map((id) => [id, 2]));
      const calls: Array<[string, Promise<{ data: unknown; error?: { code: string; message: string } }>]> = [
        ['markModuleComplete', server.markModuleComplete.call(ctx(), form({ moduleSlug: 'orientation' }))],
        ['saveResponse', server.saveResponse.call(ctx(), form({ moduleSlug: 'models', kind: 'workshop', body: 'w'.repeat(200) }))],
        ['saveSelfCheck', server.saveSelfCheck.call(ctx(), { moduleSlug: 'models', answers: { q1: [0] } })],
        ['saveSelfAssessment', server.saveSelfAssessment.call(ctx(), { ratings, context: { role: '', feature: '', ownsSystem: 'no' } })],
        ['updatePlanText', server.updatePlanText.call(ctx(), { version: 1, planText: 'x' })],
        ['submitFeedback', server.submitFeedback.call(ctx(), form({ body: 'note' }))],
        ['updateDisplayName', server.updateDisplayName.call(ctx(), form({ name: 'Ada' }))],
        ['deleteAccount', server.deleteAccount.call(ctx(), form({ confirm: 'delete' }))],
      ];
      for (const [name, pending] of calls) {
        const result = await pending;
        expect(result.data, name).toBeUndefined();
        expect(result.error?.code, name).toBe('INTERNAL_SERVER_ERROR');
        expect(result.error?.message, name).toBe(SERVER_ERROR_MESSAGE);
      }
      const logged = errors.mock.calls.flat().join('\n');
      for (const [name] of calls) expect(logged).toContain(`[actions] ${name} failed: Error: Failed query`);
      expect(logged).not.toContain('leak@example.com');
    } finally {
      errors.mockRestore();
    }
  });
});
