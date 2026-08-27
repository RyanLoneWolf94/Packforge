import { toast } from 'sonner';
import { BRAND_COLORS, STUDIO } from '../brand';
import { formatCurrency, formatDate } from './utils';
import type { Client, Invoice, Project, StudioSettings } from '../types';

/**
 * Branded invoice PDF. Generated client-side so it works without a backend —
 * the studio can issue a real document today and swap in a server-rendered
 * version later without changing the call site. Studio identity comes from
 * settings when provided, so edits on the Settings page flow onto the document.
 *
 * jsPDF (and the html2canvas it pulls in) are imported dynamically so ~380KB
 * of PDF tooling stays out of the initial bundle and only loads when someone
 * actually downloads an invoice.
 */
export async function downloadInvoicePdf({
  invoice,
  client,
  project,
  settings,
}: {
  invoice: Invoice;
  client?: Client;
  project?: Project;
  settings?: StudioSettings;
}) {
  let jsPDF: typeof import('jspdf').default;
  let autoTable: typeof import('jspdf-autotable').default;
  try {
    [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
  } catch {
    toast.error('Could not load the PDF generator. Check your connection and retry.');
    return;
  }

  const studioName = settings?.studioName ?? STUDIO.name;
  const studioWebsite = settings?.website ?? STUDIO.website;
  const studioEmail = settings?.email ?? STUDIO.email;
  const studioPhone = settings?.phone ?? STUDIO.phone;
  const studioLocations = settings?.address ?? STUDIO.locations;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 48;

  /* Header band */
  doc.setFillColor(BRAND_COLORS.night);
  doc.rect(0, 0, pageWidth, 96, 'F');

  doc.setFillColor(BRAND_COLORS.orange);
  doc.roundedRect(margin, 30, 36, 36, 6, 6, 'F');
  doc.setTextColor('#FFFFFF');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('LW', margin + 18, 53, { align: 'center' });

  doc.setFontSize(16);
  doc.text(studioName, margin + 50, 46);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor('#C9C4DA');
  doc.text(`${studioWebsite}  ·  ${studioLocations}`, margin + 50, 62);

  doc.setTextColor('#FFFFFF');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('INVOICE', pageWidth - margin, 52, { align: 'right' });

  /* Meta block */
  let y = 140;
  doc.setTextColor(BRAND_COLORS.purple);
  doc.setFontSize(9);
  doc.text('BILLED TO', margin, y);
  doc.text('INVOICE', pageWidth - margin - 150, y);

  y += 16;
  doc.setTextColor('#221F1C');
  doc.setFontSize(11);
  doc.text(client?.name ?? '—', margin, y);
  doc.text(invoice.number, pageWidth - margin - 150, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor('#6E6A65');

  y += 15;
  if (client?.contactName) doc.text(client.contactName, margin, y);
  doc.text(`Issued  ${formatDate(invoice.issueDate)}`, pageWidth - margin - 150, y);

  y += 14;
  if (client?.email) doc.text(client.email, margin, y);
  doc.text(`Due     ${formatDate(invoice.dueDate)}`, pageWidth - margin - 150, y);

  y += 14;
  if (client?.location) doc.text(client.location, margin, y);
  doc.text(`Status  ${invoice.status.replace('-', ' ').toUpperCase()}`, pageWidth - margin - 150, y);

  /* Line items. A single line today; the table keeps room for real ones later. */
  autoTable(doc, {
    startY: y + 34,
    margin: { left: margin, right: margin },
    head: [['Description', 'Amount']],
    body: [
      [
        `${invoice.notes || 'Professional services'}${project ? `\n${project.name} (${project.ref})` : ''}`,
        formatCurrency(invoice.amount),
      ],
    ],
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 10, textColor: '#221F1C' },
    headStyles: {
      fillColor: BRAND_COLORS.purple,
      textColor: '#FFFFFF',
      fontStyle: 'bold',
      fontSize: 9,
    },
    columnStyles: { 1: { halign: 'right', cellWidth: 120 } },
    alternateRowStyles: { fillColor: '#F3F2EF' },
  });

  const afterTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
    .finalY;

  /* Total */
  doc.setFillColor('#F3F2EF');
  doc.roundedRect(pageWidth - margin - 240, afterTable + 18, 240, 44, 6, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor('#6E6A65');
  doc.text('TOTAL DUE', pageWidth - margin - 224, afterTable + 40);
  doc.setFontSize(16);
  doc.setTextColor(BRAND_COLORS.orange);
  doc.text(formatCurrency(invoice.amount), pageWidth - margin - 16, afterTable + 44, {
    align: 'right',
  });

  /* Footer */
  const footerY = doc.internal.pageSize.getHeight() - 60;
  doc.setDrawColor(BRAND_COLORS.line);
  doc.line(margin, footerY - 18, pageWidth - margin, footerY - 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor('#A7A29B');
  doc.text(`Questions?  ${studioEmail}  ·  ${studioPhone}`, margin, footerY);
  doc.text(STUDIO.tagline, pageWidth - margin, footerY, { align: 'right' });

  doc.save(`${invoice.number}.pdf`);
}
