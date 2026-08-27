import { PageHeader, Card, Button, StatusPill } from '@/src/components/ui';
import { toast } from 'sonner';
import { useStudio } from '@/src/store/StudioStore';
import type { StudioSettings } from '@/src/types';

/**
 * Marketing integrations. These are the same connection flags managed on the
 * Settings page — surfaced here as cards. Toggling marks a provider as in-use;
 * live sending activates once the backend is connected, so the copy is honest
 * rather than pretending an OAuth flow that doesn't exist yet.
 */

const PROVIDERS: {
  key: keyof StudioSettings['integrations'];
  name: string;
  blurb: string;
  glyph: string;
  tone: string;
}[] = [
  {
    key: 'mailchimp',
    name: 'Mailchimp',
    blurb: 'Sync contacts and send newsletters to your audience.',
    glyph: 'M',
    tone: 'bg-gold-dim text-gold-deep',
  },
  {
    key: 'sendgrid',
    name: 'SendGrid',
    blurb: 'Reliable transactional email for invoices and updates.',
    glyph: 'SG',
    tone: 'bg-purple-dim text-purple',
  },
  {
    key: 'whatsapp',
    name: 'WhatsApp Business',
    blurb: 'Message clients and run campaigns over WhatsApp.',
    glyph: 'WA',
    tone: 'bg-positive-dim text-positive',
  },
  {
    key: 'stripe',
    name: 'Stripe',
    blurb: 'Let clients pay invoices online from their portal.',
    glyph: 'S',
    tone: 'bg-orange-dim text-orange',
  },
];

export default function Integrations() {
  const { settings, updateSettings } = useStudio();

  const toggle = (key: keyof StudioSettings['integrations'], name: string) => {
    const next = !settings.integrations[key];
    updateSettings({ integrations: { ...settings.integrations, [key]: next } });
    toast.success(next ? `${name} marked ready` : `${name} disabled`);
  };

  return (
    <div className="max-w-[1200px] space-y-6">
      <PageHeader
        title="Integrations"
        subtitle="Connect the tools you use. Live wiring activates with the backend."
      />

      <div className="rounded-xl bg-gold-dim border border-gold/30 px-4 py-3 text-[13px] text-gold-deep">
        Marking a provider as used records your intent so the studio is configured and ready. Actual
        sending and payments switch on when the backend is deployed.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {PROVIDERS.map((p) => {
          const connected = settings.integrations[p.key];
          return (
            <Card key={p.key} className="p-6 flex flex-col items-center text-center gap-4">
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl ${p.tone}`}
              >
                {p.glyph}
              </div>
              <div>
                <div className="flex items-center justify-center gap-2">
                  <h3 className="font-bold text-ink">{p.name}</h3>
                  <StatusPill tone={connected ? 'positive' : 'neutral'}>
                    {connected ? 'On' : 'Off'}
                  </StatusPill>
                </div>
                <p className="text-sm text-ink-soft mt-1.5">{p.blurb}</p>
              </div>
              <Button
                variant={connected ? 'secondary' : 'primary'}
                className="w-full mt-auto"
                onClick={() => toggle(p.key, p.name)}
              >
                {connected ? 'Disable' : 'Mark as used'}
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
