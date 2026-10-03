// test/setup.ts
// Runs before every Vitest file (vitest.config.ts setupFiles, blueprint section 12.2).
// jest-dom matchers for the component tests, and Testing Library cleanup after each test,
// which is needed explicitly because Vitest globals are off (docs/research/testing-ci.md section 2).
// Preact event names are onInput, not onChange.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/preact';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
