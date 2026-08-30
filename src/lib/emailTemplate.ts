/**
 * LoneWolf branded email HTML.
 *
 * Mirrors the studio's real email design: 600px card on a soft-purple ground,
 * deep-purple header with an orange accent strip, orange eyebrow + dark H1,
 * an optional orange-barred callout, a pill CTA, and a deep-purple footer with
 * the "Your Brand's Digital Pack" tagline. Templates are stored as the inner
 * body markup; `wrapEmail` renders the full branded shell around them for
 * preview and (later) sending.
 */

const PURPLE = '#5B0FA8';
const PURPLE_DEEP = '#3D0A70';
const ORANGE = '#FF6B00';
const INK = '#2A2431';
const GROUND = '#EFE9F7';

export interface EmailBrand {
  studioName: string;
  tagline: string;
  website: string;
  email: string;
  phone: string;
  logoUrl?: string;
}

/** Wrap a template's inner body in the full branded email shell. */
export function wrapEmail(bodyHtml: string, brand: EmailBrand): string {
  const logo = brand.logoUrl
    ? `<img src="${brand.logoUrl}" width="210" alt="${escapeAttr(
        brand.studioName,
      )}" style="width:210px;max-width:70%;height:auto;display:block;">`
    : `<div style="font-family:'Montserrat',Arial,sans-serif;font-size:22px;font-weight:800;color:#ffffff;">Lone<span style="color:${ORANGE};">Wolf</span> <span style="color:#C9B8E4;font-weight:700;">Digital</span></div>`;

  return `<div style="background:${GROUND};padding:26px 12px;font-family:'Montserrat',Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(61,10,112,0.08);">
    <div style="background:${PURPLE};padding:24px 32px;">${logo}</div>
    <div style="height:5px;background:${ORANGE};font-size:0;line-height:0;">&nbsp;</div>
    <div style="padding:32px 40px 8px 40px;color:${INK};font-size:15px;line-height:1.62;">
      ${bodyHtml}
    </div>
    <div style="background:${PURPLE_DEEP};padding:22px 40px;">
      <p style="margin:0 0 4px 0;font-size:15px;color:#ffffff;font-weight:800;">${escapeHtml(
        brand.studioName,
      ).replace(/Inc$/, `<span style="color:${ORANGE};">Inc</span>`)}</p>
      <p style="margin:0 0 8px 0;font-size:12px;color:#C9B8E4;font-style:italic;">${escapeHtml(
        brand.tagline,
      )}</p>
      <p style="margin:0;font-size:12px;color:#B9A6D8;">${escapeHtml(brand.website)} &nbsp;·&nbsp; ${escapeHtml(
        brand.email,
      )} &nbsp;·&nbsp; ${escapeHtml(brand.phone)}</p>
    </div>
  </div>
</div>`;
}

/** An orange call-to-action pill button. */
export function emailButton(label: string, href = '#'): string {
  return `<div style="text-align:center;padding:24px 0 8px 0;">
    <a href="${href}" style="display:inline-block;padding:14px 38px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:40px;background:${ORANGE};">${escapeHtml(
      label,
    )}</a>
  </div>`;
}

/** An orange eyebrow label above a heading. */
export function emailEyebrow(text: string): string {
  return `<p style="margin:0 0 4px 0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${ORANGE};font-weight:700;">${escapeHtml(
    text,
  )}</p>`;
}

export function emailHeading(text: string): string {
  return `<h1 style="margin:0 0 16px 0;font-size:26px;line-height:1.2;color:${INK};font-weight:800;">${escapeHtml(
    text,
  )}</h1>`;
}

/** A soft callout box with an orange left bar. */
export function emailCallout(html: string): string {
  return `<table role="presentation" width="100%" style="background:#F4F1F8;border-radius:10px;border-left:4px solid ${PURPLE};margin:8px 0;"><tr><td style="padding:14px 18px;font-size:14px;line-height:1.55;color:${INK};">${html}</td></tr></table>`;
}

/**
 * The seed template bodies. `{{variables}}` are substituted at send time; the
 * preview shows them literally so the studio can see where merge fields land.
 */
export const SEED_EMAIL_BODIES = {
  invoice: `${emailEyebrow('Invoice')}
${emailHeading('Invoice {{invoiceNumber}}')}
<p style="margin:0 0 14px 0;">Hi {{clientName}},</p>
<p style="margin:0 0 14px 0;">Please find your invoice <strong>{{invoiceNumber}}</strong> for <strong>{{projectName}}</strong>. The full breakdown is available any time in your client portal.</p>
${emailCallout('Amount due: <strong style="color:#5B0FA8;">{{invoiceAmount}}</strong> &middot; Due {{dueDate}}')}
${emailButton('View in portal', '{{portalLink}}')}
<p style="margin:14px 0 4px 0;">Thank you for your business.</p>
<p style="margin:0 0 6px 0;">{{studioLead}}</p>`,

  quote: `${emailEyebrow('Project Quotation')}
${emailHeading('{{projectName}}')}
<p style="margin:0 0 14px 0;">Hi {{clientName}},</p>
<p style="margin:0 0 14px 0;">Thank you for the discussions so far. Your quotation is ready to review — the full scope and pricing breakdown are in your portal, and the PDF is attached.</p>
${emailCallout('Total: <strong style="color:#5B0FA8;">{{quoteAmount}}</strong> &middot; Valid until {{validUntil}}')}
${emailButton("Let's get started", '{{portalLink}}')}
<p style="margin:14px 0 4px 0;">Confirm your preferred option and we begin on receipt of the first milestone payment.</p>
<p style="margin:0 0 6px 0;">Cheers,<br>{{studioLead}}</p>`,

  phaseComplete: `${emailEyebrow('Project Update')}
${emailHeading('A phase just wrapped')}
<p style="margin:0 0 14px 0;">Hi {{clientName}},</p>
<p style="margin:0 0 14px 0;">Good news — we've completed a phase on <strong>{{projectName}}</strong>. Your latest deliverables are ready to review in the portal.</p>
${emailButton('See the latest', '{{portalLink}}')}
<p style="margin:14px 0 6px 0;">{{studioLead}}</p>`,

  contractExpiring: `${emailEyebrow('Reminder')}
${emailHeading('Your contract is expiring soon')}
<p style="margin:0 0 14px 0;">Hi {{clientName}},</p>
<p style="margin:0 0 14px 0;">This is a friendly reminder that your contract expires on <strong>{{expiryDate}}</strong>. We'd love to keep working together — just reply and we'll sort out a renewal.</p>
${emailButton('Talk about renewal', 'mailto:{{studioEmail}}')}
<p style="margin:14px 0 6px 0;">{{studioLead}}</p>`,

  welcome: `${emailEyebrow('Welcome to the pack')}
${emailHeading('Welcome, {{clientName}}')}
<p style="margin:0 0 14px 0;">We're thrilled to be your dedicated digital partner. Your private portal is where you'll track progress, review deliverables, approve work and handle billing — all in one place.</p>
${emailButton('Open your portal', '{{portalLink}}')}
<p style="margin:14px 0 6px 0;">Let's build something great together.<br>{{studioLead}}</p>`,
};
export type SeedEmailKey = keyof typeof SEED_EMAIL_BODIES;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;');
}
