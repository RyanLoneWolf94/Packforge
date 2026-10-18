import type { TierId } from './brand';

/* ------------------------------------------------------------------ *
 * Studio domain model
 *
 * Everything is keyed by id and related through `clientId` / `projectId`
 * rather than by matching display names. That's what lets the client portal
 * resolve "everything belonging to this client" in one pass, and what stops
 * a renamed client from orphaning its invoices.
 * ------------------------------------------------------------------ */

export type UserRole = 'admin' | 'manager' | 'team' | 'client';

export interface Client {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  location: string;
  industry: string;
  status: 'active' | 'inactive';
  /** Token used in the client portal share link (`/portal/:token`). */
  portalToken: string;
  createdAt: string;
}

/* ------------------------------- Projects ------------------------------ */

export type ProjectStatus = 'planning' | 'active' | 'review' | 'completed' | 'archived';
export type PhaseStatus = 'upcoming' | 'active' | 'done';

export interface Deliverable {
  id: string;
  title: string;
  description: string;
  done: boolean;
}

export interface TrackerPhase {
  id: string;
  name: string;
  /** Phase budget. Summed for the project total. */
  budget: number;
  deliverables: Deliverable[];
  /** Shared file location (Drive/Docs) surfaced to the client once set. */
  link: string;
}

/** An item blocking progress that the client, not the studio, has to resolve. */
export interface ActionItem {
  id: string;
  title: string;
  detail: string;
  resolved: boolean;
}

/**
 * One stage of the delivery plan, shown as the client-facing timeline.
 *
 * `done` is set by the studio rather than derived from phase progress: a stage
 * can be signed off even when a stray deliverable is still open, and the
 * calendar plan doesn't always map one-to-one onto phases.
 */
export interface TimelineWeek {
  id: string;
  label: string;
  title: string;
  points: string[];
  done: boolean;
}

/**
 * The client's emerging identity. Every field is optional and revealed
 * independently, so the portal can show what has actually been signed off so
 * far (a new name in week 1, the palette in week 2) instead of staying fully
 * locked until the whole identity lands.
 */
export interface BrandSnapshot {
  name?: string;
  tagline?: string;
  palette?: { label: string; hex: string }[];
  typography?: string;
  /** Where the approved logo suite lives, once there is one. */
  logoUrl?: string;
}

export interface Project {
  id: string;
  name: string;
  clientId: string;
  /** Human-facing reference, e.g. "C&B-0726". */
  ref: string;
  status: ProjectStatus;
  packageTier: TierId | 'custom';
  packageName: string;
  startDate: string;
  targetDelivery: string;
  summary: string;
  phases: TrackerPhase[];
  timeline: TimelineWeek[];
  actionItems: ActionItem[];
  brandSnapshot?: BrandSnapshot;
  /** The blueprint this project was seeded from, if any. */
  blueprintId?: string;
}

/* ---------------------------- Internal tasks --------------------------- */

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

/** Board lanes. Stored as text so a future custom lane doesn't need a migration. */
export type TaskLane = 'Todo' | 'In Progress' | 'Done';

/**
 * A studio-internal working task on a project's Kanban board. Deliberately
 * separate from `Deliverable`: deliverables are the client-facing contract of
 * what gets shipped, these are how the studio gets there, and clients never
 * see them.
 */
export interface ProjectTask {
  id: string;
  projectId: string;
  lane: TaskLane;
  title: string;
  /** Priority tags — 'High' | 'Medium' | 'Low' in practice. */
  tags: string[];
  dueDate: string;
  assignee: string;
  subtasks: Subtask[];
  /**
   * Whether the client sees this on their portal. Defaults to true so a board
   * is useful to them immediately; untick to keep scratch work internal.
   */
  clientVisible: boolean;
  /**
   * The phase this task belongs to, if it has been organised into one.
   * Phases live inside the project, so this is a plain id reference.
   */
  phaseId?: string;
  /** Position within its lane. */
  sortOrder: number;
  createdAt: string;
}

/* ------------------------------- Invoices ------------------------------ */

export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'paid'
  | 'partially-paid'
  | 'overdue'
  | 'cancelled';

