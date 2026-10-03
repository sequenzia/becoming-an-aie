// astro.config.mjs
import { defineConfig, envField } from 'astro/config';
import node from '@astrojs/node';
import mdx from '@astrojs/mdx';
import preact from '@astrojs/preact';

// BUILD-TIME VALUES. Astro inlines every public server variable into dist/server as a constant
// when `astro build` runs (astro/dist/env/vite-plugin-env.js, getTemplates). Setting these in the
// container's environment has no effect. The Dockerfile passes them as build arguments.
//   SITE_URL         public origin; also drives security.allowedDomains below
//   FEATURE_ACCOUNTS false only for the Phase 0 image, which ships no sign-in
//   PREVIEW_DRAFTS   true only for local dev and the CI e2e build; never for the image
// `||` not `??`: an empty string from an unset CI variable must fall back too.
const siteUrl = process.env.SITE_URL || 'http://localhost:4321';
const siteHost = new URL(siteUrl).hostname;
const isLocalHost = siteHost === 'localhost' || siteHost === '127.0.0.1';

export default defineConfig({
  site: siteUrl,
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: { host: true },
  session: false,
  // One content data store for every command. `astro sync`, `astro check`, and `astro build` write it
  // to cacheDir (default node_modules/.astro), while Vite in serve mode (astro dev, Vitest) reads it
  // from .astro/. With both at .astro/, `npm test` (astro sync, then vitest) sees every collection
  // (astro/dist/content/paths.js getDataStoreFile; docs/decisions.md, 2026-10-03).
  cacheDir: './.astro/',
  integrations: [mdx(), preact()],
  markdown: {
    // Off, so .md and .mdx bodies render the straight quotes the .astro templates use and the same thesis
    // sentence is typeset one way across the site. Sätteri's smart punctuation also turns `--` and `---` into
    // dashes, which the source-level em-dash lint never sees; off keeps the no-em-dash rule true in the
    // output as well (docs/decisions.md, 2026-10-03). @astrojs/mdx inherits this setting.
    // Astro 7.3.2 prints a deprecation line for this key on every command. The replacement,
    // `processor: satteri({ features: { smartPunctuation: false } })`, needs `satteri` imported from
    // `@astrojs/markdown-satteri`, which is astro's dependency and not this project's; declaring it is a new
    // dependency and waits for the author (docs/dependencies.md). The key works until the next Astro major.
    smartypants: false,
    // Code blocks follow the brief's mono rule: primary text on the code ground, the face alone marks them
    // (docs/research/design-tokens.md, section 4). Shiki's css-variables theme writes var(--astro-code-*)
    // references instead of a palette, and src/styles/tokens.css maps every one of them to the site's tokens, so
    // both themes pass the contrast check and no hex color reaches the page. The default github-dark theme put
    // #6A737D comments on #24292e (3.04:1) and its own background over --color-code-bg. Shiki still writes
    // tabindex="0" and data-language on the pre (docs/decisions.md, 2026-10-03).
    shikiConfig: { theme: 'css-variables' },
  },
  security: {
    checkOrigin: true,
    // Hostname only, no protocol. Behind the OpenShift edge route the socket is plain HTTP, so a
    // protocol match on the Host header would fail. With this set, FetchState honors
    // X-Forwarded-Proto and X-Forwarded-For for this host, which makes url.origin https and
    // clientAddress the real client. See section 0.2 fact 5 and docs/research/testing-ci.md 6.1.
    allowedDomains: isLocalHost ? [] : [{ hostname: siteHost }],
    // Largest action body. Workshop responses are at most 20,000 characters (section 7.6).
    actionBodySizeLimit: 256 * 1024,
  },
  env: {
    // Every secret is optional here. src/lib/env.ts enforces presence at first use.
    // Reason: astro:env/server validates secrets when the module loads, and middleware
    // and prerendered pages load during astro build with no secrets present.
    // access: 'public'  = build-time constant (see the note at the top of this file)
    // access: 'secret'  = read from process.env when the server starts
    schema: {
      SITE_URL: envField.string({ context: 'server', access: 'public', url: true, default: 'http://localhost:4321' }),
      FEATURE_ACCOUNTS: envField.boolean({ context: 'server', access: 'public', default: true }),
      PREVIEW_DRAFTS: envField.boolean({ context: 'server', access: 'public', default: false }),
      // Runtime values that are not sensitive but must vary per environment. Declared secret so
      // they are read at runtime. Never inlined.
      BETTER_AUTH_URL: envField.string({ context: 'server', access: 'secret', url: true, optional: true }),
      EMAIL_PROVIDER: envField.enum({ context: 'server', access: 'secret', values: ['none'], default: 'none' }),
      PG_CA_FILE: envField.string({ context: 'server', access: 'secret', optional: true }),
      PGLITE_DATA_DIR: envField.string({ context: 'server', access: 'secret', optional: true }),
      // Real secrets.
      DATABASE_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
      BETTER_AUTH_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
      NOTIFY_TOKEN_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
      GITHUB_CLIENT_ID: envField.string({ context: 'server', access: 'secret', optional: true }),
      GITHUB_CLIENT_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
      GOOGLE_CLIENT_ID: envField.string({ context: 'server', access: 'secret', optional: true }),
      GOOGLE_CLIENT_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
});
