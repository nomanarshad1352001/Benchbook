# Benchbook — Field-Service CRM for Handyman & Home-Service Teams

A complete, production-style CRM for a handyman company: clients, job pipeline,
crew scheduling, e-signature forms, and a public REST API — designed to deploy
to **Vercel with zero database, zero environment variables, zero setup**.

> **Demo credentials — every role, one-click autofill on the login page**
>
> | Role | Email | Password | Sees |
> |---|---|---|---|
> | Admin (Dan, owner) | `dan@fixwell.ca` | `demo1234` | Everything incl. API keys, webhooks, backups |
> | Office (Priya, manager) | `priya@fixwell.ca` | `demo1234` | Clients, jobs, quotes, forms, scheduling |
> | Field crew (Marcus, lead tech) | `marcus@fixwell.ca` | `demo1234` | Mobile-first schedule, job cards, on-site signing |

---

## 1. Zero-database architecture (why it deploys anywhere)

| Layer | Where state lives | Notes |
|---|---|---|
| **App UI** (dashboard, pipeline, calendar, forms, settings) | `localStorage` via `src/lib/store.ts` — seeded on first visit, every change persists instantly | Per-browser workspace. No server round-trips, no loading states between pages |
| **Public REST API** `/api/v1/*` | Warm serverless in-memory sandbox (`src/app/api/v1/[...v1path]/route.ts`) | Same demo dataset, real HTTP + API-key auth; resets to seed on cold start |
| **Static pages** | 13 routes prerender at build time | Instant navigation with prefetching |

The UI never talks to a server for app data: a transparent `fetch` shim in
`store.ts` serves every `/api/...` call the interface makes (login, CRUD,
stage moves, signatures, PDF builds, imports) from the in-memory store.
**Vercel deploy = git push. Nothing to provision.**

### Fixing "54 Turbopack errors" on Vercel (stale files in git)

If your repo was pushed from an earlier Postgres-based revision, Vercel tries
to compile deleted files (`src/db/seed.ts`, `src/lib/auth.ts`, `src/lib/ops.ts`,
`src/app/api/{auth,clients,jobs,forms,keys,webhooks,notes,photos,appointments}/**`,
`src/app/api/v1/{clients,jobs,appointments,forms}/**`). Resolution — make sure
these paths **do not exist** in your branch, then push:

```bash
git rm -r --ignore-unmatch \
  src/db/index.ts src/db/seed.ts src/lib/ops.ts src/lib/auth.ts src/lib/api-v1.ts \
  src/app/api/auth src/app/api/clients src/app/api/notes src/app/api/photos \
  src/app/api/jobs src/app/api/appointments src/app/api/forms src/app/api/keys \
  src/app/api/webhooks src/app/api/v1/clients src/app/api/v1/jobs \
  src/app/api/v1/appointments src/app/api/v1/forms
git commit -m "remove legacy DB-era routes (zero-database build)"
git push
```

The active app code imports none of `@/db`, `@/lib/auth`, `@/lib/ops` or `@/lib/api-v1`.
For out-of-sync checkouts, `src/db/schema.ts` keeps the **full Drizzle table
definitions**, and `src/db/index.ts`, `src/lib/auth.ts`, `src/lib/ops.ts` and
`src/lib/api-v1.ts` ship as inert compatibility files: the DB client is lazy and
**never throws at import/build time** — it only activates if a `DATABASE_URL` is
actually configured. So any mix of old and new files compiles and deploys.
No env vars required (the local `.env` is inert).

---

## 2. Feature map — every module, in full

### 2.1 Login, accounts & roles
- Split-screen login with live crew imagery (Pexels), brand stats, and **demo credential cards that autofill the form with one click**.
- Three roles with an enforced permission matrix (Settings → Team & roles): **Admin** (keys, webhooks, backups, everything), **Office** (desk operations), **Field** (restricted nav — no settings/API pages; mobile-first default experience).
- Session persists in the browser; sign-out from the sidebar or avatar menu.

