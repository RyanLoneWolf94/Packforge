# Packages, Offers & Client Self-Registration

**System reference — Packforge**
Built 2026-10-18 · Supabase project `uniafzcpxyxmcxoccwue` · Live at `portal.lonewolfdigitech.com`

---

## 1. What this system is for

Packages are what a prospect reads **while the work is still being discussed** —
priced cards they choose between. This is the stage before a quote exists.

The three concepts are deliberately separate, and confusing them is the easiest
mistake to make here:

| Concept | Who reads it | When | Lives in |
|---|---|---|---|
| **Package** | The client | Still in conversation, deciding | `packages` |
| **Quote** | The client | Scope agreed, pricing it formally | `quotes` |
| **Blueprint** | You, internally | Any time — it's a delivery plan | `blueprints` |

Blueprints speed up *quoting* and describe *how work gets delivered*. Packages
are a sales artefact. The only link between them is `PackageTier.blueprintId`,
and it runs one way: picking a tier can seed a project's phases from a
blueprint, never the reverse.

---

## 2. The model

### A package is a named group of tiers

`Branding Package` holds The Pup, The Wolf and Alpha Pack. `Social Media
Package` holds its own ladder. The package is the unit you build *and* the unit
you send — a client receives the whole thing and picks one tier.

```ts
interface Package {
  id: string;
  name: string;          // "Branding Package"
  description: string;   // shown above the tiers in the portal
  category: string;
  tiers: PackageTier[];
  active: boolean;       // hidden packages can't be sent
  sortOrder: number;
  createdAt: string;
}

interface PackageTier {
  id: string;
  name: string;          // "The Wolf"
  tagline: string;
  price: number;
  period: string;        // "one-off", "per month"
  features: string[];    // the bullet list, verbatim
  badge: string;         // ribbon, e.g. "Best Value" — empty for none
  accent: PackageAccent; // 'plain' | 'outlined' | 'featured'
  timelineDays: number;
  blueprintId?: string;  // seeds the project's phases on selection
}
```

**Tiers live inside the package row as `tiers` jsonb, not in a table of their
own.** They are created, edited and sent together, and nothing outside the
package ever references a single tier. A tiers table would buy nothing and cost
a join on every read.

### An offer is a package sent to one client

```ts
interface Offer {
  id: string;
  clientId: string;
  packageId?: string;    // for reporting only — options are the truth
  title: string;         // defaults to the package name
  intro: string;
  status: 'draft' | 'sent' | 'accepted' | 'withdrawn';
  options: OfferOption[];
  selectedOptionId?: string;
  selectedAt?: string;
  projectId?: string;    // the project created on selection
  expiresAt?: string;
  createdAt: string;
}

interface OfferOption {
  id: string;
  tierId?: string;       // the tier it was copied from, if it still exists
  name: string;
  description: string;
  priceUsd: number;
  period: string;
  features: string[];
  badge: string;
  accent: PackageAccent;
  timelineDays: number;
  blueprintId?: string;
}
```

**`OfferOption` duplicates the tier fields instead of referencing them, on
purpose.** Sending an offer takes a *snapshot* of every tier. Editing a price,
rewording a feature or deleting a tier afterwards cannot change what a client
was already shown — and cannot change what they agreed to. `packageId` and
`tierId` are kept for reporting; if they ever disagree with the snapshot, the
snapshot wins.

---

## 3. The flow

```
ADMIN                                           CLIENT PORTAL
─────                                           ─────────────
Create package (name, category, blurb)
        │
Add tiers  ──────────────────────────┐
        │                            │ live preview uses the same
Send to Client ──► offers row        │ <PackageCard> the client sees
   status: 'sent'                    │
   options: [snapshot of every tier] ┘
        │
        └──────────────────────────────►  Packages tab appears
                                                  │
                                          Client picks a tier
                                                  │
                                      portal_select_package(...)
                                                  │
        ┌─────────────────────────────────────────┘
        ▼
  project created (status: 'planning')
  phases + timeline seeded from the tier's blueprint
  offer flipped to 'accepted', selectedOptionId / selectedAt / projectId set
        │
  Sent tab shows the choice and links to the project
```

