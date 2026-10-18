import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, CheckCircle, Warning } from '@phosphor-icons/react';
import { Button, Card, Field, Input, Select } from '@/src/components/ui';
import { Logo } from '@/src/components/Logo';
import { supabase } from '@/src/lib/supabase';

/**
 * Public client sign-up at `/join/:code`.
 *
 * The code in the URL is checked server-side by `portal_register_client`; it is
 * the only thing standing between this form and the clients table, so the page
 * itself holds no secrets and does no validation worth trusting. An email we
 * already have on file is refused outright rather than handed a portal link —
 * otherwise the form would be a way to find someone else's portal.
 */

const INDUSTRIES = [
  'Hospitality',
  'Retail & E-commerce',
  'Professional Services',
  'Technology & Software',
  'Health & Wellness',
  'Education',
  'Property & Construction',
  'Non-profit',
  'Other',
];

export default function JoinClient() {
  const { code } = useParams();
  const [form, setForm] = useState({
    name: '',
    contactName: '',
    email: '',
    phone: '',
    location: '',
    industry: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ portalToken: string; name: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim() || !form.email.trim()) {
      setError('Business name and email are required.');
      return;
    }

    setBusy(true);
    const { data, error: rpcError } = await supabase.rpc('portal_register_client', {
      p_code: code ?? '',
      p_name: form.name,
      p_contact: form.contactName,
      p_email: form.email,
      p_phone: form.phone,
      p_location: form.location,
      p_industry: form.industry,
    });
    setBusy(false);

    const result = data as
      | { ok?: boolean; error?: string; portalToken?: string; name?: string }
      | null;

    if (rpcError || !result?.ok || !result.portalToken) {
      setError(result?.error ?? rpcError?.message ?? 'Something went wrong. Please try again.');
      return;
    }
    setDone({ portalToken: result.portalToken, name: result.name ?? form.name });
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <header className="border-b border-line bg-surface">
        <div className="max-w-[640px] mx-auto px-6 py-4">
          <Logo variant="color" imgClassName="h-9" />
        </div>
      </header>

      <main className="flex-1 w-full max-w-[640px] mx-auto px-6 py-12">
        {done ? (
          <Card className="p-8 text-center">
            <CheckCircle size={44} className="text-positive mx-auto" />
            <h1 className="disp text-2xl font-extrabold text-ink tracking-tight mt-4">
              You're in, {done.name}
            </h1>
            <p className="text-[14px] text-ink-soft mt-3 leading-relaxed">
              Your portal is where you'll find progress, quotes, invoices and paperwork. Bookmark
              this link — it's yours.
            </p>
            <Link to={`/portal/${done.portalToken}`} className="inline-block mt-6">
              <Button icon={ArrowRight}>Open my portal</Button>
            </Link>
          </Card>
        ) : (
          <>
            <div className="mb-8">
              <h1 className="disp text-3xl font-extrabold text-ink tracking-tight">
                Set up your client portal
              </h1>
              <p className="text-[14.5px] text-ink-soft mt-2.5 leading-relaxed">
                A couple of details and you'll have your own space to track the work, review
                quotes and sign off on paperwork.
              </p>
            </div>

            <Card className="p-7">
              <form onSubmit={submit} className="space-y-4">
                <Field label="Business name">
                  <Input
                    autoFocus
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Acme Coffee Roasters"
                  />
                </Field>

                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Your name">
                    <Input
                      value={form.contactName}
                      onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                    />
                  </Field>
                  <Field label="Email">
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </Field>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Phone" hint="Optional">
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </Field>
                  <Field label="Location" hint="Optional">
                    <Input
                      value={form.location}
                      onChange={(e) => setForm({ ...form, location: e.target.value })}
                      placeholder="City, country"
                    />
                  </Field>
                </div>

                <Field label="Industry" hint="Optional">
                  <Select
                    value={form.industry}
                    onChange={(e) => setForm({ ...form, industry: e.target.value })}
                  >
                    <option value="">Select…</option>
                    {INDUSTRIES.map((i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                  </Select>
                </Field>

                {error ? (
                  <div className="flex gap-2.5 items-start px-4 py-3 rounded-lg bg-red-dim text-red text-[13px]">
                    <Warning size={16} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                ) : null}

                <Button type="submit" disabled={busy} className="w-full" icon={ArrowRight}>
                  {busy ? 'Creating your portal…' : 'Create my portal'}
                </Button>
              </form>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
