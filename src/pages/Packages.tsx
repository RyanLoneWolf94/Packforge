import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
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
  type PackageTier,
} from '@/src/types';

/**
 * The package catalogue and the offers built from it.
 *
 * A package is a named set of tiers — "Branding Package" holding The Pup, The
 * Wolf and Alpha Pack. The catalogue lists packages; opening one shows its
 * tier cards. Sending gives a client the whole package to choose a tier from.
 *
 * Packages are what a client reads while the work is still being discussed.
 * Blueprints are the internal delivery plan, and the only link between them is
 * `PackageTier.blueprintId`, which seeds a project's phases on selection.
 */

let seq = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

const today = () => new Date().toISOString().slice(0, 10);

/** Cheapest-first, which is how these are read. */
const sortedTiers = (pkg: Package) => [...pkg.tiers].sort((a, b) => a.price - b.price);

const priceRange = (pkg: Package) => {
  if (pkg.tiers.length === 0) return 'No tiers yet';
  const prices = pkg.tiers.map((t) => t.price);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  return low === high ? formatCurrency(low) : `${formatCurrency(low)} – ${formatCurrency(high)}`;
};

export default function Packages() {
  const { packageId } = useParams();
  return packageId ? <PackageDetail packageId={packageId} /> : <PackageCatalogue />;
}

/* ========================================================================== */
/*  Catalogue — the list of packages                                          */
/* ========================================================================== */

