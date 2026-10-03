# Astro 7 cheat sheet for the content-first site

Verified on 2026-09-15. Every snippet below comes from a fetched doc page or from the published package source. The source is named next to each snippet. Items I could not verify are marked UNVERIFIED.

Verification tools used:
- ctx7 library id `/withastro/docs` (Astro docs, source reputation High, 5999 snippets). Doc paths below are relative to `https://docs.astro.build/en/`.
- ctx7 library id `/bruits/satteri` (Sätteri docs).
- WebFetch of `docs.astro.build` pages where ctx7 returned only older upgrade guides.
- `npm view <pkg> version` for versions, `npm pack` plus reading `dist/` for `astro@7.3.2`, `@astrojs/mdx@8.0.1`, `@astrojs/node@11.1.5`, `@astrojs/markdown-satteri@0.4.1`.
- A live run of `satteri@0.10.3` to check unclosed tag behavior.

## 0. Confirmed package versions (npm view, 2026-09-15)

| Package | Version | Note |
| --- | --- | --- |
| astro | 7.3.2 | engines: node >=22.12.0, npm >=9.6.5. depends on vite ^8.0.13, zod ^4.5.4, @astrojs/compiler-rs ^0.4.0, @astrojs/markdown-satteri 0.4.1. optional dep sharp ^0.35.4. optional peer @astrojs/markdown-remark ^7.3.0 |
| @astrojs/node | 11.1.5 | peer astro ^7.2.1 |
| @astrojs/mdx | 8.0.1 | peer astro ^7.2.6, @astrojs/markdown-satteri ^0.4.0, @astrojs/markdown-remark ^7.3.0 marked optional in peerDependenciesMeta. depends on @astrojs/markdown-satteri 0.4.1 |
| @astrojs/preact | 6.0.5 | peer preact ^10.6.5 |
| preact | 10.29.8 | |
| @astrojs/markdown-satteri | 0.4.1 | pulled in by astro. depends on satteri ^0.10.3, github-slugger ^2.0.0 |
| @astrojs/markdown-remark | 7.3.1 | only needed for remark or rehype plugins. not needed for this project |
| @astrojs/check | 0.9.10 | peer typescript ^5.0.0 or ^6.0.0. TypeScript 7 is NOT accepted |
| typescript | 7.0.2 latest. Use 6.0.3 (or 5.9.3) | @astrojs/check 0.9.10 rejects 7.x |
| vitest | 5.0.1 | engines node ^22.12.0 or ^24.0.0 or >=26. peer vite ^6.4.0 or ^7.0.0 or ^8.0.0 |
| zod | 4.6.5 | not needed as a direct dependency. `astro/zod` re-exports `zod/v4` |
| @electric-sql/pglite | 0.5.8 | dev dependency for tests. needs approval |
| drizzle-orm | 0.45.2 | peer @electric-sql/pglite >=0.2.0, @types/pg * |
| pg | 8.23.0 | |
| better-auth | 1.7.5 | |

Node 24 satisfies astro, vitest, and @astrojs/check.

---

## 1. astro.config, server output, Node adapter, prerender

### 1.1 Config file

Doc: `guides/deploy/sevalla` (config snippet), `guides/integrations-guide/node` (adapter), `guides/integrations-guide/mdx`, `guides/integrations-guide/preact`.

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import mdx from '@astrojs/mdx';
import preact from '@astrojs/preact';

export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
  server: {
    host: true
  },
  integrations: [mdx(), preact()],
});
```

The `server.host: true` line makes the dev and preview servers listen on all addresses. The docs add it for containers. The standalone production server reads `HOST` and `PORT` from the environment instead (see 1.4).

### 1.2 What `output: 'server'` means

Doc: `guides/on-demand-rendering`.

Quoted: "set your build output configuration to `output: 'server'` to server-render all your pages by default. This is the equivalent of opting out of prerendering on every page."

Quoted: "The `'server'` output mode does not bring any additional functionality. It only switches the default rendering behavior."

### 1.3 Mark public pages prerendered, leave the rest on demand

Doc: `guides/on-demand-rendering`, `guides/routing`.

Prerendered page (static at build time):

```astro
---
export const prerender = true
---
<html>
<!--
`output: 'server'` is configured, but this page is static!
The rest of my site is rendered on demand!
-->
</html>
```

On-demand page in server mode needs nothing. The docs show the opt-out only for static mode:

```astro
---
export const prerender = false; // Not needed in 'server' mode
const { resource, id } = Astro.params;
---
<h1>{resource}: {id}</h1>
```

Prerendered dynamic routes from a collection need `getStaticPaths()` (doc: `guides/content-collections`):

```astro
---
import { getCollection, render } from 'astro:content';
// 1. Generate a new path for every collection entry
export async function getStaticPaths() {
  const posts = await getCollection('blog');
  return posts.map(post => ({
    params: { id: post.id },
    props: { post },
  }));
}
// 2. For your template, you can get the entry directly from the prop
const { post } = Astro.props;
const { Content } = await render(post);
---
<h1>{post.data.title}</h1>
<Content />
```

Add `export const prerender = true` to that file in server mode. Pages that host an action form must stay on demand. Quoted from `guides/actions`: "Pages must be on-demand rendered when calling actions using a form action."

### 1.4 Node adapter in standalone mode

Doc: `guides/integrations-guide/node`.

- `mode: 'standalone'` "builds a server that automatically starts when the entry module is run."
- Run it: `HOST=0.0.0.0 PORT=4321 node ./dist/server/entry.mjs`
- Source check (`@astrojs/node@11.1.5/dist/standalone.js`): `const port = process.env.PORT ? Number(process.env.PORT) : options.port ?? 8080;` and `const host = process.env.HOST ?? hostOptions(options.host);`. Set both explicitly in the container.
- Quoted: "When using the `astro:env` secrets or `process.env` at runtime, neither Astro nor the adapter loads environment variables for you." OpenShift injects env vars into the container, which is enough.
- HTTPS: `SERVER_KEY_PATH=./private/key.pem SERVER_CERT_PATH=./private/cert.pem node ./dist/server/entry.mjs`. Not needed behind the OpenShift router.
- Other options (types.d.ts): `experimentalDisableStreaming?: boolean`, `staticHeaders?: boolean`, `bodySizeLimit?: number` (default 1 GB per docs).
- `astro preview` is supported. Source: `@astrojs/node@11.1.5/dist/index.js` sets `previewEntrypoint: "@astrojs/node/preview.js"`.
- Sessions: "Astro uses the local filesystem for session storage when using the Node adapter." See section 9.

### 1.5 Dockerfile from the docs (multi-stage, SSR)

Doc: `recipes/docker`.

```dockerfile
FROM node:lts AS base
WORKDIR /app
COPY package.json package-lock.json ./

FROM base AS prod-deps
RUN npm install --omit=dev

FROM base AS build-deps
RUN npm install

FROM build-deps AS build
COPY . .
RUN npm run build

