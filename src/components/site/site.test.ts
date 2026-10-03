// src/components/site/site.test.ts
// Renders E's components and pages through the Container API and checks the contracts in blueprint
// sections 8, 10.4, and 14.5. Runs under vitest with getViteConfig, so astro:env/server resolves.
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, test, vi } from 'vitest';
import AnatomyMap from './AnatomyMap.astro';
import Callout from './Callout.astro';
import Collapsible from './Collapsible.astro';
import Header from './Header.astro';
import MiniMap from './MiniMap.astro';
import Notice from './Notice.astro';
import NotifyForm from './NotifyForm.astro';
import PageHeader from './PageHeader.astro';
import StatusChip from './StatusChip.astro';
import ThemeToggle from './ThemeToggle.astro';
import Landing from '../../pages/index.astro';
import MapPage from '../../pages/map.astro';
import PrivacyPage from '../../pages/privacy.astro';
import NotFoundPage from '../../pages/404.astro';
import { MINI_MAP_ALT, decorateSvg, mapDescription, nextDiagramInstance } from './diagrams';
import { AREA_CONTENT_MAP, AREA_KEYS, AREA_TITLES, ELECTIVE_MODULES, ELECTIVE_TITLES, MODULE_SLUGS } from '../../lib/content-schema';
import type { ModuleEntry } from '../../lib/modules';

// The landing page reads the module list through src/lib/modules. The real store is visible under Vitest
// (astro.config.mjs cacheDir, docs/decisions.md 2026-10-03), but every real module is a draft, so the helper
// is mocked with the fourteen modules from the content map and two of them published: orientation and
// foundations link, everything else is planned, and both branches of the list render from one fixture.
function entry(id: string, title: string, kind: string, order: number, draft: boolean, takeaway?: string): ModuleEntry {
  return { id, collection: 'modules', data: { title, kind, order, draft, takeaway } } as unknown as ModuleEntry;
}

const FIXTURE_MODULES: ModuleEntry[] = [
  entry('orientation', 'Orientation', 'orientation', 0, false),
  entry('foundations', 'Foundations', 'foundations', 0, false),
  ...AREA_KEYS.map((key) => {
    const area = AREA_CONTENT_MAP[key];
    return entry(area.slug, area.title, 'area', area.order, true, area.takeaway);
  }),
  entry('self-assessment', 'Self-assessment', 'closing', 0, true),
  ...Object.entries(ELECTIVE_MODULES).map(([slug, e]) => entry(slug, e.title, 'elective', e.order, true)),
];

vi.mock('../../lib/modules', () => ({
  getAllModules: async () => FIXTURE_MODULES,
  isPublished: (e: ModuleEntry) => !e.data.draft,
}));

const THESIS_1 = 'Using AI makes you an AI-enabled software engineer.';
const THESIS_2 = 'Engineering systems that depend on AI makes you an AI engineer.';

