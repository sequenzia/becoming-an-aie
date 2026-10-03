// src/components/module/mdx-components.ts
// The components map passed to <Content components={mdxComponents} /> (blueprint 4.7). Module bodies
// never import components; every capitalized tag a body may use is listed here, and the content check
// holds bodies to MDX_TAGS, the same list, because a tag missing from this map throws at render time.
// <Fragment> is injected by @astrojs/mdx and needs no entry.
import Artifact from './Artifact.astro';
import Workshop from './Workshop.astro';
import FailureExercise from './FailureExercise.astro';
import OptionalLab from './OptionalLab.astro';
import Takeaway from './Takeaway.astro';
import Outcomes from './Outcomes.astro';
import SelfCheckPlacement from './SelfCheckPlacement.astro';
import Sources from './Sources.astro';
import MarkCompleteForm from './MarkCompleteForm.astro';
import Callout from '../site/Callout.astro';
import Collapsible from '../site/Collapsible.astro';
import AnatomyMap from '../site/AnatomyMap.astro';

export const mdxComponents = {
  Artifact,
  Callout,
  Collapsible,
  Workshop,
  FailureExercise,
  OptionalLab,
  Takeaway,
  Outcomes,
  SelfCheck: SelfCheckPlacement,
  Sources,
  AnatomyMap,
  MarkComplete: MarkCompleteForm,
};
