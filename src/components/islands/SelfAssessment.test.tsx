// @vitest-environment jsdom
// src/components/islands/SelfAssessment.test.tsx
// Blueprint section 12.2: step navigation with focus on the step heading, the blocker alert and the
// described, focused fieldset, generate called with every id rated, the plan with four steps per focus area,
// the Applied to line and the links, edits through updatePlanText, the version list with download links,
// and axe on step 0, an area step with the blocker, and the plan step. The plan itself comes from
// src/lib/plan.ts, so the view is tested against the real shape.
import { render, screen, waitFor, within } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { AREA_CONTENT_MAP, AREA_KEYS, assessmentSpecSchema, type AssessmentSpec } from '../../lib/content-schema';
import { buildPlan, itemIds, renderPlanMarkdown, type AssessmentContext, type Ratings } from '../../lib/plan';

const mocks = vi.hoisted(() => ({ saveSelfAssessment: vi.fn(), updatePlanText: vi.fn() }));
vi.mock('astro:actions', () => ({ actions: { saveSelfAssessment: mocks.saveSelfAssessment, updatePlanText: mocks.updatePlanText } }));

import SelfAssessment, { type SelfAssessmentProps } from './SelfAssessment';

/** Six areas in talk order, one transfer item and two competencies each, like src/lib/plan.test.ts. */
function fixtureSpec(): AssessmentSpec {
  return assessmentSpecSchema.parse({
    contextQuestions: {
      role: 'What is your current role?',
      feature: 'Which AI feature are you closest to at work?',
      ownsSystem: 'Do you own a model-dependent system today?',
    },
    areas: AREA_KEYS.map((area) => {
      const slug = AREA_CONTENT_MAP[area].slug;
      return {
        area,
        moduleSlug: slug,
        transfers: [{ id: `${area}-transfer`, text: `${area} transfer item` }],
        competencies: [
          { id: `${area}-new-a`, text: `${area} competency a.` },
          { id: `${area}-new-b`, text: `${area} competency b` },
        ],
        steps: [
          { step: 1, text: 'Review outputs of {feature} by hand as {role}.', href: `/modules/${slug}#topics-and-learning-outcomes` },
          { step: 2, text: 'Start with one call for {feature}.', href: `/modules/${slug}#workshop` },
          { step: 3, text: 'Own the harness around {feature}.', href: `/modules/${slug}#failure-exercise` },
          { step: 4, text: 'Add autonomy on {feature} only as evals earn it.', href: `/modules/${slug}#completion-evidence` },
        ],
      };
    }),
    roadmap: [
      { step: 1, title: 'Look before you build.', subline: 'Monday: review 20 to 50 outputs by hand.' },
      { step: 2, title: 'Start constrained.', subline: 'One call. Then a workflow. Then a loop, only when it earns it.' },
      { step: 3, title: 'Own the harness.', subline: 'Prompts, context window, control flow. Learn the loop before a framework.' },
      { step: 4, title: 'Add autonomy as your evals earn it.', subline: 'Every step up is paid for by a check that catches what it breaks.' },
    ],
    uniformHigh: {
      text: 'You rated every item Confident. The electives and the build track are the next step.',
      links: [
        { text: 'Browse the electives', href: '/modules#electives' },
        { text: 'The book blueprint', href: 'https://example.org/blueprint' },
      ],
    },
  });
}

const SPEC = fixtureSpec();
const NOW = new Date('2026-10-03T10:00:00.000Z');
const CONTEXT: AssessmentContext = { role: 'backend engineer', feature: 'the support triage bot', ownsSystem: 'yes' };

function ratingsWhere(value: number, overrides: Ratings = {}): Ratings {
  const out: Ratings = {};
  for (const id of itemIds(SPEC)) out[id] = value;
  return { ...out, ...overrides };
}

function latestFor(ratings: Ratings, version: number, missing: Array<{ slug: string; title: string }> = [], planText?: string): NonNullable<SelfAssessmentProps['latest']> {
  const plan = buildPlan(SPEC, ratings, CONTEXT, missing, NOW);
  return { version, ratings, context: CONTEXT, plan, planText: planText ?? renderPlanMarkdown(plan, 'http://localhost:4321', version), createdAt: NOW.toISOString() };
}

