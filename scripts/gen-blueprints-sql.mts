/**
 * One-off: emit INSERT SQL for the starter blueprint library. The three
 * branding tiers are derived from the proven phase templates so their
 * breakdown, workflow and timeline agree; the rest are examples for the
 * studio's other business lines. Run:  npx tsx scripts/gen-blueprints-sql.mts
 */
import { BRANDING_PACKAGES } from '../src/brand';
import { TIER_BLUEPRINTS } from '../src/data/phaseTemplates';

const q = (v: unknown) => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
const s = (v: string) => `'${v.replace(/'/g, "''")}'`;

let n = 0;
const id = (p: string) => `${p}-${(n++).toString(36)}`;

type Row = {
  id: string;
  title: string;
  category: string;
  description: string;
  milestones: unknown;
  phases: unknown;
  timeline: unknown;
  timelineDays: number;
};
const rows: Row[] = [];

/** Spread a phase budget across its deliverables, remainder on the last. */
const spread = (total: number, count: number, i: number) =>
  i === count - 1 ? total - Math.floor(total / count) * (count - 1) : Math.floor(total / count);

for (const pkg of BRANDING_PACKAGES) {
  const bp = TIER_BLUEPRINTS[pkg.id];
  rows.push({
    id: `bp-${pkg.id}`,
    title: pkg.name,
    category: 'Branding',
    description: pkg.bestFor,
    milestones: bp.phases.map((ph) => ({
      id: id('qm'),
      title: ph.name,
      tasks: ph.deliverables.map((d, i, arr) => ({
        id: id('qt'),
        title: d.title,
        price: spread(ph.budget, arr.length, i),
      })),
    })),
    phases: bp.phases.map((ph) => ({
      id: id('ph'),
      name: ph.name,
      budget: ph.budget,
      link: '',
      deliverables: ph.deliverables.map((d) => ({ id: id('dl'), ...d, done: false })),
    })),
    timeline: bp.timeline.map((w) => ({ id: id('wk'), ...w, done: false })),
    timelineDays: bp.timeline.length * 7,
  });
}

