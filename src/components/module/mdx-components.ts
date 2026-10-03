// src/components/module/mdx-components.ts
// placeholder, A replaces (blueprint section 4.7). The map already points at the contracted
// components so a module body renders through the placeholders instead of throwing on an unknown tag.
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
