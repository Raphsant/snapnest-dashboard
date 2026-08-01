# CLAUDE.md — snapnest-dashboard

Nuxt 4 + @nuxt/ui v4 super-admin panel for SnapNest. TypeScript strict, no
`any`. Scaffolded from the official Nuxt UI dashboard template, SPA mode
(ssr: false). Talks to the snapnest-backend NestJS API (separate repo —
NEVER modify it from here; assume its endpoints exist as documented) using
Cognito ID tokens as Bearer headers.

## What exists
- Auth: aws-amplify v6 (Cognito) via client plugin; `useAuth` composable
  (signIn/signOut/user); `useApi` composable attaches a fresh ID token per
  request and signs out on 401/403; global route middleware sends
  unauthenticated users to /login.
- Pages: / (agencies table) → /agencies/[id] (members, add-member modal,
  folder overview) → /agencies/[id]/clients/[userId] (client folders,
  new-folder modal) → /folders/[id] (file thumbnail grid via batched
  presigned view-urls, modal viewer for photos + videos).
- Pipeline monitoring: jobs table with status badges (QUEUED gray, RUNNING
  blue, AWAITING_MANIFEST_APPROVAL amber, COMPLETED green, FAILED red),
  10s polling while any job is non-terminal; job detail with manifest clip
  cards and approval controls.
- Types for all admin API responses in types/; API base URL + Cognito
  config from NUXT_PUBLIC_* runtime config.

## House rules
- One file at a time, show diffs, pause for approval before moving on.
- Reuse existing useApi / loading / error idioms — don't invent parallel
  patterns.
- No new dependencies without discussion.
- ESLint CI runs on push — `npm run lint` must pass before any commit.
- No dead UI: never render a disabled/fake control (no placeholder
  buttons, no non-functional toggles). Omit instead.
- End every task with a manual test plan; the operator verifies against
  the live backend before commit.
