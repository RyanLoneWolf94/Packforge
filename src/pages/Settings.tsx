import { useEffect, useState } from 'react';
import { Bell, Building2, PlugZap, RotateCcw, User } from 'lucide-react';
import { toast } from 'sonner';
import {
  Button,
  Card,
  Field,
  Input,
  Modal,
  PageHeader,
  StatusPill,
  Textarea,
} from '@/src/components/ui';
import { cn } from '@/src/lib/utils';
import { useStudio } from '@/src/store/StudioStore';
import type { StudioSettings } from '@/src/types';

type TabId = 'studio' | 'notifications' | 'integrations' | 'data';

const TABS: { id: TabId; label: string; icon: typeof User }[] = [
  { id: 'studio', label: 'Studio Profile', icon: Building2 },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'integrations', label: 'Integrations', icon: PlugZap },
  { id: 'data', label: 'Data', icon: RotateCcw },
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
  whatsapp: { name: 'WhatsApp Business', blurb: 'Message clients from the studio.' },
  stripe: { name: 'Stripe', blurb: 'Collect invoice payments online.' },
};

export default function Settings() {
  const { settings, updateSettings, resetToSeed } = useStudio();
  const [tab, setTab] = useState<TabId>('studio');

  return (
    <div className="max-w-[1000px] space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Studio details here appear on invoices and in every client portal."
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
          {tab === 'data' ? <DataSettings onReset={resetToSeed} /> : null}
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
          toast.success('Studio profile saved — invoices and portals updated');
        }}
        className="space-y-5"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Studio Name">
            <Input
              value={form.studioName}
              onChange={(e) => setForm({ ...form, studioName: e.target.value })}
            />
          </Field>
          <Field label="Studio Lead">
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
            Save Studio Profile
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
        you use so the studio is ready to switch them on.
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

function DataSettings({ onReset }: { onReset: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <Card className="p-7">
      <h3 className="disp font-extrabold text-ink">Local Data</h3>
      <p className="text-sm text-ink-soft mt-1 max-w-lg">
        Everything in Packforge is stored in this browser for now. You can reset it back to the
        starting demo content at any time — useful before a live demo, or to clear test entries.
      </p>
      <Button variant="danger" icon={RotateCcw} className="mt-5" onClick={() => setConfirm(true)}>
        Reset to demo data
      </Button>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Reset all data?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                onReset();
                setConfirm(false);
                toast.success('Data reset to demo content');
              }}
            >
              Reset Everything
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">
          This clears every client, project, invoice, quote and setting you've changed, and
          restores the original demo content. It can't be undone.
        </p>
      </Modal>
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
