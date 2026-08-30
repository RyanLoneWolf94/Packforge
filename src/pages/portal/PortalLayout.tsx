import {
  FileSignature,
  FolderArchive,
  LayoutDashboard,
  Mail,
  MessageCircle,
  Receipt,
  ScrollText,
  ShieldCheck,
  GaugeCircle,
} from 'lucide-react';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import { Card, EmptyState } from '@/src/components/ui';
import { Logo } from '@/src/components/Logo';
import { cn, initials } from '@/src/lib/utils';
import { useStudio } from '@/src/store/StudioStore';
import type { Client } from '@/src/types';

/**
 * Shell for the client-facing portal at `/portal/:token`.
 *
 * The portal is a dashboard in its own right — progress, billing, quotes,
 * files and paperwork each get a section. The phase tracker is one part of it,
 * not the whole thing.
 */

const NAV = [
  { to: '', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: 'progress', label: 'Progress', icon: GaugeCircle },
  { to: 'invoices', label: 'Invoices', icon: Receipt },
  { to: 'quotes', label: 'Quotes', icon: ScrollText },
  { to: 'files', label: 'Files', icon: FolderArchive },
  { to: 'contracts', label: 'Contracts', icon: FileSignature },
];

export default function PortalLayout() {
  const { token } = useParams();
  const { clients, clientByToken } = useStudio();

  // A bare `/portal` falls back to the first client so the view is previewable.
  const client = token ? clientByToken(token) : clients[0];

  if (!client) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <EmptyState
            icon={ShieldCheck}
            title="Portal not found"
            description="This link doesn't match an active client. Check with your studio contact for an up-to-date link."
          />
        </Card>
      </div>
    );
  }

  const base = `/portal/${client.portalToken}`;

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <PortalHeader client={client} />

      <nav className="border-b border-line bg-surface sticky top-[65px] z-30">
        <div className="max-w-[1120px] mx-auto px-6 lg:px-7 flex gap-1 overflow-x-auto scrollbar-none">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to ? `${base}/${item.to}` : base}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 px-4 py-3.5 text-[13px] font-bold whitespace-nowrap',
                  'border-b-2 -mb-px transition-colors',
                  isActive
                    ? 'border-orange text-ink'
                    : 'border-transparent text-ink-soft hover:text-ink',
                )
              }
            >
              <item.icon size={15} />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <main className="flex-1 max-w-[1120px] w-full mx-auto px-6 lg:px-7 py-9">
        <Outlet context={{ client }} />
      </main>

      <PortalFooter client={client} />
    </div>
  );
}

function PortalHeader({ client }: { client: Client }) {
  return (
    <header className="border-b border-line bg-surface sticky top-0 z-40">
      <div className="max-w-[1120px] mx-auto px-6 lg:px-7 py-4 flex items-center justify-between gap-4">
        <Logo variant="color" imgClassName="h-9" />

        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right leading-tight">
            <div className="text-[13px] font-bold text-ink">{client.name}</div>
            <div className="text-[11px] text-ink-soft">{client.contactName}</div>
          </div>
          <div className="w-9 h-9 rounded-full bg-night text-white flex items-center justify-center text-xs font-bold">
            {initials(client.name)}
          </div>
        </div>
      </div>
    </header>
  );
}

function PortalFooter({ client }: { client: Client }) {
  const { settings } = useStudio();
  const subject = encodeURIComponent(`${client.name} — project question`);
  const message = encodeURIComponent(
    `Hi ${settings.lead}, I have a question about the ${client.name} project`,
  );

  return (
    <footer className="border-t border-line bg-surface mt-auto">
      <div className="max-w-[1120px] mx-auto px-6 lg:px-7 py-8 flex items-center justify-between gap-5 flex-wrap">
        <div className="text-[13px] text-ink-soft">
          <b className="text-ink">{settings.studioName}</b> · {settings.website} · {settings.address}
        </div>
        <div className="flex gap-2.5">
          <a
            href={`mailto:${settings.email}?subject=${subject}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-line bg-surface text-[13.5px] font-bold text-ink hover:-translate-y-px transition-transform"
          >
            <Mail size={15} /> Email {settings.lead}
          </a>
          <a
            href={`https://wa.me/${settings.whatsapp}?text=${message}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-purple text-white text-[13.5px] font-bold hover:-translate-y-px transition-transform"
          >
            <MessageCircle size={15} /> WhatsApp {settings.lead}
          </a>
        </div>
      </div>
    </footer>
  );
}