Projects born this way start in **`planning`**: the client has chosen, you
still confirm.

---

## 4. Screens and routes

| Route | File | What it does |
|---|---|---|
| `/admin/packages` | `src/pages/Packages.tsx` | Catalogue — one card per package: category, price range, tier-name chips, active toggle, send, duplicate, rename, delete |
| `/admin/packages/:packageId` | same file (`PackageDetail`) | The tier cards, with add / edit / duplicate / delete per tier and a live client-eye preview in the editor |
| `/admin/packages` → **Sent** tab | same file (`SentOffers`) | Every offer, its status, what was chosen, and a link to the project it created |
| `/portal/:token/packages` | `src/pages/portal/PortalPackages.tsx` | Where the client picks. The tab only appears once that client has an offer |
| `/join/:code` | `src/pages/JoinClient.tsx` | Public client sign-up (see §7) |

**`src/components/PackageCard.tsx`** renders the pricing card and is shared by
the admin tier view, the editor preview and the portal — so what you design is
literally what the client sees, with no second implementation to drift.
`accent: 'featured'` is the purple fill with gold accents; `'outlined'` is the
orange 2px border; `'plain'` is the default white card.

Nav: **Packages** sits under WORKFLOW in the admin sidebar, above Blueprints.

---

## 5. Database

### Tables

**`packages`** — `id`, `name`, `description`, `category`, `tiers` (jsonb),
`active`, `sortOrder`, `createdAt`

**`offers`** — `id`, `clientId`, `packageId`, `title`, `intro`, `status`,
`options` (jsonb), `selectedOptionId`, `selectedAt`, `projectId`, `expiresAt`,
`createdAt`

Both use quoted camelCase columns matching `src/types.ts` field-for-field, so
rows deserialize into the entity types with zero mapping — the house convention
throughout Packforge.

### RPCs

**`portal_select_package(p_token, p_offer_id, p_option_id) → jsonb`**
SECURITY DEFINER. Re-checks the portal token server-side, then in a **single
statement** creates the project, seeds its `phases` and `timeline` from the
option's blueprint, and flips the offer to `accepted`.

Returns `{ok: true, projectId, projectName}` or `{ok: false, error}`. Refusals:

| Condition | Message |
|---|---|
| Token matches no client | `Unknown portal link.` |
| Offer isn't that client's | `That set of packages was not found.` |
| Offer already decided | `This selection has already been made.` |
| Option id not in the offer | `Unknown package.` |

That third one is the important one: a double-click, a stale tab or a replayed
request gets refused rather than producing a second project.

**`portal_snapshot(p_token)`** carries an `offers` key filtered to
`status in ('sent','accepted')` — drafts and withdrawn offers never reach the
client's browser.

### Access

`anon` has **no table grants** on `packages` or `offers`. The portal reaches
them only through the scoped SECURITY DEFINER RPCs above. Admin CRUD runs as
`authenticated` under the `*_admin_all` RLS policies, which check
`auth.jwt()->>'email'` against the `app_admins` allow-list.

---

## 6. Design decisions worth not undoing

**Snapshot on send.** The single most important property here. An offer is a
record of what a client was shown; it must not change when the catalogue does.

**Tiers as jsonb.** See §2. Revisit only if something outside a package starts
referencing an individual tier.

**Selection is atomic and server-side.** Project creation, phase seeding and
offer closure happen in one statement inside the RPC. Doing this client-side
would open a window where a project exists but the offer is still `sent`.

**Nothing in the portal is optimistic here.** Quotes and contracts update
optimistically because they're reversible state changes. A package selection
*creates a project*, so the page waits for the server's answer and reports it.
On failure it re-reads the snapshot rather than guessing.

