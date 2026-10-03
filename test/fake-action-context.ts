// test/fake-action-context.ts
// The one place that names Astro's internal action-context symbol (blueprint decision 44). A handler
// returned by defineAction runs only when `this` carries it (astro/dist/actions/runtime/server.js, 7.3.2),
// so every action test calls `server.<action>.call(fakeActionContext(...), input)`. A rename of the symbol
// touches this line only. Shared by src/actions/index.test.ts and src/actions/index.failure.test.ts
// (docs/decisions.md, 2026-10-03).
const ACTION_API_CONTEXT = Symbol.for('astro.actionAPIContext');

export interface FakeContextOverrides {
  clientAddress?: string;
  user?: App.Locals['user'];
}

/** A minimal ActionAPIContext for a form POST to /notify. The shape is what the notify handlers read. */
export function fakeActionContext(overrides: FakeContextOverrides = {}) {
  const url = new URL('http://localhost:4321/notify?_action=notifySubscribe');
  const ctx: Record<PropertyKey, unknown> = {
    request: new Request(url, { method: 'POST' }),
    url,
    locals: { user: overrides.user ?? null, session: null },
    cookies: { has: () => false, get: () => undefined, set() {}, delete() {} },
    clientAddress: overrides.clientAddress ?? '203.0.113.10',
    isPrerendered: false,
    routePattern: '/notify',
    originPathname: '/notify',
  };
  Reflect.set(ctx, ACTION_API_CONTEXT, true);
  return ctx;
}
