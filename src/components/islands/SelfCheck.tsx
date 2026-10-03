// src/components/islands/SelfCheck.tsx
// placeholder, D replaces (blueprint section 9.1). Carries the contracted props and renders nothing
// but the placeholder marker. Default export; A's SelfCheckPlacement imports it that way.
import type { SelfCheckQuestion } from '../../lib/content-schema';

export interface SavedSelfCheckState {
  answers: Record<string, number[]>; // best answer per question (last correct, else current)
  correctOnce: Record<string, boolean>;
  attempts: number;
  passed: boolean;
  updatedAt: string; // ISO
}

export interface SelfCheckProps {
  moduleSlug: string;
  questions: SelfCheckQuestion[]; // from frontmatter, including correct and feedback
  persist: 'local' | 'account'; // orientation is always local
  initialState?: SavedSelfCheckState | null; // from the account when persist is account
  signedIn: boolean; // false shows "Sign in to save your progress." without calling the action
  optional?: boolean; // orientation shows "Optional. Does not count toward completion."
}

export default function SelfCheck(props: SelfCheckProps) {
  return <div data-placeholder="D:src/components/islands/SelfCheck.tsx" data-module={props.moduleSlug}></div>;
}
