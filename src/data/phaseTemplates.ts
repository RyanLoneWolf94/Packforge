import type { TierId } from '../brand';
import type { TimelineWeek, TrackerPhase } from '../types';

/**
 * Phase blueprints per service tier, derived from SOP-001 and the phase
 * structure proven on the Cakes & Bakes engagement. Applying a template to a
 * project seeds its phases, deliverables and budget split in one step, so a
 * new client dashboard doesn't have to be hand-built each time.
 *
 * Phase budgets sum to the package price in `BRANDING_PACKAGES`.
 */

type PhaseBlueprint = {
  name: string;
  budget: number;
  deliverables: { title: string; description: string }[];
};

type TierBlueprint = {
  phases: PhaseBlueprint[];
  timeline: Omit<TimelineWeek, 'id' | 'done'>[];
};

const DISCOVERY: PhaseBlueprint['deliverables'] = [
  { title: 'Kickoff & Intake Review', description: 'Brief, references and preferences confirmed' },
  { title: 'Brand DNA & Strategic Definition', description: 'Values, positioning, pillars, tone of voice' },
  { title: 'Audience Mapping', description: 'Primary segments & buying behaviour' },
  { title: 'Ideation Pass', description: 'Brand nouns → visual metaphors → initial sketches' },
];

const IDENTITY: PhaseBlueprint['deliverables'] = [
  { title: 'Custom Responsive Logo Suite', description: 'Developed from ideation through to final, unlimited revisions' },
  { title: 'Logo Breakdown & Usage Rules', description: 'Clearance zones, construction grid, size minimums' },
  { title: 'Visual Identity System', description: 'Colour palette, typography hierarchy, brand pattern' },
];

const CORPORATE: PhaseBlueprint['deliverables'] = [
  { title: 'Business Card Design', description: 'Print-ready files' },
  { title: 'Letterhead Template', description: 'PDF + editable DOCX' },
  { title: 'Social Media Kit', description: 'Facebook, X, LinkedIn covers' },
  { title: 'Email Signature Design', description: 'Branded, on-system' },
];

const IT_SETUP: PhaseBlueprint['deliverables'] = [
  { title: 'Domain Registration & DNS', description: 'Pending client registrar preference' },
  { title: 'Professional Email Setup', description: 'name@clientdomain.com' },
];

const MULTIMEDIA: PhaseBlueprint['deliverables'] = [
  { title: 'Packaging Layouts ×5', description: 'Technical dielines for core product range' },
  { title: '30-Second Brand Promo Video', description: 'AI-assisted visuals, scripted & storyboarded' },
  { title: 'Voiceover Integration', description: 'Culturally reviewed for the target market' },
  { title: 'Logo Sting / Animation', description: 'Motion reveal, MP4 + GIF' },
  { title: 'Social Ad Creatives', description: 'Static + animated set' },
  { title: 'Mockups ×6', description: 'High-fidelity, photorealistic applications' },
];

const HANDOVER: PhaseBlueprint['deliverables'] = [
  { title: 'Brand Manual', description: 'Complete reference document' },
  { title: 'Full Asset Handover', description: 'Raw + exported files transferred' },
];