FROM base AS runtime
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
ENV HOST=0.0.0.0
ENV PORT=4321
EXPOSE 4321
CMD ["node", "./dist/server/entry.mjs"]
```

`.dockerignore` from the same recipe:

```
.DS_Store
node_modules
dist
```

For Node 24 replace `node:lts` with `node:24`. UNVERIFIED: whether OpenShift's random UID needs extra `chmod` on `/app`; that is an OpenShift concern, not an Astro one. Note that `sharp` is an optional dependency of astro; `npm install --omit=dev` still installs optional deps.

### 1.6 Markdown pipeline in Astro 7 and what MDX needs

Doc: `guides/upgrade-to/v7`, `guides/markdown-content`, `guides/integrations-guide/mdx`.

Quoted from the v7 guide: "Astro now renders your `.md` and `.mdx` files with Sätteri, its native Markdown pipeline, instead of the remark/rehype pipeline. As a result, `@astrojs/markdown-remark` is no longer installed by default."

Quoted: "If you don't use remark or rehype plugins, you don't need to do anything. Your Markdown and MDX will now be rendered by Sätteri."

Quoted: "The deprecated `markdown.remarkPlugins`, `markdown.rehypePlugins`, and `markdown.remarkRehype` options still work, but now also require `@astrojs/markdown-remark` to be installed."

Quoted from `guides/markdown-content`: "Note: `remarkPlugins` and `rehypePlugins` are not top-level keys; they're passed within processor configuration objects instead." (WebFetch summary of the page.)

Answer for this project: `@astrojs/mdx@8.0.1` works with Sätteri and does not need `@astrojs/markdown-remark`. Source proof from `@astrojs/mdx@8.0.1/dist/index.js`:

```js
const configuredProcessor = partialMdxOptions.processor ?? (extendMarkdownConfig ? config.markdown.processor : void 0);
let processor = configuredProcessor ?? satteri();
if (hasLegacyMdxPluginOptions(partialMdxOptions)) {
  // ... dynamically imports "@astrojs/markdown-remark" only here
}
```

`LEGACY_PLUGIN_OPTIONS = ["remarkPlugins", "rehypePlugins", "remarkRehype", "recmaPlugins"]`. Only those trigger the unified import. The import is wrapped in try/catch, and a warning is logged if the package is missing. `@astrojs/markdown-remark` is `optional: true` in `peerDependenciesMeta`.

MDX is compiled by Sätteri too. The mdx package depends only on `es-module-lexer`, `@astrojs/internal-helpers`, and `@astrojs/markdown-satteri`. There is no `@mdx-js/mdx` dependency.

Explicit processor config, if ever needed (doc: `guides/markdown-content`):

```js
import { defineConfig } from "astro/config";
import { satteri } from "@astrojs/markdown-satteri";

export default defineConfig({
  markdown: {
    processor: satteri(),
  },
});
```

MDX override (doc: `guides/integrations-guide/mdx`):

```js
import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import mdx from '@astrojs/mdx';
import { myMdastPlugin } from './my-satteri-plugin.mjs';

export default defineConfig({
  // ...
  markdown: {
    shikiConfig: { theme: 'rose-pine' },
  },
  integrations: [
    mdx({
      // Use a different syntax highlighting theme.
      shikiConfig: { theme: 'dracula' },
      // Add a plugin and disable GitHub-flavored Markdown.
      processor: satteri({
        mdastPlugins: [myMdastPlugin()],
        features: { gfm: false },
      }),
    }),
  ],
});
```

Sätteri options (doc: `guides/markdown-content`): `mdastPlugins` (Markdown tree), `hastPlugins` (HTML tree), `features` such as `{ gfm: true, smartPunctuation: true }`. Heading ids "are generated based on `github-slugger`". Source check: `@astrojs/markdown-satteri@0.4.1/dist/satteri-processor.js` imports `github-slugger` and sets `gfm: gfm !== false, smartPunctuation: smartypants !== false`.

A Sätteri mdast plugin example (ctx7 `/bruits/satteri`, README):

```ts
import { markdownToHtml, defineMdastPlugin } from "satteri";

const stripInlineCode = defineMdastPlugin({
  name: "strip-inline-code",
  inlineCode(node, ctx) {
    ctx.replaceNode(node, { type: "text", value: node.value });
  },
});
```

Only unified needs `@astrojs/markdown-remark`:

```js
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';

export default defineConfig({
  markdown: {
    processor: unified(),
  },
});
```

`mdx({ recmaPlugins })` is deprecated and requires the unified processor. Do not use it.

---

## 2. Content collections

Doc: `guides/content-collections`, `reference/modules/astro-content`, `reference/content-loader-reference`, `guides/upgrade-to/v6` (zod import change).

### 2.1 Which `z` to import

The v6 upgrade guide deprecated `z` from `astro:content` and `astro:schema`. Quoted: "Remove `z` from your `astro:content` imports and import `z` separately from `astro/zod` instead."

```ts
import { defineCollection } from "astro:content"
import { z } from "astro/zod"
```

`astro/zod` is zod 4. Source: `astro@7.3.2/dist/zod.js` is `export * from "zod/v4"` plus `export { mod as z }`. astro depends on `zod ^4.5.4`. Zod 4 APIs like `z.email()` and `z.url()` are used in the docs. Do not add `zod` as a separate dependency unless the app needs it outside Astro.

### 2.2 `src/content.config.ts` with glob loader, schema, and `reference()`

Doc snippet (`guides/content-collections`):

```ts
import { defineCollection, reference } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    // Reference a single author from the `authors` collection by `id`
    author: reference("authors"),
    // Reference an array of related posts from the `blog` collection by `id`
    relatedPosts: z.array(reference("blog")),
  }),
});

const authors = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/data/authors" }),
  schema: z.object({
    name: z.string(),
    portfolio: z.url(),
  }),
});

export const collections = { blog, authors };
```

Frontmatter that sets references by id:

```yaml
---
title: "Welcome to my blog"
author: ben-holmes # references `src/data/authors/ben-holmes.json`
relatedPosts:
- about-me # references `src/content/blog/about-me.md`
- my-year-in-review # references `src/content/blog/my-year-in-review.md`
---
```

Project shape (derived from the snippet above, same API):

```ts
// src/content.config.ts
import { defineCollection, reference } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const artifacts = defineCollection({
  loader: glob({ base: "./src/content/artifacts", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    draft: z.boolean().default(false),
  }),
});

const modules = defineCollection({
  loader: glob({ base: "./src/content/modules", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    order: z.number().int(),
    draft: z.boolean().default(false),
    artifacts: z.array(reference("artifacts")).default([]),
  }),
});

export const collections = { artifacts, modules };
```

### 2.3 How ids are generated

Doc: `reference/content-loader-reference`, `guides/content-collections`.

- Quoted: "every content entry `id` is automatically generated in a URL-friendly format based on the content filename."
- Quoted: "By default it uses `github-slugger` to generate a slug with kebab-cased words." The id is the file path relative to `base`, without extension, lowercased. Nested folders stay in the id (docs example filters with `id.startsWith('en/')`).
- Override one entry: add a `slug` property in frontmatter.
- Override the rule: `generateId: ({ entry }) => entry.replace(/\.json$/, "")` keeps uppercase.
- Files whose name starts with `_` can be excluded with the pattern `'**/[^_]*.{md,mdx}'` (v6 upgrade guide snippet).

### 2.4 Query with a draft filter

Doc: `guides/content-collections`.

```astro
---
// Example: Filter out content entries with `draft: true`
import { getCollection } from 'astro:content';
const publishedBlogEntries = await getCollection('blog', ({ data }) => {
  return data.draft !== true;
});
---
```

### 2.5 `getEntry`, `getEntries`, resolving references

Doc: `guides/content-collections`.

```astro
---
import { getEntry, getEntries } from "astro:content";

// First, query a blog post
const blogPost = await getEntry("blog", "Adventures in Space");

// If the blog post doesn't exist, throw an error
if (!blogPost) {
  throw new Error("Blog post not found");
}

// Retrieve a single reference item: the blog post's author
// Equivalent to querying `{collection: "authors", id: "ben-holmes"}`
const author = await getEntry(blogPost.data.author);

// Retrieve an array of referenced items: all the related posts
// Equivalent to querying `[{collection: "blog", id: "visiting-mars"}, {collection: "blog", id: "leaving-earth-for-the-first-time"}]`
const relatedPosts = await getEntries(blogPost.data.relatedPosts);
---
```

A reference value in `data` is `{ collection, id }`. `getEntry(ref)` and `getEntries(refs)` resolve them.

### 2.6 `render(entry)` for Content and headings

Doc: `reference/modules/astro-content`.

```astro
---
import { getEntry, render } from 'astro:content';
const entry = await getEntry('blog', 'entry-1');

if (!entry) {
  throw new Error('Could not find blog post 1');
}
const { Content, headings, remarkPluginFrontmatter } = await render(entry);
---
```

Return shape (same doc): `<Content />` component, `headings` (a generated list of headings), `remarkPluginFrontmatter` (typed `any`, frontmatter after processor plugins ran).

`headings` type is `MarkdownHeading[]`. Doc (`reference/content-loader-reference`): "Each heading is described by a `depth` determined by the heading level (`h1 -> h6`), a `slug` generated with `github-slugger`, and its `text` content." The MDX guide gives the shape `{ depth: number; slug: string; text: string }[]`. Type import: `import type { MarkdownHeading } from 'astro'` (source: `astro@7.3.2/dist/types/public/index.d.ts` re-exports it).

### 2.7 Pass components to MDX content

Doc: `guides/integrations-guide/mdx`.

```astro
---
import { getEntry, render } from "astro:content";
import CustomHeading from "../../components/CustomHeading.astro";
const entry = await getEntry("blog", "post-1");
if (!entry) {
  throw new Error("Entry not found");
}
const { Content } = await render(entry);
---