function PackageCatalogue() {
  const { packages, offers, clients, add, update, remove } = useStudio();
  const navigate = useNavigate();

  const [tab, setTab] = useState<'catalogue' | 'offers'>('catalogue');
  const [editing, setEditing] = useState<Package | 'new' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Package | null>(null);
  const [sendFor, setSendFor] = useState<Package | null>(null);

  const sorted = useMemo(
    () => [...packages].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [packages],
  );

  return (
    <div className="max-w-[1400px] space-y-6">
      <PageHeader
        title="Packages"
        subtitle="Sets of priced tiers clients choose between while the work is still being discussed."
        actions={
          <Button icon={Plus} onClick={() => setEditing('new')}>
            New Package
          </Button>
        }
      />

      <div className="flex gap-2">
        {(['catalogue', 'offers'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 rounded-full text-xs font-bold transition-colors',
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
              description="Group your offering into packages — Branding, Social Media, Ad Design — each with the tiers a client picks from."
              action={
                <Button icon={Plus} onClick={() => setEditing('new')}>
                  New Package
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {sorted.map((pkg) => (
              <Card
                key={pkg.id}
                className={cn(
                  'p-6 flex flex-col gap-4 cursor-pointer hover:shadow-md transition-shadow',
                  !pkg.active && 'opacity-55',
                )}
                onClick={() => navigate(`/admin/packages/${pkg.id}`)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="disp text-lg font-extrabold text-ink tracking-tight">
                      {pkg.name}
                    </h3>
                    <p className="text-[12px] text-ink-faint mt-0.5">{pkg.category}</p>
                  </div>
                  <StatusPill tone={pkg.active ? 'positive' : 'neutral'}>
                    {pkg.active ? 'Active' : 'Hidden'}
                  </StatusPill>
                </div>

                {pkg.description ? (
                  <p className="text-[13px] text-ink-soft leading-relaxed line-clamp-3">
                    {pkg.description}
                  </p>
                ) : null}

                <div className="flex items-baseline gap-2 mt-auto">
                  <span className="disp text-xl font-extrabold text-ink">{priceRange(pkg)}</span>
                  <span className="text-[12px] text-ink-soft">
                    {pkg.tiers.length} tier{pkg.tiers.length === 1 ? '' : 's'}
                  </span>
                </div>

                {/* Tier names, so the card says what's inside at a glance. */}
                {pkg.tiers.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {sortedTiers(pkg).map((t) => (
                      <span
                        key={t.id}
                        className="px-2.5 py-1 rounded-full bg-surface-2 text-[11px] font-bold text-ink-soft"
                      >
                        {t.name}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div
                  className="flex items-center justify-between gap-2 pt-3 border-t border-line/50"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={PaperPlaneTilt}
                    disabled={pkg.tiers.length === 0}
                    onClick={() => setSendFor(pkg)}
                  >
                    Send
                  </Button>
                  <span className="flex gap-0.5">
                    <button
                      onClick={() => update('packages', pkg.id, { active: !pkg.active })}
                      aria-label={pkg.active ? 'Hide from new offers' : 'Show in new offers'}
                      title={pkg.active ? 'Active' : 'Hidden'}
                      className="p-1.5 text-ink-faint hover:text-purple rounded transition-colors"
                    >
                      {pkg.active ? <Eye size={15} /> : <EyeSlash size={15} />}
                    </button>
                    <button
                      onClick={() => {
                        add('packages', {
                          name: `${pkg.name} (copy)`,
                          description: pkg.description,
                          category: pkg.category,
                          // Fresh tier ids, so editing the copy can't touch the original.
                          tiers: pkg.tiers.map((t) => ({ ...t, id: uid('tr') })),
                          active: pkg.active,
                          sortOrder: packages.length + 1,
                          createdAt: today(),
                        });
                        toast.success('Package duplicated');
                      }}
                      aria-label="Duplicate"
                      className="p-1.5 text-ink-faint hover:text-purple rounded transition-colors"
                    >
                      <Copy size={15} />
                    </button>
                    <button
                      onClick={() => setEditing(pkg)}
                      aria-label="Rename"
                      className="p-1.5 text-ink-faint hover:text-purple rounded transition-colors"
                    >
                      <PencilSimple size={15} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(pkg)}
                      aria-label="Delete"
                      className="p-1.5 text-ink-faint hover:text-red rounded transition-colors"
                    >
                      <Trash size={15} />
                    </button>
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : (
        <SentOffers />
      )}

      <PackageModal
        target={editing}
        onClose={() => setEditing(null)}
        existingCount={packages.length}
      />

      <SendModal pkg={sendFor} clients={clients} onClose={() => setSendFor(null)} />

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
          <b className="text-ink">{confirmDelete?.name}</b> and its{' '}
          {confirmDelete?.tiers.length ?? 0} tier
          {confirmDelete?.tiers.length === 1 ? '' : 's'} will be removed. Offers already sent keep
          their own copy and are unaffected.
        </p>
      </Modal>

    </div>
  );
}

/* ========================================================================== */
/*  Detail — the tiers inside one package                                     */
/* ========================================================================== */

function PackageDetail({ packageId }: { packageId: string }) {
  const { packages, clients, update } = useStudio();
  const pkg = packages.find((p) => p.id === packageId);

  const [editingTier, setEditingTier] = useState<PackageTier | 'new' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PackageTier | null>(null);
  const [sendOpen, setSendOpen] = useState(false);

  if (!pkg) {
    return (
      <Card>
        <EmptyState
          icon={Stack}
          title="Package not found"
          description="It may have been deleted."
          action={
            <Link to="/admin/packages">
              <Button variant="secondary" icon={ArrowLeft}>
                Back to packages
              </Button>
            </Link>
          }
        />
      </Card>
    );
  }

  const saveTiers = (tiers: PackageTier[]) => update('packages', pkg.id, { tiers });

  return (
    <div className="max-w-[1400px] space-y-6">
      <Link
        to="/admin/packages"
        className="inline-flex items-center gap-1.5 text-[13px] font-bold text-ink-soft hover:text-ink transition-colors"
      >
        <ArrowLeft size={14} /> All packages
      </Link>

      <PageHeader
        title={pkg.name}
        subtitle={pkg.description || `${pkg.category} · ${pkg.tiers.length} tiers`}
        actions={
          <>
            <Button
              variant="secondary"
              icon={PaperPlaneTilt}
              disabled={pkg.tiers.length === 0}
              onClick={() => setSendOpen(true)}
            >
              Send to Client
            </Button>
            <Button icon={Plus} onClick={() => setEditingTier('new')}>
              Add Tier
            </Button>
          </>
        }
      />

      {pkg.tiers.length === 0 ? (
        <Card>
          <EmptyState
            icon={Stack}
            title="No tiers yet"
            description="Add the priced options a client picks between — three is the usual number."
            action={
              <Button icon={Plus} onClick={() => setEditingTier('new')}>
                Add Tier
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-7 pt-4 items-stretch">
          {sortedTiers(pkg).map((tier) => (
            <PackageCard
              key={tier.id}
              pkg={tier}
              footer={
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-line/40">
                  <span
                    className={cn(
                      'text-[11px]',
                      tier.accent === 'featured' ? 'text-white/60' : 'text-ink-faint',
                    )}
                  >
                    {tier.timelineDays}d{tier.blueprintId ? ' · seeds plan' : ''}
                  </span>
                  <span className="flex gap-0.5">
                    <button
                      onClick={() =>
                        saveTiers([...pkg.tiers, { ...tier, id: uid('tr'), badge: '' }])
                      }
                      aria-label="Duplicate tier"
                      className={cn(
                        'p-1.5 rounded transition-colors',
                        tier.accent === 'featured'
                          ? 'text-white/60 hover:text-white'
                          : 'text-ink-faint hover:text-purple',
                      )}
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={() => setEditingTier(tier)}
                      aria-label="Edit tier"
                      className={cn(
                        'p-1.5 rounded transition-colors',
                        tier.accent === 'featured'
                          ? 'text-white/60 hover:text-white'
                          : 'text-ink-faint hover:text-purple',
                      )}
                    >
                      <PencilSimple size={14} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(tier)}
                      aria-label="Delete tier"
                      className={cn(
                        'p-1.5 rounded transition-colors',
                        tier.accent === 'featured'
                          ? 'text-white/60 hover:text-red'
                          : 'text-ink-faint hover:text-red',
                      )}
                    >
                      <Trash size={14} />
                    </button>
                  </span>
                </div>
              }
            />
          ))}
        </div>
      )}

      <TierModal
        target={editingTier}
        onClose={() => setEditingTier(null)}
        onSave={(tier) =>
          saveTiers(
            pkg.tiers.some((t) => t.id === tier.id)
              ? pkg.tiers.map((t) => (t.id === tier.id ? tier : t))
              : [...pkg.tiers, tier],
          )
        }
      />

      <SendModal
        pkg={sendOpen ? pkg : null}
        clients={clients}
        onClose={() => setSendOpen(false)}
      />

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete tier?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirmDelete) {
                  saveTiers(pkg.tiers.filter((t) => t.id !== confirmDelete.id));
                  toast.success('Tier deleted');
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
          <b className="text-ink">{confirmDelete?.name}</b> will be removed from {pkg.name}.
        </p>
      </Modal>
    </div>
  );
}

/* ========================================================================== */
/*  Package editor (name, description, category)                              */
/* ========================================================================== */

function PackageModal({
  target,
  onClose,
  existingCount,
}: {
  target: Package | 'new' | null;
  onClose: () => void;
  existingCount: number;
}) {
  const { packages, add, update } = useStudio();
  const isNew = target === 'new';
  const pkg = isNew ? null : target;

  const categories = useMemo(
    () => [...new Set([...BLUEPRINT_CATEGORIES, ...packages.map((p) => p.category)])],
    [packages],
  );

  const [form, setForm] = useState({ name: '', description: '', category: 'Branding' });
  const [seeded, setSeeded] = useState<string | null>(null);

  // Re-seed whenever the modal opens on a different target.
  const key = isNew ? 'new' : (pkg?.id ?? null);
  if (target && key !== seeded) {
    setSeeded(key);
    setForm(
      pkg
        ? { name: pkg.name, description: pkg.description, category: pkg.category }
        : { name: '', description: '', category: 'Branding' },
    );
  }
  if (!target && seeded !== null) setSeeded(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Give the package a name');
      return;
    }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category.trim() || 'Other',
    };
    if (pkg) {
      update('packages', pkg.id, payload);
      toast.success('Package updated');
    } else {
      add('packages', {
        ...payload,
        tiers: [],
        active: true,
        sortOrder: existingCount + 1,
        createdAt: today(),
      });
      toast.success('Package created — add its tiers next');
    }
    onClose();
  };

  return (
    <Modal
      open={Boolean(target)}
      onClose={onClose}
      title={pkg ? 'Edit Package' : 'New Package'}
      subtitle="The group — tiers come next"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="package-form">
            {pkg ? 'Save Changes' : 'Create Package'}
          </Button>
        </>
      }
    >
      <form id="package-form" onSubmit={submit} className="space-y-4">
        <Field label="Package name">
          <Input
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Branding Package"
          />
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

        <Field label="Description" hint="Shown above the tiers in the client's portal">
          <Textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Identity work, from a foundational logo suite through to a full brand system."
          />
        </Field>
      </form>
    </Modal>
  );
}

/* ========================================================================== */
/*  Tier editor                                                               */
/* ========================================================================== */

const ACCENTS: { id: PackageAccent; label: string }[] = [
  { id: 'plain', label: 'Plain' },
  { id: 'outlined', label: 'Outlined' },
  { id: 'featured', label: 'Featured (dark)' },
];

type TierForm = {
  name: string;
  tagline: string;
  price: string;
  period: string;
  features: string;
  badge: string;
  accent: PackageAccent;
  timelineDays: string;
  blueprintId: string;
};

const blankTier = (): TierForm => ({
  name: '',
  tagline: '',
  price: '',
  period: 'one-off',
  features: '',
  badge: '',
  accent: 'plain',
  timelineDays: '28',
  blueprintId: '',
});

const toFeatures = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean);

function TierModal({
  target,
  onClose,
  onSave,
}: {
  target: PackageTier | 'new' | null;
  onClose: () => void;
  onSave: (tier: PackageTier) => void;
}) {
  const { blueprints } = useStudio();
  const isNew = target === 'new';
  const tier = isNew ? null : target;

  const [form, setForm] = useState<TierForm>(blankTier);
  const [seeded, setSeeded] = useState<string | null>(null);

  const key = isNew ? 'new' : (tier?.id ?? null);
  if (target && key !== seeded) {
    setSeeded(key);
    setForm(
      tier
        ? {
            name: tier.name,
            tagline: tier.tagline,
            price: String(tier.price),
            period: tier.period,
            features: tier.features.join('\n'),
            badge: tier.badge,
            accent: tier.accent,
            timelineDays: String(tier.timelineDays),
            blueprintId: tier.blueprintId ?? '',
          }
        : blankTier(),
    );
  }
  if (!target && seeded !== null) setSeeded(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Give the tier a name');
      return;
    }
    onSave({
      id: tier?.id ?? uid('tr'),
      name: form.name.trim(),
      tagline: form.tagline.trim(),
      price: Number(form.price) || 0,
      period: form.period.trim(),
      features: toFeatures(form.features),
      badge: form.badge.trim(),
      accent: form.accent,
      timelineDays: Number(form.timelineDays) || 28,
      blueprintId: form.blueprintId || undefined,
    });
    toast.success(tier ? 'Tier updated' : 'Tier added');
    onClose();
  };

  return (
    <Modal
      open={Boolean(target)}
      onClose={onClose}
      title={tier ? 'Edit Tier' : 'New Tier'}
      subtitle="This is exactly what the client sees"
      width="max-w-3xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="tier-form">
            {tier ? 'Save Changes' : 'Add Tier'}
          </Button>
        </>
      }
    >
      <div className="grid md:grid-cols-[1fr_280px] gap-6">
        <form id="tier-form" onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tier name">
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

          <Field
            label="Delivery plan"
            hint="Optional — when a client picks this tier, the project starts with these phases"
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
        </form>

        {/* Live preview — the client's view, as you type. */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-ink-faint mb-3">
            Client preview
          </div>
          <PackageCard
            pkg={{
              name: form.name || 'Tier name',
              tagline: form.tagline,
              price: Number(form.price) || 0,
              period: form.period,
              features: toFeatures(form.features),
              badge: form.badge,
              accent: form.accent,
            }}
            cta="Select this package"
          />
        </div>
      </div>
    </Modal>
  );
}

/* ========================================================================== */
/*  Send a whole package to a client                                          */
/* ========================================================================== */

function SendModal({
  pkg,
  clients,
  onClose,
}: {
  pkg: Package | null;
  clients: { id: string; name: string }[];
  onClose: () => void;
}) {
  const { add } = useStudio();
  const [form, setForm] = useState({ clientId: '', title: '', intro: '' });
  const [seeded, setSeeded] = useState<string | null>(null);

  if (pkg && pkg.id !== seeded) {
    setSeeded(pkg.id);
    setForm({ clientId: '', title: pkg.name, intro: pkg.description });
  }
  if (!pkg && seeded !== null) setSeeded(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkg) return;
    if (!form.clientId) {
      toast.error('Choose a client');
      return;
    }

    // Snapshot every tier, so later edits can't change what was sent.
    const options: OfferOption[] = sortedTiers(pkg).map((t) => ({
      id: uid('op'),
      tierId: t.id,
      name: t.name,
      description: t.tagline,
      priceUsd: t.price,
      period: t.period,
      features: t.features,
      badge: t.badge,
      accent: t.accent,
      timelineDays: t.timelineDays,
      blueprintId: t.blueprintId,
    }));

    add('offers', {
      clientId: form.clientId,
      packageId: pkg.id,
      title: form.title.trim() || pkg.name,
      intro: form.intro.trim(),
      status: 'sent',
      options,
      createdAt: today(),
    });

    const client = clients.find((c) => c.id === form.clientId);
    toast.success(`Sent to ${client?.name ?? 'client'} — it's live in their portal`);
    onClose();
  };

  return (
    <Modal
      open={Boolean(pkg)}
      onClose={onClose}
      title={`Send ${pkg?.name ?? 'package'}`}
      subtitle={`All ${pkg?.tiers.length ?? 0} tiers go across — the client picks one`}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="send-form" icon={PaperPlaneTilt}>
            Send to Portal
          </Button>
        </>
      }
    >
      <form id="send-form" onSubmit={submit} className="space-y-4">
        <Field label="Client">
          <Select
            value={form.clientId}
            onChange={(e) => setForm({ ...form, clientId: e.target.value })}
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
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>

        <Field label="Message" hint="A short note above the tiers">
          <Textarea
            rows={3}
            value={form.intro}
            onChange={(e) => setForm({ ...form, intro: e.target.value })}
            placeholder="Here are the options we discussed — pick whichever fits and we'll get started."
          />
        </Field>

        <Field label="Going across">
          <div className="flex flex-wrap gap-2">
            {pkg
              ? sortedTiers(pkg).map((t) => (
                  <span
                    key={t.id}
                    className="px-3 py-1.5 rounded-full bg-surface-2 text-[12px] font-bold text-ink-soft"
                  >
                    {t.name} · {formatCurrency(t.price)}
                  </span>
                ))
              : null}
          </div>
        </Field>
      </form>
    </Modal>
  );
}

/* ========================================================================== */
/*  Sent offers                                                               */
/* ========================================================================== */

function SentOffers() {
  const { offers, clientFor, update } = useStudio();

  if (offers.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={PaperPlaneTilt}
          title="Nothing sent yet"
          description="Send a package to a client and their choice lands here — along with the project it creates."
        />
      </Card>
    );
  }

  return (
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
                    {client?.name ?? 'Unknown client'} · {offer.options.length} tier
                    {offer.options.length === 1 ? '' : 's'} · sent {formatDate(offer.createdAt)}
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
                    <a
                      href={`/portal/${client.portalToken}/packages`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button size="sm" variant="ghost">
                        View as client
                      </Button>
                    </a>
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
  );
}
