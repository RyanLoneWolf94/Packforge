import type {
  Campaign,
  Client,
  Contract,
  EmailTemplate,
  Expense,
  FileAsset,
  Invoice,
  Lead,
  Newsletter,
  PlanTemplate,
  Project,
  Quote,
  StudioSettings,
  TeamMember,
  TimeEntry,
} from '../types';
import { STUDIO } from '../brand';
import { SEED_EMAIL_BODIES } from '../lib/emailTemplate';
import { phasesForTier, timelineForTier } from './phaseTemplates';

/**
 * Demo content for the studio, drawn from the real engagements in the Master KB
 * so the app demos with plausible work. Everything is linked by id, which is
 * what lets the client portal resolve one client's whole engagement.
 * Replaced wholesale once a real backend lands.
 */

const clients: Client[] = [
  {
    id: 'cl-cakes',
    name: 'Cakes & Bakes',
    contactName: 'Mavis Chijokwe',
    email: 'mavis@cakesandbakes.co.zw',
    phone: '+263 77 234 5566',
    location: 'Avondale, Harare',
    industry: 'Bakery & Catering',
    status: 'active',
    portalToken: 'cakes-and-bakes',
    createdAt: '2026-07-06',
  },
  {
    id: 'cl-wyfix',
    name: 'WYFIX (Pvt) Ltd',
    contactName: 'Tendai Moyo',
    email: 'tendai@wyfix.co.zw',
    phone: '+263 71 880 1120',
    location: 'Harare, Zimbabwe',
    industry: 'Construction & Chemical Products',
    status: 'active',
    portalToken: 'wyfix',
    createdAt: '2026-04-12',
  },
  {
    id: 'cl-greyview',
    name: 'Greyview Lodges',
    contactName: 'Nomsa Dube',
    email: 'stay@greyviewlodges.com',
    phone: '+263 78 445 9080',
    location: 'Nyanga, Zimbabwe',
    industry: 'Hospitality',
    status: 'active',
    portalToken: 'greyview',
    createdAt: '2026-05-28',
  },
  {
    id: 'cl-metoo',
    name: 'MeToo Foundation',
    contactName: 'Rutendo Sibanda',
    email: 'hello@metoofoundation.org',
    phone: '+263 77 991 2214',
    location: 'Bulawayo, Zimbabwe',
    industry: 'Non-profit / Advocacy',
    status: 'active',
    portalToken: 'metoo-foundation',
    createdAt: '2026-06-15',
  },
];

/** Sign off the first `count` delivery-timeline stages. */
function withStagesDone(timeline: Project['timeline'], count: number): Project['timeline'] {
  return timeline.map((week, idx) => ({ ...week, done: idx < count }));
}

/** Tick the first `count` deliverables of a project, in order, to fake progress. */
function withProgress(phases: Project['phases'], count: number): Project['phases'] {
  let remaining = count;
  return phases.map((phase) => ({
    ...phase,
    deliverables: phase.deliverables.map((d) => {
      if (remaining > 0) {
        remaining -= 1;
        return { ...d, done: true };
      }
      return d;
    }),
  }));
}