export interface Invoice {
  id: string;
  number: string;
  clientId: string;
  projectId?: string;
  amount: number;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  notes: string;
  paidAt?: string;
}

/* -------------------------------- Quotes ------------------------------- */

export interface QuoteTask {
  id: string;
  title: string;
  price: number;
}

export interface QuoteMilestone {
  id: string;
  title: string;
  tasks: QuoteTask[];
}

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';

export interface Quote {
  id: string;
  number: string;
  title: string;
  clientId: string;
  validUntil: string;
  status: QuoteStatus;
  /** Priced work breakdown. The quote total is derived from these, never stored. */
  milestones: QuoteMilestone[];
  timelineDays: number;
  convertedProjectId?: string;
  /** The blueprint this quote was started from, if any. */
  blueprintId?: string;
}

/* ------------------------------- Contracts ----------------------------- */

export type ContractStatus = 'draft' | 'pending' | 'signed' | 'expired';

export interface Contract {
  id: string;
  title: string;
  clientId: string;
  projectId?: string;
  amount: number;
  expires: string;
  status: ContractStatus;
  signedBy?: string;
  signedAt?: string;
  autoRemind: boolean;
  /** The agreement's terms, shown to the client in the portal for review. */
  body: string;
  /**
   * Evidence of signing: a PNG data URL when drawn, or `TEXT:<name>:<font>`
   * when typed. Captured at signing rather than discarded.
   */
  signature?: string;
}

/* --------------------------------- Files ------------------------------- */

export type FileKind = 'pdf' | 'image' | 'doc' | 'zip' | 'video' | 'other';

export interface FileAsset {
  id: string;
  name: string;
  kind: FileKind;
  size: string;
  uploadedAt: string;
  folder: string;
  clientId?: string;
  projectId?: string;
  /**
   * Whether the client can see this in their portal. Internal working files
   * stay hidden by default so the studio can keep scratch work in the same
   * library as deliverables.
   */
  sharedWithClient: boolean;
  url?: string;
  /** Set when the file was uploaded to storage rather than linked elsewhere. */
  storagePath?: string;
}

/* ------------------------------- Expenses ------------------------------ */

export type ExpenseCategory =
  | 'software'
  | 'contractor'
  | 'marketing'
  | 'travel'
  | 'office'
  | 'other';

export interface Expense {
  id: string;
  title: string;
  category: ExpenseCategory;
  projectId?: string;
  date: string;
  amount: number;
  /** Rebillable to the client, as opposed to studio overhead. */
  billable: boolean;
}

/* --------------------------------- Leads ------------------------------- */

export type LeadStage = 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost';

export interface Lead {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  source: string;
  stage: LeadStage;
  value: number | null;
  notes: string;
  createdAt: string;
}

/* --------------------------------- Team -------------------------------- */

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  email: string;
  status: 'active' | 'busy' | 'offline';
  /** Weekly availability, used for the utilisation readout. */
  capacityHours: number;
}

/* ------------------------------ Time entries --------------------------- */

export interface TimeEntry {
  id: string;
  projectId?: string;
  task: string;
  seconds: number;
  date: string;
  billable: boolean;
}

/* ------------------------------- Settings ------------------------------ */

/**
 * Studio-level settings, persisted as a single record. Studio profile fields
 * feed the invoice PDF and client portal, so editing them here changes what
 * clients see — the reason this can't just be a static constant.
 */
export interface StudioSettings {
  studioName: string;
  website: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  lead: string;
  /**
   * Code embedded in the client self-registration link. Rotating it
   * invalidates every link already handed out.
   */
  joinCode: string;
  /** Notification preferences, keyed by event. */
  notifications: {
    quoteAccepted: boolean;
    invoicePaid: boolean;
    contractExpiring: boolean;
    clientActionResolved: boolean;
  };
  /** Third-party connections. Real wiring lands with the backend; the flag is honest. */
  integrations: {
    mailchimp: boolean;
    sendgrid: boolean;
    whatsapp: boolean;
    stripe: boolean;
  };
}

/* --------------------------- Email templates --------------------------- */

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
}