### 2.2 Dashboard
- Time-aware greeting, 4 KPI cards (active jobs, today’s appointments, forms awaiting signature, revenue collected this month incl. HST).
- **Today’s schedule** timeline with crew color bars and job links.
- **Pipeline value** funnel (per-stage job counts and CAD subtotals).
- **Out for signature** widget + company-wide recent-activity feed with author avatars and relative timestamps.

### 2.3 Client cards (`/clients`)
- Full contact block with copy-to-clipboard, **lead source**, **tags**, **multiple service addresses** (Home / Building A / Building B with primary flag), long-form notes.
- Search by name / phone / email / tag, tag filter chips, **new client modal**.
- Header stats: active jobs, lifetime billed, next scheduled visit, client-since.
- **Unified history tab**: every event for the client in one chronological timeline — jobs, stage moves, notes, photos, forms sent, forms viewed, **forms signed** (with signer name).
- Tabs: Jobs (with stage chips + totals), History, Notes (add note, optionally linked to a job), Photos & files (captioned grid).

### 2.4 Job / deal cards + drag-and-drop pipeline (`/pipeline`, `/jobs/[id]`)
- Board stages: **Lead → Quoted → Approved → Scheduled → Completed → Paid (+ Lost)** — drag cards between columns; moves persist instantly, log an activity entry, and fire the `job.stage_changed` webhook.
- Card shows client, service-type chip, estimate total, assignee avatar, stale badge (7+ days in stage).
- **Lost** flow with reason capture; re-open a lost deal back to Lead.
- Job card: clickable **stage stepper** (jump to any stage), **Move to next stage** button, lost banner.
- **Estimate builder**: unlimited labour & material line items (description, type, qty, unit, rate) with live subtotal, **13% HST**, and CAD total — flows automatically into every quote/e-sign document.
- Overview tab (scope, lead-tech reassignment, contact, booked visits), Estimate tab, Forms tab, Photos tab, Activity tab.
- Job is fully linked to its client, appointments, and every form sent for it.

### 2.5 Team calendar (`/calendar`) — internal only, mobile-ready
- **Day / Week / Month** views, week starts Monday, 7 AM–8 PM grid, red "now" line.
- Appointments: **estimate visits, jobs, callbacks** — colored per crew member, with per-person filter chips and "show everyone".
- Click any block → detail popover (time, client, crew, type, notes, links to job card / client profile).
- Booking modal (linked job optional, crew assignee, date/time, crew notes). Clients never self-book — only staff create visits.
- On phones: collapses to a thumb-friendly day grid plus a bottom nav bar — the field crew’s home screen.

### 2.6 Forms to fill & sign (`/forms`, `/sign/[token]`)
- **Three templates, all wording editable by you** (Estimate approval & work authorization, Change order, Job completion sign-off) with token auto-fill: `{{client.name}}`, `{{job.items}}`, `{{job.total}}`, `{{company.*}}`, `{{date.today}}`, etc.
- **Send by email or text** from a job card, the forms page, or the "+ New" menu — client/job/estimate details fill in automatically.
- Client taps the link → branded signing page → reviews the document, draws their signature with finger/stylus, confirms legal consent, can leave a note for the crew.
- **On signature**: status + signer name/email/IP/device recorded with a sent→viewed→signed **audit trail**, the job **auto-advances** to the template’s next stage (auth → Approved, sign-off → Completed), a branded **PDF is generated (document + totals box + rendered signature + audit block)** and filed to the client & job, and the `form.signed` webhook fires.
- **In-person signing**: open the same link on any phone/tablet on site. Share links embed the resolved document, so they render on a device that has never touched the workspace.
- Every form row offers: copy link / open on this device / PDF download / expandable audit trail.

### 2.7 Import & export (Settings → Import & export)
- **Import** any CSV with the header `name,email,phone,lead_source,tags,address,city,postal` (paste or file upload, quoted fields supported). Duplicates on name+email are skipped safely; a sample is prefilled.
- **Export** downloads the entire client list (contacts, lead source, tags, service addresses) in the exact same format — round-trips into Excel/Google Sheets or back into the CRM. Also one-click from the Clients toolbar.

