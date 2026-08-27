import {
  CheckCircle2,
  Clock,
  Download,
  FileSignature,
  FileText,
  FolderArchive,
  Receipt,
  ScrollText,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, EmptyState, PageHeader, StatusPill } from '@/src/components/ui';
import { cn, downloadFile, formatCurrency, formatDate, relativeDays } from '@/src/lib/utils';
import { quoteTotal } from '@/src/lib/finance';
import { downloadInvoicePdf } from '@/src/lib/invoicePdf';
import { useStudio } from '@/src/store/StudioStore';
import type { InvoiceStatus, QuoteStatus } from '@/src/types';
import { usePortalClient } from './usePortalClient';

/* Client-facing views of the studio's paperwork. All read-only. */

const INVOICE_TONE: Record<InvoiceStatus, 'positive' | 'danger' | 'warning' | 'neutral'> = {
  paid: 'positive',
  overdue: 'danger',
  sent: 'warning',
  'partially-paid': 'warning',
  draft: 'neutral',
  cancelled: 'neutral',
};

export function PortalInvoices() {
  const client = usePortalClient();
  const { invoices, projectFor, settings } = useStudio();

  // Drafts are internal — the client shouldn't see an invoice before it's issued.
  const rows = invoices
    .filter((i) => i.clientId === client.id && i.status !== 'draft')
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate));

  const outstanding = rows
    .filter((i) => i.status !== 'paid' && i.status !== 'cancelled')
    .reduce((sum, i) => sum + i.amount, 0);

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle={
          outstanding > 0
            ? `${formatCurrency(outstanding)} currently outstanding`
            : 'Everything is settled — thank you'
        }
      />

      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={Receipt} title="No invoices yet" />
        </Card>
      ) : (
        <Card className="divide-y divide-line">
          {rows.map((invoice) => {
            const project = projectFor(invoice);
            const overdue = invoice.status === 'overdue';
            return (
              <div
                key={invoice.id}
                className="flex items-center justify-between gap-4 p-5 flex-wrap"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                      invoice.status === 'paid'
                        ? 'bg-positive-dim text-positive'
                        : overdue
                          ? 'bg-red-dim text-red'
                          : 'bg-gold-dim text-gold-deep',
                    )}
                  >
                    <FileText size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink">{invoice.number}</p>
                    <p className="text-xs text-ink-soft truncate">
                      {invoice.notes}
                      {project ? ` · ${project.name}` : ''}
                    </p>
                    <p className="text-[11px] text-ink-faint mt-0.5">
                      Issued {formatDate(invoice.issueDate)} · due {formatDate(invoice.dueDate)}
                      {invoice.status !== 'paid' ? ` (${relativeDays(invoice.dueDate)})` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <p className="text-base font-extrabold text-ink">
                      {formatCurrency(invoice.amount)}
                    </p>
                    <StatusPill tone={INVOICE_TONE[invoice.status]} className="mt-1">
                      {invoice.status.replace('-', ' ')}
                    </StatusPill>
                  </div>
                  <button
                    onClick={() => downloadInvoicePdf({ invoice, client, project, settings })}
                    title={`Download ${invoice.number}`}
                    className="p-2 text-ink-faint hover:text-orange hover:bg-orange-dim rounded-lg transition-colors"
                  >
                    <Download size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

const QUOTE_TONE: Record<QuoteStatus, 'positive' | 'danger' | 'warning' | 'neutral'> = {
  accepted: 'positive',
  rejected: 'danger',
  sent: 'warning',
  expired: 'neutral',
  draft: 'neutral',
};

export function PortalQuotes() {
  const client = usePortalClient();
  const { quotes, update } = useStudio();

  const rows = quotes
    .filter((q) => q.clientId === client.id && q.status !== 'draft')
    .sort((a, b) => b.validUntil.localeCompare(a.validUntil));

  return (
    <div>
      <PageHeader
        title="Quotes"
        subtitle="Priced breakdowns of proposed work. Accept one and we'll get started."
      />

      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={ScrollText} title="No quotes yet" />
        </Card>
      ) : (
        <div className="space-y-5">
          {rows.map((quote) => {
            const awaiting = quote.status === 'sent';
            return (
              <Card
                key={quote.id}
                className={cn('p-6', awaiting && 'border-orange ring-1 ring-orange')}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                      {quote.number}
                    </div>
                    <h3 className="disp text-xl font-extrabold text-ink mt-0.5">{quote.title}</h3>
                    <p className="text-xs text-ink-soft mt-1">
                      Valid until {formatDate(quote.validUntil)} · ~{quote.timelineDays} day
                      delivery
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-extrabold text-purple">
                      {formatCurrency(quoteTotal(quote))}
                    </div>
                    <StatusPill tone={QUOTE_TONE[quote.status]} className="mt-1">
                      {quote.status}
                    </StatusPill>
                  </div>
                </div>

                <div className="space-y-3">
                  {quote.milestones.map((milestone) => (
                    <div key={milestone.id} className="bg-surface-2 rounded-[10px] p-4">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <h4 className="font-bold text-sm text-ink">{milestone.title}</h4>
                        <span className="text-sm font-bold text-ink-soft">
                          {formatCurrency(
                            milestone.tasks.reduce((s, t) => s + t.price, 0),
                          )}
                        </span>
                      </div>
                      <ul className="space-y-1">
                        {milestone.tasks.map((task) => (
                          <li
                            key={task.id}
                            className="flex items-center justify-between gap-3 text-[12.5px] text-ink-soft"
                          >
                            <span>{task.title}</span>
                            <span className="font-semibold">{formatCurrency(task.price)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                {awaiting ? (
                  <div className="flex gap-2.5 mt-5 pt-5 border-t border-line">
                    <Button
                      icon={CheckCircle2}
                      onClick={() => {
                        update('quotes', quote.id, { status: 'accepted' });
                        toast.success('Quote accepted — the studio has been notified');
                      }}
                    >
                      Accept Quote
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        update('quotes', quote.id, { status: 'rejected' });
                        toast.info('Quote declined');
                      }}
                    >
                      Decline
                    </Button>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function PortalFiles() {
  const client = usePortalClient();
  const { files, projectFor } = useStudio();

  // Only files the studio has explicitly shared — internal working files stay hidden.
  const rows = files
    .filter((f) => f.clientId === client.id && f.sharedWithClient)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));

  const folders = [...new Set(rows.map((f) => f.folder))];

  return (
    <div>
      <PageHeader title="Files" subtitle="Deliverables and documents shared with you." />

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={FolderArchive}
            title="No files shared yet"
            description="Deliverables will appear here as each phase completes."
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {folders.map((folder) => (
            <div key={folder}>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-ink-faint mb-2.5">
                {folder}
              </h3>
              <Card className="divide-y divide-line">
                {rows
                  .filter((f) => f.folder === folder)
                  .map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between gap-4 p-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-purple-dim text-purple flex items-center justify-center shrink-0">
                          <FileText size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-ink truncate">{file.name}</p>
                          <p className="text-xs text-ink-soft">
                            {file.size} · added {formatDate(file.uploadedAt)}
                            {projectFor(file) ? ` · ${projectFor(file)!.name}` : ''}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => downloadFile(file)}
                        className="p-2 text-ink-faint hover:text-purple hover:bg-purple-dim rounded-lg transition-colors shrink-0"
                        aria-label={`Download ${file.name}`}
                      >
                        <Download size={18} />
                      </button>
                    </div>
                  ))}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PortalContracts() {
  const client = usePortalClient();
  const { contracts, projectFor } = useStudio();

  const rows = contracts
    .filter((c) => c.clientId === client.id)
    .sort((a, b) => b.expires.localeCompare(a.expires));

  return (
    <div>
      <PageHeader title="Contracts" subtitle="Agreements covering your engagement." />

      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={FileSignature} title="No contracts on file" />
        </Card>
      ) : (
        <Card className="divide-y divide-line">
          {rows.map((contract) => {
            const project = projectFor(contract);
            return (
              <div
                key={contract.id}
                className="flex items-center justify-between gap-4 p-5 flex-wrap"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                      contract.status === 'signed'
                        ? 'bg-positive-dim text-positive'
                        : 'bg-gold-dim text-gold-deep',
                    )}
                  >
                    {contract.status === 'signed' ? (
                      <CheckCircle2 size={17} />
                    ) : (
                      <Clock size={17} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink">{contract.title}</p>
                    <p className="text-xs text-ink-soft">
                      {project ? `${project.name} · ` : ''}
                      {formatCurrency(contract.amount)}
                    </p>
                    <p className="text-[11px] text-ink-faint mt-0.5">
                      {contract.signedBy
                        ? `Signed by ${contract.signedBy} on ${formatDate(contract.signedAt!)}`
                        : 'Awaiting signature'}{' '}
                      · valid until {formatDate(contract.expires)}
                    </p>
                  </div>
                </div>
                <StatusPill
                  tone={contract.status === 'signed' ? 'positive' : 'warning'}
                  className="shrink-0"
                >
                  {contract.status}
                </StatusPill>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
