import { toast } from 'sonner';
import { STUDIO } from '../brand';
import { formatCurrency, formatDate } from './utils';
import { quoteTotal } from './finance';
import type { Client, Invoice, Project, Quote, StudioSettings } from '../types';

/**
 * Branded LoneWolf documents — invoices and quotes — rendered client-side to
 * match the studio's real quote design: deep-purple header carrying the logo,
 * orange document title, Prepared-For / Prepared-By cards, an orange-header
 * line-item table, an orange TOTAL bar, numbered notes, and a purple footer.
 *
 * jsPDF (and the html2canvas it pulls in) load dynamically so ~380KB of PDF
 * tooling stays out of the initial bundle until someone downloads a document.
 */

/* LoneWolf brand palette, as jsPDF-friendly RGB tuples. */
const PURPLE: RGB = [91, 15, 168]; // #5B0FA8
const PURPLE_DEEP: RGB = [61, 10, 112]; // #3D0A70
const ORANGE: RGB = [255, 107, 0]; // #FF6B00
const INK: RGB = [42, 36, 49]; // #2A2431
const SOFT: RGB = [110, 102, 120]; // #6E6678
const CARD: RGB = [244, 241, 248]; // #F4F1F8
const CARD_WARM: RGB = [255, 244, 236]; // #FFF4EC
const WHITE: RGB = [255, 255, 255];

type RGB = [number, number, number];

/** A single priced row in the document table. */
interface LineItem {
  title: string;
  description?: string;
  meta?: string; // e.g. a deadline or milestone label, shown in the middle column
  amount: number;
}

interface DocConfig {
  kind: 'INVOICE' | 'SERVICE QUOTE';
  reference: string;
  refLabel: string; // "Invoice #" or "Quote Ref"
  dateLabel: string; // usually "Date"
  dateValue: string;
  secondaryLabel: string; // "Due" or "Valid Until"
  secondaryValue: string;
  client?: Client;
  project?: Project;
  scope?: string;
  items: LineItem[];
  total: number;
  notes?: string[];
  payment?: string;
  settings?: StudioSettings;
}

/** Fetch the public logo and return a data URL + natural size, or null. */
async function loadLogo(): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    const res = await fetch('/lonewolf-logo.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const size = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 0, h: 0 });
      img.src = dataUrl;
    });
    if (!size.w || !size.h) return null;
    return { dataUrl, ...size };
  } catch {
    return null;
  }
}

type JsPDFInstance = InstanceType<typeof import('jspdf').default>;

/**
 * Build the document and return the jsPDF instance (no save). Split out from
 * the download wrapper so the exact same layout can be exercised in Node — e.g.
 * to render sample documents — without a browser download.
 */