### 2.8 Public REST API + OpenAPI (`/docs`, `/api/v1`)
- Groups: `clients` (list/create/get/patch/delete), `jobs` (list/create/get/patch — incl. stage moves with computed CAD totals), `appointments` (list/create, filter by assignee), `forms` (list/send — returns a ready-to-sign `signingUrl`), plus read-only `team`.
- **Secure API keys**: shown once at creation, revocable, last-used tracking (Settings → API keys). Demo key included: `fwk_live_demokey7a3f9b2c4d8e1560` (send as `x-api-key` or Bearer).
- **Webhooks** (Settings → Webhooks): HTTPS endpoints, event subscriptions (`client.created`, `job.created`, `job.stage_changed`, `form.sent`, `form.signed`, `appointment.created`), `X-Webhook-Event` + `X-Webhook-Secret` headers, and a live delivery log (status / HTTP code / time).
- Docs: dark reference with copy-ready curl examples, payload samples, error contract — plus a downloadable **OpenAPI 3.1 spec** at `/api/openapi.json`.

### 2.9 Settings modules
Team & roles (permission matrix) · API keys · Webhooks + deliveries · Import & export · **Hosting & backups** — your-accounts hosting topology, auto-renewing SSL status, 30-day rolling daily snapshot history with restore entry point, and the handover pack (walkthrough + how-to recordings + technical docs).

---

## 3. Tech stack

- **Next.js 16 (App Router, Turbopack)** + React 19 + TypeScript (strict)
- **Tailwind CSS v4** with a custom design system (Sora / Inter / JetBrains Mono, ink + amber palette, card & animation primitives)
- **lucide-react** icons · **pdf-lib** for in-browser signed-PDF generation
- Imagery: Pexels CDN (all stock photography remote — no binary assets to ship)
- Data: `localStorage` persistence + in-memory serverless sandbox — **no database driver in the runtime at all**

## 4. Project structure

```
src/
├─ app/
│  ├─ layout.tsx / globals.css / page.tsx (→ /dashboard)
│  ├─ login/page.tsx                     # credentials + autofill
│  ├─ (app)/                             # authenticated shell (sidebar + topbar + mobile nav)
│  │  ├─ layout.tsx                      # auth gate + role guard
│  │  ├─ dashboard|pipeline|clients|clients/[id]|jobs/[id]|calendar|forms|settings|docs
│  ├─ sign/[token]/page.tsx              # public e-sign (workspace or embedded-doc mode)
│  └─ api/
│     ├─ health/route.ts
│     ├─ openapi.json/route.ts           # OpenAPI 3.1 document
│     └─ v1/[...v1path]/route.ts         # entire public REST API (sandbox store)
├─ components/                           # shell + every interactive view
└─ lib/
   ├─ model.ts                           # types, estimate math, template tokens, seed data, CSV I/O
   ├─ store.ts                           # localStorage store, ops, fetch shim, instant-nav hooks
   ├─ pdf.ts                             # client-side signed PDF builder
   ├─ constants.ts / utils.ts            # stages, service types, imagery, formatters
   └─ login-assets.ts
```

## 5. Local development

```bash
npm install
npm run dev        # http://localhost:3000
```

Quality gates (all must pass — they do): `npx next typegen` · `npm exec tsc -- --noEmit` · `npm run build`.

## 6. Deploy to Vercel

1. Push this folder to GitHub (see §1 note about deleting legacy files).
2. Vercel → New Project → import → **Deploy**. No env vars, no database, no build overrides.
3. SSL is automatic. Your data lives in each user’s browser; the demo REST API self-seeds per function instance.

## 7. E-signature approach

Benchbook ships with a **built-in signature flow** (drawn signature, consent, IP/device/timestamp
audit, auto-filed PDF, stage automation). Recommendation: keep it for day-to-day approvals — it’s
free, fully branded, and the audit trail stays in your own data. The code leaves a clean seam
(webhook on `form.signed` + `signingUrl` issued via API) to add Dropbox Sign/BoldSign later only
if you ever need third-party identity verification (KBA) on very large contracts.
