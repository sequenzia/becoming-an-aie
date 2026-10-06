// scripts/vercel-preview.mjs
// Plain Node, no packages. The build command for the static preview on Vercel (vercel.json).
// OpenShift stays the deployment (docs/decisions.md, decision 1); this script never runs in the image or CI.
//
// Usage: node scripts/vercel-preview.mjs
//
// What it does, in order:
// 1. Runs `npm run build` with FEATURE_ACCOUNTS=false and without PREVIEW_DRAFTS, so the prerendered pages
//    carry no sign-in link and no mark-complete form. SITE_URL comes from the environment, else from Vercel's
//    VERCEL_PROJECT_PRODUCTION_URL, else the astro.config.mjs default.
// 2. Writes dist/client/notify/closed/index.html from the built 404 page, so it keeps the site's styles.
//    vercel.json sends the notify form's POST there with a 303. The preview has no server, so nothing is stored,
//    and the page says so instead of the thanks page's "We stored your address".
// 3. Replaces dist/client/robots.txt with one that disallows everything, so the preview is not indexed.
//
// Vercel serves dist/client as static files. Every on-demand route is absent; dist/client/404.html answers.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const env = { ...process.env, FEATURE_ACCOUNTS: 'false' };
delete env.PREVIEW_DRAFTS;
const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
if (!env.SITE_URL && productionHost) env.SITE_URL = `https://${productionHost}`;
console.log(`vercel-preview: building with SITE_URL=${env.SITE_URL || '(astro.config.mjs default)'}`);

const build = spawnSync('npm', ['run', 'build'], { stdio: 'inherit', env });
if (build.status !== 0) process.exit(build.status ?? 1);

/** Replaces exactly one occurrence, so a change to the 404 page fails the build instead of shipping it. */
function replaceOnce(html, from, to) {
  const count = html.split(from).length - 1;
  if (count !== 1) {
    console.error(`vercel-preview: expected one ${JSON.stringify(from)} in dist/client/404.html, found ${count}`);
    process.exit(1);
  }
  return html.replace(from, to);
}

const notFound = readFileSync('dist/client/404.html', 'utf8');
const prose = notFound.match(/<div class="prose">[\s\S]*?<\/div>/);
if (!prose) {
  console.error('vercel-preview: no <div class="prose"> in dist/client/404.html');
  process.exit(1);
}

let closed = notFound;
closed = replaceOnce(closed, '<title>Not found ·', '<title>Sign-ups open at launch ·');
closed = replaceOnce(
  closed,
  '<meta name="description" content="That page does not exist.">',
  '<meta name="description" content="This preview does not collect addresses.">',
);
closed = replaceOnce(closed, '<p class="kicker">Not found</p>', '<p class="kicker">Launch notifications</p>');
closed = replaceOnce(
  closed,
  '<h1 class="page-title">That page does not exist.</h1>',
  '<h1 class="page-title">Sign-ups open at launch</h1>',
);
closed = replaceOnce(
  closed,
  prose[0],
  '<div class="prose">' +
    '<p>This is a preview of the site. It does not collect addresses, so nothing you entered was stored.</p>' +
    '<p>The program is free and self-paced. Published modules are open to read without an account.</p>' +
    '<ul><li><a href="/">Back to the program</a></li>' +
    '<li><a href="/modules/orientation">Read the orientation module</a></li></ul>' +
    '</div>',
);

mkdirSync('dist/client/notify/closed', { recursive: true });
writeFileSync('dist/client/notify/closed/index.html', closed);
writeFileSync('dist/client/robots.txt', '# Preview deployment. Not for crawlers.\nUser-agent: *\nDisallow: /\n');
console.log('vercel-preview: wrote dist/client/notify/closed/index.html and dist/client/robots.txt');
