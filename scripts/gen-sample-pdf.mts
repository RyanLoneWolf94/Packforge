/**
 * One-off: render sample invoice + quote PDFs with the real document builder,
 * so the output can be eyeballed outside the browser. Run with:
 *   npx tsx scripts/gen-sample-pdf.mts
 */
import { writeFileSync } from 'node:fs';
import { buildDocument, type DocConfig } from '../src/lib/pdf';

const settings = {
  studioName: 'LoneWolf Digital Inc',
  website: 'lonewolfdigitech.com',
  email: 'ryan@lonewolfdigitech.com',
  phone: '+1 (647) 436 7094',
  whatsapp: '12898070728',
  address: 'Hanoi / Harare',
  lead: 'Ryan',
  notifications: { quoteAccepted: true, invoicePaid: true, contractExpiring: true, clientActionResolved: false },
  integrations: { mailchimp: false, sendgrid: false, whatsapp: false, stripe: false },
};

const client = {
  id: 'c1',
  name: 'Koki Technologies',
  contactName: 'Blessing Ncube',
  email: 'kokidelivery.co',
  phone: '',
  location: '',
  industry: 'Koki Delivery Platform',
  status: 'active' as const,
  portalToken: 'koki',
  createdAt: '2026-08-27',
};

const quoteConfig: DocConfig = {
  kind: 'SERVICE QUOTE',
  reference: 'LW-QT-KOKI-002',
  refLabel: 'Quote Ref',
  dateLabel: 'Date',
  dateValue: 'Aug 27, 2026',
  secondaryLabel: 'Valid Until',
  secondaryValue: 'Sep 10, 2026',
  client,
  scope:
    'Resolution of two active Google Play Console compliance warnings for the Koki Delivery application (com.koki.service) under the Koki Technologies developer account.',
  items: [
    {
      title: 'Target API Level Update',
      description:
        'Update targetSdkVersion to API level 35 (Android 15) as required by Google Play policy. Includes Uni-App recompile, compatibility testing, and Play Store submission.',
      meta: 'Aug 31, 2026',
      amount: 70,
    },
    {
      title: 'Developer Account Inactivity Resolution',
      description:
        "Resolve account closure warning by publishing the updated app build. Satisfies Google's active developer requirement.",
      meta: 'Sep 16, 2026',
      amount: 50,
    },
  ],
  total: 120,
  notes: [
    'Item 1 is time critical. The API level update must be submitted before August 31, 2026 or the account will be blocked from publishing updates.',
    "Completing Item 1 automatically resolves Item 2, as the app update satisfies Google's active developer requirement before September 16.",
    'This quote covers the build update and submission only. Deeper dependency issues surfaced during recompile will be scoped and quoted separately.',
  ],
  payment: 'Full payment of $120.00 USD due upon completion and confirmation of successful submission.',
  settings,
};

const invoiceConfig: DocConfig = {
  kind: 'INVOICE',
  reference: 'LW-2026-014',
  refLabel: 'Invoice #',
  dateLabel: 'Issued',
  dateValue: 'Aug 1, 2026',
  secondaryLabel: 'Due',
  secondaryValue: 'Aug 15, 2026',
  client,
  items: [
    {
      title: 'Wolf Package — 50% deposit',
      description: 'Cakes & Bakes Rebrand (C&B-0726)',
      amount: 337.5,
    },
  ],
  total: 337.5,
  payment: 'Amount due: $337.50. Status: SENT.',
  settings,
};

async function main() {
  for (const config of [quoteConfig, invoiceConfig]) {
    const doc = await buildDocument(config);
    if (!doc) throw new Error('buildDocument returned null');
    const bytes = doc.output('arraybuffer') as ArrayBuffer;
    const out = `sample-${config.reference}.pdf`;
    writeFileSync(out, Buffer.from(bytes));
    console.log('wrote', out, Buffer.from(bytes).length, 'bytes');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
