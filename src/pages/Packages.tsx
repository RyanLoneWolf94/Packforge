import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Copy,
  Eye,
  EyeSlash,
  PaperPlaneTilt,
  PencilSimple,
  Plus,
  Stack,
  Trash,
} from '@phosphor-icons/react';
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
  StatusPill,
  Textarea,
} from '@/src/components/ui';
import PackageCard from '@/src/components/PackageCard';
import { cn, formatCurrency, formatDate } from '@/src/lib/utils';
import { useStudio } from '@/src/store/StudioStore';
import {
  BLUEPRINT_CATEGORIES,
  type OfferOption,
  type Package,
  type PackageAccent,
} from '@/src/types';

/**
 * The package catalogue and the offers built from it.
 *
 * Packages are what a client sees while the work is still being discussed —
 * priced cards they choose between. Sending a set of them creates an offer in
 * that client's portal; when they pick one, the database creates the project
 * and closes the offer in a single step.
 */

let seq = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

const ACCENTS: { id: PackageAccent; label: string }[] = [
  { id: 'plain', label: 'Plain' },
  { id: 'outlined', label: 'Outlined' },
  { id: 'featured', label: 'Featured (dark)' },
];

type FormState = {
  name: string;
  tagline: string;
  price: string;
  period: string;
  features: string;
  badge: string;
  accent: PackageAccent;
  category: string;
  timelineDays: string;
  blueprintId: string;
  active: boolean;
};

const blankForm = (): FormState => ({
  name: '',
  tagline: '',
  price: '',
  period: 'one-off',
  features: '',
  badge: '',
  accent: 'plain',
  category: 'Branding',
  timelineDays: '28',
  blueprintId: '',
  active: true,
});

const toFeatures = (text: string) =>
  text.split('\n').map((l) => l.trim()).filter(Boolean);