const projects: Project[] = [
  {
    id: 'pr-cakes',
    name: 'Cakes & Bakes Rebrand',
    clientId: 'cl-cakes',
    ref: 'C&B-0726',
    status: 'active',
    packageTier: 'wolf',
    packageName: 'The Wolf Package',
    startDate: '2026-07-06',
    targetDelivery: '2026-08-31',
    summary:
      'Full brand foundation engagement including a strategic rename, identity system, corporate setup and packaging.',
    phases: withProgress(phasesForTier('wolf'), 5),
    timeline: timelineForTier('wolf'),
    actionItems: [
      {
        id: 'ai-1',
        title: 'Review & confirm your new business name shortlist',
        detail: 'Sent separately for sign-off — this unlocks the logo suite work in Week 2.',
        resolved: false,
      },
      {
        id: 'ai-2',
        title: 'Confirm domain & registrar preference',
        detail:
          'Needed before Phase 3 technical setup begins — no credentials are retained by the studio after handover.',
        resolved: false,
      },
    ],
  },
  {
    id: 'pr-wyfix',
    name: 'WYFIX Brand Ecosystem',
    clientId: 'cl-wyfix',
    ref: 'WYF-1108',
    status: 'completed',
    packageTier: 'wolf',
    packageName: 'The Wolf Package',
    startDate: '2026-04-15',
    targetDelivery: '2026-05-20',
    summary:
      'End-to-end brand development for an industrial construction and chemical products manufacturer.',
    phases: withProgress(phasesForTier('wolf'), 99),
    timeline: withStagesDone(timelineForTier('wolf'), 4),
    actionItems: [],
    brandSnapshot: {
      name: 'WYFIX',
      tagline: 'Built to Hold',
      typography: 'Barlow Condensed / Inter',
      palette: [
        { label: 'Industrial Blue', hex: '#1B4F8C' },
        { label: 'Safety Amber', hex: '#F5A623' },
        { label: 'Concrete', hex: '#8B8B86' },
        { label: 'Ink', hex: '#1C1C1A' },
      ],
    },
  },
  {
    id: 'pr-greyview',
    name: 'Greyview Booking Platform',
    clientId: 'cl-greyview',
    ref: 'GVL-0526',
    status: 'active',
    packageTier: 'alpha',
    packageName: 'Alpha Pack',
    startDate: '2026-06-01',
    targetDelivery: '2026-09-25',
    summary:
      'Brand system plus a booking platform for two homestay properties, with an optional partner-network phase.',
    phases: withProgress(phasesForTier('alpha'), 12),
    timeline: withStagesDone(timelineForTier('alpha'), 2),
    actionItems: [
      {
        id: 'ai-3',
        title: 'Supply high-resolution property photography',
        detail: 'Needed for the website build in Weeks 7–9. Twelve images per property minimum.',
        resolved: false,
      },
    ],
    // Partially approved: name and palette are signed off, typography and
    // tagline are still open — the portal reveals only what exists.
    brandSnapshot: {
      name: 'Greyview Lodges',
      palette: [
        { label: 'Highland Green', hex: '#2F4B3F' },
        { label: 'Granite', hex: '#6E7472' },
        { label: 'Ember', hex: '#C4622D' },
      ],
    },
  },
  {
    id: 'pr-metoo',
    name: 'MeToo Foundation Portal',
    clientId: 'cl-metoo',
    ref: 'MTF-0626',
    status: 'planning',
    packageTier: 'pup',
    packageName: 'The Pup',
    startDate: '2026-09-01',
    targetDelivery: '2026-09-22',
    summary:
      'Foundational identity for a mission-driven advocacy organisation ahead of the volunteer portal build.',
    phases: phasesForTier('pup'),
    timeline: timelineForTier('pup'),
    actionItems: [],
  },
];

const invoices: Invoice[] = [
  {
    id: 'in-1',
    number: 'LW-2026-014',
    clientId: 'cl-cakes',
    projectId: 'pr-cakes',
    amount: 337.5,
    issueDate: '2026-08-01',
    dueDate: '2026-08-15',
    status: 'paid',
    paidAt: '2026-08-11',
    notes: 'Wolf Package — 50% deposit',
  },
  {
    id: 'in-2',
    number: 'LW-2026-021',
    clientId: 'cl-cakes',
    projectId: 'pr-cakes',
    amount: 337.5,
    issueDate: '2026-08-18',
    dueDate: '2026-09-01',
    status: 'sent',
    notes: 'Wolf Package — balance on handover',
  },
  {
    id: 'in-3',
    number: 'LW-2026-018',
    clientId: 'cl-greyview',
    projectId: 'pr-greyview',
    amount: 1150,
    issueDate: '2026-07-20',
    dueDate: '2026-08-03',
    status: 'overdue',
    notes: 'Alpha Pack — milestone 1',
  },
  {
    id: 'in-4',
    number: 'LW-2026-009',
    clientId: 'cl-wyfix',
    projectId: 'pr-wyfix',
    amount: 675,
    issueDate: '2026-05-21',
    dueDate: '2026-06-04',
    status: 'paid',
    paidAt: '2026-05-30',
    notes: 'Wolf Package — paid in full on handover',
  },
  {
    id: 'in-5',
    number: 'LW-2026-023',
    clientId: 'cl-metoo',
    projectId: 'pr-metoo',
    amount: 175,
    issueDate: '2026-08-20',
    dueDate: '2026-09-03',
    status: 'draft',
    notes: 'Pup Package — 50% deposit',
  },
];

