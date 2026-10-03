// src/lib/mailer.test.ts
import { afterEach, expect, test } from 'vitest';
import { NoopMailer, getMailer, setMailerForTests, type Mailer, type OutboundMessage } from './mailer';

afterEach(() => setMailerForTests(null));

const message: OutboundMessage = {
  kind: 'confirm',
  to: 'learner@example.com',
  subject: 'Confirm your address',
  text: 'Confirm your address by opening the link.',
  links: {
    confirm: 'http://localhost:4321/notify/confirm?token=abc.def',
    unsubscribe: 'http://localhost:4321/notify/unsubscribe?token=ghi.jkl',
  },
};

test('the noop mailer logs one line with the kind, the address, and both links', async () => {
  const lines: string[] = [];
  const mailer = new NoopMailer((l) => lines.push(l));
  await mailer.send(message);
  expect(mailer.name).toBe('noop');
  expect(lines).toHaveLength(1);
  const line = lines[0]!;
  expect(line).toContain('[mailer:noop]');
  expect(line).toContain('kind=confirm');
  expect(line).toContain('to=learner@example.com');
  expect(line).toContain('confirm=http://localhost:4321/notify/confirm?token=abc.def');
  expect(line).toContain('unsubscribe=http://localhost:4321/notify/unsubscribe?token=ghi.jkl');
});

test('a message without a confirm link logs only the unsubscribe link', async () => {
  const lines: string[] = [];
  const mailer = new NoopMailer((l) => lines.push(l));
  await mailer.send({ ...message, kind: 'launch', links: { unsubscribe: message.links.unsubscribe } });
  expect(lines[0]).toContain('kind=launch');
  expect(lines[0]).not.toContain('confirm=');
  expect(lines[0]).toContain('unsubscribe=');
});

test('getMailer returns the noop mailer and the test seam replaces it', async () => {
  expect(getMailer('none')).toBeInstanceOf(NoopMailer);
  expect(getMailer()).toBe(getMailer());
  const sent: OutboundMessage[] = [];
  const spy: Mailer = { name: 'spy', send: async (m) => void sent.push(m) };
  setMailerForTests(spy);
  expect(getMailer()).toBe(spy);
  await getMailer().send(message);
  expect(sent).toEqual([message]);
});
