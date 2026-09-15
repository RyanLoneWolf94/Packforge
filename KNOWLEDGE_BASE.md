# Packforge — Project Knowledge Base

> Internal studio-management app ("Studio OS") for **LoneWolf Digital Inc**.
> React SPA on Vite, backed by **Supabase** (Postgres + Auth), deployed on Netlify.
> Last reviewed: 2026-09-15.

---

## 1. What Packforge is

Packforge is the internal operations system for LoneWolf Digital Inc — a
freelance tech-and-creative studio (branding, packaging, web, ads) based across
Hanoi / Harare. It replaces a scattered set of tools with one place to run the
studio and one clean, branded window for clients.

It has **two faces from one codebase and one data store**:

| Face | Route base | Audience | Access |
|------|-----------|----------|--------|
| **Admin workspace** | `/admin/*` | The studio (Ryan + team) | Unguarded (auth is a later phase) |
| **Client portal** | `/portal/:token` | A single client | Reached by a per-client share token |

The client portal is a **dashboard in its own right** — the delivery/phase
tracker is just one section of it, alongside invoices, quotes, files and
contracts. It is *not* "the tracker as the whole page".

---

## 2. Tech stack

- **React 19** + **Vite 6** + **TypeScript** (strict mode on)
- **Tailwind CSS v4** via `@tailwindcss/vite` — brand tokens defined with `@theme` in `src/index.css`
- **react-router-dom v7** — routing
- **recharts** — dashboard charts (lazy-loaded)
- **jspdf** + **jspdf-autotable** — branded PDF invoices/quotes (dynamically imported)
- **react-signature-canvas** — contract signing
- **motion** (`motion/react`) — animation
- **sonner** — toasts
- **lucide-react** — icons
- `clsx` + `tailwind-merge` — the `cn()` class helper

### Scripts
```bash
npm run dev      # vite dev server on :3000
npm run build    # production build to dist/
npm run preview  # preview the build
npm run lint     # tsc --noEmit (type-check only)
```

> Windows note: Node lives at `C:\Program Files\nodejs`. The Browser-pane
> launch config points directly at `node.exe` + `node_modules/vite/bin/vite.js`
> to dodge a stale-PATH issue.

---

## 3. Architecture

### 3.1 The store is the single source of truth
Everything shared lives in **`src/store/StudioStore.tsx`** (`StudioProvider` /
`useStudio`), backed by **Supabase**. No page holds its own hardcoded data array.

Reads load every collection on mount; writes apply **optimistically** to local
state and then persist. Two invariants matter:

- **Writes are serialised** through a FIFO queue (each request is a thunk issued
  only when its turn comes). Converting a quote inserts a project *then* points
  the quote at it; fired concurrently the dependent write can land first and
  trip the foreign key or update zero rows.
- **`undefined` is normalised**: dropped on INSERT (so the column default
  applies), converted to `null` on UPDATE (so clearing an optional field
  actually persists — JSON serialisation would otherwise drop it silently).

On a write error the store toasts and refetches, so the UI can't drift from the
database.

**Generic typed CRUD** over 14 collections:
```ts
add(key, item)        // add('leads', {...}) is type-checked against Lead
update(key, id, patch)
remove(key, id)
```
Collections: `clients, projects, invoices, quotes, contracts, files, expenses,
leads, team, timeEntries, emailTemplates, planTemplates, campaigns, newsletters`.

Plus a single **`settings`** record (studio profile + notification/integration
flags) updated via `updateSettings(patch)` — settings feed the PDF header and
portal footer, which is why they're data, not a constant.

**Domain-specific helpers** on top of the generic API:
- Projects: `createProject` (seeds phases + timeline for the tier), `deleteProject` (detaches invoices/contracts/files, keeps the paperwork)
- Tracker: `toggleDeliverable`, `setPhaseLink`, `addDeliverable`, `removeDeliverable`, `addActionItem`, `toggleActionItem`, `removeActionItem`, `toggleTimelineWeek`
- Clients: `createClient` (mints a portal token), `deleteClient` (cascades)
- Lookups: `clientFor`, `projectFor`, `projectsForClient`, `clientByToken`
- `resetToSeed`

`loadState` deep-merges saved data over the seed so payloads written before a
field/collection existed still get sensible defaults instead of a blank app.

> **Exception:** the Kanban task board in `Projects.tsx` keeps its own
> `project_tasks` localStorage key — deliberate.

### 3.2 Derived, never stored
Progress, health, and finance totals are computed on read, not persisted:
- `src/lib/tracker.ts` — `phaseProgress`, `phaseStatus`, `projectProgress`, `currentPhase`, `projectBudget`, `projectEarned`, `projectHealth` (`on-track|at-risk|overdue|complete`), `daysUntil`, `openActionItems`
- `src/lib/finance.ts` — `quoteTotal`, `outstandingTotal`, `paidTotal`, `expenseTotal`, `isOverdue`, `trackedHours`, `formatDuration`
- `src/lib/utils.ts` — `cn`, `formatCurrency`, `formatDate`, `formatShortDate`, `initials`, `downloadFile`, `relativeDays`