<Content components={{ h1: CustomHeading }} />
```

Spread form from the same doc: `<Content components={{ ...components, h1: CustomHeading }} />`. Preact islands can be passed the same way when the MDX file uses them as tags. Alternatively, an MDX file can `import` a component directly.

### 2.8 Template-section check with headings

Built from the verified `render()` return shape and `getCollection` API. The check itself is project code.

```ts
// src/lib/content/sections.ts
import { getCollection, render } from 'astro:content';
import type { MarkdownHeading } from 'astro';

export const REQUIRED_MODULE_SECTIONS = ['Why this matters', 'Self-check'] as const;

export function missingSections(headings: MarkdownHeading[], required: readonly string[]) {
  const h2 = new Set(headings.filter((h) => h.depth === 2).map((h) => h.text.trim()));
  return required.filter((name) => !h2.has(name));
}

export async function auditModules() {
  const modules = await getCollection('modules', ({ data }) => data.draft !== true);
  const report: Array<{ id: string; missing: string[] }> = [];
  for (const entry of modules) {
    const { headings } = await render(entry);
    const missing = missingSections(headings, REQUIRED_MODULE_SECTIONS);
    if (missing.length) report.push({ id: entry.id, missing });
  }
  return report;
}
```

`render()` runs inside Astro's Vite pipeline. Call this from a page, an endpoint, or a vitest test that uses `getViteConfig` (section 8). `missingSections` is a pure function and can be tested without Astro.

### 2.9 Types

`import type { CollectionEntry, CollectionKey, SchemaContext } from 'astro:content'` (doc: `reference/modules/astro-content`). Example: `CollectionEntry<'modules'>`. Entries are plain serializable objects with `id`, `data`, `body`, and `collection`. Run `astro sync` to regenerate types after schema changes.

---

## 3. Astro Actions

Doc: `guides/actions`, `reference/modules/astro-actions`. Source: `astro@7.3.2/dist/actions/runtime/server.js`, `client.js`, `types.d.ts`.

### 3.1 Define an action

```ts
// src/actions/index.ts
import { defineAction, ActionError } from "astro:actions";
import { z } from "astro/zod";

export const server = {
  likePost: defineAction({
    input: z.object({ postId: z.string() }),
    handler: async (input, ctx) => {
      if (!ctx.cookies.has('user-session')) {
        throw new ActionError({
          code: "UNAUTHORIZED",
          message: "User must be logged in.",
        });
      }
      // Otherwise, like the post
    },
  }),
};
```

`defineAction` options (reference doc): `input` optional Zod validator, `accept: "form" | "json"` (default `json`), `handler: (input, context) => TOutput | Promise<TOutput>`.

The handler context type from source (`types.d.ts`):

```ts
export type ActionAPIContext = Pick<APIContext, 'request' | 'url' | 'isPrerendered' | 'locals' | 'clientAddress' | 'cookies' | 'currentLocale' | 'generator' | 'routePattern' | 'site' | 'params' | 'preferredLocale' | 'preferredLocaleList' | 'originPathname' | 'session' | 'cache' | 'csp' | 'logger'>;
```

So `context.locals`, `context.cookies`, `context.request`, `context.clientAddress`, and `context.session` are all available. `props`, `getActionResult`, `callAction`, and `redirect` are stripped from the action context (source: `omitKeys` in `getActionContext`). Redirect from the caller, not from the handler.

Form-accepting action:

```ts
import { defineAction } from 'astro:actions';
import { z } from 'astro/zod';

export const server = {
  newsletter: defineAction({
    accept: 'form',
    input: z.object({
      email: z.email(),
      terms: z.boolean(),
    }),
    handler: async ({ email, terms }) => { /* ... */ },
  })
}
```

Form data coercion rules, from the docs page summary plus the source `formDataToObject`:
- Checkbox with `z.boolean()`: `"true"` gives true, `"false"` gives false, otherwise presence of the key gives true. Docs say checkboxes validate with `z.coerce.boolean()`; the source handles plain `z.boolean()` too.
- File inputs: `z.instanceof(File)`.
- Empty values become `null`, or `undefined` when the field is `.optional()`.
- `z.number()` fields are converted with `Number(value)`.
- `z.array()` fields use `formData.getAll(key)`.
- `z.object()` nesting uses dotted names like `address.city`.
- A form action given JSON, or a JSON action given FormData, throws `UNSUPPORTED_MEDIA_TYPE`.

### 3.2 ActionError codes

Reference doc: "A union type of standard HTTP status codes defined by IANA using the human-readable versions as uppercase strings separated by an underscore (e.g. `BAD_REQUEST` or `PAYLOAD_TOO_LARGE`)."

Full list from source `client.js` (`codeToStatusMap`):

```
BAD_REQUEST 400, UNAUTHORIZED 401, PAYMENT_REQUIRED 402, FORBIDDEN 403, NOT_FOUND 404,
METHOD_NOT_ALLOWED 405, NOT_ACCEPTABLE 406, PROXY_AUTHENTICATION_REQUIRED 407,
REQUEST_TIMEOUT 408, CONFLICT 409, GONE 410, LENGTH_REQUIRED 411, PRECONDITION_FAILED 412,
CONTENT_TOO_LARGE 413, URI_TOO_LONG 414, UNSUPPORTED_MEDIA_TYPE 415,
RANGE_NOT_SATISFIABLE 416, EXPECTATION_FAILED 417, MISDIRECTED_REQUEST 421,
UNPROCESSABLE_CONTENT 422, LOCKED 423, FAILED_DEPENDENCY 424, TOO_EARLY 425,
UPGRADE_REQUIRED 426, PRECONDITION_REQUIRED 428, TOO_MANY_REQUESTS 429,
REQUEST_HEADER_FIELDS_TOO_LARGE 431, UNAVAILABLE_FOR_LEGAL_REASONS 451,
INTERNAL_SERVER_ERROR 500, NOT_IMPLEMENTED 501, BAD_GATEWAY 502, SERVICE_UNAVAILABLE 503,
GATEWAY_TIMEOUT 504, HTTP_VERSION_NOT_SUPPORTED 505, VARIANT_ALSO_NEGOTIATES 506,
INSUFFICIENT_STORAGE 507, LOOP_DETECTED 508, NETWORK_AUTHENTICATION_REQUIRED 511
```

Note the 413 code is `CONTENT_TOO_LARGE` in 7.3.2 source, not `PAYLOAD_TOO_LARGE` as the reference doc's example says. Use `CONTENT_TOO_LARGE`. `ActionError` has `code`, `status`, `message`, and static `codeToStatus(code)` and `statusToCode(status)`.

Input validation failures become `ActionInputError` with `code: "BAD_REQUEST"`, `issues` (Zod issues), and `fields` (map of first path segment to message list). Any non-ActionError thrown in a handler becomes `INTERNAL_SERVER_ERROR` with the original message (source: `callSafely`).

Helpers: `isInputError(error)` and `isActionError(error)` from `astro:actions`. `error instanceof ActionError` also works on the client.

### 3.3 Result shape

Source `types.d.ts`:

```ts
export type SafeResult<TInput extends ErrorInferenceObject, TOutput> = {
    data: TOutput;
    error: undefined;
} | {
    data: undefined;
    error: ActionError<TInput>;
};
```

Every action client has `orThrow(input)` that returns `data` or throws. Actions with an input schema also expose `queryString` and stringify to it (source: `toString: () => action.queryString`), which is why `action={actions.name}` works in a form.

Returned data is serialized with devalue (`application/json+devalue`). Returning `undefined` sends 204. Returning a `Response` throws a build error; redirect from the caller instead.

### 3.4 Call from an HTML form with progressive enhancement

Doc: `guides/actions`.

```astro
---
import { actions } from 'astro:actions';
---