export default function Packages() {
  const { packages, offers, blueprints, clients, clientFor, add, update, remove } = useStudio();

  const [tab, setTab] = useState<'catalogue' | 'offers'>('catalogue');
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [confirmDelete, setConfirmDelete] = useState<Package | null>(null);

  // Send flow
  const [sendOpen, setSendOpen] = useState(false);
  const [send, setSend] = useState({
    clientId: '',
    title: 'Choose your package',
    intro: '',
    picked: [] as string[],
  });

  const sorted = useMemo(
    () => [...packages].sort((a, b) => a.sortOrder - b.sortOrder || a.price - b.price),
    [packages],
  );
  const categories = useMemo(
    () => [...new Set([...BLUEPRINT_CATEGORIES, ...packages.map((p) => p.category)])],
    [packages],
  );

  const openAdd = () => {
    setEditingId(null);
    setForm(blankForm());
    setIsOpen(true);
  };

  const openEdit = (pkg: Package) => {
    setEditingId(pkg.id);
    setForm({
      name: pkg.name,
      tagline: pkg.tagline,
      price: String(pkg.price),
      period: pkg.period,
      features: pkg.features.join('\n'),
      badge: pkg.badge,
      accent: pkg.accent,
      category: pkg.category,
      timelineDays: String(pkg.timelineDays),
      blueprintId: pkg.blueprintId ?? '',
      active: pkg.active,
    });
    setIsOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Give the package a name');
      return;
    }
    const payload = {
      name: form.name.trim(),
      tagline: form.tagline.trim(),
      price: Number(form.price) || 0,
      period: form.period.trim(),
      features: toFeatures(form.features),
      badge: form.badge.trim(),
      accent: form.accent,
      category: form.category.trim() || 'Other',
      timelineDays: Number(form.timelineDays) || 28,
      blueprintId: form.blueprintId || undefined,
      active: form.active,
    };
    if (editingId) {
      update('packages', editingId, payload);
      toast.success('Package updated');
    } else {
      add('packages', { ...payload, sortOrder: packages.length + 1, createdAt: new Date().toISOString().slice(0, 10) });
      toast.success('Package created');
    }
    setIsOpen(false);
  };

  /** Snapshot each chosen package so later edits can't change a sent offer. */
  const sendOffer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!send.clientId) {
      toast.error('Choose a client');
      return;
    }
    if (send.picked.length === 0) {
      toast.error('Pick at least one package');
      return;
    }
    const options: OfferOption[] = send.picked.map((id) => {
      const p = packages.find((x) => x.id === id)!;
      return {
        id: uid('op'),
        packageId: p.id,
        name: p.name,
        description: p.tagline,
        priceUsd: p.price,
        period: p.period,
        features: p.features,
        badge: p.badge,
        accent: p.accent,
        timelineDays: p.timelineDays,
        blueprintId: p.blueprintId,
      };
    });
    add('offers', {
      clientId: send.clientId,
      title: send.title.trim() || 'Choose your package',
      intro: send.intro.trim(),
      status: 'sent',
      options,
      createdAt: new Date().toISOString().slice(0, 10),
    });
    const client = clients.find((c) => c.id === send.clientId);
    toast.success(`Sent to ${client?.name ?? 'client'} — it's live in their portal`);
    setSendOpen(false);
    setSend({ clientId: '', title: 'Choose your package', intro: '', picked: [] });
    setTab('offers');
  };

  return (
    <div className="max-w-[1400px] space-y-6">
      <PageHeader
        title="Packages"
        subtitle="Priced options clients choose between while the work is still being discussed."
        actions={
          <>
            <Button
              variant="secondary"
              icon={PaperPlaneTilt}
              onClick={() => {
                if (packages.length === 0) {
                  toast.error('Create a package first');
                  return;
                }
                setSendOpen(true);
              }}
            >
              Send to Client
            </Button>
            <Button icon={Plus} onClick={openAdd}>
              New Package
            </Button>
          </>
        }
      />

      <div className="flex gap-2">
        {(['catalogue', 'offers'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 rounded-full text-xs font-bold capitalize transition-colors',
              tab === t ? 'bg-night text-white' : 'bg-surface-2 text-ink-soft hover:text-ink',
            )}
          >
            {t === 'offers' ? `Sent (${offers.length})` : `Catalogue (${packages.length})`}
          </button>
        ))}
      </div>

      {tab === 'catalogue' ? (
        sorted.length === 0 ? (
          <Card>
            <EmptyState
              icon={Stack}
              title="No packages yet"
              description="Set up the options you offer clients, then send a set of them to anyone you're talking to."
              action={
                <Button icon={Plus} onClick={openAdd}>
                  New Package
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-7 pt-4">
            {sorted.map((pkg) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                className={cn(!pkg.active && 'opacity-50')}
                footer={
                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-line/40">
                    <span className="text-[11px] text-ink-faint">
                      {pkg.category} · {pkg.timelineDays}d
                      {pkg.blueprintId ? ' · seeds plan' : ''}
                    </span>
                    <span className="flex gap-0.5">
                      <button
                        onClick={() => update('packages', pkg.id, { active: !pkg.active })}
                        aria-label={pkg.active ? 'Hide from new offers' : 'Show in new offers'}
                        title={pkg.active ? 'Active' : 'Hidden'}
                        className="p-1.5 text-ink-faint hover:text-purple rounded transition-colors"
                      >
                        {pkg.active ? <Eye size={14} /> : <EyeSlash size={14} />}
                      </button>
                      <button
                        onClick={() => {
                          const { id, createdAt, ...rest } = pkg;
                          void id;
                          void createdAt;
                          add('packages', {
                            ...rest,
                            name: `${pkg.name} (copy)`,
                            sortOrder: packages.length + 1,
                            createdAt: new Date().toISOString().slice(0, 10),
                          });
                          toast.success('Package duplicated');
                        }}
                        aria-label="Duplicate"
                        className="p-1.5 text-ink-faint hover:text-purple rounded transition-colors"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        onClick={() => openEdit(pkg)}
                        aria-label="Edit"
                        className="p-1.5 text-ink-faint hover:text-purple rounded transition-colors"
                      >
                        <PencilSimple size={14} />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(pkg)}
                        aria-label="Delete"
                        className="p-1.5 text-ink-faint hover:text-red rounded transition-colors"
                      >
                        <Trash size={14} />
                      </button>
                    </span>
                  </div>
                }
              />
            ))}
          </div>
        )
      ) : offers.length === 0 ? (
        <Card>
          <EmptyState
            icon={PaperPlaneTilt}
            title="Nothing sent yet"
            description="Send a set of packages to a client and their choice lands here — along with the project it creates."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {[...offers]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map((offer) => {
              const client = clientFor(offer);
              const chosen = offer.options.find((o) => o.id === offer.selectedOptionId);
              return (
                <Card key={offer.id} className="p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-ink">{offer.title}</h3>
                        <StatusPill
                          tone={
                            offer.status === 'accepted'
                              ? 'positive'
                              : offer.status === 'sent'
                                ? 'warning'
                                : 'neutral'
                          }
                        >
                          {offer.status}
                        </StatusPill>
                      </div>
                      <p className="text-[13px] text-ink-soft mt-0.5">
                        {client?.name ?? 'Unknown client'} · {offer.options.length} option
                        {offer.options.length === 1 ? '' : 's'} · sent{' '}
                        {formatDate(offer.createdAt)}
                      </p>
                      {chosen ? (
                        <p className="text-[13px] text-positive font-bold mt-1.5">
                          Chose {chosen.name} ({formatCurrency(chosen.priceUsd)})
                          {offer.selectedAt ? ` on ${formatDate(offer.selectedAt)}` : ''}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {offer.projectId ? (
                        <Link to={`/admin/tracker/${offer.projectId}`}>
                          <Button size="sm" variant="secondary">
                            Open project
                          </Button>
                        </Link>
                      ) : null}
                      {client ? (
                        <Link to={`/portal/${client.portalToken}/packages`} target="_blank">
                          <Button size="sm" variant="ghost">
                            View as client
                          </Button>
                        </Link>
                      ) : null}
                      {offer.status === 'sent' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            update('offers', offer.id, { status: 'withdrawn' });
                            toast.success('Withdrawn — no longer visible to the client');
                          }}
                        >
                          Withdraw
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </Card>
              );
            })}
        </div>
      )}

      {/* ------------------------------ Editor ------------------------------ */}
      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title={editingId ? 'Edit Package' : 'New Package'}
        subtitle="This is exactly what the client sees"
        width="max-w-3xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="package-form">
              {editingId ? 'Save Changes' : 'Create Package'}
            </Button>
          </>
        }
      >
        <div className="grid md:grid-cols-[1fr_280px] gap-6">
          <form id="package-form" onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Name">
                <Input
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="The Wolf"
                />
              </Field>
              <Field label="Badge" hint="Ribbon — leave blank for none">
                <Input
                  value={form.badge}
                  onChange={(e) => setForm({ ...form, badge: e.target.value })}
                  placeholder="Best Value"
                />
              </Field>
            </div>

            <Field label="Tagline">
              <Input
                value={form.tagline}
                onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                placeholder="Growing brands needing a full brand system"
              />
            </Field>

            <div className="grid grid-cols-3 gap-4">
              <Field label="Price (USD)">
                <Input
                  type="number"
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </Field>
              <Field label="Period">
                <Input
                  value={form.period}
                  onChange={(e) => setForm({ ...form, period: e.target.value })}
                  placeholder="one-off"
                />
              </Field>
              <Field label="Delivery (days)">
                <Input
                  type="number"
                  min="1"
                  value={form.timelineDays}
                  onChange={(e) => setForm({ ...form, timelineDays: e.target.value })}
                />
              </Field>
            </div>

            <Field label="What's included" hint="One per line">
              <Textarea
                rows={8}
                value={form.features}
                onChange={(e) => setForm({ ...form, features: e.target.value })}
                className="text-[12.5px] leading-relaxed"
                placeholder={'Responsive Logo Suite\nBrand Strategy & Brand DNA\nSocial Media Kit'}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Card style">
                <Select
                  value={form.accent}
                  onChange={(e) => setForm({ ...form, accent: e.target.value as PackageAccent })}
                >
                  {ACCENTS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Category">
                <Input
                  list="package-categories"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
                <datalist id="package-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
            </div>

            <Field
              label="Delivery plan"
              hint="Optional — when a client picks this, the project starts with these phases"
            >
              <Select
                value={form.blueprintId}
                onChange={(e) => setForm({ ...form, blueprintId: e.target.value })}
              >
                <option value="">No plan — start the project blank</option>
                {blueprints.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title} ({b.category})
                  </option>
                ))}
              </Select>
            </Field>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="w-4 h-4 rounded border-line accent-orange cursor-pointer"
              />
              <span className="text-[13px] text-ink-soft">
                Available to include in new offers
              </span>
            </label>
          </form>

          {/* Live preview — the client's view, as you type. */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-ink-faint mb-3">
              Client preview
            </div>
            <PackageCard
              pkg={{
                name: form.name || 'Package name',
                tagline: form.tagline,
                price: Number(form.price) || 0,
                period: form.period,
                features: toFeatures(form.features),
                badge: form.badge,
                accent: form.accent,
              }}
              cta="Select plan"
            />
          </div>
        </div>
      </Modal>

      {/* ------------------------------- Send ------------------------------- */}
      <Modal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        title="Send packages to a client"
        subtitle="They appear in that client's portal for them to choose from"
        width="max-w-2xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSendOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="send-form" icon={PaperPlaneTilt}>
              Send to Portal
            </Button>
          </>
        }
      >
        <form id="send-form" onSubmit={sendOffer} className="space-y-4">
          <Field label="Client">
            <Select
              value={send.clientId}
              onChange={(e) => setSend({ ...send, clientId: e.target.value })}
            >
              <option value="">Select a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Heading">
            <Input
              value={send.title}
              onChange={(e) => setSend({ ...send, title: e.target.value })}
            />
          </Field>

          <Field label="Message" hint="A short note above the options">
            <Textarea
              rows={3}
              value={send.intro}
              onChange={(e) => setSend({ ...send, intro: e.target.value })}
              placeholder="Here are the options we discussed — pick whichever fits and we'll get started."
            />
          </Field>

          <Field label="Packages to include">
            <div className="space-y-2">
              {packages.filter((p) => p.active).length === 0 ? (
                <p className="text-[13px] text-ink-soft">No active packages.</p>
              ) : (
                packages
                  .filter((p) => p.active)
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((p) => {
                    const on = send.picked.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className={cn(
                          'flex items-center gap-3 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors',
                          on ? 'border-orange bg-orange-dim' : 'border-line hover:border-ink-faint',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() =>
                            setSend({
                              ...send,
                              picked: on
                                ? send.picked.filter((x) => x !== p.id)
                                : [...send.picked, p.id],
                            })
                          }
                          className="w-4 h-4 rounded border-line accent-orange cursor-pointer"
                        />
                        <span className="flex-1 text-[13.5px] font-bold text-ink">{p.name}</span>
                        <span className="text-[13px] text-ink-soft">
                          {formatCurrency(p.price)}
                        </span>
                      </label>
                    );
                  })
              )}
            </div>
          </Field>
        </form>
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete package?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirmDelete) {
                  remove('packages', confirmDelete.id);
                  toast.success('Package deleted');
                }
                setConfirmDelete(null);
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">
          <b className="text-ink">{confirmDelete?.name}</b> will be removed from the catalogue.
          Offers already sent keep their own copy and are unaffected.
        </p>
      </Modal>
    </div>
  );
}