const quotes: Quote[] = [
  {
    id: 'qt-1',
    number: 'QT-2026-007',
    title: 'Cakes & Bakes — Brand Foundation',
    clientId: 'cl-cakes',
    validUntil: '2026-07-31',
    status: 'accepted',
    timelineDays: 28,
    convertedProjectId: 'pr-cakes',
    milestones: [
      {
        id: 'qm-1',
        title: 'Phase 1 — Discovery, Renaming & Strategy',
        tasks: [
          { id: 'qt-a', title: 'Brand DNA & strategic definition', price: 85 },
          { id: 'qt-b', title: 'Strategic renaming exercise', price: 50 },
        ],
      },
      {
        id: 'qm-2',
        title: 'Phase 2 — Visual Identity',
        tasks: [
          { id: 'qt-c', title: 'Responsive logo suite', price: 95 },
          { id: 'qt-d', title: 'Colour & typography system', price: 40 },
        ],
      },
      {
        id: 'qm-3',
        title: 'Phase 3 — Corporate & Digital Setup',
        tasks: [
          { id: 'qt-e', title: 'Stationery & social kit', price: 85 },
          { id: 'qt-f', title: 'Domain, DNS & email', price: 50 },
        ],
      },
      {
        id: 'qm-4',
        title: 'Phase 4 — Packaging & Multimedia',
        tasks: [
          { id: 'qt-g', title: 'Packaging dielines ×5', price: 150 },
          { id: 'qt-h', title: 'Promo video & logo sting', price: 120 },
        ],
      },
    ],
  },
  {
    id: 'qt-2',
    number: 'QT-2026-012',
    title: 'Greyview — Booking Platform & Brand',
    clientId: 'cl-greyview',
    validUntil: '2026-06-15',
    status: 'accepted',
    timelineDays: 84,
    convertedProjectId: 'pr-greyview',
    milestones: [
      {
        id: 'qm-5',
        title: 'Brand System',
        tasks: [
          { id: 'qt-i', title: 'Identity & visual system', price: 700 },
          { id: 'qt-j', title: 'Packaging & multimedia', price: 400 },
        ],
      },
      {
        id: 'qm-6',
        title: 'Platform Build',
        tasks: [
          { id: 'qt-k', title: 'Website design & build', price: 700 },
          { id: 'qt-l', title: 'SEO, automation & launch', price: 500 },
        ],
      },
    ],
  },
  {
    id: 'qt-3',
    number: 'QT-2026-019',
    title: 'MeToo Foundation — Identity Starter',
    clientId: 'cl-metoo',
    validUntil: '2026-09-15',
    status: 'sent',
    timelineDays: 21,
    milestones: [
      {
        id: 'qm-7',
        title: 'Foundational Identity',
        tasks: [
          { id: 'qt-m', title: 'Discovery & brand strategy', price: 120 },
          { id: 'qt-n', title: 'Logo suite & visual system', price: 130 },
          { id: 'qt-o', title: 'Corporate & digital setup', price: 100 },
        ],
      },
    ],
  },
];

