// @vitest-environment jsdom
// src/components/islands/SelfCheck.test.tsx
// Blueprint section 12.2: keyboard-only operation, live regions, the empty-selection notice, multi-correct
// questions, retry, the passed summary, the three persistence modes with astro:actions mocked, the offline
// queue, and axe in the pending, correct, and incorrect states. Preact event names are onInput; user-event
// drives the native controls the way a keyboard does.
import { render, screen, waitFor, within } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { SelfCheckQuestion } from '../../lib/content-schema';

const mocks = vi.hoisted(() => ({ saveSelfCheck: vi.fn() }));
vi.mock('astro:actions', () => ({ actions: { saveSelfCheck: mocks.saveSelfCheck } }));

import SelfCheck, { MISSING_LINE, type SavedSelfCheckState } from './SelfCheck';
import { QUEUE_KEY, STATE_KEY, enqueue, readQueue } from './self-check-storage';

const QUESTIONS: SelfCheckQuestion[] = [
  {
    id: 'q-pin',
    question: 'What does pinning a model version buy you?',
    options: ['Nothing. Aliases are fine.', 'A dependency you can test against and replace on purpose.'],
    correct: [1],
    feedback: ['An alias moves under you. Reread the versions section.', 'Right. The model is a versioned, expiring dependency.'],
  },
  {
    id: 'q-evals',
    question: 'Which two belong in the eval suite behind a model choice?',
    options: ['A fixed set of real inputs', 'A vibe check in the playground', 'Error analysis on the outputs'],
    correct: [0, 2],
    feedback: ['Yes. Fixed inputs make a comparison repeatable.', 'A playground session is not a measurement.', 'Yes. Error analysis is the first eval.'],
  },
];

const ONE: SelfCheckQuestion[] = [QUESTIONS[0]!];

type Result = { data: unknown; error: unknown };
const ok = (passed = false): Result => ({ data: { passed, correct: {}, attempts: 1, status: 'in_progress' }, error: undefined });
const fail = (code: string, status: number, message = code): Result => ({ data: undefined, error: { type: 'AstroActionError', code, status, message } });

function card(index: number): HTMLElement {
  const cards = document.querySelectorAll<HTMLElement>('article.self-check-question');
  const el = cards[index];
  if (!el) throw new Error(`no question card ${index}`);
  return el;
}

function summary(): HTMLElement {
  const el = document.querySelector<HTMLElement>('p.self-check-summary');
  if (!el) throw new Error('no summary');
  return el;
}