### 3.3 One tracker component, two modes
**`src/components/tracker/PhaseTracker.tsx`** serves both the admin (editable)
and client (read-only) views via a `mode` prop. **Never fork it** — a single
component is what guarantees the admin and client views can't drift apart.

### 3.4 Code splitting
Routes are `React.lazy` + `Suspense` split (see `src/App.tsx`). recharts
(Overview) and jspdf load only on demand. Main chunk went 1,485 kB → ~546 kB.

---

## 4. Directory map

```
src/
  App.tsx                     # routes (admin + portal), lazy loading
  main.tsx                    # entry
  brand.ts                    # STUDIO constants, BRAND_COLORS, service packages/tiers
  types.ts                    # full domain model (see §6)
  index.css                   # Tailwind v4 @theme brand tokens
  store/StudioStore.tsx       # the store — single source of truth (Supabase-backed)
  store/PortalStore.tsx       # read-only portal provider, fed by portal_snapshot RPC
  auth/AuthProvider.tsx       # session + is_studio_admin check
  auth/Login.tsx              # branded sign-in (password + magic link)
  auth/RequireAdmin.tsx       # gate for /admin
  data/
    seed.ts                   # seed data for every collection + settings
    phaseTemplates.ts         # phasesForTier / timelineForTier
    defaultTasks.ts           # Kanban default tasks (extracted for Fast Refresh)
  lib/
    supabase.ts               # the Supabase client (VITE_SUPABASE_* env vars)
    tracker.ts                # progress/health derivations
    finance.ts                # money/time derivations
    pdf.ts                    # branded invoice & quote PDF generator
    emailTemplate.ts          # branded HTML email shell + seed bodies
    utils.ts                  # cn, formatters, downloadFile
  components/
    ErrorBoundary.tsx
    Logo.tsx                  # <Logo variant="color|light"> w/ text fallback
    SignatureModal.tsx        # contract signing
    layout/DashboardLayout.tsx
    tracker/PhaseTracker.tsx  # THE shared tracker (admin+client)
    ui/index.tsx              # design-system primitives (see §5)
  pages/
    Dashboard, Overview, Projects, ProjectTracker, Clients, Leads,
    Quotations, Invoices, Contracts, Timelines, TimeTracking, Expenses,
    Teams, Files, Emails, Settings
    marketing/  Campaigns, Newsletters, Integrations
    portal/     PortalLayout, PortalOverview, PortalProgress,
                PortalBilling (PortalInvoices/Quotes/Files/Contracts),
                usePortalClient.ts
public/
  README-logo.md              # expected: lonewolf-logo.png, lonewolf-logo-light.png, favicon.png
scripts/
  gen-sample-pdf.mts          # npx tsx — writes sample-*.pdf (gitignored) via buildDocument
```

---

## 5. Design system (`src/components/ui/index.tsx`)

Shared primitives — always reach for these before hand-rolling markup:
`Button, Card, PageHeader, StatCard, StatusPill, MetaPill, ProgressBar,
ProgressRing, Modal, Field, Input, Textarea, Select, EmptyState`.

### Brand palette
| Token | Hex | Use |
|-------|-----|-----|
| orange | `#FF6B00` | primary accent / CTAs |
| purple | `#5B0FA8` | headers / brand |
| deep purple | `#3D0A70` | footers |
| red | `#CC1A00` | destructive |
| gold | `#FFB300` | highlight |
| night | `#1E1633` | dark sidebar |
| line | `#E7E4DE` | borders |

Studio identity constants live in `src/brand.ts` (`STUDIO`): name, tagline
("Your Brand's Digital Pack"), website `lonewolfdigitech.com`, tiers
**Pup / Wolf / Alpha** (branding + ad packages).

---

## 6. Domain model (`src/types.ts`)

Everything is keyed by `id` and related through `clientId` / `projectId` (never
by matching display names), so the portal can resolve "everything for this
client" in one pass and a rename never orphans records.

Core entities: `Client`, `Project` (with `phases: TrackerPhase[]`,
`timeline: TimelineWeek[]`, `actionItems`, optional `brandSnapshot`), `Invoice`,
`Quote` (milestones → tasks; total derived), `Contract`, `FileAsset`
(`sharedWithClient` gates portal visibility), `Expense`, `Lead`, `TeamMember`,
`TimeEntry`, `StudioSettings`, `EmailTemplate`, `PlanTemplate`, `Campaign`,
`Newsletter`.

Notable design choices:
- **`TrackerPhase`** has `budget`, `deliverables[]`, and a shared `link`.
- **`TimelineWeek.done`** is set by the studio (toggleable), *not* derived from phase progress — a stage can be signed off with a stray deliverable still open.
- **`BrandSnapshot`** fields are all optional and revealed independently, so the portal shows what's actually been signed off so far (progressive reveal) rather than staying locked until the full identity lands.

---

## 7. Branded documents & emails

