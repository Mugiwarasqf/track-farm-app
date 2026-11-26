import { addLocalNotification } from './notifications/localEvents';

/**
 * Downloadable reports, built in the browser as a PDF with a real table.
 *
 * These used to be CSV files. A CSV opened on a phone shows as raw
 * comma-separated text, which is unreadable for most farmers; a PDF opens
 * natively on any phone and prints cleanly. There is still no export endpoint
 * on the backend (the S3 reports bucket exists but nothing writes to it).
 *
 * jsPDF is loaded only when a report is actually downloaded, so it stays out
 * of the main bundle. Its built-in fonts have no ₦ glyph, so money columns
 * should say "NGN" in the header rather than putting ₦ in the cells.
 */

const BRAND_GREEN = [77, 102, 0]; // #4D6600, dark lime for text on white
const BRAND_LIME = [223, 255, 131]; // #DFFF83, the app's main colour
const CHARCOAL = [23, 25, 26]; // #17191A, text on lime
const STRIPE = [245, 245, 244]; // stone-100

/**
 * @param {object} report
 * @param {string} report.filename  ends in .pdf
 * @param {string} report.title     e.g. "Feed Report"
 * @param {string} [report.subtitle] e.g. the batch name
 * @param {string[]} report.headers
 * @param {Array<Array<string|number>>} report.rows
 */