const contracts: Contract[] = [
  {
    id: 'ct-1',
    title: 'Service Agreement — Wolf Package',
    clientId: 'cl-cakes',
    projectId: 'pr-cakes',
    amount: 675,
    expires: '2026-12-31',
    status: 'signed',
    signedBy: 'Mavis Chijokwe',
    signedAt: '2026-07-06',
    autoRemind: true,
    body: '',
  },
  {
    id: 'ct-2',
    title: 'Master Service Agreement',
    clientId: 'cl-greyview',
    projectId: 'pr-greyview',
    amount: 2300,
    expires: '2026-09-10',
    status: 'signed',
    signedBy: 'Nomsa Dube',
    signedAt: '2026-06-01',
    autoRemind: true,
    body: '',
  },
  {
    id: 'ct-3',
    title: 'Service Agreement — Pup Package',
    clientId: 'cl-metoo',
    projectId: 'pr-metoo',
    amount: 350,
    expires: '2026-11-30',
    status: 'pending',
    autoRemind: false,
    body: '',
  },
  {
    id: 'ct-4',
    title: 'Brand Handover & Licence',
    clientId: 'cl-wyfix',
    projectId: 'pr-wyfix',
    amount: 675,
    expires: '2027-05-20',
    status: 'signed',
    signedBy: 'Tendai Moyo',
    signedAt: '2026-05-20',
    autoRemind: false,
    body: '',
  },
];

const files: FileAsset[] = [
  {
    id: 'fl-1',
    name: 'Cakes_and_Bakes_Brand_Strategy.pdf',
    kind: 'pdf',
    size: '2.4 MB',
    uploadedAt: '2026-07-24',
    folder: 'Deliverables',
    clientId: 'cl-cakes',
    projectId: 'pr-cakes',
    sharedWithClient: true,
  },
  {
    id: 'fl-2',
    name: 'Name_Shortlist_v3.docx',
    kind: 'doc',
    size: '148 KB',
    uploadedAt: '2026-07-28',
    folder: 'Deliverables',
    clientId: 'cl-cakes',
    projectId: 'pr-cakes',
    sharedWithClient: true,
  },
  {
    id: 'fl-3',
    name: 'Logo_Explorations_WIP.ai',
    kind: 'other',
    size: '18.2 MB',
    uploadedAt: '2026-08-14',
    folder: 'Working',
    clientId: 'cl-cakes',
    projectId: 'pr-cakes',
    sharedWithClient: false,
  },
  {
    id: 'fl-4',
    name: 'WYFIX_Brand_Manual.pdf',
    kind: 'pdf',
    size: '11.6 MB',
    uploadedAt: '2026-05-20',
    folder: 'Handover',
    clientId: 'cl-wyfix',
    projectId: 'pr-wyfix',
    sharedWithClient: true,
  },
  {
    id: 'fl-5',
    name: 'WYFIX_Assets_Final.zip',
    kind: 'zip',
    size: '242 MB',
    uploadedAt: '2026-05-20',
    folder: 'Handover',
    clientId: 'cl-wyfix',
    projectId: 'pr-wyfix',
    sharedWithClient: true,
  },
  {
    id: 'fl-6',
    name: 'Greyview_Property_Wireframes.pdf',
    kind: 'pdf',
    size: '3.8 MB',
    uploadedAt: '2026-08-06',
    folder: 'Deliverables',
    clientId: 'cl-greyview',
    projectId: 'pr-greyview',
    sharedWithClient: true,
  },
  {
    id: 'fl-7',
    name: 'Studio_Rate_Card_2026.pdf',
    kind: 'pdf',
    size: '96 KB',
    uploadedAt: '2026-01-08',
    folder: 'Internal',
    sharedWithClient: false,
  },
];

