import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, Stack } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Card, EmptyState, Modal, Button, StatusPill } from '@/src/components/ui';
import PackageCard from '@/src/components/PackageCard';
import { supabase } from '@/src/lib/supabase';
import { formatCurrency } from '@/src/lib/utils';
import { useStudio } from '@/src/store/StudioStore';
import type { OfferOption } from '@/src/types';

/**
 * Where a client picks the package they want.
 *
 * Selecting one calls `portal_select_package`, which creates the project and
 * closes the offer in a single statement — so a double-click or a stale tab
 * can't produce two projects. The server's answer is what we report; nothing
 * here is optimistic.
 */

export default function PortalPackages() {
  const { token } = useParams();
  const { offers, refresh } = useStudio();

  const [confirming, setConfirming] = useState<{ offerId: string; option: OfferOption } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const open = offers.filter((o) => o.status === 'sent');
  const decided = offers.filter((o) => o.status === 'accepted');

  const choose = async () => {
    if (!confirming) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('portal_select_package', {
      p_token: token,
      p_offer_id: confirming.offerId,
      p_option_id: confirming.option.id,
    });
    setBusy(false);

    const result = data as { ok?: boolean; error?: string; projectName?: string } | null;
    if (error || !result?.ok) {
      toast.error(result?.error ?? error?.message ?? 'That selection could not be saved.');
      // Something has moved underneath us — re-read so the page tells the truth.
      await refresh();
      setConfirming(null);
      return;
    }

    setConfirming(null);
    toast.success(`${result.projectName ?? confirming.option.name} is booked in`);
    await refresh();
  };

  if (offers.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Stack}
          title="No packages to review"
          description="When we send you options to choose from, they'll show up here."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-12">
      {open.map((offer) => (
        <section key={offer.id}>
          <header className="text-center max-w-2xl mx-auto mb-9">
            <h1 className="disp text-3xl font-extrabold text-ink tracking-tight">{offer.title}</h1>
            {offer.intro ? (
              <p className="text-[14.5px] text-ink-soft mt-3 leading-relaxed">{offer.intro}</p>
            ) : null}
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-7 pt-4 items-stretch">
            {offer.options.map((option) => (
              <PackageCard
                key={option.id}
                pkg={{
                  name: option.name,
                  tagline: option.description,
                  price: option.priceUsd,
                  period: option.period,
                  features: option.features,
                  badge: option.badge,
                  accent: option.accent,
                }}
                cta="Select this package"
                onSelect={() => setConfirming({ offerId: offer.id, option })}
                footer={
                  option.timelineDays ? (
                    <p className="text-center text-[11.5px] text-ink-faint">
                      Delivered in about {option.timelineDays} days
                    </p>
                  ) : null
                }
              />
            ))}
          </div>
        </section>
      ))}

      {decided.map((offer) => {
        const chosen = offer.options.find((o) => o.id === offer.selectedOptionId);
        return (
          <Card key={offer.id} className="p-6">
            <div className="flex items-start gap-4">
              <CheckCircle size={26} className="text-positive shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="font-bold text-ink">{offer.title}</h2>
                  <StatusPill tone="positive">Confirmed</StatusPill>
                </div>
                <p className="text-[13.5px] text-ink-soft mt-1.5">
                  You chose <b className="text-ink">{chosen?.name ?? 'a package'}</b>
                  {chosen ? ` — ${formatCurrency(chosen.priceUsd)}` : ''}. We've set the project up
                  and you'll see it under Progress.
                </p>
              </div>
            </div>
          </Card>
        );
      })}

      <Modal
        open={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        title={`Go with ${confirming?.option.name ?? 'this package'}?`}
        busy={busy}
        footer={
          <>
            <Button variant="ghost" disabled={busy} onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button onClick={choose} disabled={busy}>
              {busy ? 'Confirming…' : 'Yes, go ahead'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft leading-relaxed">
          We'll set up your project at{' '}
          <b className="text-ink">
            {confirming ? formatCurrency(confirming.option.priceUsd) : ''}
          </b>{' '}
          and be in touch to kick things off. This replaces the other options, so pick the one you
          want — if you change your mind, just message us.
        </p>
      </Modal>
    </div>
  );
}