// ---- Other business lines ----
type Item = [title: string, description: string, price: number];
const custom = (
  title: string,
  category: string,
  description: string,
  timelineDays: number,
  phases: { name: string; items: Item[] }[],
  timeline: { label: string; title: string; points: string[] }[],
) =>
  rows.push({
    id: `bp-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    title,
    category,
    description,
    timelineDays,
    milestones: phases.map((ph) => ({
      id: id('qm'),
      title: ph.name,
      tasks: ph.items.map(([t, , p]) => ({ id: id('qt'), title: t, price: p })),
    })),
    phases: phases.map((ph) => ({
      id: id('ph'),
      name: ph.name,
      link: '',
      budget: ph.items.reduce((a, [, , p]) => a + p, 0),
      deliverables: ph.items.map(([t, d]) => ({
        id: id('dl'),
        title: t,
        description: d,
        done: false,
      })),
    })),
    timeline: timeline.map((w) => ({ id: id('wk'), ...w, done: false })),
  });

custom(
  'Social Growth Retainer',
  'Digital Marketing',
  'Monthly content, community and paid-social management for a growing brand.',
  30,
  [
    {
      name: 'Strategy & Setup',
      items: [
        ['Channel audit & competitor scan', 'Where the brand stands today', 120],
        ['Content pillars & monthly calendar', 'Themes, cadence and formats agreed', 100],
      ],
    },
    {
      name: 'Content Production',
      items: [
        ['12 static posts', 'Designed to the brand system', 240],
        ['4 short-form videos', 'Scripted, shot and edited for Reels/TikTok', 320],
        ['Captions & hashtag sets', 'Written and scheduled', 60],
      ],
    },
    {
      name: 'Paid & Reporting',
      items: [
        ['Paid-social campaign management', 'Setup, targeting and optimisation', 200],
        ['Monthly performance report', 'Reach, engagement, leads and next steps', 80],
      ],
    },
  ],
  [
    { label: 'Week 1', title: 'Strategy & Setup', points: ['Audit', 'Content pillars', 'Calendar approved'] },
    { label: 'Weeks 2–3', title: 'Production', points: ['Posts designed', 'Videos shot & cut', 'Scheduling'] },
    { label: 'Week 4', title: 'Paid & Report', points: ['Campaign live', 'Optimisation', 'Monthly report'] },
  ],
);

custom(
  'Web App MVP',
  'Software Development',
  'A production-ready minimum viable product: scoped, designed, built and shipped.',
  56,
  [
    {
      name: 'Discovery & Scoping',
      items: [
        ['Requirements workshop', 'User stories, priorities and success metrics', 250],
        ['Technical architecture', 'Stack, data model and integrations', 200],
      ],
    },
    {
      name: 'Design',
      items: [
        ['User flows & wireframes', 'Every core journey mapped', 300],
        ['High-fidelity UI', 'Design system and key screens', 400],
      ],
    },
    {
      name: 'Build',
      items: [
        ['Backend & database', 'Auth, API and data layer', 900],
        ['Frontend build', 'Responsive app on the design system', 900],
        ['Integrations', 'Payments, email, third-party APIs', 350],
      ],
    },
    {
      name: 'Launch',
      items: [
        ['QA & security pass', 'Testing, hardening and fixes', 300],
        ['Deployment & handover', 'Hosting, CI/CD, docs and training', 250],
      ],
    },
  ],
  [
    { label: 'Weeks 1–2', title: 'Discovery & Scoping', points: ['Workshop', 'Architecture', 'Scope signed off'] },
    { label: 'Weeks 3–4', title: 'Design', points: ['Wireframes', 'UI design', 'Design approved'] },
    { label: 'Weeks 5–7', title: 'Build', points: ['Backend', 'Frontend', 'Integrations'] },
    { label: 'Week 8', title: 'Launch', points: ['QA', 'Deploy', 'Handover'] },
  ],
);

custom(
  'Marketing Website',
  'Web Design',
  'A fast, on-brand marketing site with CMS, SEO foundations and analytics.',
  28,
  [
    {
      name: 'Plan',
      items: [['Sitemap & content plan', 'Pages, messaging and calls to action', 150]],
    },
    {
      name: 'Design & Build',
      items: [
        ['Responsive page designs', 'Home plus up to 5 inner pages', 450],
        ['Build & CMS integration', 'Editable content, forms, performance', 600],
      ],
    },
    {
      name: 'Launch',
      items: [
        ['Technical SEO & analytics', 'Schema, sitemaps, tracking', 150],
        ['Go-live & training', 'Domain, hosting, editor walkthrough', 100],
      ],
    },
  ],
  [
    { label: 'Week 1', title: 'Plan', points: ['Sitemap', 'Content plan'] },
    { label: 'Weeks 2–3', title: 'Design & Build', points: ['Page designs', 'Build', 'CMS'] },
    { label: 'Week 4', title: 'Launch', points: ['SEO & analytics', 'Go-live', 'Training'] },
  ],
);

custom(
  'Ad Creative Pack',
  'Ad Design',
  'A fast-turnaround set of ad creatives for a campaign, static and animated.',
  5,
  [
    {
      name: 'Creative',
      items: [
        ['Campaign concept & copy', 'Hook, message and CTA per placement', 40],
        ['7 static ad creatives', 'Sized for feed, story and display', 105],
        ['3 animated variants', 'Motion versions of the lead creatives', 60],
      ],
    },
  ],
  [
    { label: 'Days 1–2', title: 'Concept', points: ['Brief', 'Concept & copy'] },
    { label: 'Days 3–5', title: 'Production', points: ['Statics', 'Animations', 'Exports'] },
  ],
);

const cols = '(id,title,category,description,milestones,phases,timeline,"timelineDays","createdAt")';
const values = rows
  .map(
    (r) =>
      `  (${s(r.id)}, ${s(r.title)}, ${s(r.category)}, ${s(r.description)}, ${q(r.milestones)}, ${q(r.phases)}, ${q(r.timeline)}, ${r.timelineDays}, '2026-09-15')`,
  )
  .join(',\n');
console.log(`insert into public.blueprints ${cols} values\n${values};`);