<form method="POST" action={actions.logout}>
  <button>Log out</button>
</form>
```

Quoted: "Pages must be on-demand rendered when calling actions using a form action." Quoted: this "will set the `action` attribute to use a query string that is handled by the server automatically." The query parameter is `_action=<name>` (source: `ACTION_QUERY_PARAMS.actionName = "_action"`).

Read the result on the same page after the POST:

```astro
---
import { actions } from 'astro:actions';

const result = Astro.getActionResult(actions.newsletter);
---

{result?.error && (
  <p class="error">Unable to sign up. Please try again later.</p>
)}
<form method="POST" action={actions.newsletter}>
  <label>
    E-mail
    <input required type="email" name="email" />
  </label>
  <button>Sign up</button>
</form>
```

Field-level errors:

```astro
---
import { actions, isInputError } from 'astro:actions';

const result = Astro.getActionResult(actions.newsletter);
const inputErrors = isInputError(result?.error) ? result.error.fields : {};
---

<form method="POST" action={actions.newsletter}>
  <label>
    E-mail
    <input required type="email" name="email" aria-describedby="error" />
  </label>
  {inputErrors.email && <p id="error">{inputErrors.email.join(',')}</p>}
  <button>Sign up</button>
</form>
```

Redirect on success (docs, v5 upgrade guide example, adapted to `Astro.redirect`):

```astro
---
import { actions } from 'astro:actions';

const result = Astro.getActionResult(actions.newsletter);
if (result && !result.error) {
  return Astro.redirect('/confirmation');
}
---
```

Enhance the same form with a client script (doc: `guides/actions`):

```astro
<form>
  <label for="email">E-mail</label>
  <input id="email" required type="email" name="email" />
  <label>
    <input required type="checkbox" name="terms">
    I agree to the terms of service
  </label>
  <button>Sign up</button>
</form>

<script>
  import { actions } from 'astro:actions';
  import { navigate } from 'astro:transitions/client';

  const form = document.querySelector('form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const { error } = await actions.newsletter(formData);
    if (!error) navigate('/confirmation');
  })
</script>
```

Keep `method="POST" action={actions.newsletter}` on the form so it still works without JavaScript. A form action with `accept: 'form'` receives the `FormData` either way.

Avoid the "confirm form resubmission" dialog with POST, Redirect, GET in middleware. The docs example uses Netlify Blob; the same pattern with `getActionContext` is in section 3.8.

### 3.5 Call from the client (script or Preact island)

Doc: `guides/actions`, `reference/modules/astro-actions`.

```astro
<script>
import { ActionError, actions } from 'astro:actions';

async () => {
  const { data, error } = await actions.myAction({ /* ... */ });
  if (error instanceof ActionError) {
    // Handle action-specific errors
    console.log(error.code);
  }
}
</script>
```

Quoted: "It's best to check if an `error` is present before using the `data` property."

The docs only ship a React helper (`withState` from `@astrojs/react/actions`). `@astrojs/preact@6.0.5` exports `.`, `./container-renderer`, `./client.js`, `./client-dev.js`, `./server.js`, and `./package.json`. There is no Preact actions helper. In a Preact island, import `actions` from `astro:actions` and call it directly. Example built on the documented client call:

```tsx
// src/components/SelfCheck.tsx
import { useState } from 'preact/hooks';
import { actions, isInputError } from 'astro:actions';

type Props = { moduleId: string; questions: Array<{ id: string; prompt: string }> };

export default function SelfCheck({ moduleId, questions }: Props) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function onSubmit(event: Event) {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    setStatus('saving');
    const { data, error } = await actions.saveSelfCheck(new FormData(form));
    if (error) {
      setStatus('error');
      setMessage(isInputError(error) ? Object.values(error.fields).flat().join(' ') : error.message);
      return;
    }
    setStatus('saved');
    setMessage(`Saved ${data.answered} answers`);
  }

  return (
    <form method="POST" action={actions.saveSelfCheck.queryString} onSubmit={onSubmit}>
      <input type="hidden" name="moduleId" value={moduleId} />
      {questions.map((q) => (
        <label key={q.id}>
          {q.prompt}
          <input type="checkbox" name={`answers.${q.id}`} />
        </label>
      ))}
      <button disabled={status === 'saving'}>Save</button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
```

`queryString` exists on actions that declare an input schema (source `types.d.ts`). Using it as the form `action` keeps the no-JS path working through the page's `Astro.getActionResult`. The nested `answers.<id>` names rely on the dotted-key object handling in `formDataToObject`, which needs `answers: z.object({...})` or a schema with `catchall` in the input. UNVERIFIED for a `z.record()` field; use `z.object` with known keys or a catchall.

Custom fetch when headers are needed (reference doc):

```astro
<script>
import { actions, getActionPath } from 'astro:actions'

await fetch(getActionPath(actions.like), {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer YOUR_TOKEN'
  },
  body: JSON.stringify({ id: 'YOUR_ID' }),
  keepalive: true
})
</script>
```

### 3.6 Call from server code

Doc: `guides/actions`.

```astro
---
import { actions } from 'astro:actions';

const searchQuery = Astro.url.searchParams.get('search');
if (searchQuery) {
  const { data, error } = await Astro.callAction(actions.findProduct, { query: searchQuery });
  // handle result
}
---
```

Quoted: "You can call actions directly from Astro component scripts using the `Astro.callAction()` wrapper (or `context.callAction()` when using a server endpoint)."

Calling `actions.x()` on the server without the wrapper throws `ActionCalledFromServerError` (source `errors-data.js`: "Action called from a server-rendered page or endpoint without using `Astro.callAction()`.").

### 3.7 Unit testing a handler

There is no documented API to invoke a handler outside a request. The docs have no testing section for actions (WebFetch of `guides/actions` confirmed no mention). Three approaches, from safest to most internal:

1. Recommended. Keep the logic in plain modules and test those. The action handler stays thin:

```ts
// src/lib/notify/subscribe.ts
export async function subscribe(db: Db, email: string, now = new Date()) { /* insert unconfirmed row */ }

// src/actions/index.ts
import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro/zod';
import { subscribe } from '../lib/notify/subscribe';
import { db } from '../lib/db';

export const server = {
  notifyMe: defineAction({
    accept: 'form',
    input: z.object({ email: z.email() }),
    handler: async ({ email }, ctx) => subscribe(db, email),
  }),
};
```

Test `subscribe` with vitest and pglite. No Astro runtime needed.

2. Integration test over HTTP against `astro preview` (or `astro dev`). Verified from source: the RPC route is `/_actions/[...path]` and the name is the path after `/_actions/`. POST JSON with `Content-Type: application/json`, or FormData for `accept: 'form'`. Success returns 200 with `Content-Type: application/json+devalue` (parse with `devalue`'s `parse`) or 204 for `undefined`. Errors return the mapped status with a JSON body `{ type, code, message, status }` or, for input errors, `{ type: "AstroActionInputError", issues, fields }`. `security.checkOrigin` only checks form and text/plain content types, so a JSON POST from a test does not need an Origin header. UNVERIFIED: whether preview honors `astro:env` secrets from a `.env` file; pass them as real env vars.

3. Direct invocation with a fake context. Verified against 7.3.2 source, but it uses an internal symbol and may break in a minor release. `defineAction` returns a function that requires `this` to carry `Symbol.for("astro.actionAPIContext") === true`. `createCallAction` does exactly `Reflect.set(context, SYMBOL, true); baseAction.bind(context)(input)`. So:

```ts
import { server } from '../src/actions';

const SYMBOL = Symbol.for('astro.actionAPIContext');

function fakeContext(overrides: Partial<Record<string, unknown>> = {}) {
  const ctx: Record<PropertyKey, unknown> = {
    request: new Request('http://localhost/'),
    url: new URL('http://localhost/'),
    locals: {},
    cookies: { has: () => false, get: () => undefined, set() {}, delete() {} },
    clientAddress: '127.0.0.1',
    ...overrides,
  };
  Reflect.set(ctx, SYMBOL, true);
  return ctx;
}

