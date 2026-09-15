import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { SEED } from '../data/seed';
import { supabase } from '../lib/supabase';
import type { Client, Contract, FileAsset, Invoice, Project, Quote, StudioSettings } from '../types';
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
  settings: StudioSettings | null;
}

const noop = () => undefined;

export function PortalProvider({ children }: { children: ReactNode }) {
  const { token } = useParams();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setSnapshot(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase.rpc('portal_snapshot', { p_token: token }).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data) {
        setSnapshot(null);
      } else {
        const snap = data as Snapshot;
        setSnapshot(snap);
        setQuotes(snap.quotes ?? []);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

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
      contracts: snapshot?.contracts ?? [],
      files: snapshot?.files ?? [],
      expenses: [],
      leads: [],
      team: [],
      timeEntries: [],
      emailTemplates: [],
      planTemplates: [],
      campaigns: [],
      newsletters: [],
      settings,

      loading,
      refresh: async () => undefined,

      // The one permitted portal write: respond to a quote.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update: (key: string, id: string, patch: any) => {
        if (key !== 'quotes' || (patch.status !== 'accepted' && patch.status !== 'rejected')) {
          return;
        }
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
  }, [snapshot, quotes, loading, token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-orange border-t-transparent animate-spin" />
      </div>
    );
  }

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}