**Catalogue stays internal.** The portal's store sets `packages: []`. Clients
see only the offers addressed to them — never the full price list, never other
clients' pricing.

---

## 7. Client self-registration

**`/join/:code`** is a public route, outside both the portal provider and the
admin gate. A client fills in business name, contact, email, phone, location
and industry, and gets their own portal immediately — no account, no password.

**`portal_register_client(p_code, …)`** checks the code against
`settings."joinCode"`. That code is the *only* gate, which is why
**Settings → Client Sign-up** treats it as a shared secret: shown in full,
copyable, and rotatable. Rotating it immediately breaks every link already
sent — that's the point, and the UI says so before you do it.

The function **refuses to return a portal token for an email already on file**:

> We already have an account for that email — ask your contact to resend your portal link.

Without that, the form would be a way to fish for another client's portal by
guessing emails. It also refuses a blank business name or email, and an
unrecognised code (`This registration link is no longer valid.`).

Portal tokens are slugified from the business name with a numeric suffix on
collision, so `acme-coffee`, `acme-coffee-2`, and so on.

---

## 8. Gotchas

- **`active: false` hides a package from new offers only.** Offers already sent
  are unaffected — they hold their own copy.
- **Deleting a package doesn't retract anything.** Use **Withdraw** on the
  offer; that flips it to `withdrawn`, which `portal_snapshot` filters out.
- **The portal Packages tab is conditional.** It appears only when
  `offers.length > 0` for that client, so an untouched portal isn't cluttered
  with an empty section.
- **`PortalStore.refresh()` is real** (it was a no-op stub before this system).
  It re-reads `portal_snapshot` quietly — no spinner — which is what the
  packages page calls after a selection.
- **Price range on the catalogue card** is derived from the tiers, never
  stored. Same rule as everything else in Packforge.

---

## 9. Verification record

Checked against the live database, in rolled-back transactions, replaying the
app's exact write payloads:

- **Admin CRUD** as `authenticated` with the real JWT claims — create package,
  add tiers via a `tiers` update, create and withdraw an offer, delete: all
  pass RLS.
- **Portal round-trip** as `anon` against the real Branding Package — three
  tiers reach the snapshot; picking The Wolf returns
  `{ok: true, projectName: "The Wolf"}`; the replay is refused with
  *"This selection has already been made."*
- **Registration** — valid code creates the client and returns
  `portalToken: "acme-coffee"`; wrong code, blank fields and an email already
  on file are each refused with their own message.
- `tsc --noEmit` clean; `vite build` exit 0.

---

## 10. Where the code lives

```
src/
  types.ts                          Package, PackageTier, Offer, OfferOption, PackageAccent
  components/PackageCard.tsx        the shared pricing card
  pages/Packages.tsx                catalogue, tier detail, editors, send, sent list
  pages/JoinClient.tsx              public /join/:code sign-up
  pages/portal/PortalPackages.tsx   where the client picks
  pages/portal/PortalLayout.tsx     conditional Packages tab
  pages/Settings.tsx                Client Sign-up tab — show / copy / rotate the join code
  store/StudioStore.tsx             packages + offers collections
  store/PortalStore.tsx             offers from the snapshot; real refresh()
```

## 11. MCP access

The MCP server (`netlify/functions/mcp.mts`) exposes two package tools:

- **`list_packages`** — the catalogue with every tier, price and inclusion.
- **`create_package`** — a package plus all its tiers in one call. Validates that any `blueprintId` a tier points at actually exists, since a dangling reference would silently create a project with no phases. Returns an `editUrl` straight to the tier view.

**A model cannot send an offer.** It can build the catalogue; putting a package in front of a client stays a human action. There are still no update or delete tools, so the worst an error can do is leave a package to tidy up.

---

Database objects: tables `packages`, `offers`; functions
`portal_select_package`, `portal_register_client`; `portal_snapshot` extended
with `offers`; `settings."joinCode"`.
