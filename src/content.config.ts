// src/content.config.ts
import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { moduleFields, moduleRules, artifactSchema, changelogSchema } from './lib/content-schema';

const modules = defineCollection({
  loader: glob({ base: './src/content/modules', pattern: '**/[^_]*.mdx' }),
  schema: moduleFields
    .extend({
      artifacts: z.array(reference('artifacts')).default([]),
      prerequisites: z.array(reference('modules')).default([]),
    })
    .superRefine(moduleRules),
});

const artifacts = defineCollection({
  loader: glob({ base: './src/content/artifacts', pattern: '**/[^_]*.md' }),
  schema: artifactSchema,
});

const changelog = defineCollection({
  loader: glob({ base: './src/content/changelog', pattern: '**/[^_]*.md' }),
  schema: changelogSchema,
});

export const collections = { modules, artifacts, changelog };
