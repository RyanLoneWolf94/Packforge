import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { SEED } from '../data/seed';
import { supabase } from '../lib/supabase';
import type {
  Client,
  Contract,
  FileAsset,
  Invoice,
  Offer,
  Project,
  ProjectTask,
  Quote,
  StudioSettings,
} from '../types';
import { StudioContext } from './StudioStore';

/**
 * Read-only data provider for the public client portal.
 *
 * The portal is anonymous, so it can't read tables directly (row-level security
 * denies it). Instead it calls the `portal_snapshot(token)` RPC, which returns
 * exactly one client's data — projects, billing, paperwork and shared files —
 * and nothing else. That snapshot is shaped into the same `StudioContext` the
 * admin app uses, so the portal pages and the shared PhaseTracker consume it
 * through `useStudio()` without any special-casing.
 *
 * The only write the portal permits is a client accepting or declining a quote,
 * routed through the `portal_respond_quote` RPC.
 */

interface Snapshot {
  client: Client;
  projects: Project[];
  invoices: Invoice[];
  quotes: Quote[];
  contracts: Contract[];
  files: FileAsset[];
  /** Board tasks the studio has marked visible, for this client's projects. */
  tasks: ProjectTask[];
  /** Package sets sent to this client. */
  offers: Offer[];
  settings: StudioSettings | null;
}

const noop = () => undefined;

export function PortalProvider({ children }: { children: ReactNode }) {
  const { token } = useParams();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  // Quotes and contracts are the two things a client can act on, so they are
  // held in state to update optimistically; everything else is read straight
  // off the snapshot.
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  /**
   * Pulls the snapshot. `quiet` skips the spinner, for re-reads after an action
   * the client has already seen confirmed (picking a package, say) — the page
   * stays put rather than blanking out.
   */
  const load = useCallback(
    async ({ quiet = false }: { quiet?: boolean } = {}) => {
      if (!token) {
        setSnapshot(null);
        setLoading(false);
        return;
      }
      if (!quiet) setLoading(true);
      const { data, error } = await supabase.rpc('portal_snapshot', { p_token: token });
      if (error || !data) {
        if (!quiet) setSnapshot(null);
      } else {
        const snap = data as Snapshot;
        setSnapshot(snap);
        setQuotes(snap.quotes ?? []);
        setContracts(snap.contracts ?? []);
      }
      setLoading(false);
    },
    [token],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const value = useMemo(() => {
    const client = snapshot?.client;
    const projects = snapshot?.projects ?? [];
    const settings = snapshot?.settings ?? SEED.settings;

    return {
      // Collections — only the client's own data is present; the rest are empty.
      clients: client ? [client] : [],
      projects,
      invoices: snapshot?.invoices ?? [],
      quotes,
      contracts,
      files: snapshot?.files ?? [],
      expenses: [],
      leads: [],
      team: [],
      timeEntries: [],
      // Only the tasks the studio chose to share reach the portal.
      projectTasks: snapshot?.tasks ?? [],
      emailTemplates: [],
      blueprints: [],
      packages: [],
      // Offers carry a snapshot of each package, so the catalogue stays internal.
      offers: snapshot?.offers ?? [],
      campaigns: [],
      newsletters: [],
      settings,

      loading,
      refresh: () => load({ quiet: true }),

      /**
       * The only writes the portal permits: a client responding to a quote, and
       * signing a contract they've reviewed. Both go through scoped RPCs that
       * re-check the token server-side; anything else is ignored. Pages call
       * this with the same `update(collection, id, patch)` shape the admin app
       * uses, so they need no portal-specific code.
       */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update: (key: string, id: string, patch: any) => {
        if (key === 'quotes') {
          if (patch.status !== 'accepted' && patch.status !== 'rejected') return;
          setQuotes((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
          supabase
            .rpc('portal_respond_quote', {
              p_token: token,
              p_quote_id: id,
              p_status: patch.status,
            })
            .then(({ error }) => {
              if (error) console.error('portal_respond_quote failed:', error.message);
            });
          return;
        }

        if (key === 'contracts' && patch.status === 'signed') {
          const signer = String(patch.signedBy ?? '').trim();
          if (!signer) return;
          const signature = patch.signature ?? null;
          const signedAt = new Date().toISOString().slice(0, 10);
          setContracts((prev) =>
            prev.map((c) =>
              c.id === id
                ? { ...c, status: 'signed', signedBy: signer, signedAt, signature }
                : c,
            ),
          );
          supabase
            .rpc('portal_sign_contract', {
              p_token: token,
              p_contract_id: id,
              p_signer: signer,
              p_signature: signature,
            })
            .then(({ error }) => {
              if (error) console.error('portal_sign_contract failed:', error.message);
            });
        }
      },

      // Lookups over the snapshot.
      clientFor: (item: { clientId?: string }) =>
        client && item.clientId === client.id ? client : undefined,
      projectFor: (item: { projectId?: string }) =>
        projects.find((p) => p.id === item.projectId),
      projectsForClient: (clientId: string) => projects.filter((p) => p.clientId === clientId),
      clientByToken: (t: string) => (client && client.portalToken === t ? client : undefined),

      // Everything mutating is inert in the portal.
      add: (() => {
        throw new Error('The client portal is read-only.');
      }) as never,
      remove: noop as never,
      updateSettings: noop,
      createProject: (() => {
        throw new Error('The client portal is read-only.');
      }) as never,
      deleteProject: noop,
      toggleDeliverable: noop,
      setPhaseLink: noop,
      addPhase: noop,
      updatePhase: noop,
      removePhase: noop,
      addDeliverable: noop,
      removeDeliverable: noop,
      addActionItem: noop,
      toggleActionItem: noop,
      removeActionItem: noop,
      toggleTimelineWeek: noop,
      createClient: (() => {
        throw new Error('The client portal is read-only.');
      }) as never,
      deleteClient: noop,
    };
  }, [snapshot, quotes, contracts, loading, token, load]);

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-orange border-t-transparent animate-spin" />
      </div>
    );
  }

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}
