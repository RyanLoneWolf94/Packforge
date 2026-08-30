import {
  Bell,
  Calendar,
  ExternalLink,
  FileText,
  FolderArchive,
  FolderKanban,
  GaugeCircle,
  LayoutDashboard,
  Mail,
  Megaphone,
  PenTool,
  Receipt,
  Search,
  Settings as SettingsIcon,
  Target,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/src/lib/utils";
import { STUDIO } from "@/src/brand";
import { Logo } from "@/src/components/Logo";
import { useStudio } from "@/src/store/StudioStore";
import { projectProgress } from "@/src/lib/tracker";

const MENU_SECTIONS = [
  {
    title: "CORE",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", href: "/admin" },
      { icon: GaugeCircle, label: "Tracker", href: "/admin/tracker" },
      { icon: FolderKanban, label: "Projects", href: "/admin/projects" },
      { icon: Users, label: "Clients", href: "/admin/clients" },
      { icon: Target, label: "Leads", href: "/admin/leads" },
      { icon: Users, label: "Teams", href: "/admin/teams" },
      { icon: FolderArchive, label: "Files", href: "/admin/files" },
    ],
  },
  {
    title: "WORKFLOW",
    items: [
      { icon: FileText, label: "Quotations", href: "/admin/quotations" },
      { icon: PenTool, label: "Contracts", href: "/admin/contracts" },
      { icon: Calendar, label: "Timelines", href: "/admin/timelines" },
      { icon: Mail, label: "Emails", href: "/admin/emails" },
    ],
  },
  {
    title: "FINANCE",
    items: [
      { icon: TrendingUp, label: "Overview", href: "/admin/overview" },
      { icon: Receipt, label: "Invoices", href: "/admin/invoices" },
      { icon: Wallet, label: "Expenses", href: "/admin/expenses" },
    ],
  },
  {
    title: "MARKETING",
    items: [
      { icon: Megaphone, label: "Campaigns", href: "/admin/marketing/campaigns" },
      { icon: Mail, label: "Newsletters", href: "/admin/marketing/newsletters" },
      { icon: Target, label: "Integrations", href: "/admin/marketing/integrations" },
    ],
  },
  {
    title: "SYSTEM",
    items: [{ icon: SettingsIcon, label: "Settings", href: "/admin/settings" }],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  // Longest matching prefix wins, so nested routes like
  // `/admin/tracker/:projectId` still title as "Tracker" rather than falling
  // back to the dashboard.
  const activeItem = MENU_SECTIONS.flatMap((s) => s.items)
    .filter((item) =>
      item.href === "/admin"
        ? location.pathname === "/admin" || location.pathname === "/admin/"
        : location.pathname.startsWith(item.href),
    )
    .sort((a, b) => b.href.length - a.href.length)[0];
  const pageTitle = activeItem?.label ?? "Dashboard";

  return (
    <div className="min-h-screen bg-paper flex">
      <aside className="hidden md:flex flex-col w-64 bg-night text-slate-300 shadow-xl z-20 shrink-0">
        <div className="h-20 flex items-center px-6 border-b border-night-line">
          <Link to="/admin" className="flex items-center">
            <Logo variant="light" imgClassName="h-8" />
          </Link>
        </div>

        <nav className="flex-1 px-4 py-5 space-y-7 overflow-y-auto scrollbar-none">
          {MENU_SECTIONS.map((section) => (
            <div key={section.title}>
              <h4 className="text-[10px] font-bold text-white/35 uppercase tracking-widest mb-2.5 px-3">
                {section.title}
              </h4>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active =
                    item.href === "/admin"
                      ? location.pathname === "/admin" || location.pathname === "/admin/"
                      : location.pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                        active
                          ? "bg-night-soft text-white font-semibold"
                          : "text-white/55 hover:text-white hover:bg-white/5",
                      )}
                    >
                      <item.icon
                        size={18}
                        strokeWidth={active ? 2.5 : 2}
                        className={active ? "text-orange" : "text-white/45"}
                      />
                      <span className="text-[13px]">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-night-line">
          <Link
            to="/portal"
            target="_blank"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/55 hover:text-white hover:bg-white/5 transition-colors"
          >
            <ExternalLink size={17} />
            <span className="text-[13px]">Client portal preview</span>
          </Link>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-20 px-5 lg:px-8 flex items-center justify-between gap-4 sticky top-0 bg-paper/95 backdrop-blur z-30 border-b border-line">
          <h1 className="disp text-lg font-extrabold text-ink shrink-0">{pageTitle}</h1>
          <GlobalSearch />
          <div className="flex items-center gap-4 shrink-0">
            <NotificationBell />
            <Link
              to="/admin/settings"
              className="w-9 h-9 bg-night text-white rounded-full flex items-center justify-center text-xs font-bold hover:ring-2 hover:ring-orange/50 transition-all"
              title={`${STUDIO.lead} · ${STUDIO.shortName}`}
            >
              RM
            </Link>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 lg:px-8 py-7">{children}</div>
      </main>
    </div>
  );
}

/**
 * Search across projects and clients. Results link straight into the tracker,
 * which is the fastest route to anything the studio actually needs to act on.
 */
function GlobalSearch() {
  const { projects, clients, clientFor } = useStudio();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const projectHits = projects
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.ref.toLowerCase().includes(q) ||
          (clientFor(p)?.name ?? "").toLowerCase().includes(q),
      )
      .slice(0, 5)
      .map((p) => ({
        key: p.id,
        label: p.name,
        sub: `${clientFor(p)?.name ?? "Unassigned"} · ${projectProgress(p).pct}% complete`,
        to: `/admin/tracker/${p.id}`,
      }));
    const clientHits = clients
      .filter((c) => c.name.toLowerCase().includes(q) || c.contactName.toLowerCase().includes(q))
      .slice(0, 3)
      .map((c) => ({
        key: c.id,
        label: c.name,
        sub: `Client · ${c.contactName}`,
        to: `/admin/clients`,
      }));
    return [...projectHits, ...clientHits];
  }, [query, projects, clients, clientFor]);

  const open = focused && query.trim().length > 0;

  return (
    <div className="flex-1 max-w-xl relative">
      <Search
        className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none"
        size={16}
      />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        // Delay so a result click registers before the list unmounts.
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder="Search projects, clients, refs…"
        className="w-full pl-11 pr-10 py-2.5 bg-surface border border-line rounded-full text-sm text-ink outline-none transition-shadow focus:border-orange focus:ring-2 focus:ring-orange/20 placeholder:text-ink-faint"
      />
      {query ? (
        <button
          onClick={() => setQuery("")}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
        >
          <X size={15} />
        </button>
      ) : null}

      {open ? (
        <div className="absolute top-full mt-2 left-0 right-0 bg-surface border border-line rounded-xl shadow-lg overflow-hidden">
          {results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-ink-soft">No matches for “{query}”</div>
          ) : (
            results.map((r) => (
              <button
                key={r.key}
                onClick={() => {
                  navigate(r.to);
                  setQuery("");
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-surface-2 transition-colors border-b border-line last:border-0"
              >
                <div className="text-[13px] font-bold text-ink">{r.label}</div>
                <div className="text-[11.5px] text-ink-soft">{r.sub}</div>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Surfaces real blockers — open client action items — instead of a fake badge. */
function NotificationBell() {
  const { projects } = useStudio();
  const [open, setOpen] = useState(false);

  const blockers = projects.flatMap((project) =>
    project.actionItems.filter((a) => !a.resolved).map((a) => ({ ...a, project })),
  );

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="relative text-ink-faint hover:text-ink transition-colors"
        aria-label={`${blockers.length} items need attention`}
      >
        <Bell size={20} strokeWidth={2.5} />
        {blockers.length > 0 ? (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-orange text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {blockers.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full mt-2 w-80 bg-surface border border-line rounded-xl shadow-lg overflow-hidden z-40">
          <div className="px-4 py-3 border-b border-line">
            <div className="disp text-xs font-extrabold text-ink">Waiting On Clients</div>
          </div>
          {blockers.length === 0 ? (
            <div className="px-4 py-4 text-sm text-ink-soft">Nothing outstanding.</div>
          ) : (
            blockers.slice(0, 6).map((item) => (
              <Link
                key={item.id}
                to={`/admin/tracker/${item.project.id}`}
                className="block px-4 py-3 hover:bg-surface-2 border-b border-line last:border-0 transition-colors"
              >
                <div className="text-[13px] font-bold text-ink">{item.title}</div>
                <div className="text-[11.5px] text-ink-soft mt-0.5">{item.project.name}</div>
              </Link>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
