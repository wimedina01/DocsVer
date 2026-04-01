import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * Atmos-styled Human Remains Document Checklist PDF
 * Red border preserved. Interior matches Atmos color system.
 *
 * Atmos colors used:
 *   Dark Blue   #051464  — header bar, section titles
 *   United Blue #1414D2  — accents
 *   Alert Red   #D50032  — border, missing items
 *   Alert Green #1B7742  — verified items
 *   Dark Grey   #242424  — body text
 *   Medium Grey #555555  — labels
 *   Light Tonal #F7F4F2  — alternate rows
 *   Med Tonal   #D7D7D4  — table lines
 */
export function generateChecklistPDF(data) {
  const {
    awbNumber,
    origin,
    originDisplay,
    destination,
    destinationDisplay,
    routing,
    flightNumbers,
    shipmentType,
    remainsType,
    checklistItems,
    notes,
    employeeId,
    submittedAt,
  } = data;

  const doc = new jsPDF('portrait', 'mm', 'letter');
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 12; // outer margin
  const L = M + 5;  // content left
  const R = W - M - 5; // content right
  const CW = R - L; // content width

  // ── Atmos color constants (RGB arrays) ──
  const DARK_BLUE  = [5, 20, 100];
  const UNITED_BLUE = [20, 20, 210];
  const ALERT_RED  = [213, 0, 50];
  const ALERT_GREEN = [27, 119, 66];
  const DARK_GREY  = [36, 36, 36];
  const MED_GREY   = [85, 85, 85];
  const LIGHT_TONAL = [247, 244, 242];
  const MED_TONAL  = [215, 215, 212];
  const WHITE      = [255, 255, 255];
  const BLACK      = [0, 0, 0];

  // ═══════════════════════════════════════
  //  RED BORDER (preserved per requirement)
  // ═══════════════════════════════════════
  doc.setDrawColor(...ALERT_RED);
  doc.setLineWidth(2.5);
  doc.rect(M - 2, M - 2, W - 2 * (M - 2), H - 2 * (M - 2));
  doc.setLineWidth(0.4);
  doc.rect(M + 1, M + 1, W - 2 * (M + 1), H - 2 * (M + 1));

  let y = M + 9;

  // ═══════════════════════════════════════
  //  HEADER — Dark Blue bar with white text
  // ═══════════════════════════════════════
  doc.setFillColor(...DARK_BLUE);
  doc.rect(L, y - 5, CW, 12, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...WHITE);
  doc.text('HUMAN REMAINS DOCUMENT CHECKLIST AND VERIFICATION', W / 2, y + 1.5, { align: 'center' });

  y += 11;
  doc.setFontSize(7.5);
  doc.setTextColor(...DARK_GREY);
  doc.text('ALL DOCUMENTS MUST BE ORIGINAL UNLESS NOTED ON THE CHECKLIST BELOW', W / 2, y, { align: 'center' });

  // ── Thin red divider ──
  y += 3;
  doc.setDrawColor(...ALERT_RED);
  doc.setLineWidth(0.5);
  doc.line(L, y, R, y);

  // ═══════════════════════════════════════
  //  SHIPMENT INFO — 2-column clean grid
  // ═══════════════════════════════════════
  y += 5;
  const c1 = L + 1;
  const c2 = W / 2 + 4;

  function label(text, x, yy) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...MED_GREY);
    doc.text(text, x, yy);
    return x + doc.getTextWidth(text) + 1.5;
  }

  function value(text, x, yy) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...DARK_GREY);
    doc.text(text || '', x, yy);
  }

  // Row 1
  let vx;
  vx = label('AWB:', c1, y); value(awbNumber || '', vx, y);
  vx = label('Type:', c2, y); value(remainsType || '', vx, y);

  // Row 2
  y += 5;
  vx = label('Origin:', c1, y); value(originDisplay || origin || '', vx, y);
  vx = label('Destination:', c2, y); value(destinationDisplay || destination || '', vx, y);

  // Row 3
  y += 5;
  vx = label('Routing:', c1, y); value(routing || '', vx, y);
  vx = label('Shipment:', c2, y); value(shipmentType || '', vx, y);

  // Row 4
  y += 5;
  vx = label('Flights:', c1, y); value(flightNumbers || '', vx, y);
  if (submittedAt) {
    const ds = new Date(submittedAt).toLocaleString('en-US', {
      month: '2-digit', day: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
    vx = label('Date:', c2, y); value(ds, vx, y);
  }

  // ── Red divider ──
  y += 4;
  doc.setDrawColor(...ALERT_RED);
  doc.setLineWidth(0.5);
  doc.line(L, y, R, y);

  // ═══════════════════════════════════════
  //  CHECKLIST TABLE — Atmos-styled
  // ═══════════════════════════════════════
  y += 2;

  const rows = checklistItems.map((item, i) => [
    (i + 1).toString(),
    item.document_name,
    item.status || '',
    item.verification || '',
    '', // checkbox column
  ]);

  doc.autoTable({
    startY: y,
    head: [['#', 'Document Requirement', 'Status', 'Verification', '\u2713']],
    body: rows,
    margin: { left: L, right: W - R },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      lineColor: MED_TONAL,
      lineWidth: 0.2,
      textColor: DARK_GREY,
      font: 'helvetica',
    },
    headStyles: {
      fillColor: DARK_BLUE,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 7,
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 30, halign: 'center', fontSize: 6.5 },
      3: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 10, halign: 'center' },
    },
    alternateRowStyles: {
      fillColor: LIGHT_TONAL,
    },
    didParseCell(hook) {
      if (hook.section === 'body' && hook.column.index === 3) {
        if (hook.cell.raw === 'Missing') {
          hook.cell.styles.textColor = ALERT_RED;
          hook.cell.styles.fontStyle = 'bold';
        } else if (hook.cell.raw === 'Verified') {
          hook.cell.styles.textColor = ALERT_GREEN;
        }
      }
    },
    didDrawCell(hook) {
      // Checkbox squares
      if (hook.section === 'body' && hook.column.index === 4) {
        const bx = hook.cell.x + hook.cell.width / 2 - 1.8;
        const by = hook.cell.y + hook.cell.height / 2 - 1.8;
        doc.setDrawColor(...MED_GREY);
        doc.setLineWidth(0.25);
        doc.rect(bx, by, 3.6, 3.6);
      }
    },
  });

  y = doc.lastAutoTable.finalY + 3;

  // ═══════════════════════════════════════
  //  NOTES SECTION
  // ═══════════════════════════════════════
  doc.setDrawColor(...MED_TONAL);
  doc.setLineWidth(0.3);
  doc.line(L, y, R, y);

  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...MED_GREY);
  doc.text('NOTES', L + 1, y);

  if (notes && notes.trim()) {
    y += 1;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...DARK_GREY);
    const lines = doc.splitTextToSize(notes.trim(), CW - 4);
    doc.text(lines, L + 1, y + 3);
    y += 3 + lines.length * 3;
  } else {
    doc.setDrawColor(...MED_TONAL);
    doc.setLineWidth(0.15);
    for (let i = 0; i < 3; i++) {
      y += 4.5;
      doc.line(L + 1, y, R - 1, y);
    }
  }

  y += 3;

  // ═══════════════════════════════════════
  //  VERIFICATION & AUTHORIZATION
  // ═══════════════════════════════════════
  // Dark blue bar
  doc.setFillColor(...DARK_BLUE);
  doc.rect(L, y, CW, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...WHITE);
  doc.text('VERIFICATION & AUTHORIZATION', W / 2, y + 4.8, { align: 'center' });

  y += 11;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...MED_GREY);
  doc.text('I certify that I have reviewed and verified all documents listed above.', W / 2, y, { align: 'center' });

  // ── Signature grid ──
  y += 6;
  const sL = L + 1;
  const sR = W / 2 + 6;
  const lineLen = 52;

  doc.setDrawColor(...MED_GREY);
  doc.setLineWidth(0.25);

  // Row 1: Agent ID | Date/Time
  label('Agent ID (V/U#):', sL, y);
  doc.line(sL + 30, y + 1, sL + 30 + lineLen, y + 1);
  if (employeeId) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...DARK_GREY);
    doc.text(employeeId, sL + 32, y);
  }

  label('Date/Time:', sR, y);
  doc.line(sR + 19, y + 1, sR + 19 + lineLen, y + 1);
  if (submittedAt) {
    const ts = new Date(submittedAt).toLocaleString('en-US', {
      month: '2-digit', day: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...DARK_GREY);
    doc.text(ts, sR + 21, y);
  }

  // Row 2: Supervisor Signature | Supervisor ID
  y += 9;
  label('Supervisor Signature:', sL, y);
  doc.line(sL + 35, y + 1, sL + 35 + lineLen - 5, y + 1);

  label('Supervisor ID:', sR, y);
  doc.line(sR + 24, y + 1, sR + 24 + lineLen - 5, y + 1);

  // Row 3: Date
  y += 9;
  label('Date:', sL, y);
  doc.line(sL + 10, y + 1, sL + 10 + lineLen, y + 1);

  // ═══════════════════════════════════════
  //  FOOTER
  // ═══════════════════════════════════════
  const fy = H - M - 4;
  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(160, 160, 160);
  doc.text('United Cargo \u2014 Human Remains Document Checklist', W / 2, fy, { align: 'center' });
  doc.text('Generated: ' + new Date().toLocaleString(), W / 2, fy + 2.5, { align: 'center' });

  return doc;
}
