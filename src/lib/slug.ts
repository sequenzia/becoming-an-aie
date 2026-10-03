// src/lib/slug.ts
// Heading ids as Astro's Markdown pipeline (Sätteri with github-slugger) produces them for the
// ASCII headings this program uses (blueprint section 4.12): lowercase, drop every character
// other than letters, digits, spaces, and hyphens, then replace spaces with hyphens.
// Underscores and other punctuation are dropped. A heading whose id would differ between
// github-slugger and this rule must be rewritten by the author (docs/content-authoring.md).

export function headingId(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N} -]/gu, '')
    .replace(/ /g, '-');
}