const expenses: Expense[] = [
  {
    id: 'ex-1',
    title: 'Adobe Creative Cloud',
    category: 'software',
    date: '2026-08-01',
    amount: 54.99,
    billable: false,
  },
  {
    id: 'ex-2',
    title: 'Figma Organisation',
    category: 'software',
    date: '2026-08-01',
    amount: 45,
    billable: false,
  },
  {
    id: 'ex-3',
    title: 'Voiceover artist — Shona narration',
    category: 'contractor',
    projectId: 'pr-cakes',
    date: '2026-08-12',
    amount: 85,
    billable: true,
  },
  {
    id: 'ex-4',
    title: 'Domain registration (2 yr)',
    category: 'other',
    projectId: 'pr-cakes',
    date: '2026-08-15',
    amount: 28,
    billable: true,
  },
  {
    id: 'ex-5',
    title: 'Property photography day rate',
    category: 'contractor',
    projectId: 'pr-greyview',
    date: '2026-07-30',
    amount: 220,
    billable: true,
  },
  {
    id: 'ex-6',
    title: 'Meta Ads — studio lead gen',
    category: 'marketing',
    date: '2026-08-05',
    amount: 150,
    billable: false,
  },
];

const leads: Lead[] = [
  {
    id: 'ld-1',
    name: 'Serene Haven Lodge',
    contactName: 'Farai Nyathi',
    email: 'info@serenehaven.co.zw',
    phone: '+263 77 118 4402',
    source: 'Referral — Greyview',
    stage: 'proposal',
    value: 675,
    notes: 'Wants monogram identity plus social strategy. Quote drafted.',
    createdAt: '2026-08-04',
  },
  {
    id: 'ld-2',
    name: 'Koki Delivery',
    contactName: 'Blessing Ncube',
    email: 'ops@koki.delivery',
    phone: '+263 71 552 0091',
    source: 'Website enquiry',
    stage: 'qualified',
    value: 2300,
    notes: 'App store optimisation and a performance audit for the courier app.',
    createdAt: '2026-07-29',
  },
  {
    id: 'ld-3',
    name: 'Acappella Productions',
    contactName: 'Danai Marufu',
    email: 'hello@acappella.vn',
    phone: '+84 90 224 8811',
    source: 'Instagram DM',
    stage: 'contacted',
    value: null,
    notes: 'Multi-channel content strategy for a vocal video series.',
    createdAt: '2026-08-18',
  },
  {
    id: 'ld-4',
    name: 'Hanoi Coffee Collective',
    contactName: 'Linh Pham',
    email: 'linh@hanoicoffee.vn',
    phone: '+84 91 776 3320',
    source: 'Website enquiry',
    stage: 'new',
    value: null,
    notes: 'Packaging refresh for a five-SKU retail range.',
    createdAt: '2026-08-21',
  },
];

const team: TeamMember[] = [
  {
    id: 'tm-1',
    name: 'Ryan M',
    role: 'Studio Lead — Strategy & Engineering',
    email: 'ryan@lonewolfdigitech.com',
    status: 'active',
    capacityHours: 40,
  },
  {
    id: 'tm-2',
    name: 'Sarah Dube',
    role: 'Contract Designer',
    email: 'sarah@lonewolfdigitech.com',
    status: 'busy',
    capacityHours: 20,
  },
  {
    id: 'tm-3',
    name: 'Jonas Karimba',
    role: 'Motion & Video',
    email: 'jonas@lonewolfdigitech.com',
    status: 'offline',
    capacityHours: 12,
  },
];

const today = new Date().toISOString().slice(0, 10);

const timeEntries: TimeEntry[] = [
  { id: 'te-1', projectId: 'pr-cakes', task: 'Name ideation workshop', seconds: 7200, date: today, billable: true },
  { id: 'te-2', projectId: 'pr-cakes', task: 'Logo sketching', seconds: 10800, date: today, billable: true },
  { id: 'te-3', projectId: 'pr-greyview', task: 'Booking flow wireframes', seconds: 14400, date: today, billable: true },
  { id: 'te-4', task: 'Studio admin & invoicing', seconds: 3600, date: today, billable: false },
];

const settings: StudioSettings = {
  studioName: STUDIO.name,
  website: STUDIO.website,
  email: STUDIO.email,
  phone: STUDIO.phone,
  whatsapp: STUDIO.whatsapp,
  address: 'Hanoi, Vietnam · Harare, Zimbabwe',
  lead: STUDIO.lead,
  notifications: {
    quoteAccepted: true,
    invoicePaid: true,
    contractExpiring: true,
    clientActionResolved: false,
  },
  integrations: {
    mailchimp: false,
    sendgrid: false,
    whatsapp: false,
    stripe: false,
  },
};