export async function buildDocument(config: DocConfig): Promise<JsPDFInstance | null> {
  let jsPDF: typeof import('jspdf').default;
  let autoTable: typeof import('jspdf-autotable').default;
  try {
    [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
  } catch {
    return null;
  }

  const s = config.settings;
  const studioName = s?.studioName ?? STUDIO.name;
  const studioEmail = s?.email ?? STUDIO.email;
  const studioPhone = s?.phone ?? STUDIO.phone;
  const studioWebsite = s?.website ?? STUDIO.website;

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 44;

  /* ---------------- Header band (purple) with logo/contact ---------------- */
  const headerH = 104;
  doc.setFillColor(...PURPLE);
  doc.rect(0, 0, pageW, headerH, 'F');
  // Orange accent strip beneath the header.
  doc.setFillColor(...ORANGE);
  doc.rect(0, headerH, pageW, 5, 'F');

  const logo = await loadLogo();
  if (logo) {
    const logoW = 190;
    const logoH = (logo.h / logo.w) * logoW;
    doc.addImage(logo.dataUrl, 'PNG', margin, (headerH - logoH) / 2, logoW, logoH);
  } else {
    // Text wordmark fallback.
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(...ORANGE);
    doc.text('LoneWolf', margin, 52);
    const lwW = doc.getTextWidth('LoneWolf ');
    doc.setTextColor(...WHITE);
    doc.text('Digital', margin + lwW, 52);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(201, 184, 228);
    doc.text("Your Brand's Digital Pack", margin, 70);
  }

  // Contact block, right-aligned in the header.
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...WHITE);
  doc.text(studioEmail, pageW - margin, 42, { align: 'right' });
  doc.text(studioPhone, pageW - margin, 56, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.text(studioWebsite, pageW - margin, 70, { align: 'right' });

  /* ------------------------------ Title ------------------------------ */
  let y = headerH + 46;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(...ORANGE);
  doc.text(config.kind, margin, y);
  // Short orange underline.
  doc.setFillColor(...ORANGE);
  doc.rect(margin, y + 8, 60, 3, 'F');

  /* ------------------------- Reference meta -------------------------- */
  y += 34;
  const metaRow = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text(label, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SOFT);
    doc.text(value, margin + 90, y);
    y += 16;
  };
  metaRow(config.refLabel, config.reference);
  metaRow(config.dateLabel, config.dateValue);
  metaRow(config.secondaryLabel, config.secondaryValue);

  /* --------------------- Prepared For / Prepared By ------------------ */
  y += 12;
  const colGap = 16;
  const colW = (pageW - margin * 2 - colGap) / 2;
  const cardY = y;
  const cardH = 74;

  const partyCard = (x: number, accent: RGB, label: string, lines: string[]) => {
    doc.setFillColor(...CARD);
    doc.roundedRect(x, cardY, colW, cardH, 8, 8, 'F');
    doc.setFillColor(...accent);
    doc.rect(x, cardY, colW, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...accent);
    doc.text(label.toUpperCase(), x + 16, cardY + 22);
    doc.setFontSize(12.5);
    doc.setTextColor(...INK);
    doc.text(lines[0] ?? '—', x + 16, cardY + 40);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...SOFT);
    lines.slice(1).forEach((line, i) => doc.text(line, x + 16, cardY + 56 + i * 13));
  };

  partyCard(margin, ORANGE, 'Prepared For', [
    config.client?.name ?? '—',
    config.project?.name ?? config.client?.industry ?? '',
    config.client?.email ?? '',
  ].filter(Boolean));

  partyCard(margin + colW + colGap, PURPLE, 'Prepared By', [
    studioName,
    s?.lead ?? STUDIO.lead,
    studioWebsite,
  ]);

  y = cardY + cardH + 30;

  /* ----------------------------- Scope ------------------------------ */
  if (config.scope) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...ORANGE);
    doc.text('Scope of Work', margin, y);
    doc.setFillColor(...ORANGE);
    doc.rect(margin, y + 6, 48, 2.5, 'F');
    y += 22;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(...INK);
    const lines = doc.splitTextToSize(config.scope, pageW - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 14 + 14;
  }

  /* --------------------------- Item table --------------------------- */
  const showMeta = config.items.some((it) => it.meta);
  const head = showMeta ? [['#', 'ITEM', 'DEADLINE', 'AMOUNT']] : [['#', 'ITEM', 'AMOUNT']];

  // The ITEM cell carries only the description; autotable draws it in soft grey
  // with extra top padding, and we draw the bold-orange title once in the
  // reserved space above (see didParseCell / didDrawCell). A leading space keeps
  // description-less rows tall enough for the title line.
  const body = config.items.map((it, idx) => {
    const descCell = it.description ? it.description : ' ';
    return showMeta
      ? [String(idx + 1), descCell, it.meta ?? '', formatCurrency(it.amount)]
      : [String(idx + 1), descCell, formatCurrency(it.amount)];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head,
    body,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 10,
      cellPadding: { top: 10, bottom: 10, left: 12, right: 12 },
      textColor: INK,
      valign: 'top',
    },
    headStyles: {
      fillColor: ORANGE,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: { top: 9, bottom: 9, left: 12, right: 12 },
    },
    alternateRowStyles: { fillColor: [250, 248, 253] },
    columnStyles: showMeta
      ? {
          0: { cellWidth: 28, fontStyle: 'bold', textColor: PURPLE },
          2: { cellWidth: 90, fontStyle: 'bold', textColor: PURPLE },
          3: { halign: 'right', cellWidth: 80, fontStyle: 'bold' },
        }
      : {
          0: { cellWidth: 28, fontStyle: 'bold', textColor: PURPLE },
          2: { halign: 'right', cellWidth: 90, fontStyle: 'bold' },
        },
    // Reserve room above the description for the title, drawn once in orange.
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        data.cell.styles.textColor = SOFT;
        data.cell.styles.cellPadding = { top: 28, bottom: 10, left: 12, right: 12 };
      }
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        const raw = config.items[data.row.index];
        if (raw) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10.5);
          doc.setTextColor(...ORANGE);
          doc.text(raw.title, data.cell.x + 12, data.cell.y + 18);
          doc.setFont('helvetica', 'normal');
        }
      }
    },
  });

  let afterTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  /* ---------------------------- TOTAL bar --------------------------- */
  const barY = afterTable + 4;
  const barH = 40;
  doc.setFillColor(...ORANGE);
  doc.rect(margin, barY, pageW - margin * 2, barH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...WHITE);
  doc.text('TOTAL', margin + 16, barY + 26);
  doc.setFontSize(18);
  doc.text(formatCurrency(config.total), pageW - margin - 16, barY + 27, { align: 'right' });
  y = barY + barH + 28;

  /* ------------------------------ Notes ----------------------------- */
  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 90) {
      doc.addPage();
      y = 60;
    }
  };

  if (config.notes && config.notes.length) {
    ensureSpace(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...ORANGE);
    doc.text('Notes', margin, y);
    doc.setFillColor(...ORANGE);
    doc.rect(margin, y + 6, 40, 2.5, 'F');
    y += 22;
    config.notes.forEach((note, i) => {
      const lines = doc.splitTextToSize(note, pageW - margin * 2 - 22);
      ensureSpace(lines.length * 13 + 8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...ORANGE);
      doc.text(`${i + 1}.`, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...INK);
      doc.text(lines, margin + 22, y);
      y += lines.length * 13 + 8;
    });
    y += 8;
  }

  /* ----------------------------- Payment ---------------------------- */
  if (config.payment) {
    ensureSpace(48);
    doc.setFillColor(...CARD_WARM);
    const payLines = doc.splitTextToSize(config.payment, pageW - margin * 2 - 32);
    const payH = payLines.length * 13 + 28;
    doc.roundedRect(margin, y, pageW - margin * 2, payH, 8, 8, 'F');
    doc.setFillColor(...ORANGE);
    doc.rect(margin, y, 6, payH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...SOFT);
    doc.text('PAYMENT', margin + 18, y + 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(payLines, margin + 18, y + 32);
    y += payH + 20;
  }

  /* ------------------------------ Footer ---------------------------- */
  const footerH = 46;
  doc.setFillColor(...PURPLE_DEEP);
  doc.rect(0, pageH - footerH, pageW, footerH, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(201, 184, 228);
  doc.text(
    `${studioName}  |  ${studioWebsite}  |  ${studioEmail}  |  ${studioPhone}`,
    pageW / 2,
    pageH - footerH + 20,
    { align: 'center' },
  );
  doc.setTextColor(...ORANGE);
  doc.setFontSize(8);
  doc.text("Your Brand's Digital Pack", pageW / 2, pageH - footerH + 34, { align: 'center' });

  return doc;
}

/** Build the document and trigger a browser download. */
async function renderDocument(config: DocConfig) {
  const doc = await buildDocument(config);
  if (!doc) {
    toast.error('Could not load the PDF generator. Check your connection and retry.');
    return;
  }
  doc.save(`${config.reference}.pdf`);
}

export type { DocConfig };

/* ------------------------------ Invoices ------------------------------ */

export function downloadInvoicePdf({
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
  return renderDocument({
    kind: 'INVOICE',
    reference: invoice.number,
    refLabel: 'Invoice #',
    dateLabel: 'Issued',
    dateValue: formatDate(invoice.issueDate),
    secondaryLabel: 'Due',
    secondaryValue: formatDate(invoice.dueDate),
    client,
    project,
    items: [
      {
        title: invoice.notes || 'Professional services',
        description: project ? `${project.name} (${project.ref})` : undefined,
        amount: invoice.amount,
      },
    ],
    total: invoice.amount,
    payment: `Amount due: ${formatCurrency(invoice.amount)}. Status: ${invoice.status
      .replace('-', ' ')
      .toUpperCase()}.`,
    settings,
  });
}

/* ------------------------------- Quotes ------------------------------- */

export function downloadQuotePdf({
  quote,
  client,
  settings,
}: {
  quote: Quote;
  client?: Client;
  settings?: StudioSettings;
}) {
  // Flatten milestones → line items, tagging each with its milestone name.
  const items: LineItem[] = quote.milestones.flatMap((m) =>
    m.tasks.map((t) => ({ title: t.title, description: m.title, amount: t.price })),
  );
  const total = quoteTotal(quote);

  return renderDocument({
    kind: 'SERVICE QUOTE',
    reference: quote.number,
    refLabel: 'Quote Ref',
    dateLabel: 'Date',
    dateValue: formatDate(new Date()),
    secondaryLabel: 'Valid Until',
    secondaryValue: formatDate(quote.validUntil),
    client,
    scope: quote.title,
    items,
    total,
    notes: [
      `Estimated delivery timeline: approximately ${quote.timelineDays} days from project commencement.`,
      'This quote covers the scope described above. Work outside this scope will be quoted separately.',
      `This quote is valid until ${formatDate(quote.validUntil)}.`,
    ],
    payment: `Total of ${formatCurrency(
      total,
    )} USD. A milestone payment breakdown is available on request; work begins on receipt of the first milestone payment.`,
    settings,
  });
}
