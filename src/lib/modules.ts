// src/lib/modules.ts
import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import { env } from './env';
import { KIND_ORDER, MODULE_SLUGS } from './content-schema';

export type ModuleEntry = CollectionEntry<'modules'>;

/** A module renders when it is not a draft, or when the build enabled draft preview. */
export function isPublished(entry: ModuleEntry): boolean {
  return !entry.data.draft || env.previewDrafts;
}

/** Catalog sort: kind group order, then order within the kind, then title. */
export function compareModules(a: ModuleEntry, b: ModuleEntry): number {
  return (
    KIND_ORDER.indexOf(a.data.kind) - KIND_ORDER.indexOf(b.data.kind) ||
    a.data.order - b.data.order ||
    a.data.title.localeCompare(b.data.title)
  );
}

export async function getAllModules(): Promise<ModuleEntry[]> {
  return (await getCollection('modules')).sort(compareModules);
}

export async function getPublishedModules(): Promise<ModuleEntry[]> {
  return (await getAllModules()).filter(isPublished);
}

/**
 * The entry when it exists and is published, else null. Actions use this for their entry check.
 * A slug outside MODULE_SLUGS is null before getEntry runs: Astro logs a WARN line for every unknown id,
 * and a scanner walking /modules/<anything> would otherwise fill the log (docs/decisions.md, 2026-10-03).
 */
export async function getPublishedModule(slug: string): Promise<ModuleEntry | null> {
  if (!(MODULE_SLUGS as readonly string[]).includes(slug)) return null;
  const entry = await getEntry('modules', slug);
  return entry && isPublished(entry) ? entry : null;
}