const baseProps = (over: Partial<SelfAssessmentProps> = {}): SelfAssessmentProps => ({ spec: SPEC, latest: null, versions: [], missingModules: [], ...over });

const status = () => document.querySelector<HTMLElement>('p.assessment-status')!;
const stepHeading = () => screen.getByRole('heading', { level: 2 });
const alert = () => screen.getByRole('alert');

async function rate(user: ReturnType<typeof userEvent.setup>, itemText: string, label: string) {
  const group = screen.getByRole('group', { name: itemText });
  await user.click(within(group).getByRole('radio', { name: label }));
}

/** Zero axe violations on the island. region is page-level; color-contrast needs layout, which jsdom lacks. */
async function expectNoAxeViolations(container: Element) {
  const results = await axe.run(container, { rules: { region: { enabled: false }, 'color-contrast': { enabled: false } } });
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' | ')}`)).toEqual([]);
}

beforeEach(() => {
  mocks.saveSelfAssessment.mockReset();
  mocks.updatePlanText.mockReset();
});

describe('steps', () => {
  test('starts on the context step with the three questions, and Next moves the focus to the step heading', async () => {
    const user = userEvent.setup();
    render(<SelfAssessment {...baseProps()} />);
    expect(status()).toHaveTextContent('Step 1 of 8: Your context');
    expect(status()).toHaveAttribute('aria-live', 'polite');
    expect(stepHeading()).toHaveTextContent('Your context');
    expect(stepHeading()).toHaveAttribute('tabindex', '-1');
    // Nothing steals the focus on first paint.
    expect(document.body).toHaveFocus();
    expect(screen.getByLabelText(/What is your current role\?/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Which AI feature are you closest to at work\?/)).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Do you own a model-dependent system today?' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Partly' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(status()).toHaveTextContent('Step 2 of 8: Models');
    expect(stepHeading()).toHaveTextContent('Models');
    expect(stepHeading()).toHaveFocus();
    expect(screen.getByRole('heading', { level: 3, name: 'What transfers' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'What is new' })).toBeInTheDocument();
    const group = screen.getByRole('group', { name: 'models transfer item' });
    expect(group).toHaveClass('rating-group');
    expect(group).toHaveAttribute('tabindex', '-1');
    expect(within(group).getAllByRole('radio').map((r) => r.closest('label')?.textContent?.trim())).toEqual(['Not yet', 'Aware', 'Practiced', 'Confident']);

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(status()).toHaveTextContent('Step 1 of 8: Your context');
    expect(stepHeading()).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'Partly' })).toBeChecked();
  });

  test('Next without the context answer, then without a rating, names the item in an alert and focuses its fieldset', async () => {
    const user = userEvent.setup();
    const { container } = render(<SelfAssessment {...baseProps()} />);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(alert()).toHaveTextContent('Answer the question before continuing: Do you own a model-dependent system today?');
    expect(alert()).toHaveAttribute('id', 'assessment-blocker');
    const owns = screen.getByRole('group', { name: 'Do you own a model-dependent system today?' });
    expect(owns).toHaveFocus();
    expect(owns).toHaveAttribute('aria-describedby', 'assessment-blocker');
    expect(status()).toHaveTextContent('Step 1 of 8');

    await user.click(screen.getByRole('radio', { name: 'Yes' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(status()).toHaveTextContent('Step 2 of 8: Models');

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(alert()).toHaveTextContent('Rate: models transfer item before continuing.');
    const first = screen.getByRole('group', { name: 'models transfer item' });
    expect(first).toHaveFocus();
    expect(first).toHaveAttribute('aria-describedby', 'assessment-blocker');
    expect(screen.getByRole('group', { name: 'models competency a.' })).not.toHaveAttribute('aria-describedby');
    expect(status()).toHaveTextContent('Step 2 of 8: Models');
    await expectNoAxeViolations(container);

    // The next unrated item takes over; a trailing period in the item text is not doubled.
    await rate(user, 'models transfer item', 'Aware');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(alert()).toHaveTextContent('Rate: models competency a before continuing.');
    expect(screen.getByRole('group', { name: 'models competency a.' })).toHaveFocus();
    expect(first).not.toHaveAttribute('aria-describedby');

    await rate(user, 'models competency a.', 'Practiced');
    await rate(user, 'models competency b', 'Confident');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(status()).toHaveTextContent('Step 3 of 8: Context and knowledge');
  });
});

describe('generating the plan', () => {
  test('calls saveSelfAssessment with every id rated and the context, then renders the plan', async () => {
    const user = userEvent.setup();
    mocks.saveSelfAssessment.mockImplementation(async (input: { ratings: Ratings; context: AssessmentContext }) => {
      const plan = buildPlan(SPEC, input.ratings, input.context, [{ slug: 'models', title: 'Models' }], NOW);
      return { data: { version: 1, plan, planText: renderPlanMarkdown(plan, 'http://localhost:4321', 1), createdAt: NOW }, error: undefined };
    });
    const { container } = render(<SelfAssessment {...baseProps({ missingModules: [{ slug: 'models', title: 'Models' }] })} />);
    expect(screen.getByRole('note')).toHaveTextContent('Not yet complete: Models.');

    await user.type(screen.getByLabelText(/What is your current role\?/), 'backend engineer');
    await user.type(screen.getByLabelText(/Which AI feature/), 'the support triage bot');
    await user.click(screen.getByRole('radio', { name: 'Yes' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    for (const [i, area] of AREA_KEYS.entries()) {
      expect(status()).toHaveTextContent(`Step ${i + 2} of 8`);
      const low = area === 'evals';
      await rate(user, `${area} transfer item`, 'Confident');
      await rate(user, `${area} competency a.`, low ? 'Not yet' : 'Confident');
      await rate(user, `${area} competency b`, low ? 'Not yet' : 'Confident');
      await user.click(screen.getByRole('button', { name: 'Next' }));
    }
    expect(status()).toHaveTextContent('Step 8 of 8: Your plan');
    expect(stepHeading()).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    expect(screen.getByText('"Autonomy is earned by evals, one step at a time."')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Generate my plan' }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 3, name: 'Focus 1: Verification and evals' })).toBeInTheDocument());

    expect(mocks.saveSelfAssessment).toHaveBeenCalledTimes(1);
    const input = mocks.saveSelfAssessment.mock.calls[0]![0] as { ratings: Ratings; context: AssessmentContext };
    expect(Object.keys(input.ratings).sort()).toEqual([...itemIds(SPEC)].sort());
    expect(input.ratings['evals-new-a']).toBe(0);
    expect(input.ratings['models-transfer']).toBe(3);
    expect(input.context).toEqual(CONTEXT);

    // The plan view (AC-5.10.3, AC-5.10.4, AC-5.10.7).
    expect(screen.getByText(/You own a model-dependent system today\. Start step 1 on that system this week, beginning with the support triage bot\./)).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Areas ranked by gap' });
    const rows = within(table).getAllByRole('row');
    expect(within(rows[1]!).getByRole('rowheader')).toHaveTextContent('Verification and evals');
    expect(rows).toHaveLength(7);
    const focus = screen.getByRole('region', { name: 'Focus 1: Verification and evals' });
    expect(within(focus).getByText('Applied to: the support triage bot')).toBeInTheDocument();
    const items = within(focus).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items[0]!.querySelector('b')).toHaveTextContent('Look before you build.');
    expect(items[0]).toHaveTextContent('Monday: review 20 to 50 outputs by hand. Review outputs of the support triage bot by hand as backend engineer.');
    expect(items[3]!.querySelector('b')).toHaveTextContent('Add autonomy as your evals earn it.');
    const links = within(focus).getAllByRole('link', { name: /Open the module section/ });
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/modules/verification-and-evals#topics-and-learning-outcomes',
      '/modules/verification-and-evals#workshop',
      '/modules/verification-and-evals#failure-exercise',
      '/modules/verification-and-evals#completion-evidence',
    ]);
    expect(screen.getByRole('heading', { level: 3, name: 'Next steps' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Complete Models' })).toHaveAttribute('href', '/modules/models');
    expect(screen.getByRole('note')).toHaveTextContent('Modules not yet complete: Models.');
    expect(within(screen.getByRole('note')).getByRole('link', { name: 'Models' })).toHaveAttribute('href', '/modules/models');

    // Editor, export, versions (AC-5.10.5, EC-5.10.2).
    expect(screen.getByLabelText(/Plan text/)).toHaveValue(renderPlanMarkdown(buildPlan(SPEC, input.ratings, input.context, [{ slug: 'models', title: 'Models' }], NOW), 'http://localhost:4321', 1));
    expect(screen.getByRole('link', { name: 'Download as Markdown' })).toHaveAttribute('href', '/account/plan.md?version=1');
    expect(screen.getByRole('link', { name: 'Download version 1' })).toHaveAttribute('href', '/account/plan.md?version=1');
    expect(screen.getByText(/Version 1, 2026-10-03 \(current\)\./)).toBeInTheDocument();
    expect(document.querySelectorAll('.assessment-sync')[0]).toHaveTextContent('Saved');
    expect(stepHeading()).toHaveFocus();
    await expectNoAxeViolations(container);
  });

  test('a rejected call asks for a retry and the retry generates the plan', async () => {
    const user = userEvent.setup();
    mocks.saveSelfAssessment.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    render(<SelfAssessment {...baseProps({ latest: latestFor(ratingsWhere(2), 1), versions: [{ version: 1, createdAt: NOW.toISOString() }] })} />);
    await user.click(screen.getByRole('button', { name: 'Retake the assessment' }));
    expect(status()).toHaveTextContent('Step 1 of 8: Your context');
    expect(stepHeading()).toHaveFocus();
    expect(screen.getByLabelText(/What is your current role\?/)).toHaveValue('backend engineer');
    expect(screen.getByRole('radio', { name: 'Yes' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    // The ratings are prefilled, so every step passes.
    expect(within(screen.getByRole('group', { name: 'models transfer item' })).getByRole('radio', { name: 'Practiced' })).toBeChecked();
    for (let i = 0; i < 6; i += 1) await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(status()).toHaveTextContent('Step 8 of 8: Your plan');

    await user.click(screen.getByRole('button', { name: 'Generate my plan' }));
    const sync = () => document.querySelector('.assessment-generate .assessment-sync')!;
    await waitFor(() => expect(sync()).toHaveTextContent('Could not save. Retry.'));

    const plan = buildPlan(SPEC, ratingsWhere(2), CONTEXT, [], NOW);
    mocks.saveSelfAssessment.mockResolvedValueOnce({ data: { version: 2, plan, planText: renderPlanMarkdown(plan, 'http://localhost:4321', 2), createdAt: NOW.toISOString() }, error: undefined });
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByRole('link', { name: 'Download as Markdown' })).toHaveAttribute('href', '/account/plan.md?version=2'));
    expect(mocks.saveSelfAssessment).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('link', { name: 'Download version 2' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download version 1' })).toBeInTheDocument();
    expect(screen.getByText(/Version 2, 2026-10-03 \(current\)/)).toBeInTheDocument();
  });

  test('UNAUTHORIZED shows the sign-in line, a rate limit shows the server message, and a bad request its message', async () => {
    const user = userEvent.setup();
    const props = baseProps({ latest: latestFor(ratingsWhere(1), 1), versions: [{ version: 1, createdAt: NOW.toISOString() }] });
    const sync = () => document.querySelector('.assessment-generate .assessment-sync')!;
    const toGenerate = async () => {
      await user.click(screen.getByRole('button', { name: 'Retake the assessment' }));
      for (let i = 0; i < 7; i += 1) await user.click(screen.getByRole('button', { name: 'Next' }));
      await user.click(screen.getByRole('button', { name: 'Generate my plan' }));
    };

    mocks.saveSelfAssessment.mockResolvedValueOnce({ data: undefined, error: { type: 'AstroActionError', code: 'UNAUTHORIZED', status: 401, message: 'Sign in to save your work.' } });
    const first = render(<SelfAssessment {...props} />);
    await toGenerate();
    await waitFor(() => expect(sync()).toHaveTextContent('Sign in to save your progress.'));
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    first.unmount();

    mocks.saveSelfAssessment.mockResolvedValueOnce({ data: undefined, error: { type: 'AstroActionError', code: 'TOO_MANY_REQUESTS', status: 429, message: 'Too many requests. Try again in 5 minutes.' } });
    const second = render(<SelfAssessment {...props} />);
    await toGenerate();
    await waitFor(() => expect(sync()).toHaveTextContent('Too many requests. Try again in 5 minutes.'));
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    second.unmount();

    mocks.saveSelfAssessment.mockResolvedValueOnce({ data: undefined, error: { type: 'AstroActionError', code: 'BAD_REQUEST', status: 400, message: 'Rate every item. Missing: models-transfer.' } });
    render(<SelfAssessment {...props} />);
    await toGenerate();
    await waitFor(() => expect(sync()).toHaveTextContent('Rate every item. Missing: models-transfer.'));
  });
});

describe('an existing plan', () => {
  test('opens on the plan step and saves edits through updatePlanText for the latest version only', async () => {
    const user = userEvent.setup();
    mocks.updatePlanText.mockResolvedValue({ data: { updatedAt: NOW }, error: undefined });
    const latest = latestFor(ratingsWhere(3, { 'tools-new-a': 0 }), 2, [], '# My plan\n\nKeep it short.');
    const { container } = render(<SelfAssessment {...baseProps({ latest, versions: [{ version: 2, createdAt: NOW.toISOString() }, { version: 1, createdAt: '2026-09-20T09:00:00.000Z' }] })} />);
    expect(status()).toHaveTextContent('Step 8 of 8: Your plan');
    expect(document.body).toHaveFocus();
    expect(screen.getByRole('heading', { level: 3, name: 'Focus 1: Tools and extensibility' })).toBeInTheDocument();

    const textarea = screen.getByLabelText(/Plan text/);
    expect(textarea).toHaveValue('# My plan\n\nKeep it short.');
    // The learner's text is in the textarea only, never rendered.
    expect(container.querySelector('h1')).toBeNull();
    expect(screen.queryByText('My plan')).not.toBeInTheDocument();
    await user.type(textarea, ' Then act.');
    await user.click(screen.getByRole('button', { name: 'Save edits' }));
    await waitFor(() => expect(screen.getByText('Edits saved')).toBeInTheDocument());
    expect(mocks.updatePlanText).toHaveBeenCalledTimes(1);
    expect(mocks.updatePlanText).toHaveBeenCalledWith({ version: 2, planText: '# My plan\n\nKeep it short. Then act.' });

    const list = screen.getByRole('heading', { level: 3, name: 'Previous versions' }).nextElementSibling!;
    const items = within(list as HTMLElement).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Version 2, 2026-10-03 (current).');
    expect(items[1]).toHaveTextContent('Version 1, 2026-09-20.');
    expect(within(items[0]!).getByRole('link', { name: 'Download version 2' })).toHaveAttribute('href', '/account/plan.md?version=2');
    expect(within(items[1]!).getByRole('link', { name: 'Download version 1' })).toHaveAttribute('href', '/account/plan.md?version=1');
    expect(screen.getByRole('link', { name: 'Download as Markdown' })).toHaveAttribute('href', '/account/plan.md?version=2');
    await expectNoAxeViolations(container);
  });

  test('a conflict on edit shows the server message', async () => {
    const user = userEvent.setup();
    mocks.updatePlanText.mockResolvedValue({ data: undefined, error: { type: 'AstroActionError', code: 'CONFLICT', status: 409, message: 'Only the latest version can be edited.' } });
    render(<SelfAssessment {...baseProps({ latest: latestFor(ratingsWhere(2), 1), versions: [{ version: 1, createdAt: NOW.toISOString() }] })} />);
    await user.click(screen.getByRole('button', { name: 'Save edits' }));
    await waitFor(() => expect(screen.getByText('Only the latest version can be edited.')).toBeInTheDocument());
  });

  test('uniform high ratings render the closing text and the suggested links (EC-5.10.1)', () => {
    render(<SelfAssessment {...baseProps({ latest: latestFor(ratingsWhere(3), 1), versions: [{ version: 1, createdAt: NOW.toISOString() }] })} />);
    expect(screen.getByText('You rated every item Confident. The electives and the build track are the next step.')).toBeInTheDocument();
    expect(screen.queryByText(/Applied to:/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Where to go next' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse the electives' })).toHaveAttribute('href', '/modules#electives');
    expect(screen.getByRole('link', { name: 'The book blueprint' })).toHaveAttribute('href', 'https://example.org/blueprint');
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  test('axe reports no violations on the context step', async () => {
    const { container } = render(<SelfAssessment {...baseProps({ missingModules: [{ slug: 'models', title: 'Models' }] })} />);
    await expectNoAxeViolations(container);
  });
});
