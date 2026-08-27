import { useMemo, useState } from 'react';
import {
  BarChart3,
  Edit2,
  Mail,
  Megaphone,
  MessageCircle,
  Plus,
  Search,
  Send,
  Share2,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  StatCard,
  StatusPill,
} from '@/src/components/ui';
import { formatDate } from '@/src/lib/utils';
import { useStudio } from '@/src/store/StudioStore';
import type { Campaign, CampaignChannel, CampaignStatus } from '@/src/types';

const CHANNELS: CampaignChannel[] = ['email', 'whatsapp', 'social'];
const STATUSES: CampaignStatus[] = ['draft', 'scheduled', 'active', 'completed'];

const CHANNEL_ICON = { email: Mail, whatsapp: MessageCircle, social: Share2 } as const;

const STATUS_TONE: Record<CampaignStatus, 'positive' | 'warning' | 'brand' | 'neutral'> = {
  active: 'positive',
  scheduled: 'warning',
  draft: 'neutral',
  completed: 'brand',
};

type FormState = {
  name: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  audience: string;
};

const blankForm = (): FormState => ({
  name: '',
  channel: 'email',
  status: 'draft',
  audience: '',
});

export default function Campaigns() {
  const { campaigns, add, update, remove } = useStudio();

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return campaigns
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.audience.toLowerCase().includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [campaigns, query]);

  const totalSent = campaigns.reduce((s, c) => s + c.sent, 0);
  const active = campaigns.filter((c) => c.status === 'active').length;

  const openAdd = () => {
    setEditingId(null);
    setForm(blankForm());
    setIsOpen(true);
  };

  const openEdit = (campaign: Campaign) => {
    setEditingId(campaign.id);
    setForm({
      name: campaign.name,
      channel: campaign.channel,
      status: campaign.status,
      audience: campaign.audience,
    });
    setIsOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Campaign name is required');
      return;
    }
    if (editingId) {
      update('campaigns', editingId, form);
      toast.success('Campaign updated');
    } else {
      add('campaigns', {
        ...form,
        sent: 0,
        openRate: 0,
        clickRate: 0,
        createdAt: new Date().toISOString().slice(0, 10),
      });
      toast.success('Campaign created');
    }
    setIsOpen(false);
  };

  return (
    <div className="max-w-[1200px] space-y-6">
      <PageHeader
        title="Campaigns"
        subtitle="Plan email, WhatsApp and social pushes. Sending activates with the backend."
        actions={
          <Button icon={Plus} onClick={openAdd}>
            New Campaign
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard icon={Megaphone} tone="purple" value={campaigns.length} label="Campaigns" />
        <StatCard icon={Send} tone="orange" value={active} label="Active Now" />
        <StatCard icon={BarChart3} tone="gold" value={totalSent.toLocaleString()} label="Total Sent" />
      </div>

      <Card className="p-4">
        <div className="relative max-w-sm">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search campaigns…"
            className="pl-10"
          />
        </div>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Megaphone}
            title="No campaigns"
            description="Create your first campaign to start planning outreach."
            action={
              <Button icon={Plus} onClick={openAdd}>
                New Campaign
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left min-w-[720px]">
              <thead>
                <tr className="text-[10px] text-ink-faint font-bold uppercase tracking-widest bg-surface-2">
                  <th className="px-5 py-3">Campaign</th>
                  <th className="px-5 py-3">Channel</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Performance</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((campaign) => {
                  const Icon = CHANNEL_ICON[campaign.channel];
                  return (
                    <tr key={campaign.id} className="hover:bg-surface-2/60 transition-colors group">
                      <td className="px-5 py-4">
                        <div className="text-[13px] font-bold text-ink">{campaign.name}</div>
                        <div className="text-[11px] text-ink-faint">
                          {campaign.audience || 'No audience set'} · {formatDate(campaign.createdAt)}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-soft capitalize">
                          <Icon size={14} className="text-ink-faint" />
                          {campaign.channel}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <StatusPill tone={STATUS_TONE[campaign.status]}>{campaign.status}</StatusPill>
                      </td>
                      <td className="px-5 py-4">
                        {campaign.sent > 0 ? (
                          <div className="flex items-center gap-4 text-[12px] font-medium text-ink-soft">
                            <span title="Sent">{campaign.sent.toLocaleString()} sent</span>
                            <span title="Open rate">{campaign.openRate}% open</span>
                            <span title="Click rate">{campaign.clickRate}% click</span>
                          </div>
                        ) : (
                          <span className="text-[12px] text-ink-faint">Not sent yet</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          {campaign.status === 'draft' ? (
                            <button
                              onClick={() => {
                                update('campaigns', campaign.id, { status: 'scheduled' });
                                toast.success('Campaign scheduled');
                              }}
                              title="Schedule"
                              className="p-1.5 text-ink-faint hover:text-positive hover:bg-positive-dim rounded transition-colors"
                            >
                              <Send size={15} />
                            </button>
                          ) : null}
                          <button
                            onClick={() => openEdit(campaign)}
                            title="Edit"
                            className="p-1.5 text-ink-faint hover:text-purple hover:bg-purple-dim rounded transition-colors"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => {
                              remove('campaigns', campaign.id);
                              toast.success('Campaign deleted');
                            }}
                            title="Delete"
                            className="p-1.5 text-ink-faint hover:text-red hover:bg-red-dim rounded transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title={editingId ? 'Edit Campaign' : 'New Campaign'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="campaign-form">
              {editingId ? 'Save Changes' : 'Create Campaign'}
            </Button>
          </>
        }
      >
        <form id="campaign-form" onSubmit={submit} className="space-y-4">
          <Field label="Campaign Name">
            <Input
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Autumn Branding Promo"
            />
          </Field>
          <Field label="Audience">
            <Input
              value={form.audience}
              onChange={(e) => setForm({ ...form, audience: e.target.value })}
              placeholder="e.g. Warm leads"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Channel">
              <Select
                value={form.channel}
                onChange={(e) => setForm({ ...form, channel: e.target.value as CampaignChannel })}
              >
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as CampaignStatus })}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </form>
      </Modal>
    </div>
  );
}