const fd = new FormData();
fd.set('email', 'a@b.co');
const result = await server.notifyMe.call(fakeContext(), fd); // { data, error }
```

Importing `src/actions/index.ts` in vitest requires `getViteConfig` so that `astro:actions` resolves (section 8). Treat this approach as a fallback only.

### 3.8 Middleware gating and POST, Redirect, GET

Doc: `guides/actions` (Gate actions from middleware):

```ts
import { defineMiddleware } from "astro:middleware";
import { getActionContext } from "astro:actions";

export const onRequest = defineMiddleware(async (context, next) => {
  const { action } = getActionContext(context);
  if (action?.calledFrom === "rpc") {
    if (!context.cookies.has("user-session")) {
      return new Response("Forbidden", { status: 403 });
    }
  }
  context.cookies.set("user-session", "session-token-value");
  return next();
});
```

Quoted: "Astro recommends authorizing user sessions from your action handler to respect permission levels and rate-limiting on a per-action basis."

`getActionContext(context)` returns `{ action, setActionResult, serializeActionResult, deserializeActionResult }`. `action` is `{ calledFrom: "rpc" | "form", name, handler: () => Promise<SafeResult> } | undefined`.

PRG pattern skeleton from the docs (storage swapped for this project):

```ts
import { defineMiddleware } from 'astro:middleware';
import { getActionContext } from 'astro:actions';

export const onRequest = defineMiddleware(async (context, next) => {
  // Skip requests for prerendered pages
  if (context.isPrerendered) return next();

  const { action, setActionResult, serializeActionResult } = getActionContext(context);

  // If an action was called from an HTML form action,
  // call the action handler and redirect to the destination page
  if (action?.calledFrom === "form") {
    const actionResult = await action.handler();
    // persist serializeActionResult(actionResult) keyed by a cookie id,
    // then on the next GET call setActionResult(name, stored) and clear it

    // Redirect back to the previous page on error
    if (actionResult.error) {
      const referer = context.request.headers.get("Referer");
      if (!referer) {
        throw new Error(
          "Internal: Referer unexpectedly missing from Action POST request.",
        );
      }
      return context.redirect(referer);
    }
    // Redirect to the destination page on success
    return context.redirect(context.originPathname);
  }

  return next();
});
```

The docs example stores the serialized result in Netlify Blob with a random cookie id. For this single-process deployment a `Map` in module scope or the Astro session store works. Without this middleware Astro still renders the result on the same page; the only cost is the resubmission dialog on refresh.

### 3.9 CSRF and body limits

Doc: `reference/configuration-reference`. `security.checkOrigin` defaults to `true` (source `schemas/defaults.js`). Quoted: the check runs "only for the requests `POST`, `PATCH`, `DELETE` and `PUT` with one of the following `content-type` headers: `'application/x-www-form-urlencoded'`, `'multipart/form-data'`, `'text/plain'`." A mismatch returns 403. `security.actionBodySizeLimit` exists in the schema (default not read; UNVERIFIED).

### 3.10 Rate limiting pattern

Not covered in the Astro docs. The building blocks are verified:
- `context.clientAddress` is on `ActionAPIContext`.
- The Node adapter only trusts `x-forwarded-for` when the request host validates against `security.allowedDomains`. Source `astro@7.3.2/dist/core/app/node.js`: `const forwardedClientIp = hostValidated ? getFirstForwardedValue(req.headers["x-forwarded-for"]) : void 0; const clientIp = forwardedClientIp || req.socket?.remoteAddress;` and `validateHost` returns `undefined` when `allowedDomains` is empty. Behind the OpenShift router `clientAddress` will be the router's IP unless `allowedDomains` lists the public hostname:

```js
// astro.config.mjs
export default defineConfig({
  security: {
    allowedDomains: [
      { hostname: 'aie.example.org', protocol: 'https' },
    ],
  },
});
```

Doc quote for `allowedDomains`: "When not configured, `X-Forwarded-Host` headers are not trusted and will be ignored." The source shows the same gate applies to `x-forwarded-for`.

- Single process is a stated decision, so an in-memory limiter is enough:

```ts
// src/lib/rate-limit.ts
const buckets = new Map<string, { count: number; resetAt: number }>();

export function take(key: string, limit: number, windowMs: number, now = Date.now()) {
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count += 1;
  return true;
}
```

```ts
// in a handler
import { ActionError } from 'astro:actions';
import { take } from '../lib/rate-limit';

handler: async (input, ctx) => {
  if (!take(`notify:${ctx.clientAddress}`, 5, 60_000)) {
    throw new ActionError({ code: 'TOO_MANY_REQUESTS', message: 'Try again in a minute.' });
  }
  // ...
}
```

`TOO_MANY_REQUESTS` maps to 429 (source). Pure function, unit testable.

---

## 4. Middleware

Doc: `guides/middleware`, `reference/api-reference`, `guides/authentication`, `guides/routing` (advanced routing).

### 4.1 `defineMiddleware` and `sequence`

```ts
import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  if(context.url.pathname === '/some-test-path') {
    return Response.json({
      ok: true
    });
  }

  return next();
});
```

```js
import { sequence } from "astro:middleware";

async function validation(_, next) {
    console.log("validation request");
    const response = await next();
    console.log("validation response");
    return response;
}

async function auth(_, next) {
    console.log("auth request");
    const response = await next();
    console.log("auth response");
    return response;
}

async function greeting(_, next) {
    console.log("greeting request");
    const response = await next();
    console.log("greeting response");
    return response;
}

export const onRequest = sequence(validation, auth, greeting);
```

Output order: `validation request, auth request, greeting request, greeting response, auth response, validation response`.

### 4.2 Typing `context.locals` with `App.Locals`

Doc: `guides/middleware`. File `src/env.d.ts`:

```ts
type User = {
  id: number;
  name: string;
};

declare namespace App {
  interface Locals {
    user: User;
    welcomeTitle: () => string;
    orders: Map<string, object>;
    session: import("./lib/server/session").Session | null;
  }
}
```

Source confirms `App.Locals` and `App.SessionData` are declared as empty global interfaces in `astro@7.3.2/dist/types/public/extendables.d.ts`, so this augmentation merges. `src/env.d.ts` is optional in Astro 5+; if the file is created it can also contain `/// <reference path="../.astro/types.d.ts" />` (doc: `guides/typescript`). `tsconfig.json` should be:

```json
{
  "extends": "astro/tsconfigs/base",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

Project shape for Better Auth:

```ts
// src/env.d.ts
declare namespace App {
  interface Locals {
    user: import("./lib/auth").SessionUser | null;
  }
}
```

### 4.3 Reading cookies, setting locals, redirecting

Cookie API (doc: `reference/api-reference`):
- `cookies.get(key, options?)` returns `AstroCookie | undefined` with `.value`, `.json()`, `.number()`, `.boolean()`.
- `cookies.has(key)`.
- `cookies.set(key, value, options?)` with `maxAge`, `httpOnly`, `path`, `sameSite`, `secure`, and so on.
- `cookies.delete(key, options?)` with `domain`, `path`, `httpOnly`, `sameSite`, `secure`.
- `cookies.merge(cookies)`.

Session-populating middleware from the docs (`guides/backend/scalekit`, trimmed):

```ts
import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
  const accessToken = context.cookies.get("sk-access-token")?.value;
  if (accessToken) {
    // validate, then
    context.locals.user = { sub: "...", email: "...", name: "..." };
  }
  return next();
});
```

Cookie set with options (same doc):

```ts
context.cookies.set("sk-access-token", newToken, {
  httpOnly: true,
  path: "/",
  sameSite: "lax",
  secure,
});
```

Redirect from an endpoint (doc: `guides/backend/firebase`):

```ts
import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ redirect, cookies }) => {
  cookies.delete("__session", {
    path: "/",
  });
  return redirect("/signin");
};
```

`context.redirect(path)` is the same function on the middleware context. The docs PRG example uses `return context.redirect(referer)`.

Other context fields verified: `context.isPrerendered` (skip SSR logic on prerendered pages), `context.originPathname`, `context.routePattern` (source doc comment: "The value when rendering `src/pages/blog/[slug].astro` will be `/blog/[slug]`."), `context.rewrite(...)` and `next(new Request(...))` for in-place rewrites, `context.session`.

### 4.4 Redirecting unauthenticated requests: the docs warning

Doc: `guides/authentication` and `guides/routing`, quoted:

"The public pathname a middleware sees is not guaranteed to be the same as the route Astro matches internally: a configured `base`, URL encoding, and duplicate slashes can all cause them to differ. An attacker can exploit that gap to reach a protected route with a pathname your check does not recognize.

Do not authorize requests by matching `context.url.pathname` against a string (e.g. `context.url.pathname === "/dashboard"` or `context.url.pathname.startsWith("/dashboard")`). Instead, restrict access on a router that matches routes for you."

Two safe options:

Option A. Check `context.routePattern` (the matched route, not the raw pathname) or put the check in the page itself. Middleware skeleton:

```ts
import { defineMiddleware } from 'astro:middleware';