export async function downloadTableReport({ filename, title, subtitle, headers, rows }) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);

  // Landscape once a table gets wide, so columns aren't squeezed on A4.
  const doc = new jsPDF({ orientation: headers.length > 4 ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
  drawHeader(doc, title, subtitle);
  autoTable(doc, { ...tableStyle(doc), startY: 96, head: [headers], body: cells(rows) });

  doc.save(filename);

  addLocalNotification({
    type: 'report_ready',
    title: 'Report Ready',
    message: `${title}${subtitle ? ` for ${subtitle}` : ''} has been downloaded as a PDF.`,
  });
}

/**
 * The farm-wide export: a summary page, then one page per batch with its key
 * figures and a single day-by-day table, then store purchases. Built from
 * lib/exportRecords.js (buildOverview, buildBatchReports, buildFarmSections).
 */
export async function downloadFarmReport({ filename, farm, overview, batches, farmSections }) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.width;
  const H = doc.internal.pageSize.height;
  const RIGHT = W - LEFT;
  const farmName = farm?.name || 'Your farm';

  const table = (startY, { headers, rows, total, columnStyles }) =>
    autoTable(doc, {
      ...tableStyle(doc),
      styles: { ...tableStyle(doc).styles, cellPadding: 4.5 },
      didDrawPage: undefined,
      margin: { left: LEFT, right: LEFT, bottom: 40 },
      startY,
      head: [headers],
      body: rows.length ? cells(rows) : [[{ content: 'Nothing recorded yet', colSpan: headers.length, styles: { textColor: MUTED } }]],
      foot: total && rows.length ? [cells([total])[0]] : undefined,
      footStyles: { fillColor: FOOT_FILL, textColor: CHARCOAL, fontStyle: 'bold' },
      showFoot: 'lastPage',
      columnStyles,
    });

  const heading = (text, y, size = 13, x = LEFT) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    doc.setTextColor(...BRAND_GREEN);
    doc.text(text, x, y);
  };

  const boxes = (items, y, h) => {
    const gap = 10;
    const w = (RIGHT - LEFT - gap * (items.length - 1)) / items.length;
    items.forEach((item, i) => {
      const x = LEFT + i * (w + gap);
      doc.setFillColor(...STRIPE);
      doc.setDrawColor(231, 229, 228);
      doc.roundedRect(x, y, w, h, 6, 6, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED);
      doc.text(item.label, x + 10, y + 16);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(h > 50 ? 15 : 11);
      doc.setTextColor(...CHARCOAL);
      doc.text(String(item.value), x + 10, y + (h > 50 ? 37 : 32));
      if (item.hint) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...MUTED);
        doc.text(item.hint, x + 10, y + 52);
      }
    });
  };

  // Page 1: the farm at a glance.
  drawHeader(doc, 'Farm Records', [farmName, farm?.location].filter(Boolean).join(', '));
  boxes(overview.tiles, 100, 64);

  let y = 196;
  const half = (RIGHT - LEFT - 24) / 2;
  if (overview.money) {
    heading('Income & expenses', y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text(overview.money.period, LEFT, y + 13);
    autoTable(doc, {
      ...tableStyle(doc),
      didDrawPage: undefined,
      startY: y + 20,
      margin: { left: LEFT, right: W - LEFT - half },
      head: [overview.money.headers],
      body: overview.money.rows.map((r) =>
        Array.isArray(r) ? r : r.cells.map((c) => ({ content: c, styles: { fontStyle: 'bold', fillColor: FOOT_FILL } }))
      ),
      columnStyles: { 1: { halign: 'right' } },
    });
  }

  const ax = LEFT + half + 24;
  heading('Needs attention', y, 13, ax);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  let ay = y + 22;
  const notes = overview.attention.length ? overview.attention : ['Nothing overdue. No birds in the sick bay.'];
  for (const line of notes.slice(0, 14)) {
    const overdue = line.startsWith('Overdue');
    doc.setTextColor(...(overdue ? DANGER : CHARCOAL));
    const wrapped = doc.splitTextToSize(`•  ${line}`, half);
    doc.text(wrapped, ax, ay);
    ay += wrapped.length * 12 + 4;
  }

  // One page per batch.
  for (const b of batches) {
    doc.addPage();
    heading(b.title, 50, 17);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    doc.text(b.subtitle, LEFT, 66);
    boxes(b.facts.map(([label, value]) => ({ label, value })), 80, 44);

    let ty = 140;
    if (b.upcoming.length) {
      doc.setFontSize(9.5);
      for (const line of b.upcoming.slice(0, 4)) {
        doc.setTextColor(...(line.startsWith('Overdue') ? DANGER : CHARCOAL));
        doc.text(`•  ${line}`, LEFT, ty);
        ty += 13;
      }
      ty += 4;
    }
    table(ty, { headers: b.headers, rows: b.rows, total: b.total, columnStyles: { 0: { cellWidth: 70 } } });
  }

  // Store purchases and anything not tied to a batch.
  if (farmSections.some((s) => s.rows.length)) {
    doc.addPage();
    heading('Store purchases', 50, 17);
    let sy = 74;
    for (const s of farmSections) {
      if (!s.rows.length) continue;
      if (sy > H - 120) {
        doc.addPage();
        sy = 50;
      }
      heading(s.title, sy, 11);
      table(sy + 8, s);
      sy = doc.lastAutoTable.finalY + 28;
    }
  }

  // Footer on every page, once the page count is known.
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(168, 162, 158);
    doc.text(`TrackFarm  ·  ${farmName}`, LEFT, H - 20);
    doc.text(`Page ${p} of ${pages}`, RIGHT, H - 20, { align: 'right' });
  }

  doc.save(filename);
  addLocalNotification({ type: 'report_ready', title: 'Report Ready', message: 'Farm records have been downloaded as a PDF.' });
}

const MUTED = [120, 113, 108];
const DANGER = [190, 18, 60];
const FOOT_FILL = [240, 250, 214];

const LEFT = 40;

function cells(rows) {
  return rows.map((row) => row.map((cell) => (cell == null ? '' : String(cell))));
}

function tableStyle(doc) {
  return {
    margin: { left: LEFT, right: LEFT },
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 6, textColor: [41, 37, 36], lineColor: [231, 229, 228], lineWidth: 0.5 },
    headStyles: { fillColor: BRAND_LIME, textColor: CHARCOAL, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: STRIPE },
    didDrawPage: () => {
      const page = doc.getNumberOfPages();
      const { height } = doc.internal.pageSize;
      doc.setFontSize(8);
      doc.setTextColor(168, 162, 158);
      doc.text(`Page ${page}`, LEFT, height - 20);
    },
  };
}

function drawHeader(doc, title, subtitle) {
  const left = LEFT;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...BRAND_GREEN);
  doc.text('TrackFarm', left, 44);

  doc.setFontSize(13);
  doc.setTextColor(28, 25, 23);
  doc.text(title, left, 66);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120, 113, 108);
  const generated = `Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  doc.text(subtitle ? `${subtitle}  ·  ${generated}` : generated, left, 82);
}
