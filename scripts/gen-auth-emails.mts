/**
 * Generate LoneWolf-branded HTML for Supabase's auth emails, so sign-in mail
 * looks like the rest of the brand instead of a default Supabase notice.
 *
 * Paste the output into Supabase → Authentication → Emails → Templates.
 * Supabase substitutes `{{ .ConfirmationURL }}` / `{{ .Token }}` itself, so
 * those placeholders are left untouched.
 *
 *   npx tsx scripts/gen-auth-emails.mts > docs/supabase-auth-emails.html
 */
import { emailButton, emailCallout, emailEyebrow, emailHeading, wrapEmail } from '../src/lib/emailTemplate';
import { STUDIO } from '../src/brand';

/** Emails can't use relative paths — the logo needs an absolute, public URL. */
const SITE = 'https://lonewolf-packforge.netlify.app';

const brand = {
  studioName: STUDIO.name,
  tagline: STUDIO.tagline,
  website: STUDIO.website,
  email: STUDIO.email,
  phone: STUDIO.phone,
  logoUrl: `${SITE}/lonewolf-logo.png`,
};

const templates: { name: string; subject: string; body: string }[] = [
  {
    name: 'Magic Link',
    subject: 'Your Packforge sign-in link',
    body: [
      emailEyebrow('Sign in'),
      emailHeading('Your sign-in link'),
      `<p style="margin:0 0 14px 0;">Use the button below to sign in to Packforge. The link works once and expires shortly.</p>`,
      emailButton('Sign in to Packforge', '{{ .ConfirmationURL }}'),
      emailCallout(
        `If you didn't request this, you can ignore this email — nobody can sign in without the link.`,
      ),
      `<p style="margin:14px 0 6px 0;">${STUDIO.lead}</p>`,
    ].join('\n'),
  },
  {
    name: 'Confirm signup',
    subject: 'Confirm your Packforge account',
    body: [
      emailEyebrow('Account'),
      emailHeading('Confirm your email'),
      `<p style="margin:0 0 14px 0;">Confirm this address to finish setting up your Packforge account.</p>`,
      emailButton('Confirm email address', '{{ .ConfirmationURL }}'),
      `<p style="margin:14px 0 6px 0;">${STUDIO.lead}</p>`,
    ].join('\n'),
  },
  {
    name: 'Reset password',
    subject: 'Reset your Packforge password',
    body: [
      emailEyebrow('Security'),
      emailHeading('Reset your password'),
      `<p style="margin:0 0 14px 0;">Use the button below to choose a new password. The link expires shortly.</p>`,
      emailButton('Choose a new password', '{{ .ConfirmationURL }}'),
      emailCallout(`Didn't ask for this? Ignore this email and your password stays as it is.`),
      `<p style="margin:14px 0 6px 0;">${STUDIO.lead}</p>`,
    ].join('\n'),
  },
];

const out: string[] = [];
for (const t of templates) {
  out.push(`<!-- ==========================================================`);
  out.push(`     TEMPLATE: ${t.name}`);
  out.push(`     SUBJECT:  ${t.subject}`);
  out.push(`     Paste everything between the markers below into the`);
  out.push(`     "${t.name}" template body in Supabase.`);
  out.push(`     ========================================================== -->`);
  out.push(`<!-- ---- BEGIN ${t.name} ---- -->`);
  out.push(wrapEmail(t.body, brand));
  out.push(`<!-- ---- END ${t.name} ---- -->\n`);
}
console.log(out.join('\n'));