### PDFs — `src/lib/pdf.ts`
One generator renders **both invoices and quotes** to match LoneWolf's real
document design: deep-purple header band + logo, orange title/accents,
Prepared-For / Prepared-By cards, orange-header line-item table with two-tone
rows, orange TOTAL bar, numbered notes, orange-barred PAYMENT callout,
deep-purple footer with the tagline.
- `buildDocument(config): Promise<JsPDFInstance | null>` — returns the doc *without* saving (reusable in Node)
- `downloadInvoicePdf(...)`, `downloadQuotePdf(...)` — wrap it and `.save()`
- Header fetches `/lonewolf-logo.png`; falls back to a text wordmark if absent
- Studio identity in the PDF comes from `settings`
- Two-tone item cell: autotable draws only the description; the bold-orange title is overlaid once in `didDrawCell` (fixes an earlier title-ghosting bug)
- Verify output outside the browser: `npx tsx scripts/gen-sample-pdf.mts` → `sample-*.pdf` (gitignored)

Download buttons: admin Invoices/Quotations + portal Invoices/Quotes.

### Emails — `src/lib/emailTemplate.ts`
`wrapEmail(bodyHtml, brand)` renders the full branded shell (600px card, purple
header + orange strip, purple footer). Helpers: `emailButton`, `emailEyebrow`,
`emailHeading`, `emailCallout`. `SEED_EMAIL_BODIES` holds 5 templates (invoice,
quote, phaseComplete, contractExpiring, welcome) using `{{variables}}`. The
Emails page (`src/pages/Emails.tsx`) does store-backed CRUD and previews the
wrapped result in an isolated `<iframe srcDoc>`.

---

## 8. Backend & security model

Supabase project `uniafzcpxyxmcxoccwue` (org "LoneWolf Digital", ap-southeast-1).
15 tables mirror `src/types.ts` with **quoted camelCase columns**, so rows
deserialize straight into the entity types with no field mapping. Foreign keys
enforce the same cascade (delete a client) / detach (delete a project) rules the
store applies locally.

Access is layered:

| Actor | Mechanism | Sees |
|---|---|---|
| Studio admin | Supabase Auth + `app_admins` allow-list, checked in RLS via `auth.jwt()->>'email'` | Everything; full CRUD |
| Other signed-in user | Same RLS, not on the allow-list | **Nothing** (0 rows) |
| Anonymous (portal) | No table grants at all; `SECURITY DEFINER` RPCs only | One client, by share token |

- `portal_snapshot(token)` returns a single client's data, files filtered to
  `sharedWithClient`. `portal_respond_quote(token, quoteId, status)` is the only
  write the portal can make.
- `is_studio_admin()` powers the app-level gate (`RequireAdmin`).
- `anon` deliberately holds **no** SELECT/INSERT/UPDATE/DELETE. `authenticated`
  holds DML, narrowed by RLS. Don't "helpfully" grant anon table access.
- The two "public can execute SECURITY DEFINER" advisor warnings are expected —
  the portal RPCs are meant to be anon-callable.

Still deferred: **AI / Gemini features** were stripped at the user's request to
return later; every Gemini touchpoint was removed and `@google/genai`
uninstalled. Don't "fix" that as an oversight.

Route new shared data through `StudioStore`, never page-local `useState`. New
tables need matching RLS (admin allow-list for studio data; an RPC for anything
the portal must see) — and re-run the security advisor after any DDL.

---

## 8b. Known gaps (verified 2026-09-15, not yet built)

Found during a full sweep; none of these is a broken control, each is something
the data model promises that no UI delivers:

1. **Project status can never change.** `Projects.tsx` is read-only and nothing
   anywhere writes `project.status`, so a created project stays `planning`
   forever. `ProjectStatus` offers 5 values; only the seed ever set them.
2. **Archiving isn't implemented.** `Project.archived` is only ever written as
   `false` (in `createProject`), so the portal's `!p.archived` filter is a no-op.
   Note the two parallel concepts — the `archived` boolean and
   `status === 'archived'` — which should be reconciled when this is built.
3. **The Kanban board is still browser-local.** `Projects.tsx` keeps tasks under
   its own `project_tasks` localStorage key, so the board doesn't sync across
   devices the way everything else now does.

## 9. Assets the user must supply

Drop these into `public/` for the real logo to appear (pasted-in-chat images
can't be written to disk by the agent — see `public/README-logo.md`):
- `lonewolf-logo.png`
- `lonewolf-logo-light.png`
- `favicon.png`

Until then `Logo.tsx` and the PDF header fall back to a text wordmark
gracefully.

---

## 10. Repo & conventions

- GitHub: <https://github.com/RyanLoneWolf94/Packforge> (`main`)
- Git user: `ashamacs` / ashamacs@gmail.com (attribution only — never sent to services)
- `.gitignore` excludes `.env*` (keep `.env.example`) and `sample-*.pdf`; **never commit secrets**
- Never enter credentials/API keys/tokens into the app — deferred to the backend phase
- Production hardening done: every route audited for dead buttons (all wired or removed); file "download" is a real `downloadFile()` (opens a url or shows an honest toast), never `href="#"`