/* ------------------------------ Blueprints ----------------------------- */

/**
 * A reusable, editable template for a kind of engagement — for any business
 * line, not just branding. A blueprint carries everything needed to start
 * work in one step:
 *
 * - `milestones`: the priced breakdown, copied into a quote.
 * - `phases`: the delivery workflow with deliverables, seeded into the tracker.
 * - `timeline`: the client-facing stages shown in the portal.
 *
 * Its price is derived from the milestones, never stored. Quotes and projects
 * remember which blueprint they came from via `blueprintId`; a quote built
 * from scratch can be saved back as a new blueprint.
 */
export interface Blueprint {
  id: string;
  title: string;
  /** Business line, e.g. "Branding", "Digital Marketing", "Software Development". */
  category: string;
  description: string;
  milestones: QuoteMilestone[];
  phases: TrackerPhase[];
  timeline: TimelineWeek[];
  timelineDays: number;
  createdAt: string;
}

/** Suggested business lines. Free text elsewhere — these just seed the picker. */
export const BLUEPRINT_CATEGORIES = [
  'Branding',
  'Digital Marketing',
  'Software Development',
  'Web Design',
  'Ad Design',
  'Video & Motion',
  'Other',
] as const;

/* ------------------------------- Packages ------------------------------ */

/**
 * A priced option shown to a client while the work is still being discussed —
 * the pricing cards. Distinct from a Blueprint, which exists to speed up
 * quoting and delivery; a package may point at one so that choosing it seeds
 * a real delivery plan, but it doesn't have to.
 */
export type PackageAccent = 'plain' | 'outlined' | 'featured';

/**
 * One priced card inside a package — "The Pup", "The Wolf".
 *
 * Tiers only exist inside their package: they are created, edited and sent
 * together, and nothing references a tier from outside, so they live in the
 * package row rather than a table of their own.
 */
export interface PackageTier {
  id: string;
  name: string;
  tagline: string;
  price: number;
  /** e.g. "one-off", "per month" — shown beside the price. */
  period: string;
  /** Bullet list, exactly as the client reads it. */
  features: string[];
  /** Ribbon text such as "Best Value". Empty for none. */
  badge: string;
  accent: PackageAccent;
  timelineDays: number;
  /** Optional delivery plan used when a client picks this tier. */
  blueprintId?: string;
}

/**
 * A named set of tiers — "Branding Package", "Social Media Package".
 *
 * This is the unit you build and the unit you send: a client receives the
 * whole package and picks one tier from it.
 */
export interface Package {
  id: string;
  name: string;
  description: string;
  category: string;
  tiers: PackageTier[];
  active: boolean;
  sortOrder: number;
  createdAt: string;
}

/**
 * One option inside an offer. A snapshot of a tier taken when the offer was
 * sent, so later edits to the package can't silently change what a client was
 * shown.
 */
export interface OfferOption {
  id: string;
  /** The tier this was copied from, if it still exists. */
  tierId?: string;
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

export type OfferStatus = 'draft' | 'sent' | 'accepted' | 'withdrawn';

/**
 * A package sent to one client to choose a tier from. When they pick one, the
 * database creates the project and closes the offer in a single step.
 */
export interface Offer {
  id: string;
  clientId: string;
  /** The package it was built from. Kept for reporting; options are the truth. */
  packageId?: string;
  title: string;
  intro: string;
  status: OfferStatus;
  options: OfferOption[];
  selectedOptionId?: string;
  selectedAt?: string;
  /** The project created on selection. */
  projectId?: string;
  expiresAt?: string;
  createdAt: string;
}

/* ------------------------------ Marketing ------------------------------ */

export type CampaignChannel = 'email' | 'whatsapp' | 'social';
export type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'completed';

export interface Campaign {
  id: string;
  name: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  audience: string;
  sent: number;
  openRate: number;
  clickRate: number;
  createdAt: string;
}

export type NewsletterStatus = 'draft' | 'scheduled' | 'published';

export interface Newsletter {
  id: string;
  title: string;
  audience: string;
  status: NewsletterStatus;
  sentAt?: string;
  updatedAt: string;
}
