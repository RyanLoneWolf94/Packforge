import { useEffect, useState } from 'react';
import {
  ArrowCounterClockwise,
  ArrowsClockwise,
  Bell,
  Buildings,
  Copy,
  PlugsConnected,
  UserPlus,
  User,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import {
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  StatusPill,
  Textarea,
} from '@/src/components/ui';
import { cn } from '@/src/lib/utils';
import { useStudio } from '@/src/store/StudioStore';
import type { StudioSettings } from '@/src/types';

type TabId = 'studio' | 'notifications' | 'integrations' | 'access' | 'data';

const TABS: { id: TabId; label: string; icon: typeof User }[] = [
  { id: 'studio', label: 'Business Profile', icon: Buildings },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'integrations', label: 'Integrations', icon: PlugsConnected },
  { id: 'access', label: 'Client Sign-up', icon: UserPlus },
  { id: 'data', label: 'Data', icon: ArrowCounterClockwise },
];

const NOTIFICATION_LABELS: Record<keyof StudioSettings['notifications'], string> = {
  quoteAccepted: 'A client accepts a quote',
  invoicePaid: 'An invoice is marked paid',
  contractExpiring: 'A contract is nearing expiry',
  clientActionResolved: 'A client resolves an action item',
};

const INTEGRATION_META: Record<
  keyof StudioSettings['integrations'],
  { name: string; blurb: string }
> = {
  mailchimp: { name: 'Mailchimp', blurb: 'Sync contacts and send newsletters.' },
  sendgrid: { name: 'SendGrid', blurb: 'Transactional email delivery.' },
  whatsapp: { name: 'WhatsApp Business', blurb: 'Message clients from Packforge.' },
  stripe: { name: 'Stripe', blurb: 'Collect invoice payments online.' },
};

export default function Settings() {
  const { settings, updateSettings, refresh } = useStudio();
  const [tab, setTab] = useState<TabId>('studio');

  return (
    <div className="max-w-[1000px] space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Business details here appear on invoices and in every client portal."
      />

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="w-full lg:w-56 shrink-0 flex lg:flex-col gap-1.5 overflow-x-auto scrollbar-none">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-bold transition-colors whitespace-nowrap',
                tab === t.id
                  ? 'bg-night text-white'
                  : 'text-ink-soft hover:text-ink hover:bg-surface-2',
              )}
            >
              <t.icon size={17} className={tab === t.id ? 'text-orange' : ''} />
              {t.label}
            </button>
          ))}
        </aside>

        <div className="flex-1 min-w-0">
          {tab === 'studio' ? (
            <StudioProfile settings={settings} onSave={updateSettings} />
          ) : null}
          {tab === 'notifications' ? (
            <NotificationSettings settings={settings} onSave={updateSettings} />
          ) : null}
          {tab === 'integrations' ? (
            <IntegrationSettings settings={settings} onSave={updateSettings} />
          ) : null}
          {tab === 'access' ? (
            <ClientSignup settings={settings} onSave={updateSettings} />
          ) : null}
          {tab === 'data' ? <DataSettings onRefresh={refresh} /> : null}
        </div>
      </div>
    </div>
  );
}

function StudioProfile({
  settings,
  onSave,
}: {
  settings: StudioSettings;
  onSave: (patch: Partial<StudioSettings>) => void;
}) {
  // Buffer edits locally so the whole form saves at once, not per keystroke.
  const [form, setForm] = useState(settings);
  useEffect(() => setForm(settings), [settings]);

  const dirty = JSON.stringify(form) !== JSON.stringify(settings);

  return (
    <Card className="p-7">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(form);
          toast.success('Profile saved — invoices and portals updated');
        }}
        className="space-y-5"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Business Name">
            <Input
              value={form.studioName}
              onChange={(e) => setForm({ ...form, studioName: e.target.value })}
            />
          </Field>
          <Field label="Lead Contact">
            <Input value={form.lead} onChange={(e) => setForm({ ...form, lead: e.target.value })} />
          </Field>
          <Field label="Website">
            <Input
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />
          </Field>
          <Field label="Contact Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="WhatsApp Number" hint="Digits only, incl. country code">
            <Input
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Address / Locations" hint="Shown on invoices">
          <Textarea
            rows={2}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={!dirty}>
            Save Profile
          </Button>
        </div>
      </form>
    </Card>
  );
}

function NotificationSettings({
  settings,
  onSave,
}: {
  settings: StudioSettings;
  onSave: (patch: Partial<StudioSettings>) => void;
}) {
  const keys = Object.keys(settings.notifications) as (keyof StudioSettings['notifications'])[];
  return (
    <Card className="p-7 space-y-3">
      <p className="text-sm text-ink-soft mb-2">Choose which events email you a heads-up.</p>
      {keys.map((key) => (
        <div
          key={key}
          className="flex items-center justify-between gap-4 p-4 bg-surface-2 rounded-xl"
        >
          <span className="text-sm font-semibold text-ink">{NOTIFICATION_LABELS[key]}</span>
          <Toggle
            checked={settings.notifications[key]}
            onChange={(v) => {
              onSave({ notifications: { ...settings.notifications, [key]: v } });
              toast.success('Preference saved');
            }}
          />
        </div>
      ))}
    </Card>
  );
}