/** Scoped styles add data-astro-cid attributes; the contracts are about the rest of the markup. */
function clean(html: string): string {
  return html.replace(/ data-astro-cid-[a-z0-9]+(?:="[^"]*")?/g, '');
}

type RenderOptions = Parameters<AstroContainer['renderToString']>[1];

async function render(component: Parameters<AstroContainer['renderToString']>[0], options: RenderOptions = {}): Promise<string> {
  const container = await AstroContainer.create();
  return clean(await container.renderToString(component, options));
}

/** Heading levels in document order. */
function headingLevels(html: string): number[] {
  return [...html.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
}

function count(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

/** The <main> element's markup. */
function main_(html: string): string {
  return html.slice(html.indexOf('<main'), html.indexOf('</main>'));
}

describe('diagram helpers', () => {
  test('decorateSvg adds root attributes, title, and desc and keeps the body', () => {
    const out = decorateSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">\n  <rect/>\n</svg>\n', {
      attrs: { role: 'img', 'aria-labelledby': 't d', 'data-highlight': undefined },
      title: 'A & B',
      titleId: 't',
      desc: '<x>',
      descId: 'd',
    });
    expect(out.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" role="img" aria-labelledby="t d"><title id="t">A &amp; B</title><desc id="d">&lt;x&gt;</desc>')).toBe(true);
    expect(out).not.toContain('data-highlight');
    expect(out.endsWith('<rect/>\n</svg>')).toBe(true);
  });

  test('nextDiagramInstance counts per scope', () => {
    const a = {};
    const b = {};
    expect(nextDiagramInstance(a)).toBe(1);
    expect(nextDiagramInstance(a)).toBe(2);
    expect(nextDiagramInstance(b)).toBe(1);
  });

  test('mapDescription appends the yours and highlight sentences', () => {
    expect(mapDescription('base')).not.toContain('yours');
    expect(mapDescription('yours')).toContain('Every box except Goal carries an amber badge reading yours');
    expect(mapDescription('base', 'harness')).toMatch(/The Harness region is highlighted and the rest is dimmed\.$/);
  });
});

describe('site components', () => {
  test('AnatomyMap renders one labelled svg per instance with distinct ids', async () => {
    const container = await AstroContainer.create();
    const request = new Request('http://localhost/map');
    const first = clean(await container.renderToString(AnatomyMap, { request, props: { variant: 'base', descriptionOpen: true } }));
    const second = clean(await container.renderToString(AnatomyMap, { request, props: { variant: 'yours', highlight: 'model', describedBy: false } }));

    expect(first).toContain('<figure class="diagram-tile">');
    // The region's name names the region; the sideways-scroll behavior is a CSS fact under 48rem, not part of the name.
    expect(first).toContain('<div class="diagram-scroll" role="group" aria-label="Anatomy diagram" tabindex="0">');
    expect(first).toContain('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080"');
    expect(first).toContain('class="map" role="img" aria-labelledby="map-title-1 map-desc-1"');
    expect(first).toContain('<title id="map-title-1">Anatomy of an agentic AI system.</title>');
    expect(first).toContain('<desc id="map-desc-1">A platform wraps one run');
    expect(first).not.toContain('data-highlight');
    expect(first).toContain('data-layer="model"');
    // The Model label is primary text, not blue, so it reads at the rendered size (WCAG 1.4.3; import script step 3).
    expect(first).toMatch(/font-weight="700" fill="#fffcf5">Model<\/text>/);
    expect(first).not.toMatch(/fill="#1064f8">Model</);
    expect(first).toContain('<p>Title: Anatomy of an agentic AI system.</p>');
    expect(first).toContain('<li>Guardrails: limits on actions.</li>');
    expect(first).not.toContain('id="box-');
    expect(first).not.toContain('<defs>');
    expect(first).toContain('<details class="collapsible" open>');
    expect(first).toContain('Long description');
    expect(first).toContain('Governance: policies, audit trails, approvals.');

    expect(second).toContain('aria-labelledby="map-title-2 map-desc-2"');
    expect(second).toContain('<title id="map-title-2">Anatomy of an agentic AI system: every box is yours.</title>');
    expect(second).toContain('yours to select. The Model box is highlighted and the rest is dimmed.</desc>');
    expect(second).toContain('data-highlight="model"');
    expect(second).toContain('data-layer="badges"');
    expect(second).not.toContain('<details');

    // Two maps on one page share no id.
    const ids = [...(first + second).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('MiniMap is a short-named link around an image named by the alt text', async () => {
    const html = await render(MiniMap, { props: { variant: 'evals' } });
    // The link's name is short; the picture keeps the section 7 alt as its own name (docs/decisions.md, 2026-10-03).
    expect(html).toContain('<a class="minimap" href="/map" aria-label="Open the map">');
    expect(html).toContain(`role="img" aria-label="${MINI_MAP_ALT.evals}"`);
    // No <title> next to aria-label: it would duplicate the name and show as a hover tooltip.
    expect(html).not.toContain('<title>');
    expect(html).toContain('width="160" height="90"');
    expect(html).not.toMatch(/\sid="/);
  });

  test('PageHeader renders the kicker, the mini-map, and one h1', async () => {
    const html = await render(PageHeader, {
      props: { kicker: 'When you are the user', area: 'Models', minimap: 'models', title: 'Models' },
    });
    expect(html).toContain('<div class="page-header">');
    expect(html).toContain('<p class="kicker"><b>Models</b> · When you are the user</p>');
    expect(html).toContain('<h1 class="page-title">Models</h1>');
    expect(html).toContain('class="minimap"');
    expect(html).toContain('<hr class="divider">');
    const neutral = await render(PageHeader, { props: { kicker: 'The map', title: 'Map' } });
    expect(neutral).toContain('<p class="kicker">The map</p>');
    expect(neutral).not.toContain('minimap');
  });

  test('Header shows Sign in without a user and Account plus Sign out with one', async () => {
    const anonymous = await render(Header, { locals: { user: null, session: null } });
    expect(anonymous).toContain('<header class="site-header">');
    expect(anonymous).toContain('<a class="site-name" href="/">Becoming an AI Engineer</a>');
    expect(anonymous).toContain('<nav class="site-nav" aria-label="Site">');
    expect(anonymous).toContain('<a href="/modules">Modules</a>');
    expect(anonymous).toContain('<a href="/map">Map</a>');
    expect(anonymous).toContain('<a href="/sign-in">Sign in</a>');
    expect(anonymous).not.toContain('Sign out');
    expect(anonymous).toContain('role="group" aria-label="Theme"');
    expect(anonymous).toContain('data-theme-choice="system" aria-pressed="true"');
    expect(anonymous).not.toContain('<script');

    // Prerendered pages have no locals.user at all.
    const prerendered = await render(Header, {});
    expect(prerendered).toContain('<a href="/sign-in">Sign in</a>');

    const user = { id: 'u1', name: 'Ada', email: 'ada@example.com', emailVerified: true, createdAt: new Date(), updatedAt: new Date() };
    const signedIn = await render(Header, { locals: { user, session: null } });
    expect(signedIn).toContain('<span class="secondary">Ada</span>');
    expect(signedIn).toContain('<a href="/account">Account</a>');
    expect(signedIn.indexOf('Ada</span>')).toBeLessThan(signedIn.indexOf('href="/account"'));
    expect(signedIn).toContain('<form method="POST" action="/sign-out"><button class="btn btn-outline" type="submit">Sign out</button></form>');
    expect(signedIn).not.toContain('Sign in');
  });

  test('ThemeToggle renders three buttons in order with no script', async () => {
    const html = await render(ThemeToggle, {});
    expect(html.indexOf('>System<')).toBeLessThan(html.indexOf('>Light<'));
    expect(html.indexOf('>Light<')).toBeLessThan(html.indexOf('>Dark<'));
    expect(count(html, '<button type="button" class="btn btn-outline" data-theme-choice=')).toBe(3);
    expect(html).toContain('data-theme-choice="light" aria-pressed="false"');
    expect(html).not.toContain('<script');
  });

  test('NotifyForm posts to the on-demand notify route and links the privacy notice', async () => {
    const html = await render(NotifyForm, {});
    expect(html).toContain('<form class="notify-form" id="notify" method="POST" action="/notify?_action=notifySubscribe">');
    expect(html).toContain('<label class="field-label" for="notify-email">Email</label>');
    expect(html).toContain('id="notify-email" name="email" type="email" required autocomplete="email"');
    expect(html).not.toContain('aria-invalid');
    expect(html).toContain('<button class="btn btn-primary" type="submit">Notify me</button>');
    expect(html).toContain('<p class="field-help">We store your address to tell you when modules launch. <a href="/privacy">Privacy notice</a>.</p>');
    expect(html.indexOf('Notify me')).toBeLessThan(html.indexOf('field-help'));

    expect(html).not.toContain('value=');

    const withError = await render(NotifyForm, { props: { error: 'Enter a valid email address.', value: 'a"b&c' } });
    expect(withError).toContain('autofocus aria-invalid="true" aria-describedby="notify-error"');
    // The rejected text comes back in the field, with the quote and the ampersand escaped (Astro's attribute escaping).
    expect(withError).toContain('value="a&quot;b&amp;c"');
    expect(withError).toContain('<p class="field-error" id="notify-error"><b>Fix:</b> Enter a valid email address.</p>');
    expect(withError).not.toContain('notify-notice');

    // A rate limit or a server failure is not the learner's input: a status line, and the field stays valid.
    const withNotice = await render(NotifyForm, { props: { notice: 'Too many requests. Try again in 5 minutes.' } });
    expect(withNotice).toContain('<p class="field-help notify-notice" id="notify-notice" role="status">Too many requests. Try again in 5 minutes.</p>');
    expect(withNotice).not.toContain('aria-invalid');
    expect(withNotice).not.toContain('autofocus');
    expect(withNotice).not.toContain('Fix:');
  });

  test('Callout, Collapsible, StatusChip, and Notice follow the class contract', async () => {
    const surface = await render(Callout, { props: { label: 'Note' }, slots: { default: '<p>Body</p>' } });
    expect(surface).toContain('<div class="callout-surface"><span class="callout-label">Note</span><p>Body</p></div>');
    const plain = await render(Callout, { props: { kind: 'plain', label: 'Why this matters' }, slots: { default: '<p>Body</p>' } });
    expect(plain).toContain('<div class="callout"><p class="callout-lead">Why this matters</p><p>Body</p></div>');

    const closed = await render(Collapsible, { props: { title: 'More' }, slots: { default: 'Inside' } });
    expect(closed).toContain('<details class="collapsible">');
    expect(closed).toContain('<summary>');
    expect(closed).toContain('class="chevron"');
    expect(closed).toContain('stroke="currentColor"');
    expect(closed).toContain('<div class="collapsible-body">');
    const open = await render(Collapsible, { props: { title: 'More', open: true }, slots: { default: 'Inside' } });
    expect(open).toContain('<details class="collapsible" open>');

    expect(await render(StatusChip, { props: { status: 'not_started' } })).toContain('<span class="chip chip-status-not-started">Not started</span>');
    expect(await render(StatusChip, { props: { status: 'in_progress' } })).toContain('<span class="chip chip-status-in-progress">In progress</span>');
    expect(await render(StatusChip, { props: { status: 'completed' } })).toContain('<span class="chip chip-status-complete">Complete</span>');
    expect(await render(StatusChip, { props: { status: 'draft' } })).toContain('<span class="chip chip-status-draft">Draft</span>');
    expect(await render(StatusChip, { props: { status: 'planned' } })).toContain('<span class="chip chip-status-planned">Planned</span>');

    const notice = await render(Notice, { props: { label: 'Before this module', ariaLabel: 'Prerequisite' }, slots: { default: '<p>Read Foundations.</p>' } });
    expect(notice).toContain('<aside class="notice" role="note" aria-label="Prerequisite"><span class="callout-label">Before this module</span><p>Read Foundations.</p></aside>');
    const neutral = await render(Notice, { props: { label: 'Note', neutral: true } });
    expect(neutral).toContain('<aside class="notice notice-neutral" role="note">');
  });
});

describe('public pages', () => {
  test('landing page states the thesis, the scope, the map, the modules, and the form', async () => {
    const html = await render(Landing, { request: new Request('http://localhost/'), routeType: 'page' });

    expect(html).toContain('<title>Becoming an AI Engineer</title>');
    expect(html).toContain(THESIS_1);
    expect(html).toContain(THESIS_2);
    for (const statement of ['The program is free.', 'It is self-paced.', 'It has no certificate.', 'It does not require a build']) {
      expect(html).toContain(statement);
    }

    // One h1, strict heading order.
    expect(count(html, '<h1')).toBe(1);
    const levels = headingLevels(html);
    for (let i = 1; i < levels.length; i += 1) expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);

    // The map with its text alternative and long description.
    expect(html).toContain('class="map" role="img" aria-labelledby="map-title-1 map-desc-1"');
    expect(html).toContain('Long description');
    expect(html).toContain('"Agent equals model plus harness. Everything that is not the model is what you engineer."');

    // Every module by name: published ones link, drafts are planned with no link.
    expect(html).toContain('14 modules are planned.');
    expect(html).toContain('<a href="/modules/orientation">Orientation</a>');
    expect(html).toContain('<a href="/modules/foundations">Foundations</a>');
    for (const slug of MODULE_SLUGS.filter((s) => s !== 'orientation' && s !== 'foundations')) {
      expect(html).not.toContain(`href="/modules/${slug}"`);
    }
    for (const title of [...Object.values(AREA_TITLES), ...ELECTIVE_TITLES, 'Self-assessment']) {
      expect(html).toContain(`<span>${title}</span> <span class="chip chip-status-planned">Planned</span>`);
    }
    expect(count(html, 'Planned</span>')).toBe(12);
    // Safari with VoiceOver keeps list semantics only with an explicit role on a list-style: none list.
    expect(count(main_(html), '<ul class="module-list" role="list">')).toBe(5);
    for (const heading of ['Orientation', 'Foundations', 'The six areas', 'Closing', 'Electives']) expect(html).toContain(`<h3>${heading}</h3>`);
    expect(html).toContain('"The model is a versioned, expiring dependency. Treat it like one."');
    expect(html).toContain('"When you are the owner, its answer is your answer."');

    // The form and the privacy link inside it.
    const form = html.slice(html.indexOf('<form class="notify-form"'), html.indexOf('</form>'));
    expect(form).toContain('action="/notify?_action=notifySubscribe"');
    expect(form).toContain('>Email</label>');
    expect(form).toContain('>Notify me</button>');
    expect(form).toContain('href="/privacy"');
    const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
    expect(main).toContain('<a href="/modules">module catalog</a>');
    // The opener's spoken form is a hidden span; the visual spans are hidden from assistive technology.
    expect(main).toContain('<span class="visually-hidden">demo equals works dot any, product equals works dot all</span>');
    expect(main).not.toContain('aria-label="demo');
    // The one hedge sentence every notify surface carries, verbatim (docs/decisions.md, 2026-10-03).
    expect(main).toContain('No mail goes out until a provider is chosen.');
    expect(main).not.toContain('mail provider');

    // The opener keeps its alignment spaces.
    expect(html).toContain('<span class="secondary">demo    = </span>works<span class="amber">.any()</span>');

    // No JavaScript beyond the theme script.
    expect(count(html, '<script')).toBe(1);
    expect(html).toContain("var key = 'aie-theme'");
    expect(html).not.toContain('data-placeholder');
  });

  test('map page holds two labelled maps with distinct ids and the long description open', async () => {
    const html = await render(MapPage, { request: new Request('http://localhost/map'), routeType: 'page' });
    expect(count(html, '<h1')).toBe(1);
    expect(count(html, 'role="img"')).toBe(2);
    expect(html).toContain('aria-labelledby="map-title-1 map-desc-1"');
    expect(html).toContain('aria-labelledby="map-title-2 map-desc-2"');
    expect(html).toContain('<details class="collapsible" open>');
    expect(count(html, '<details')).toBe(1);
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(count(html, '<script')).toBe(1);
    expect(html).not.toContain('data-placeholder');
    const levels = headingLevels(html);
    for (let i = 1; i < levels.length; i += 1) expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
  });

  test('privacy notice covers the notify list, accounts, deletion, and the contact placeholder', async () => {
    const html = await render(PrivacyPage, { request: new Request('http://localhost/privacy'), routeType: 'page' });
    expect(count(html, '<h1')).toBe(1);
    for (const needle of [
      'The address is stored unconfirmed.',
      'No mail goes out until a provider is chosen and confirmed opt-in is enabled.',
      'Anyone who can read a link can read the address in it.',
      'at most 30 days',
      'provider access and refresh tokens',
      'deleted from the account page in one action',
      'data-open-item="contact-address"',
      'runs no analytics',
      'orientation self-check',
      'deleting your account does not remove it',
    ]) {
      expect(html).toContain(needle);
    }
    expect(html).not.toContain('data-placeholder');
  });

  test('not-found page says so and links home and to the modules from its body', async () => {
    const html = await render(NotFoundPage, { request: new Request('http://localhost/missing'), routeType: 'page' });
    expect(html).toContain('That page does not exist.');
    // The header links to / and /modules on every page, so the assertions look inside main (section 8).
    const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
    expect(main).toContain('<a href="/">Go to the start page</a>');
    expect(main).toContain('<a href="/modules">Browse the modules</a>');
    expect(count(html, '<h1')).toBe(1);
  });
});