/** Zero axe violations on the island. region is page-level; color-contrast needs layout, which jsdom lacks. */
async function expectNoAxeViolations(container: Element) {
  const results = await axe.run(container, { rules: { region: { enabled: false }, 'color-contrast': { enabled: false } } });
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' | ')}`)).toEqual([]);
}

beforeEach(() => {
  localStorage.clear();
  mocks.saveSelfCheck.mockReset();
});

afterEach(() => {
  localStorage.clear();
});

describe('keyboard operation and live regions', () => {
  test('Tab to the first option, Arrow to select, Tab to Check answer, Enter; feedback is announced', async () => {
    const user = userEvent.setup();
    render(<SelfCheck moduleSlug="models" questions={ONE} persist="local" signedIn={false} />);
    await waitFor(() => expect(document.querySelector('section.self-check')).toHaveAttribute('data-hydrated', 'true'));

    await user.tab();
    const first = screen.getByRole('radio', { name: 'Nothing. Aliases are fine.' });
    expect(first).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    const second = screen.getByRole('radio', { name: 'A dependency you can test against and replace on purpose.' });
    expect(second).toBeChecked();
    expect(second.closest('label')).toHaveAttribute('data-selected', 'true');

    await user.tab();
    const button = screen.getByRole('button', { name: 'Check answer' });
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');

    const region = within(card(0)).getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveClass('self-check-feedback');
    expect(region).toHaveTextContent('Correct.');
    expect(region).toHaveTextContent('Right. The model is a versioned, expiring dependency.');
    expect(region.querySelector('b')).toHaveTextContent('Correct.');
    expect(card(0)).toHaveAttribute('data-state', 'correct');
    // Focus stays on the button, which now offers another try.
    expect(screen.getByRole('button', { name: 'Check again' })).toHaveFocus();
  });

  test('Space selects an option reached by Tab; Space activates the button', async () => {
    const user = userEvent.setup();
    render(<SelfCheck moduleSlug="models" questions={ONE} persist="local" signedIn={false} />);
    await user.tab();
    await user.keyboard(' ');
    expect(screen.getByRole('radio', { name: 'Nothing. Aliases are fine.' })).toBeChecked();
    await user.tab();
    await user.keyboard(' ');
    const region = within(card(0)).getByRole('status');
    expect(region).toHaveTextContent('Not yet.');
    expect(region).toHaveTextContent('An alias moves under you. Reread the versions section.');
    expect(card(0)).toHaveAttribute('data-state', 'incorrect');
  });

  test('the feedback region and the summary exist before any check, and the question is numbered for screen readers', async () => {
    render(<SelfCheck moduleSlug="models" questions={QUESTIONS} persist="local" signedIn={false} />);
    await waitFor(() => expect(document.querySelector('section.self-check')).toHaveAttribute('data-hydrated', 'true'));
    const regions = document.querySelectorAll('div.self-check-feedback[role="status"][aria-live="polite"]');
    expect(regions).toHaveLength(2);
    for (const r of regions) expect(r).toBeEmptyDOMElement();
    expect(summary()).toHaveAttribute('role', 'status');
    expect(summary()).toHaveAttribute('aria-live', 'polite');
    expect(summary()).toHaveTextContent('0 of 2 answered correctly.');
    const heading = screen.getByRole('heading', { level: 3, name: 'Question 1 of 2. What does pinning a model version buy you?' });
    expect(heading.querySelector('.visually-hidden')).toHaveTextContent('Question 1 of 2.');
    // The fieldset is named by the question through its legend.
    expect(screen.getByRole('group', { name: 'What does pinning a model version buy you?' })).toBeInTheDocument();
    expect(document.querySelector('section.self-check')).toHaveAttribute('aria-label', 'Self-check');
  });
});

describe('checking', () => {
  test('Check answer with no selection writes the notice and changes nothing else', async () => {
    const user = userEvent.setup();
    render(<SelfCheck moduleSlug="models" questions={ONE} persist="local" signedIn={false} />);
    await user.click(screen.getByRole('button', { name: 'Check answer' }));
    expect(within(card(0)).getByRole('status')).toHaveTextContent('Choose an option first.');
    expect(card(0)).toHaveAttribute('data-state', 'pending');
    expect(screen.getByRole('button', { name: 'Check answer' })).toBeInTheDocument();
    expect(summary()).toHaveTextContent('0 of 1 answered correctly.');
    expect(localStorage.getItem(STATE_KEY('models'))).toBeNull();
    // Choosing an option clears the notice.
    await user.click(screen.getByRole('radio', { name: 'Nothing. Aliases are fine.' }));
    expect(within(card(0)).getByRole('status')).toBeEmptyDOMElement();
  });

  test('multi-correct questions say so in the legend, use checkboxes, and need the exact set', async () => {
    const user = userEvent.setup();
    render(<SelfCheck moduleSlug="models" questions={QUESTIONS} persist="local" signedIn={false} />);
    const group = screen.getByRole('group', { name: /Which two belong in the eval suite/ });
    expect(group.querySelector('legend')).toHaveTextContent('Select all that apply.');
    expect(within(group).getAllByRole('checkbox')).toHaveLength(3);
    expect(within(card(0)).queryAllByRole('checkbox')).toHaveLength(0);

    const button = within(card(1)).getByRole('button', { name: 'Check answer' });
    await user.click(screen.getByRole('checkbox', { name: 'A fixed set of real inputs' }));
    await user.click(button);
    expect(within(card(1)).getByRole('status')).toHaveTextContent('Not yet.');
    expect(within(card(1)).getByRole('status')).toHaveTextContent('Yes. Fixed inputs make a comparison repeatable.');
    expect(card(1)).toHaveAttribute('data-state', 'incorrect');
    expect(within(card(1)).getByRole('button', { name: 'Check again' })).toBeInTheDocument();

    // A superset is wrong too.
    await user.click(screen.getByRole('checkbox', { name: 'A vibe check in the playground' }));
    await user.click(screen.getByRole('checkbox', { name: 'Error analysis on the outputs' }));
    await user.click(within(card(1)).getByRole('button', { name: 'Check again' }));
    expect(card(1)).toHaveAttribute('data-state', 'incorrect');
    const paragraphs = within(card(1)).getByRole('status').querySelectorAll('p');
    expect(paragraphs).toHaveLength(4);
    expect(paragraphs[2]).toHaveTextContent('A playground session is not a measurement.');

    // The exact set is right.
    await user.click(screen.getByRole('checkbox', { name: 'A vibe check in the playground' }));
    await user.click(within(card(1)).getByRole('button', { name: 'Check again' }));
    expect(card(1)).toHaveAttribute('data-state', 'correct');
    expect(within(card(1)).getByRole('status')).toHaveTextContent('Correct.');
    expect(summary()).toHaveTextContent('1 of 2 answered correctly.');
    expect(summary()).not.toHaveTextContent('Passed.');
  });

  test('retry after a wrong answer, then the passed summary after every question is correct', async () => {
    const user = userEvent.setup();
    render(<SelfCheck moduleSlug="models" questions={QUESTIONS} persist="local" signedIn={false} />);
    await user.click(screen.getByRole('radio', { name: 'Nothing. Aliases are fine.' }));
    await user.click(within(card(0)).getByRole('button', { name: 'Check answer' }));
    expect(card(0)).toHaveAttribute('data-state', 'incorrect');
    await user.click(screen.getByRole('radio', { name: 'A dependency you can test against and replace on purpose.' }));
    await user.click(within(card(0)).getByRole('button', { name: 'Check again' }));
    expect(card(0)).toHaveAttribute('data-state', 'correct');
    expect(summary()).toHaveTextContent('1 of 2 answered correctly.');

    await user.click(screen.getByRole('checkbox', { name: 'A fixed set of real inputs' }));
    await user.click(screen.getByRole('checkbox', { name: 'Error analysis on the outputs' }));
    await user.click(within(card(1)).getByRole('button', { name: 'Check answer' }));
    expect(summary()).toHaveTextContent('2 of 2 answered correctly. Passed.');

    // A later wrong answer does not take the pass away (mastery, not the last state).
    await user.click(screen.getByRole('radio', { name: 'Nothing. Aliases are fine.' }));
    await user.click(within(card(0)).getByRole('button', { name: 'Check again' }));
    expect(card(0)).toHaveAttribute('data-state', 'incorrect');
    expect(summary()).toHaveTextContent('2 of 2 answered correctly. Passed.');
    const saved = JSON.parse(localStorage.getItem(STATE_KEY('models'))!) as SavedSelfCheckState;
    expect(saved.passed).toBe(true);
    expect(saved.attempts).toBe(4);
    // The best answer is kept for a question answered correctly once.
    expect(saved.answers['q-pin']).toEqual([1]);
    expect(saved.correctOnce).toEqual({ 'q-pin': true, 'q-evals': true });
  });
});

describe('persist="local"', () => {
  test('never calls the action, shows the on-device line and the optional note, and restores from localStorage', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<SelfCheck moduleSlug="orientation" questions={ONE} persist="local" signedIn={true} optional />);
    expect(screen.getByText('Optional. Does not count toward completion.')).toBeInTheDocument();
    expect(summary()).toHaveTextContent('This self-check stays on this device.');
    await user.click(screen.getByRole('radio', { name: 'A dependency you can test against and replace on purpose.' }));
    await user.click(screen.getByRole('button', { name: 'Check answer' }));
    expect(summary()).toHaveTextContent('1 of 1 answered correctly. Passed. This self-check stays on this device.');
    expect(mocks.saveSelfCheck).not.toHaveBeenCalled();
    const stored = JSON.parse(localStorage.getItem(STATE_KEY('orientation'))!) as SavedSelfCheckState;
    expect(stored.answers).toEqual({ 'q-pin': [1] });
    expect(stored.passed).toBe(true);
    unmount();

    // A reload restores the state (AC-5.8.6).
    render(<SelfCheck moduleSlug="orientation" questions={ONE} persist="local" signedIn={true} optional />);
    await waitFor(() => expect(card(0)).toHaveAttribute('data-state', 'correct'));
    expect(screen.getByRole('radio', { name: 'A dependency you can test against and replace on purpose.' })).toBeChecked();
    expect(within(card(0)).getByRole('status')).toHaveTextContent('Correct.');
    expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument();
    expect(summary()).toHaveTextContent('Passed.');
    expect(mocks.saveSelfCheck).not.toHaveBeenCalled();
  });

  test('ignores an initialState and a queue when persisting locally', async () => {
    enqueue({ moduleSlug: 'orientation', answers: { 'q-pin': [1] }, queuedAt: new Date().toISOString() });
    const initialState: SavedSelfCheckState = { answers: { 'q-pin': [1] }, correctOnce: { 'q-pin': true }, attempts: 1, passed: true, updatedAt: new Date().toISOString() };
    render(<SelfCheck moduleSlug="orientation" questions={ONE} persist="local" signedIn={true} initialState={initialState} />);
    await waitFor(() => expect(document.querySelector('section.self-check')).toHaveAttribute('data-hydrated', 'true'));
    expect(card(0)).toHaveAttribute('data-state', 'pending');
    expect(mocks.saveSelfCheck).not.toHaveBeenCalled();
    expect(readQueue()).toHaveLength(1);
  });
});

describe('persist="account" signed out', () => {
  test('grades locally, saves locally, shows the sign-in line, never calls the action', async () => {
    const user = userEvent.setup();
    render(<SelfCheck moduleSlug="models" questions={ONE} persist="account" signedIn={false} />);
    expect(summary()).toHaveTextContent('Sign in to save your progress.');
    await user.click(screen.getByRole('radio', { name: 'Nothing. Aliases are fine.' }));
    await user.click(screen.getByRole('button', { name: 'Check answer' }));
    expect(card(0)).toHaveAttribute('data-state', 'incorrect');
    expect(summary()).toHaveTextContent('0 of 1 answered correctly. Sign in to save your progress.');
    expect(localStorage.getItem(STATE_KEY('models'))).not.toBeNull();
    expect(mocks.saveSelfCheck).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });
});

describe('persist="account" signed in', () => {
  test('calls the action once per check with the best answers and shows Saved', async () => {
    const user = userEvent.setup();
    mocks.saveSelfCheck.mockResolvedValue(ok(false));
    render(<SelfCheck moduleSlug="models" questions={QUESTIONS} persist="account" signedIn={true} />);
    await user.click(screen.getByRole('radio', { name: 'Nothing. Aliases are fine.' }));
    await user.click(within(card(0)).getByRole('button', { name: 'Check answer' }));
    await waitFor(() => expect(summary()).toHaveTextContent('Saved'));
    expect(mocks.saveSelfCheck).toHaveBeenCalledTimes(1);
    expect(mocks.saveSelfCheck).toHaveBeenCalledWith({ moduleSlug: 'models', answers: { 'q-pin': [0] } });

    await user.click(screen.getByRole('radio', { name: 'A dependency you can test against and replace on purpose.' }));
    await user.click(within(card(0)).getByRole('button', { name: 'Check again' }));
    await waitFor(() => expect(mocks.saveSelfCheck).toHaveBeenCalledTimes(2));
    expect(mocks.saveSelfCheck).toHaveBeenLastCalledWith({ moduleSlug: 'models', answers: { 'q-pin': [1] } });

    // Wrong again: the best answer (the last correct one) is what gets saved.
    await user.click(screen.getByRole('radio', { name: 'Nothing. Aliases are fine.' }));
    await user.click(within(card(0)).getByRole('button', { name: 'Check again' }));
    await waitFor(() => expect(mocks.saveSelfCheck).toHaveBeenCalledTimes(3));
    expect(mocks.saveSelfCheck).toHaveBeenLastCalledWith({ moduleSlug: 'models', answers: { 'q-pin': [1] } });
    expect(readQueue()).toEqual([]);
  });

  test('adopts the server passed flag', async () => {
    const user = userEvent.setup();
    mocks.saveSelfCheck.mockResolvedValue(ok(true));
    render(<SelfCheck moduleSlug="models" questions={QUESTIONS} persist="account" signedIn={true} />);
    await user.click(screen.getByRole('radio', { name: 'A dependency you can test against and replace on purpose.' }));
    await user.click(within(card(0)).getByRole('button', { name: 'Check answer' }));
    await waitFor(() => expect(summary()).toHaveTextContent('1 of 2 answered correctly. Passed. Saved'));
  });

  test('a rejected call keeps the answer in the queue and shows the pending line; Retry sends it', async () => {
    const user = userEvent.setup();
    mocks.saveSelfCheck.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    render(<SelfCheck moduleSlug="models" questions={ONE} persist="account" signedIn={true} />);
    await user.click(screen.getByRole('radio', { name: 'A dependency you can test against and replace on purpose.' }));
    await user.click(screen.getByRole('button', { name: 'Check answer' }));
    // Feedback is local and immediate, before the call settles.
    expect(card(0)).toHaveAttribute('data-state', 'correct');
    await waitFor(() => expect(summary()).toHaveTextContent('Saved on this device. Will sync when online.'));
    expect(readQueue()).toHaveLength(1);
    expect(readQueue()[0]).toMatchObject({ moduleSlug: 'models', answers: { 'q-pin': [1] } });

    mocks.saveSelfCheck.mockResolvedValueOnce(ok(true));
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(summary()).toHaveTextContent('1 of 1 answered correctly. Passed. Saved'));
    expect(readQueue()).toEqual([]);
    expect(localStorage.getItem(QUEUE_KEY)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  test('a result with neither data nor error is treated as a network failure', async () => {
    const user = userEvent.setup();
    mocks.saveSelfCheck.mockResolvedValueOnce({ data: undefined, error: undefined });
    render(<SelfCheck moduleSlug="models" questions={ONE} persist="account" signedIn={true} />);
    await user.click(screen.getByRole('radio', { name: 'Nothing. Aliases are fine.' }));
    await user.click(screen.getByRole('button', { name: 'Check answer' }));
    await waitFor(() => expect(summary()).toHaveTextContent('Saved on this device. Will sync when online.'));
    expect(readQueue()).toHaveLength(1);
  });

  test('a 5xx keeps the answer queued; the online event drains it', async () => {
    const user = userEvent.setup();
    mocks.saveSelfCheck.mockResolvedValueOnce(fail('INTERNAL_SERVER_ERROR', 500));
    render(<SelfCheck moduleSlug="models" questions={ONE} persist="account" signedIn={true} />);
    await user.click(screen.getByRole('radio', { name: 'Nothing. Aliases are fine.' }));
    await user.click(screen.getByRole('button', { name: 'Check answer' }));
    await waitFor(() => expect(summary()).toHaveTextContent('Saved on this device. Will sync when online.'));
    expect(readQueue()).toHaveLength(1);
    mocks.saveSelfCheck.mockResolvedValueOnce(ok(false));
    window.dispatchEvent(new Event('online'));
    await waitFor(() => expect(summary()).toHaveTextContent('0 of 1 answered correctly. Saved'));
    expect(readQueue()).toEqual([]);
  });

  test('UNAUTHORIZED shows the sign-in line and queues nothing', async () => {
    const user = userEvent.setup();
    mocks.saveSelfCheck.mockResolvedValueOnce(fail('UNAUTHORIZED', 401, 'Sign in to save your work.'));
    render(<SelfCheck moduleSlug="models" questions={ONE} persist="account" signedIn={true} />);
    await user.click(screen.getByRole('radio', { name: 'Nothing. Aliases are fine.' }));
    await user.click(screen.getByRole('button', { name: 'Check answer' }));
    await waitFor(() => expect(summary()).toHaveTextContent('Sign in to save your progress.'));
    expect(readQueue()).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  test('another 4xx shows the error line with a Retry button that resubmits', async () => {
    const user = userEvent.setup();
    mocks.saveSelfCheck.mockResolvedValueOnce(fail('FORBIDDEN', 403));
    render(<SelfCheck moduleSlug="models" questions={ONE} persist="account" signedIn={true} />);
    await user.click(screen.getByRole('radio', { name: 'A dependency you can test against and replace on purpose.' }));
    await user.click(screen.getByRole('button', { name: 'Check answer' }));
    await waitFor(() => expect(summary()).toHaveTextContent('Could not save. Retry.'));
    expect(readQueue()).toEqual([]);
    mocks.saveSelfCheck.mockResolvedValueOnce(ok(true));
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(summary()).toHaveTextContent('Passed. Saved'));
    expect(mocks.saveSelfCheck).toHaveBeenLastCalledWith({ moduleSlug: 'models', answers: { 'q-pin': [1] } });
  });

  test('drains a queued item for this module on mount and drops one the server no longer knows', async () => {
    enqueue({ moduleSlug: 'models', answers: { 'q-pin': [1] }, queuedAt: '2026-10-03T10:00:00.000Z' });
    enqueue({ moduleSlug: 'gone', answers: { 'q-x': [0] }, queuedAt: '2026-10-03T10:00:00.000Z' });
    mocks.saveSelfCheck.mockImplementation(async (input: { moduleSlug: string }) => (input.moduleSlug === 'gone' ? fail('NOT_FOUND', 404) : ok(true)));
    render(<SelfCheck moduleSlug="models" questions={ONE} persist="account" signedIn={true} />);
    await waitFor(() => expect(readQueue()).toEqual([]));
    expect(summary()).toHaveTextContent('Saved');
    expect(mocks.saveSelfCheck).toHaveBeenCalledTimes(2);
    // The adopted pass is written back to the local copy.
    expect((JSON.parse(localStorage.getItem(STATE_KEY('models')) ?? 'null') as SavedSelfCheckState | null)?.passed).toBe(true);
  });

  test('starts from the account state, or from the local copy when it is newer', async () => {
    const account: SavedSelfCheckState = { answers: { 'q-pin': [1] }, correctOnce: { 'q-pin': true }, attempts: 3, passed: true, updatedAt: '2026-10-02T10:00:00.000Z' };
    const { unmount } = render(<SelfCheck moduleSlug="models" questions={ONE} persist="account" signedIn={true} initialState={account} />);
    await waitFor(() => expect(card(0)).toHaveAttribute('data-state', 'correct'));
    expect(summary()).toHaveTextContent('1 of 1 answered correctly. Passed.');
    unmount();

    localStorage.setItem(
      STATE_KEY('models'),
      JSON.stringify({ answers: { 'q-pin': [0] }, correctOnce: {}, attempts: 1, passed: false, updatedAt: '2026-10-03T10:00:00.000Z' } satisfies SavedSelfCheckState),
    );
    render(<SelfCheck moduleSlug="models" questions={ONE} persist="account" signedIn={true} initialState={account} />);
    await waitFor(() => expect(card(0)).toHaveAttribute('data-state', 'incorrect'));
    expect(summary()).toHaveTextContent('0 of 1 answered correctly.');
    expect(mocks.saveSelfCheck).not.toHaveBeenCalled();
  });

  test('an account row without correctOnce is graded from its answers', async () => {
    const row = { answers: { 'q-pin': [1] }, attempts: 2, passed: false, updatedAt: new Date('2026-10-02T10:00:00.000Z') } as unknown as SavedSelfCheckState;
    render(<SelfCheck moduleSlug="models" questions={ONE} persist="account" signedIn={true} initialState={row} />);
    await waitFor(() => expect(card(0)).toHaveAttribute('data-state', 'correct'));
    expect(summary()).toHaveTextContent('1 of 1 answered correctly. Passed.');
  });
});

describe('restoring saved progress does not announce it (Phase 1 review round 2)', () => {
  test('each feedback region is filled before it becomes live, the summary is live throughout, and a later check is announced', async () => {
    localStorage.setItem(
      STATE_KEY('orientation'),
      JSON.stringify({ answers: { 'q-pin': [1], 'q-evals': [0, 2] }, correctOnce: { 'q-pin': true, 'q-evals': true }, attempts: 2, passed: true, updatedAt: new Date().toISOString() } satisfies SavedSelfCheckState),
    );
    // Records arrive in DOM order, so the index of a region's first fill against the index of its aria-live
    // addition says which came first. A region filled while already live would be announced.
    const records: Array<{ type: string; target: Node; attr: string | null }> = [];
    const observer = new MutationObserver((list) => {
      for (const m of list) records.push({ type: m.type, target: m.target, attr: m.attributeName });
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-live', 'role'] });
    try {
      render(<SelfCheck moduleSlug="orientation" questions={QUESTIONS} persist="local" signedIn={false} optional />);
      await waitFor(() => expect(document.querySelector('section.self-check')).toHaveAttribute('data-hydrated', 'true'));
      await new Promise((resolve) => setTimeout(resolve, 0));
    } finally {
      observer.disconnect();
    }
    const regions = [...document.querySelectorAll<HTMLElement>('div.self-check-feedback')];
    expect(regions).toHaveLength(2);
    for (const region of regions) {
      expect(region).toHaveAttribute('role', 'status');
      expect(region).toHaveAttribute('aria-live', 'polite');
      expect(region).toHaveTextContent('Correct.');
      const filled = records.findIndex((r) => r.type === 'childList' && r.target === region);
      const live = records.findIndex((r) => r.type === 'attributes' && r.target === region && r.attr === 'aria-live');
      expect(filled, 'the restored feedback was inserted').toBeGreaterThanOrEqual(0);
      expect(live, 'aria-live was added after the initial render').toBeGreaterThanOrEqual(0);
      expect(filled, 'the fill came before the region went live').toBeLessThan(live);
    }
    // The summary carried its live attributes from the first render: no attribute record names it.
    expect(records.some((r) => r.type === 'attributes' && r.target === summary())).toBe(false);
    expect(summary()).toHaveAttribute('aria-live', 'polite');
    expect(summary()).toHaveTextContent('2 of 2 answered correctly. Passed. This self-check stays on this device.');

    // A check made now lands in a region that is already live.
    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: 'Nothing. Aliases are fine.' }));
    await user.click(within(card(0)).getByRole('button', { name: 'Check again' }));
    expect(within(card(0)).getByRole('status')).toHaveTextContent('Not yet.');
  });

  test('without saved progress the regions go live right after hydration and stay empty', async () => {
    render(<SelfCheck moduleSlug="models" questions={ONE} persist="local" signedIn={false} />);
    await waitFor(() => expect(document.querySelector('section.self-check')).toHaveAttribute('data-hydrated', 'true'));
    const region = within(card(0)).getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toBeEmptyDOMElement();
  });
});

describe('accessibility', () => {
  test('axe reports no violations in the pending, correct, and incorrect states', async () => {
    const user = userEvent.setup();
    const { container } = render(<SelfCheck moduleSlug="models" questions={QUESTIONS} persist="account" signedIn={false} optional />);
    await expectNoAxeViolations(container);

    await user.click(screen.getByRole('radio', { name: 'A dependency you can test against and replace on purpose.' }));
    await user.click(within(card(0)).getByRole('button', { name: 'Check answer' }));
    expect(card(0)).toHaveAttribute('data-state', 'correct');
    await expectNoAxeViolations(container);

    await user.click(screen.getByRole('checkbox', { name: 'A vibe check in the playground' }));
    await user.click(within(card(1)).getByRole('button', { name: 'Check answer' }));
    expect(card(1)).toHaveAttribute('data-state', 'incorrect');
    await expectNoAxeViolations(container);
  });

  test('sets data-motion="reduce" when the learner prefers reduced motion', async () => {
    const original = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (query: string) => ({ matches: query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {} }),
    });
    try {
      render(<SelfCheck moduleSlug="models" questions={ONE} persist="local" signedIn={false} />);
      await waitFor(() => expect(document.querySelector('section.self-check')).toHaveAttribute('data-motion', 'reduce'));
    } finally {
      if (original) Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: original });
      else Reflect.deleteProperty(window, 'matchMedia');
    }
  });
});

describe('what the live regions say (docs/decisions.md, 2026-10-03)', () => {
  // Feedback written the way docs/content-authoring.md asks: every entry opens with the verdict word.
  const PREFIXED: SelfCheckQuestion[] = [
    {
      id: 'q-one',
      question: 'Which one holds?',
      options: ['The wrong one', 'The right one'],
      correct: [1],
      feedback: ['Not yet. Reread the first section.', 'Correct. That is the point.'],
    },
    {
      id: 'q-many',
      question: 'Which belong?',
      options: ['A', 'B', 'C'],
      correct: [0, 1],
      feedback: ['Correct. A is in.', 'Correct. B is in.', 'Not yet. C is out.'],
    },
  ];
  const paragraphs = (index: number) => Array.from(within(card(index)).getByRole('status').querySelectorAll('p')).map((p) => p.textContent);

  test('a single-correct question says the verdict once', async () => {
    const user = userEvent.setup();
    render(<SelfCheck moduleSlug="models" questions={PREFIXED} persist="local" signedIn={false} />);
    await user.click(screen.getByRole('radio', { name: 'The wrong one' }));
    await user.click(within(card(0)).getByRole('button', { name: 'Check answer' }));
    expect(paragraphs(0)).toEqual(['Not yet.', 'Reread the first section.']);
    await user.click(screen.getByRole('radio', { name: 'The right one' }));
    await user.click(within(card(0)).getByRole('button', { name: 'Check again' }));
    expect(paragraphs(0)).toEqual(['Correct.', 'That is the point.']);
  });

  test('a multi-correct question names missing options, keeps per-pick verdicts on a mixed result, and drops them on a uniform one', async () => {
    const user = userEvent.setup();
    render(<SelfCheck moduleSlug="models" questions={PREFIXED} persist="local" signedIn={false} />);
    const button = () => within(card(1)).getByRole('button', { name: /^Check (answer|again)$/ });

    // Only A: every pick was right, but B is missing. The picks' prefixes do not match the verdict and stay.
    await user.click(screen.getByRole('checkbox', { name: 'A' }));
    await user.click(button());
    expect(paragraphs(1)).toEqual(['Not yet.', 'Correct. A is in.', MISSING_LINE]);

    // A and C: a wrong pick and a missing one.
    await user.click(screen.getByRole('checkbox', { name: 'C' }));
    await user.click(button());
    expect(paragraphs(1)).toEqual(['Not yet.', 'Correct. A is in.', 'Not yet. C is out.', MISSING_LINE]);

    // A, B, and C: nothing missing, so no extra line; the wrong pick keeps its prefix.
    await user.click(screen.getByRole('checkbox', { name: 'B' }));
    await user.click(button());
    expect(paragraphs(1)).toEqual(['Not yet.', 'Correct. A is in.', 'Correct. B is in.', 'Not yet. C is out.']);

    // A and B: a uniform correct result reads the verdict once.
    await user.click(screen.getByRole('checkbox', { name: 'C' }));
    await user.click(button());
    expect(paragraphs(1)).toEqual(['Correct.', 'A is in.', 'B is in.']);
    expect(card(1)).toHaveAttribute('data-state', 'correct');
  });

  test('the multi-correct hint is in the legend once and the summary is one text node', async () => {
    const user = userEvent.setup();
    render(<SelfCheck moduleSlug="models" questions={PREFIXED} persist="local" signedIn={false} />);
    const legend = card(1).querySelector('legend');
    expect(legend?.textContent?.match(/Select all that apply\./g)).toHaveLength(1);
    expect(summary().childNodes).toHaveLength(1);
    expect(summary().childNodes[0]?.nodeType).toBe(Node.TEXT_NODE);
    await user.click(screen.getByRole('radio', { name: 'The right one' }));
    await user.click(within(card(0)).getByRole('button', { name: 'Check answer' }));
    expect(summary().childNodes).toHaveLength(1);
    expect(summary()).toHaveTextContent('1 of 2 answered correctly. This self-check stays on this device.');
  });
});