function IntegrationSettings({
  settings,
  onSave,
}: {
  settings: StudioSettings;
  onSave: (patch: Partial<StudioSettings>) => void;
}) {
  const keys = Object.keys(settings.integrations) as (keyof StudioSettings['integrations'])[];
  return (
    <Card className="p-7">
      <div className="rounded-xl bg-gold-dim border border-gold/30 px-4 py-3 mb-5 text-[13px] text-gold-deep">
        Live sending goes through these once the backend is connected. You can pre-mark which ones
        you use so they're ready to switch on.
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {keys.map((key) => {
          const meta = INTEGRATION_META[key];
          const connected = settings.integrations[key];
          return (
            <div
              key={key}
              className="border border-line rounded-xl p-5 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-ink">{meta.name}</h3>
                  <p className="text-xs text-ink-soft mt-0.5">{meta.blurb}</p>
                </div>
                <StatusPill tone={connected ? 'positive' : 'neutral'}>
                  {connected ? 'On' : 'Off'}
                </StatusPill>
              </div>
              <Button
                variant={connected ? 'secondary' : 'primary'}
                size="sm"
                className="mt-auto"
                onClick={() => {
                  onSave({
                    integrations: { ...settings.integrations, [key]: !connected },
                  });
                  toast.success(
                    connected ? `${meta.name} disabled` : `${meta.name} marked ready`,
                  );
                }}
              >
                {connected ? 'Disable' : 'Mark as used'}
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function DataSettings({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <Card className="p-7">
      <h3 className="disp font-extrabold text-ink">Your Data</h3>
      <p className="text-sm text-ink-soft mt-1 max-w-lg">
        Your data lives in the cloud, not in this browser — every change saves as you make
        it, and the same records appear on any device you sign in from. Client portals read from
        the same source, so what you change here is what clients see.
      </p>
      <p className="text-sm text-ink-soft mt-3 max-w-lg">
        Pull the latest copy if you've been editing from another device, or if a save reported an
        error.
      </p>
      <Button
        variant="secondary"
        icon={ArrowCounterClockwise}
        className="mt-5"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onRefresh();
            toast.success('Reloaded from the cloud');
          } catch {
            toast.error("Couldn't reach the server");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Reloading…' : 'Reload from cloud'}
      </Button>
    </Card>
  );
}

/**
 * The client sign-up link.
 *
 * `joinCode` is the whole gate on `portal_register_client`, so it is treated
 * like a shared secret: shown in full, copyable, and replaceable the moment it
 * has been somewhere it should not have been. Rotating it immediately breaks
 * every link already sent out, which is the point.
 */
function ClientSignup({
  settings,
  onSave,
}: {
  settings: StudioSettings;
  onSave: (patch: Partial<StudioSettings>) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const code = settings.joinCode ?? '';
  const link = code ? `${window.location.origin}/join/${code}` : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy — select the link and copy it manually');
    }
  };

  const rotate = () => {
    const next = Array.from(crypto.getRandomValues(new Uint8Array(12)))
      .map((b) => b.toString(36).padStart(2, '0'))
      .join('')
      .slice(0, 18);
    onSave({ joinCode: next });
    setConfirming(false);
    toast.success('New link generated — the old one no longer works');
  };

  return (
    <Card className="p-7 space-y-6">
      <div>
        <h2 className="disp text-lg font-extrabold text-ink tracking-tight">
          Client sign-up link
        </h2>
        <p className="text-[13.5px] text-ink-soft mt-1.5 leading-relaxed">
          Send this to anyone you want in the portal. They fill in their details and get their
          own portal straight away — no account or password needed.
        </p>
      </div>

      {link ? (
        <div className="flex gap-2 flex-wrap">
          <Input readOnly value={link} className="flex-1 min-w-[260px] font-mono text-[12.5px]" />
          <Button variant="secondary" icon={Copy} onClick={copy}>
            Copy
          </Button>
        </div>
      ) : (
        <p className="text-[13.5px] text-ink-soft">
          No link yet — generate one to start inviting clients.
        </p>
      )}

      <div className="pt-5 border-t border-line space-y-3">
        <p className="text-[12.5px] text-ink-soft leading-relaxed">
          Anyone with the link can register, so treat it like a password. Replacing it breaks
          every copy already sent out.
        </p>
        {confirming ? (
          <div className="flex gap-2">
            <Button variant="danger" onClick={rotate}>
              Yes, replace it
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="secondary" icon={ArrowsClockwise} onClick={() => setConfirming(true)}>
            {link ? 'Generate a new link' : 'Generate link'}
          </Button>
        )}
      </div>
    </Card>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative w-11 h-6 rounded-full transition-colors shrink-0',
        checked ? 'bg-orange' : 'bg-line',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
          checked && 'translate-x-5',
        )}
      />
    </button>
  );
}
