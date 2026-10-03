// src/components/forms/forms.test.ts
// Renders the two response forms through the Container API and checks the section 9.4 markup: the
// sign-in callout when signed out, the form with its hidden fields, label, help line, status line, button
// label per kind, the prefilled saved text, and the error state with the echoed text. The enhancement
// script is bundled by Astro and is not executed here; its behavior is covered by the Phase 1 manual gate.
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, test } from 'vitest';
import FailureResponseForm from './FailureResponseForm.astro';
import WorkshopResponseForm from './WorkshopResponseForm.astro';
import { WORKSHOP_MAX_CHARS, WORKSHOP_MIN_CHARS } from '../../lib/limits';
import type { FormError, ResponseRow } from '../../lib/types';

/** Scoped styles add data-astro-cid attributes; the contract is about the rest of the markup. */
function clean(html: string): string {
  return html.replace(/ data-astro-cid-[a-z0-9]+(?:="[^"]*")?/g, '');
}

/** A type alias, not an interface: the container's Props type carries an index signature. */
type Props = {
  moduleSlug: string;
  kind: 'workshop' | 'failure';
  saved: ResponseRow | null;
  error?: FormError;
  signedIn: boolean;
  minChars: number;
  maxChars: number;
};

async function render(component: typeof WorkshopResponseForm, props: Props): Promise<string> {
  const container = await AstroContainer.create();
  return clean(await container.renderToString(component, { props }));
}

const base = (over: Partial<Props> = {}): Props => ({
  moduleSlug: 'models',
  kind: 'workshop',
  saved: null,
  signedIn: true,
  minChars: WORKSHOP_MIN_CHARS,
  maxChars: WORKSHOP_MAX_CHARS,
  ...over,
});

describe('WorkshopResponseForm', () => {
  test('signed out: a surface callout with a sign-in link and no form', async () => {
    const html = await render(WorkshopResponseForm, base({ signedIn: false }));
    expect(html).toContain('<div class="callout-surface"><span class="callout-label">Sign in to save your response.</span>');
    expect(html).toContain('<a class="btn btn-primary" href="/sign-in?next=%2Fmodules%2Fmodels">Sign in</a>');
    expect(html).not.toContain('<form');
    expect(html).not.toContain('<textarea');
  });

  test('signed in: the form posts to saveResponse with the hidden fields, the label, the help line, and the status line', async () => {
    const html = await render(WorkshopResponseForm, base());
    expect(html).toContain('<form method="POST" action="?_action=saveResponse" id="workshop-form" class="response-form" data-response-form data-kind="workshop" data-module-slug="models"');
    expect(html).toContain('data-server-error="Something went wrong on our side. Try again in a few minutes."');
    expect(html).toContain('<input type="hidden" name="moduleSlug" value="models">');
    expect(html).toContain('<input type="hidden" name="kind" value="workshop">');
    expect(html).toContain('<label class="field-label" for="workshop-body">Your response <span class="small secondary">required</span></label>');
    expect(html).toContain('<textarea class="field" id="workshop-body" name="body" required minlength="200" maxlength="20000" aria-describedby="workshop-help" autocomplete="off"></textarea>');
    expect(html).not.toContain('aria-invalid');
    expect(html).toContain('<p class="field-help" id="workshop-help">At least 200 characters. Saved to your account. Rendered as plain text.</p>');
    expect(html).toContain('<p class="field-error" id="workshop-error" hidden></p>');
    expect(html).toContain('<p class="field-help" role="status" id="workshop-saved"></p>');
    expect(html).toContain('<button class="btn btn-area" type="submit">Save response</button>');
    expect(html.indexOf('workshop-help')).toBeLessThan(html.indexOf('workshop-saved'));
    expect(html.indexOf('workshop-saved')).toBeLessThan(html.indexOf('Save response'));
  });

  test('prefills the saved text, escaped, and dates the status line in ISO form', async () => {
    const saved: ResponseRow = { body: 'First line.\n\n<b>Not markup</b> & "quotes"', updatedAt: new Date('2026-10-03T14:05:00Z') };
    const html = await render(WorkshopResponseForm, base({ saved }));
    expect(html).toContain('>First line.\n\n&lt;b&gt;Not markup&lt;/b&gt; &amp; &quot;quotes&quot;</textarea>');
    expect(html).not.toContain('<b>Not markup</b>');
    expect(html).toContain('<p class="field-help" role="status" id="workshop-saved">Saved 2026-10-03</p>');
  });

  test('renders the error line with the Fix lead, marks the field invalid, and echoes the rejected text', async () => {
    const error: FormError = { form: 'workshop', message: 'Write at least 200 characters and at most 20,000.', value: 'too short' };
    const html = await render(WorkshopResponseForm, base({ error, saved: { body: 'the saved text', updatedAt: new Date('2026-10-01T00:00:00Z') } }));
    expect(html).toContain('aria-describedby="workshop-help workshop-error" aria-invalid="true" autofocus');
    expect(html).toContain('>too short</textarea>');
    expect(html).not.toContain('the saved text');
    expect(html).toContain('<p class="field-error" id="workshop-error"><b>Fix:</b> Write at least 200 characters and at most 20,000.</p>');
  });

  test('signed out with an error: the alert, the rejected text in a focused read-only field, and a sign-in link back to the form (Phase 1 review round 2)', async () => {
    // A native POST whose session had expired (EC-5.9.3): the page re-renders signed out with the UNAUTHORIZED message.
    const error: FormError = { form: 'workshop', message: 'Sign in to save your progress.', value: 'A long response <b>kept</b> for the learner.' };
    const html = await render(WorkshopResponseForm, base({ signedIn: false, error }));
    expect(html).not.toContain('<form');
    expect(html).toContain('<span class="callout-label">Sign in to save your response.</span>');
    expect(html).toContain('<p class="field-error" role="alert" id="workshop-error"><b>Fix:</b> Sign in to save your progress.</p>');
    expect(html).toContain('<label class="field-label" for="workshop-unsaved">Your unsaved response</label>');
    expect(html).toContain('<textarea class="field" id="workshop-unsaved" readonly aria-describedby="workshop-error" autofocus>A long response &lt;b&gt;kept&lt;/b&gt; for the learner.</textarea>');
    expect(html).toContain('Copy it before you sign in. It is not stored.');
    expect(html).toContain('<a class="btn btn-primary" href="/sign-in?next=%2Fmodules%2Fmodels%23workshop-form">Sign in</a>');
    // An error without a readable body (a request Astro rejected before the handler) shows the alert alone.
    const bare = await render(WorkshopResponseForm, base({ signedIn: false, error: { form: 'workshop', message: 'The form could not be read. Submit it again from the page.' } }));
    expect(bare).toContain('role="alert"');
    expect(bare).not.toContain('<textarea');
    // The failure form's own ids and anchor.
    const failure = await render(FailureResponseForm, base({ kind: 'failure', signedIn: false, error: { form: 'failure', message: 'Sign in to save your progress.', value: 'x' } }));
    expect(failure).toContain('id="failure-error"');
    expect(failure).toContain('id="failure-unsaved"');
    expect(failure).toContain('href="/sign-in?next=%2Fmodules%2Fmodels%23failure-form"');
  });

  test('an error for the other form is ignored', async () => {
    const error: FormError = { form: 'failure', message: 'nope', value: 'x' };
    const html = await render(WorkshopResponseForm, base({ error, saved: { body: 'kept', updatedAt: new Date('2026-10-01T00:00:00Z') } }));
    expect(html).not.toContain('aria-invalid');
    expect(html).toContain('>kept</textarea>');
    expect(html).toContain('<p class="field-error" id="workshop-error" hidden></p>');
  });

  test('emits one enhancement script module and the hook it binds to', async () => {
    const html = await render(WorkshopResponseForm, base());
    expect(html).toContain('data-response-form');
    // In the container (dev mode) the component's <script> renders as one module reference; the build bundles it once per page.
    const scripts = html.match(/<script[^>]*>/g) ?? [];
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toContain('type="module"');
    expect(scripts[0]).toContain('WorkshopResponseForm.astro?astro&type=script');
    expect(html).not.toContain('<script>');
  });
});

describe('FailureResponseForm', () => {
  test('is the same form with kind failure, its own ids, and the reveal button label', async () => {
    const html = await render(FailureResponseForm, base({ kind: 'failure', saved: { body: 'my failure note', updatedAt: new Date('2026-10-02T00:00:00Z') } }));
    expect(html).toContain('id="failure-form"');
    expect(html).toContain('data-kind="failure"');
    expect(html).toContain('<input type="hidden" name="kind" value="failure">');
    expect(html).toContain('id="failure-body"');
    expect(html).toContain('aria-describedby="failure-help"');
    expect(html).toContain('<p class="field-help" role="status" id="failure-saved">Saved 2026-10-02</p>');
    expect(html).toContain('<button class="btn btn-area" type="submit">Submit and reveal the explanation</button>');
    expect(html).toContain('>my failure note</textarea>');
    expect(html).not.toContain('workshop');
  });

  test('forces kind failure even when the caller passes workshop, and shows the sign-in callout when signed out', async () => {
    const html = await render(FailureResponseForm, base({ kind: 'workshop' }));
    expect(html).toContain('id="failure-form"');
    const out = await render(FailureResponseForm, base({ kind: 'failure', signedIn: false, moduleSlug: 'operating-it' }));
    expect(out).toContain('href="/sign-in?next=%2Fmodules%2Foperating-it"');
    expect(out).not.toContain('<form');
  });
});
