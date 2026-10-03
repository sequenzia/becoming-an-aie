// src/lib/auth-client.ts
// The browser client (blueprint section 6.3). No baseURL: it targets the same origin, which is the only
// origin the auth routes trust. Used by the sign-in page's bundled script and nowhere else.
import { createAuthClient } from 'better-auth/client';

export const authClient = createAuthClient();