const emailTemplates: EmailTemplate[] = [
  {
    id: 'et-1',
    name: 'Invoice Sent',
    subject: 'Invoice {{invoiceNumber}} from {{studioName}}',
    category: 'Invoice',
    body: SEED_EMAIL_BODIES.invoice,
  },
  {
    id: 'et-2',
    name: 'Quote Ready',
    subject: 'Your quote for {{projectName}}',
    category: 'Quote',
    body: SEED_EMAIL_BODIES.quote,
  },
  {
    id: 'et-3',
    name: 'Phase Complete',
    subject: '{{projectName}} — a phase just wrapped',
    category: 'Update',
    body: SEED_EMAIL_BODIES.phaseComplete,
  },
  {
    id: 'et-4',
    name: 'Contract Expiring',
    subject: 'Notice: contract expiring soon',
    category: 'Reminder',
    body: SEED_EMAIL_BODIES.contractExpiring,
  },
  {
    id: 'et-5',
    name: 'Client Welcome',
    subject: 'Welcome to {{studioName}}',
    category: 'Onboarding',
    body: SEED_EMAIL_BODIES.welcome,
  },
];

const planTemplates: PlanTemplate[] = [
  {
    id: 'pt-wolf',
    title: 'Wolf Package — 4 Week',
    description: 'Standard brand foundation delivery plan.',
    phases: [
      { id: 'pp-1', name: 'Discovery & Strategy', days: 7, tone: 'purple' },
      { id: 'pp-2', name: 'Visual Identity', days: 7, tone: 'orange' },
      { id: 'pp-3', name: 'Corporate & Digital', days: 7, tone: 'gold' },
      { id: 'pp-4', name: 'Packaging & Handover', days: 7, tone: 'positive' },
    ],
  },
  {
    id: 'pt-web',
    title: 'Website Build Sprint',
    description: 'Design-to-launch plan for a marketing site.',
    phases: [
      { id: 'pp-5', name: 'Wireframes', days: 5, tone: 'purple' },
      { id: 'pp-6', name: 'Design System', days: 7, tone: 'orange' },
      { id: 'pp-7', name: 'Build & CMS', days: 14, tone: 'positive' },
      { id: 'pp-8', name: 'QA & Launch', days: 4, tone: 'gold' },
    ],
  },
];

const campaigns: Campaign[] = [
  {
    id: 'cp-1',
    name: 'Wolf Package — Q3 Push',
    channel: 'email',
    status: 'active',
    audience: 'Warm leads',
    sent: 320,
    openRate: 46,
    clickRate: 12,
    createdAt: '2026-08-05',
  },
  {
    id: 'cp-2',
    name: 'Harare Bakery Outreach',
    channel: 'whatsapp',
    status: 'completed',
    audience: 'Local F&B list',
    sent: 84,
    openRate: 88,
    clickRate: 34,
    createdAt: '2026-07-18',
  },
  {
    id: 'cp-3',
    name: 'Ad Design Starter Promo',
    channel: 'social',
    status: 'draft',
    audience: 'Instagram followers',
    sent: 0,
    openRate: 0,
    clickRate: 0,
    createdAt: '2026-08-20',
  },
];

const newsletters: Newsletter[] = [
  {
    id: 'nl-1',
    title: 'Why a logo is not a brand',
    audience: 'All subscribers',
    status: 'published',
    sentAt: '2026-07-30',
    updatedAt: '2026-07-30',
  },
  {
    id: 'nl-2',
    title: 'Packaging that sells on the shelf',
    audience: 'Retail & F&B',
    status: 'draft',
    updatedAt: '2026-08-19',
  },
];

export const SEED = {
  clients,
  projects,
  invoices,
  quotes,
  contracts,
  files,
  expenses,
  leads,
  team,
  timeEntries,
  emailTemplates,
  planTemplates,
  campaigns,
  newsletters,
  settings,
};
