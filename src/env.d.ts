/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    /** Set by src/middleware.ts on every on-demand request. Absent on prerendered pages. */
    user: import('better-auth').User | null;
    session: import('better-auth').Session | null;
    /** Set by the module pages before rendering Content. Read by module components. */
    module?: import('./lib/types').ModuleContext;
    /** Set by the on-demand module page for a signed-in learner. */
    learner?: import('./lib/types').LearnerModuleState;
    /** Set by the on-demand module page after a form action ran with an error. */
    formError?: import('./lib/types').FormError;
  }
}
