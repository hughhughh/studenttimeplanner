# Student Time Planner

https://studenttimeplanner.responsehsc.com/

An AI-driven weekly study planner for students. Talk to your calendar in plain
language ("add an hour of English study tonight"), or photograph your school
timetable and watch your week fill in. Built with Next.js 16 (App Router),
TypeScript, MongoDB, and Google Gemini.

## Features

- **Week view** (Mon–Sun) with configurable working hours, a live now-indicator,
  overdue (orange) and completed (green) task styling, repeat icons, and split
  sessions shown as one card across multiple time blocks.
- **Natural-language editing** via Gemini — create, move, reschedule, delete,
  complete, handle recurrence + exceptions, and bulk changes. Every AI proposal
  is validated server-side and applied all-or-nothing (never half-updated).
- **Timetable image import** — upload a photo; Gemini extracts class blocks into
  fixed weekly activities that you review before anything is saved.
- **Passwordless auth** — one-time email codes via Resend + a signed JWT cookie
  session. Per-user data isolation throughout.

## Tech

Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · MongoDB (`mongodb`) ·
`@google/genai` · `zod` · `luxon` · `resend` · `jose`.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure `.env.local` (already scaffolded — fill in values):

   | Variable | Required | Notes |
   |----------|----------|-------|
   | `MONGODB_URI` | yes | e.g. a local `mongodb://127.0.0.1:27017` or an Atlas URI |
   | `MONGODB_DB` | no | defaults to `studenttimeplanner`, or the database name in your URI path |
   | `GEMINI_API_KEY` | for AI | from Google AI Studio |
   | `APP_TIMEZONE` | no | defaults to `Australia/Sydney` |
   | `SESSION_SECRET` | recommended | `openssl rand -base64 32` (dev fallback used if unset) |
   | `RESEND_API_KEY` | for email | if unset, login codes print to the server console |
   | `EMAIL_FROM` | for email | sender address |

3. Seed a sample week for the demo account:

   ```bash
   npm run seed
   ```

4. Run the dev server:

   ```bash
   npm run dev
   ```

   Open http://localhost:3000. The landing page is at `/`; the planner is at
   `/planner` (requires sign-in); the Assessment 3 theory folio is at `/folio`
   (public). Without `RESEND_API_KEY`, use **Continue as guest** on the login
   page (or the landing page) to see the seeded data.

## Tests

Automated calendar and validation tests (no API keys required):

```bash
npm test
```

Vitest expands premade fixture items for a frozen week and asserts expected
occurrences, statuses, grid layout, Zod validation, AI operation schemas, and
duration updates. Current suite: **74 tests / 74 passed** across 14 files.
See `/folio#testing` for the written evaluation.

## How it works

- `lib/db` — MongoDB connection and the per-user item/user repositories.
- `lib/calendar` — timezone math, recurrence expansion, and grid layout.
- `lib/validation` — Zod schemas; the single source of truth for valid data.
- `lib/ai` — Gemini client, the operation schema, the prompt builder, and the
  validate → resolve → enforce → all-or-nothing **apply** pipeline.
- `lib/auth` — sessions (`jose`), login codes, email (`resend`), and the DAL.
- `app/_components` — the week-view UI (grid, cards, modal, command bar).
- `proxy.ts` — route protection (Next.js 16's successor to middleware).

See `docs/projectOverview.md` for the product spec and
`docs/calendarQueryTestCases.md` for AI test prompts.