const PROTECTED = new Set(['/account', '/account/[...rest]']);

export const onRequest = defineMiddleware(async (context, next) => {
  if (context.isPrerendered) return next();
  context.locals.user = await readUserFromCookies(context); // Better Auth session lookup
  if (PROTECTED.has(context.routePattern) && !context.locals.user) {
    return context.redirect('/login');
  }
  return next();
});
```

UNVERIFIED: the docs do not show `routePattern` used for auth; the field is documented and matches Astro's own route, which is what the warning asks for.

Option B. Advanced routing in `src/fetch.ts`, stable in v7. Doc: `guides/routing`.

```ts
import { Hono } from 'hono';
import { actions, middleware, pages, i18n } from 'astro/hono';

const app = new Hono();
app.use(actions());
app.use(middleware());
app.use(pages());
app.use(i18n());

export default app;
```

```ts
app.use('/dashboard', requireAuth);
app.use('/dashboard/*', requireAuth);

async function requireAuth(c, next) {
  if (!(await isLoggedIn(c.req.raw))) {
    return c.redirect('/login');
  }
  return next();
}
```

This adds `hono` as a dependency. The v7 guide says `src/fetch.ts` (or `.js`, `.mjs`, `.mts`) is now a reserved file name. `fetchFile: null` disables it. Without Hono the plain form is:

```ts
import { FetchState, astro } from 'astro/fetch';

export default {
  async fetch(request: Request): Promise<Response> {
    const state = new FetchState(request);
    const response = await astro(state);
    response.headers.set('X-Powered-By', 'Astro');
    return response;
  },
};
```

Recommendation: Option A for this site. Only two or three routes need a login.

---

## 5. `astro:env`

Doc: `guides/environment-variables`, `reference/modules/astro-env`, `reference/modules/astro-config`.

### 5.1 Schema

```js
import { defineConfig, envField } from "astro/config";

export default defineConfig({
  env: {
    schema: {
      API_URL: envField.string({ context: "client", access: "public", optional: true }),
      PORT: envField.number({ context: "server", access: "public", default: 4321 }),
      API_SECRET: envField.string({ context: "server", access: "secret" }),
    }
  }
})
```

Three kinds (quoted):
- "Public client variables: These variables end up in both your final client and server bundles, and can be accessed from both client and server through the `astro:env/client` module"
- "Public server variables: These variables end up in your final server bundle and can be accessed on the server through the `astro:env/server` module"
- "Secret server variables: These variables are not part of your final bundle and can be accessed on the server through the `astro:env/server` module"
- "Secret client variables are not supported".

Field types: `envField.string`, `envField.number`, `envField.boolean`, `envField.enum({ values: [...] })`. Common options: `optional`, `default`. String validators: `max`, `min`, `length`, `url`, `includes`, `startsWith`, `endsWith`. Number validators: `gt`, `lt`, `min`, `max`, `int`.

Quoted: "By default, all secrets are validated whenever anything is imported from the `astro:env/server` module. This means, secrets may be validated even when they are not imported. You may need to pass dummy environment variables to satisfy this validation during the build." `env.validateSecrets: true` validates on start instead.

Project schema (same API):

```js
env: {
  schema: {
    DATABASE_URL: envField.string({ context: "server", access: "secret", url: true }),
    BETTER_AUTH_SECRET: envField.string({ context: "server", access: "secret", min: 32 }),
    BETTER_AUTH_URL: envField.string({ context: "server", access: "public", url: true }),
    GITHUB_CLIENT_ID: envField.string({ context: "server", access: "secret" }),
    GITHUB_CLIENT_SECRET: envField.string({ context: "server", access: "secret" }),
    GOOGLE_CLIENT_ID: envField.string({ context: "server", access: "secret" }),
    GOOGLE_CLIENT_SECRET: envField.string({ context: "server", access: "secret" }),
    TOKEN_SIGNING_SECRET: envField.string({ context: "server", access: "secret", min: 32 }),
    PUBLIC_SITE_URL: envField.string({ context: "client", access: "public", url: true }),
  }
}
```

### 5.2 Reading in actions, middleware, and any server module

```js
import { API_SECRET } from "astro:env/server";
```

The docs show this import in component frontmatter and endpoints; `src/actions/index.ts` and `src/middleware.ts` are server modules and use the same import. `getSecret(key)` from `astro:env/server` reads a secret that is not in the schema at runtime.

At runtime with the Node adapter nothing loads `.env`. Quoted: "neither Astro nor the adapter loads environment variables for you." Use real env vars in OpenShift, `node --env-file=.env ./dist/server/entry.mjs` locally (Node flag; UNVERIFIED in the Astro docs, which show `npx @dotenvx/dotenvx run -- node ./dist/server/entry.mjs`).

---

## 6. Preact islands

Doc: `guides/integrations-guide/preact`, `guides/framework-components`, `reference/directives-reference`, `concepts/islands`.

### 6.1 Install

```
npm install @astrojs/preact preact
```

```js
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

export default defineConfig({
  integrations: [preact()],
});
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "preact"
  }
}
```

Options: `compat: true` for React libraries, `devtools: true`, `include`/`exclude` only when several JSX frameworks coexist.

### 6.2 Directives

Doc quote: "With all directives except client:only, the component first renders to static HTML on the server before hydrating in the browser."

```astro
<!-- This component's JS will begin importing when the page loads -->
<InteractiveButton client:load />

<!-- This component's JS will not be sent to the client until
the user scrolls down and the component is visible on the page -->
<InteractiveCounter client:visible />

<!-- This component won't render on the server, but will render on the client when the page loads -->
<InteractiveModal client:only="svelte" />
```

- `client:load`: hydrate immediately on page load. Use for above-the-fold interactive UI.
- `client:idle`: "load when the browser becomes idle". Optional timeout: `<ShowHideButton client:idle={{timeout: 500}} />` (Since 4.15.0, maps to `requestIdleCallback` timeout).
- `client:visible`: hydrate when it enters the viewport. Optional margin: `<HeavyImageCarousel client:visible={{rootMargin: "200px"}} />`.
- `client:media={QUERY}` and `client:only="preact"` also exist.

For the self-check and self-assessment at the end of a long module page, `client:visible` fits. If the island is near the top, `client:idle`.

### 6.3 Props

Quoted: "Props passed to interactive components using `client:*` directives must be serializable data types."

```astro
---
import TodoList from '../components/TodoList.jsx';
import Counter from '../components/Counter.svelte';
---
<div>
  <TodoList initialTodos={["learn Astro", "review PRs"]} />
  <Counter startingCount={1} />
