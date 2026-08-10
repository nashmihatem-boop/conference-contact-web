# E2E tests

Real Playwright tests against the actual dev stack (Astro frontend + NestJS API + Postgres + Redis + Stripe test mode) — no mocked backend, except where noted below.

## Run

```bash
npm run dev          # in one terminal — starts the site on :4321 (the API is assumed already running on :3000)
npm run test:e2e     # in another terminal
```

`npm run test:e2e:ui` opens Playwright's UI runner for debugging a single test.

## What runs without any setup

- `public-pages.spec.ts` — every public page loads, has a real title, no console errors; pricing/FAQ copy consistency; no leftover pilot language; mobile layout.
- `paywall-redirect.spec.ts` — every authenticated page redirects a logged-out visitor to `/signin` with no data leak.
- `anonymous-ai-search.spec.ts` — the real anonymous AI search flow on `/ai-lead-finder`. The exhaustion-popup tests mock the `/leads/ai-search/anonymous` response instead of actually burning the real 3-searches/day IP-scoped quota — that quota is shared with manual testing and other test runs against this backend, so a real end-to-end exhaustion isn't something this suite should force on every run. The "example chip search" test does use the real API and self-skips if today's quota is already spent.

## What needs credentials

`authenticated-flows.spec.ts` covers signed-in flows (Directory search + CSV export, Lead Finder AI search, subscription cancellation retention prompt, admin Users table) but every test in it self-skips unless you set:

```bash
E2E_USER_EMAIL=...       # a verified, subscribed test account
E2E_USER_PASSWORD=...
E2E_ADMIN_EMAIL=...      # an ADMIN or SUPER_ADMIN account
E2E_ADMIN_PASSWORD=...
```

**These will only get you as far as the device-code step unless the device/session is already trusted.** Signing in from a browser Playwright hasn't used before triggers the app's untrusted-device email code (`signin.astro`'s `#code-form`), and as of this audit Resend is sandboxed to only deliver to the account owner's own inbox — no code reaches a real test user. Either run this against a browser profile/session that's already trusted for the test account, or fix the Resend sending-domain verification first (see the QA report).