export const TIER_BLUEPRINTS: Record<TierId, TierBlueprint> = {
  /* The Pup — $350 */
  pup: {
    phases: [
      { name: 'Discovery & Brand Strategy', budget: 120, deliverables: DISCOVERY.slice(0, 3) },
      { name: 'Visual Identity & Logo Suite', budget: 130, deliverables: IDENTITY },
      {
        name: 'Corporate & Digital Setup',
        budget: 100,
        deliverables: [...CORPORATE, ...HANDOVER.slice(0, 1)],
      },
    ],
    timeline: [
      { label: 'Week 1', title: 'Discovery & Strategy', points: ['Brand DNA', 'Audience mapping', 'Direction agreed'] },
      { label: 'Week 2', title: 'Identity Build-Out', points: ['Logo suite', 'Colour & type system', 'Brand patterns'] },
      { label: 'Week 3', title: 'Setup & Handover', points: ['Stationery', 'Social covers', 'Brand manual'] },
    ],
  },

  /* The Wolf — $675. Mirrors the live Cakes & Bakes dashboard structure. */
  wolf: {
    phases: [
      {
        name: 'Discovery, Renaming & Brand Strategy',
        budget: 135,
        deliverables: [
          ...DISCOVERY,
          { title: 'Strategic Renaming Exercise', description: 'New business name & tagline finalized here, in Phase 1 only' },
          { title: 'Brand Strategy Document', description: 'Comprehensive write-up: name, tagline, positioning' },
        ],
      },
      { name: 'Visual Identity & Logo Suite', budget: 135, deliverables: IDENTITY },
      { name: 'Corporate, Digital & IT Setup', budget: 135, deliverables: [...CORPORATE, ...IT_SETUP] },
      {
        name: 'Packaging & Multimedia Marketing',
        budget: 270,
        deliverables: [...MULTIMEDIA, ...HANDOVER],
      },
    ],
    timeline: [
      {
        label: 'Week 1 · Phase 1',
        title: 'Discovery, Renaming & Brand Strategy',
        points: ['Brand DNA workshop', 'New name & tagline finalized', 'Audience mapping', 'Brand Strategy Document'],
      },
      {
        label: 'Week 2 · Phase 2',
        title: 'Visual Identity Build-Out',
        points: ['Logo suite finalized', 'Colour & typography system', 'Brand patterns'],
      },
      {
        label: 'Week 3 · Phase 3',
        title: 'Corporate & Digital Setup',
        points: ['Stationery & letterhead', 'Social kit & email signature', 'Domain, DNS & email'],
      },
      {
        label: 'Week 4 · Phase 4',
        title: 'Packaging, Multimedia & Handover',
        points: ['Dielines finalized', 'Promo video + animation', 'Mockups & brand manual', 'Full asset handover'],
      },
    ],
  },

  /* Alpha Pack — $2,300. Wolf plus web engineering and growth. */
  alpha: {
    phases: [
      {
        name: 'Discovery, Renaming & Brand Strategy',
        budget: 270,
        deliverables: [
          ...DISCOVERY,
          { title: 'Competitive & Market Research', description: 'Positioning against local and regional players' },
          { title: 'Brand Strategy Document', description: 'Comprehensive write-up: name, tagline, positioning' },
        ],
      },
      { name: 'Visual Identity & Logo Suite', budget: 230, deliverables: IDENTITY },
      { name: 'Corporate, Digital & IT Setup', budget: 200, deliverables: [...CORPORATE, ...IT_SETUP] },
      { name: 'Packaging & Multimedia Marketing', budget: 400, deliverables: MULTIMEDIA },
      {
        name: 'Website Design & Build',
        budget: 700,
        deliverables: [
          { title: 'Sitemap & Wireframes', description: 'Page architecture and user flows' },
          { title: 'Responsive Design System', description: 'Mobile-first layouts built on the brand system' },
          { title: 'Build & CMS Integration', description: 'Production build with editable content' },
          { title: 'Online Booking System', description: 'Enquiry or booking flow wired end to end' },
          { title: 'Performance & Security Pass', description: 'Core Web Vitals, SSL, dependency audit' },
        ],
      },
      {
        name: 'SEO, Automation & Launch',
        budget: 500,
        deliverables: [
          { title: 'Technical SEO Foundations', description: 'Schema, sitemaps, crawlability, page speed' },
          { title: 'Keyword & Content Architecture', description: 'Pillar pages, clusters, internal linking' },
          { title: 'Social Ads ×20 + Campaign Setup', description: 'Creative set with campaign structure' },
          { title: 'Newsletter & Campaign Automations', description: 'List, segmentation and nurture sequences' },
          ...HANDOVER,
        ],
      },
    ],
    timeline: [
      { label: 'Weeks 1–2', title: 'Discovery & Strategy', points: ['Brand DNA', 'Market research', 'Strategy document'] },
      { label: 'Weeks 3–4', title: 'Identity & Corporate', points: ['Logo suite', 'Visual system', 'Stationery & IT setup'] },
      { label: 'Weeks 5–6', title: 'Packaging & Multimedia', points: ['Dielines', 'Promo video', 'Ad creatives'] },
      { label: 'Weeks 7–9', title: 'Website Build', points: ['Wireframes', 'Design system', 'Build & CMS'] },
      { label: 'Weeks 10–12', title: 'Growth & Launch', points: ['Technical SEO', 'Campaign setup', 'Handover'] },
    ],
  },
};

let seq = 0;
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

/** Build a fresh, unticked set of phases for a tier. */
export function phasesForTier(tier: TierId): TrackerPhase[] {
  return TIER_BLUEPRINTS[tier].phases.map((phase) => ({
    id: uid('ph'),
    name: phase.name,
    budget: phase.budget,
    link: '',
    deliverables: phase.deliverables.map((d) => ({
      id: uid('dl'),
      title: d.title,
      description: d.description,
      done: false,
    })),
  }));
}

/** Build the client-facing delivery timeline for a tier. */
export function timelineForTier(tier: TierId): TimelineWeek[] {
  return TIER_BLUEPRINTS[tier].timeline.map((week) => ({
    ...week,
    id: uid('wk'),
    done: false,
  }));
}