</div>
```

Pass plain objects, arrays, strings, numbers, booleans. Do not pass functions or class instances. Pass the module id and the question list, not the collection entry.

### 6.4 Talking to Actions from an island

The recommended way is the documented client call: `import { actions } from 'astro:actions'` and `await actions.name(input)` returning `{ data, error }`. See section 3.5 for the island example and the `queryString` trick that keeps a no-JS fallback. There is no Preact-specific helper in `@astrojs/preact@6.0.5`.

Astro components such as `<Image />` cannot be used inside a Preact component. They can be passed as children from a `.astro` file (doc: `guides/images`).

---

## 7. Images and SVG

Doc: `guides/images`, `reference/modules/astro-assets`, `guides/imports`, `reference/experimental-flags/svg-optimization`, `reference/configuration-reference`.

### 7.1 `src/assets` vs `public/`

Quoted (WebFetch summary): the docs recommend keeping local images in `src/` so Astro can transform and optimize them. Files in `public/` are served as-is without processing.

Quoted: "Images rendered with HTML tags will not be processed (e.g. optimized, transformed) and will be copied into your build folder as-is."

`<Image />` with a `public/` file needs explicit size:

```astro
---
import { Image } from 'astro:assets';
---
<Image
  src="/images/my-public-image.png"
  alt="descriptive text"
  width="200"
  height="150"
/>
```

Quoted: "both of these properties are required for images stored in your `public/` folder as Astro is unable to analyze these files." For imports from `src/`, width and height are inferred.

### 7.2 SVG as a component (inlined)

```astro
---
import Logo from '../assets/logo.svg';
---

<Logo width={64} height={64} fill="currentColor" />
```

Quoted: "Astro allows you to import SVG files and use them as Astro components. Astro will inline the SVG content into your HTML output." Passed attributes override the file's values. The `SvgComponent` type exists for TypeScript. Inlined SVGs work with CSS custom properties, which suits the four area colors in dark and light themes (`fill="currentColor"` or `var(--area-color)`).

### 7.3 SVG through `<Image />` or `<img>`

Importing an SVG gives an object with `src`:

```astro
---
// Returns an object with `src` and other properties
import imgReference from './image.png';
import svgReference from './image.svg';
---

{/* HTML or UI Framework components use this to render the image */}
<img src={imgReference.src} alt="image description" />

{/* The Astro `<Image />` and `<Picture />` components access `src` by default */}
<Image src={imgReference} alt="image description">
```

SVG sources are not run through the image service by default. Config reference `image.dangerouslyProcessSVG` (default `false`, since 6.3.0): "Allows SVG source images to be processed by the image optimization pipeline. This is disabled by default as specifically formed SVGs can be prohibitively expensive to process". Leave it off. `<Image src={svgImport} />` still emits width and height from the file, which prevents layout shift.

Decision for this site: diagrams as SVG components from `src/assets` when they need theme colors; static logos or favicons in `public/` referenced by URL with explicit `width` and `height`.

### 7.4 SVG optimization (experimental in 7.3.2)

```js
import { defineConfig, svgoOptimizer } from "astro/config";

export default defineConfig({
  experimental: {
    svgOptimizer: svgoOptimizer()
  }
});
```

Source check: `svgOptimizer` sits inside `experimental` in `astro@7.3.2/dist/core/config/schemas/base.js`, and `svgoOptimizer` is exported from `astro/config`. Optional. Skip unless SVG size becomes a problem.

### 7.5 Responsive images

```astro
---
import { Image } from 'astro:assets';
import myImage from '../assets/my_image.png';
---
<Image src={myImage} alt="A description of my image." layout='constrained' width={800} height={600} />
```

`layout` generates `srcset` and `sizes`. `image.responsiveStyles: true` adds the small global styles. `image.service` defaults to sharp (optional dependency of astro), which works in the Node container.

---

## 8. `astro check`, `astro build`, `astro preview`, vitest

Doc: `guides/typescript`, `reference/cli-reference`, `guides/testing`, `reference/container-reference`, `guides/upgrade-to/v7`.

### 8.1 Commands

- `astro check` needs `@astrojs/check` and `typescript` installed (v3 upgrade guide). `@astrojs/check@0.9.10` accepts `typescript ^5.0.0 || ^6.0.0`. Install `typescript@6.0.3`. Do not install TypeScript 7.
- Quoted: "`astro start` and `astro build` transpile code using esbuild without running type checks." So:

```json
{
  "scripts": {
    "dev": "astro dev",
    "check": "astro check",
    "build": "astro check && astro build",
    "preview": "astro preview",
    "sync": "astro sync",
    "test": "vitest run"
  }
}
```

- `astro build` with the Node adapter writes `dist/server/entry.mjs` and `dist/client/`.
- `astro preview` serves the build locally. Quoted: "It is not designed to be run in production." The Node adapter supports it (source: `previewEntrypoint`).
- `astro sync` regenerates `.astro/types.d.ts`, including `astro:content` and `astro:actions` types. The actions reference says you "may need to restart the dev server or run the `astro sync` command" before `actions` is recognized.

### 8.2 vitest with `getViteConfig`

```js
// vitest.config.ts
/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    // Vitest configuration options
  },
});
```

Second argument for inline Astro config:

```js
export default getViteConfig(
  { test: { /* Vitest configuration options */ } },
  {
    site: 'https://example.com/',
    trailingSlash: 'always',
  },
);
```

Use `environment: 'node'` for anything that renders Astro components (v6 upgrade guide switched the docs example from jsdom to node).

Source check of `getViteConfig` (`astro@7.3.2/dist/config/index.js`): it resolves the Astro config, runs integration `astro:config:setup` hooks, builds the routes list, and calls `createVite` with `sync: false`, then merges the user's Vite config. So Astro's Vite plugins are present and virtual modules like `astro:actions`, `astro:content`, and `astro:env/server` resolve inside vitest. Because `sync` is false, run `astro sync` before the test run so the content data store and generated types exist. UNVERIFIED: whether `astro:content` queries return entries in vitest without a prior `astro sync`; the safe script is `"test": "astro sync && vitest run"`.

`vitest@5.0.1` accepts `vite ^8.0.0`, which matches astro's `vite ^8.0.13`.

### 8.3 Container API for component tests

```js
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { expect, test } from 'vitest';
import Card from '../src/components/Card.astro';

test('Card with slots', async () => {
	const container = await AstroContainer.create();
	const result = await container.renderToString(Card, {
	slots: {
		default: 'Card content',
	},
	});

	expect(result).toContain('This is a card');
	expect(result).toContain('Card content');
});
```

`renderToString(component, { slots, props, request, params, locals, routeType, partial })`. Pass `request: new Request("https://example.com/blog", { headers })` when the component reads cookies or URL.

Rendering a page that contains a Preact island or MDX needs renderers. The v7 guide deprecates the package-root import and says: "Update your Container API imports to use the new `container-renderer` entrypoint for each official integration":

```js
// Old way
import { getContainerRenderer } from '@astrojs/react';

// New way
import { getContainerRenderer } from '@astrojs/react/container-renderer';
```

For Preact and MDX: `@astrojs/preact/container-renderer` (export verified in `@astrojs/preact@6.0.5` package.json) and `@astrojs/mdx/container-renderer` (file present in `@astrojs/mdx@8.0.1/dist`). Manual registration (doc `reference/container-reference`, adapted names):

```js
import { experimental_AstroContainer } from "astro/container";
import preactRenderer from "@astrojs/preact/server.js";
import mdxRenderer from "@astrojs/mdx/server.js";

const container = await experimental_AstroContainer.create();
container.addServerRenderer({ renderer: mdxRenderer });
container.addServerRenderer({ renderer: preactRenderer });
container.addClientRenderer({
  name: "@astrojs/preact",
  entrypoint: "@astrojs/preact/client.js",
});
```

The doc's rule: "Server renderers must be added before client renderers."

### 8.4 pglite in tests

`drizzle-orm@0.45.2` lists `@electric-sql/pglite >=0.2.0` as an optional peer, and `drizzle-orm/pglite` is the driver entry the decision names. Details for Drizzle are outside this sheet. Flag `@electric-sql/pglite@0.5.8` as a dev dependency that needs approval.

---

## 9. Astro 7 upgrade guide, the parts that matter here

Doc: `guides/upgrade-to/v7` (WebFetch of the full page, plus ctx7 snippets). Section headings on the page, in order: Upgrade Astro; Breaking Changes; Dependency Upgrades; Experimental Flags; Rust compiler; Reserved file name: src/fetch.ts; New default Markdown processor: Sätteri; New default whitespace handling: compressHTML: 'jsx'; Deprecated; Deprecated: getContainerRenderer() from integration package roots; Removed; Removed: @astrojs/db; Removed: exposed astro:transitions internals.

### 9.1 Rust compiler and unclosed tags (in `.astro` files)

Quoted: "Astro v7.0 replaces the previous Go-based compiler with a new Rust-based compiler. The new compiler is faster, but is also stricter about invalid HTML syntax. Templates that previously built without errors may now fail."

Quoted: "1. Unclosed tags now produce errors. The previous compiler silently accepted unclosed HTML and component tags. The Rust compiler requires all non-void elements to have a matching closing tag."

Quoted: "2. Semantically invalid HTML is no longer auto-corrected. ... The Rust compiler does not attempt to correct your markup and instead passes it through as-is, leaving the browser to handle it."

Rule for agents: every `<p>`, `<li>`, `<div>`, and component tag in `.astro` templates must be closed. Do not nest block elements inside `<p>`.

### 9.2 Markdown and MDX strictness (verified by running Sätteri 0.10.3)

- MDX: unclosed JSX or HTML tags are compile errors. `mdxToJs("# Hi\n\n<p>unclosed paragraph\n\nmore text")` threw `Expected a closing tag for <p> (3:1) before the end of paragraph (mdx-jsx:unexpected-character)`. `mdxToJs("<Note>\n\nhello\n")` threw `Expected a closing tag for <Note> (1:1)`. The closed form compiled.
- Plain Markdown: raw HTML is passed through verbatim by default. `markdownToHtml("<div>\n\n**hi**\n")` returned `<div>\n<p><strong>hi</strong></p>\n` with no error and no auto-close. With `features: { rawHtml: true }` Sätteri reparses HTML and closed the div. Astro's `@astrojs/markdown-satteri` does not set `rawHtml` in its source (grep found no `rawHtml`), so `.md` files pass raw HTML through unchanged. The browser then repairs it.
- Rule for agents: in `.mdx` close every tag. In `.md` avoid raw HTML.
- MDX runtime errors surface as `MDXError` with `loc` from the `@astrojs/mdx` Vite plugin. The plugin also errors if `@astrojs/markdown-satteri` is too old to render `.mdx`; keep it at the version astro pins (0.4.1).

### 9.3 Sätteri as default processor

See section 1.6. `@astrojs/markdown-remark` is optional. `markdown.remarkPlugins` and `markdown.rehypePlugins` are deprecated and need that package. Not used here.

### 9.4 `compressHTML: 'jsx'`

Quoted: "In Astro v7.0, the default value of `compressHTML` has changed from `true` to `'jsx'`. Now, Astro strips whitespace from your HTML using JSX rules by default, the same way frameworks like React do." Example from the page: `<span>hello</span><em>world</em>` on separate lines renders as `helloworld` instead of `hello world`. Put an explicit `{' '}` or a literal space on the same line between inline elements in `.astro` templates.

### 9.5 Vite 8 and stabilized flags

- "Astro v7.0 upgrades to Vite 8 as the development server and production bundler."
- Remove from config if present: `experimental.logger`, `experimental.queuedRendering`, `experimental.rustCompiler`, `experimental.advancedRouting`, `experimental.cache`, `experimental.routeRules`. These are defaults or stable now.
- `src/fetch.ts` is reserved for advanced routing. Set `fetchFile: null` to disable, or another path to move it.

### 9.6 Removed: `@astrojs/db`

Quoted: "The `@astrojs/db` package has been removed in Astro v7.0 and is no longer maintained." Alternatives listed: `node:sqlite`, Drizzle ORM, other libraries. This project uses Drizzle with `pg` on RDS. No migration needed.

### 9.7 View transitions

The v7 guide removes only internals: `TRANSITION_BEFORE_PREPARATION`, `TRANSITION_AFTER_PREPARATION`, `TRANSITION_BEFORE_SWAP`, `TRANSITION_AFTER_SWAP`, `TRANSITION_PAGE_LOAD`, `isTransitionBeforePreparationEvent()`, `isTransitionBeforeSwapEvent()`, `createAnimationScope()`. Replacement: listen to the event names directly, for example `'astro:before-preparation'` and `'astro:after-swap'`.

No default changed in v7. Earlier changes that still apply: `<ClientRouter />` from `astro:transitions` replaced `<ViewTransitions />` in v5, and the `handleForms` prop was removed in v6 because form handling is on by default. `ClientRouter` stays opt-in; a site without it in `<head>` gets full page loads. The docs client form example imports `navigate` from `astro:transitions/client`, which works without `ClientRouter` as a plain navigation. UNVERIFIED: whether `navigate` falls back to `location.assign` without the router; the docs do not say. Using `window.location.assign` in islands avoids the question.

### 9.8 Sessions

Not mentioned in the v7 guide. Current behavior:
- Node adapter: "Astro uses the local filesystem for session storage when using the Node adapter." Source: `sessionDrivers.fs` maps to unstorage `fsLite` with `base: ".astro/session"` (`astro@7.3.2/dist/core/session/drivers.js`). That directory is inside the container and is lost on redeploy, which is acceptable only for throwaway data.
- Quoted: "If your project does not use sessions, you can set `session: false` in your Astro config. The adapter will not configure the filesystem session driver, and the session runtime will be excluded from your server bundle." Better Auth keeps its own session table, so `session: false` is the clean choice unless the PRG middleware in 3.8 wants Astro sessions.
- v6 changed the driver API to helper functions:

```js
import { defineConfig, sessionDrivers } from 'astro/config'

export default defineConfig({
  session: {
    driver: sessionDrivers.redis({
      url: process.env.REDIS_URL
    }),
    cookie: {
      secure: true
    },
    ttl: 3600
  }
})
```

- API: `Astro.session?.get(key)`, `set(key, value)`, `regenerate()` on login, `destroy()` on logout. In actions: `context.session?.get('cart')`. In middleware: `context.session?.set('lastVisit', new Date())`. Type the data with `App.SessionData`.

### 9.9 Server islands

Not mentioned in the v7 guide. Current rules (doc `guides/server-islands`):
- `<Avatar server:defer>` with `<GenericAvatar slot="fallback" />` for placeholder content.
- Props must be serializable: plain object, number, string, Array, Map, Set, RegExp, Date, BigInt, URL, typed arrays, Infinity. No functions.
- An adapter is required.
- Props are encrypted with a key generated per build. `astro create-key` makes a stable `ASTRO_KEY` for rolling deployments or CDN caching. With one server process and no CDN cache of island pages this is not needed, but a rolling OpenShift deployment that serves old HTML against a new pod would break island requests until the old cached page is gone. Setting `ASTRO_KEY` as a secret is cheap insurance.

### 9.10 Cookies

Not mentioned in the v7 guide. API unchanged, see 4.3. One older change still relevant: since v5 "Actions submitted by HTML forms no longer use cookie redirects." Results are rendered on the same page unless middleware implements PRG.

### 9.11 Content collections

No v7 change. v6 removed `legacy.collections` and the `type` field. Entries use `id` (not `slug`), and `render()` is imported from `astro:content` rather than called on the entry.

---

## 10. Decisions this forces

1. Pin `typescript` to 6.0.3 (or 5.9.3). `@astrojs/check@0.9.10` refuses TypeScript 7.
2. Do not install `@astrojs/markdown-remark`. MDX 8 runs on Sätteri. Remark and rehype plugins are out of scope.
3. Import `z` from `astro/zod` (zod 4). Never from `astro:content`.
4. Every action lives in `src/actions/index.ts` under `export const server`. Business logic lives in `src/lib` and is unit tested there. Actions are tested over HTTP or with the fake-context fallback.
5. `security.allowedDomains` must list the public hostname or `context.clientAddress` is the router's IP and rate limiting is useless.
6. Route protection uses `context.routePattern` or per-page checks, never `context.url.pathname` string matching.
7. `session: false` unless Astro sessions are used for PRG. Better Auth owns sessions.
8. Close every tag in `.astro` and `.mdx`. Avoid raw HTML in `.md`.
9. Pages that host action forms are on demand. Public content pages get `export const prerender = true`.
10. `npm run test` runs `astro sync && vitest run`. `vitest.config.ts` uses `getViteConfig` with `environment: 'node'`.

