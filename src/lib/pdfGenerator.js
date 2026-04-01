import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * Atmos-styled Human Remains Document Checklist PDF
 *
 * Key feature: Dynamic station checkboxes based on routing.
 * If routing is "IAH - DEN - NRT - HKG", the table gets
 * checkbox columns for DEN, NRT, HKG (all stops after origin).
 * Each column header shows the station code so handlers at
 * each city know which box to check.
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
  const M = 12;
  const L = M + 5;
  const R = W - M - 5;
  const CW = R - L;

  // ── Atmos colors ──
  const DARK_BLUE   = [5, 20, 100];
  const UNITED_BLUE = [20, 20, 210];
  const ALERT_RED   = [213, 0, 50];
  const ALERT_GREEN = [27, 119, 66];
  const DARK_GREY   = [36, 36, 36];
  const MED_GREY    = [85, 85, 85];
  const LIGHT_TONAL = [247, 244, 242];
  const MED_TONAL   = [215, 215, 212];
  const WHITE       = [255, 255, 255];

  // ═══════════════════════════════════════
  //  PARSE ROUTING INTO STATION CODES
  //  "IAH - DEN - NRT - HKG" → ["IAH", "DEN", "NRT"]
  //  (keep origin + intermediates, skip destination which is the last stop)
  // ═══════════════════════════════════════
  let stations = [];
  if (routing && routing.trim()) {
    const allStops = routing
      .replace(/\s*-\s*/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((s) => s.toUpperCase());
    // Remove destination (last stop), keep origin + intermediates
    if (allStops.length > 1) {
      stations = allStops.slice(0, -1);
    }
  }
  // Fallback: if no routing but we have an origin, use just the origin
  if (stations.length === 0 && origin) {
    stations = [origin.toUpperCase()];
  }
  // Cap at 5 stations max to keep columns fitting on the page
  if (stations.length > 5) stations = stations.slice(0, 5);

  // ═══════════════════════════════════════
  //  RED BORDER
  // ═══════════════════════════════════════
  doc.setDrawColor(...ALERT_RED);
  doc.setLineWidth(2.5);
  doc.rect(M - 2, M - 2, W - 2 * (M - 2), H - 2 * (M - 2));
  doc.setLineWidth(0.4);
  doc.rect(M + 1, M + 1, W - 2 * (M + 1), H - 2 * (M + 1));

  let y = M + 9;

  // ═══════════════════════════════════════
  //  HEADER BAR
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

  y += 3;
  doc.setDrawColor(...ALERT_RED);
  doc.setLineWidth(0.5);
  doc.line(L, y, R, y);

  // ═══════════════════════════════════════
  //  SHIPMENT INFO
  // ═══════════════════════════════════════
  y += 5;
  const c1 = L + 1;
  const c2 = W / 2 + 4;

  function lbl(text, x, yy) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...MED_GREY);
    doc.text(text, x, yy);
    return x + doc.getTextWidth(text) + 1.5;
  }

  function val(text, x, yy) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...DARK_GREY);
    doc.text(text || '', x, yy);
  }

  let vx;
  vx = lbl('AWB:', c1, y); val(awbNumber || '', vx, y);
  vx = lbl('Type:', c2, y); val(remainsType || '', vx, y);

  y += 5;
  vx = lbl('Origin:', c1, y); val(originDisplay || origin || '', vx, y);
  vx = lbl('Destination:', c2, y); val(destinationDisplay || destination || '', vx, y);

  y += 5;
  vx = lbl('Routing:', c1, y); val(routing || '', vx, y);
  vx = lbl('Shipment:', c2, y); val(shipmentType || '', vx, y);

  y += 5;
  vx = lbl('Flights:', c1, y); val(flightNumbers || '', vx, y);
  if (submittedAt) {
    const ds = new Date(submittedAt).toLocaleString('en-US', {
      month: '2-digit', day: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
    vx = lbl('Date:', c2, y); val(ds, vx, y);
  }

  y += 4;
  doc.setDrawColor(...ALERT_RED);
  doc.setLineWidth(0.5);
  doc.line(L, y, R, y);

  // ═══════════════════════════════════════
  //  CHECKLIST TABLE WITH STATION CHECKBOXES
  // ═══════════════════════════════════════
  y += 2;

  // Build header row: #, Document, Status, Verification, [Station1], [Station2], ...
  const headRow = ['#', 'Document Requirement', 'Status', 'Verification'];
  stations.forEach((code) => headRow.push(code));

  // Build body rows
  const bodyRows = checklistItems.map((item, i) => {
    const row = [
      (i + 1).toString(),
      item.custom_note
        ? item.document_name + '\n  \u26A0 ' + item.custom_note
        : item.document_name,
      item.status || '',
      item.verification || '',
    ];
    // Add empty cells for each station (checkboxes drawn via didDrawCell)
    stations.forEach(() => row.push(''));
    return row;
  });

  // Calculate column widths dynamically
  const stationColWidth = Math.min(14, 60 / Math.max(stations.length, 1));
  const totalStationWidth = stationColWidth * stations.length;
  const fixedCols = 8 + 30 + 22; // #, status, verification
  const docColWidth = CW - fixedCols - totalStationWidth - (stations.length > 0 ? 0 : 0);

  const colStyles = {
    0: { cellWidth: 8, halign: 'center' },
    1: { cellWidth: 'auto' },
    2: { cellWidth: 30, halign: 'center', fontSize: 6.5 },
    3: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
  };
  stations.forEach((_, i) => {
    colStyles[4 + i] = { cellWidth: stationColWidth, halign: 'center' };
  });

  doc.autoTable({
    startY: y,
    head: [headRow],
    body: bodyRows,
    margin: { left: L, right: W - R },
    styles: {
      fontSize: 7,
      cellPadding: 1.8,
      lineColor: MED_TONAL,
      lineWidth: 0.2,
      textColor: DARK_GREY,
      font: 'helvetica',
    },
    headStyles: {
      fillColor: DARK_BLUE,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 6.5,
      cellPadding: 2,
      halign: 'center',
    },
    columnStyles: colStyles,
    alternateRowStyles: {
      fillColor: LIGHT_TONAL,
    },
    didParseCell(hook) {
      // Color verification column
      if (hook.section === 'body' && hook.column.index === 3) {
        if (hook.cell.raw === 'Missing') {
          hook.cell.styles.textColor = ALERT_RED;
          hook.cell.styles.fontStyle = 'bold';
        } else if (hook.cell.raw === 'Verified') {
          hook.cell.styles.textColor = ALERT_GREEN;
        }
      }
      // Color custom_note lines in document column
      if (hook.section === 'body' && hook.column.index === 1) {
        // Multi-line text with warning symbol indicates custom note
        hook.cell.styles.fontSize = 7;
      }
    },
    didDrawCell(hook) {
      // Draw checkbox squares in station columns (index 4+)
      if (hook.section === 'body' && hook.column.index >= 4) {
        const bx = hook.cell.x + hook.cell.width / 2 - 2;
        const by = hook.cell.y + hook.cell.height / 2 - 2;
        doc.setDrawColor(...MED_GREY);
        doc.setLineWidth(0.3);
        doc.rect(bx, by, 4, 4);
      }
      // Draw station code labels rotated in header if needed
      // (already handled by head row text)
    },
  });

  y = doc.lastAutoTable.finalY + 3;

  // ═══════════════════════════════════════
  //  NOTES
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

  y += 6;
  const sL = L + 1;
  const sR = W / 2 + 6;
  const lineLen = 52;

  doc.setDrawColor(...MED_GREY);
  doc.setLineWidth(0.25);

  // Row 1: Agent ID | Date/Time
  lbl('Agent ID (V/U#):', sL, y);
  doc.line(sL + 30, y + 1, sL + 30 + lineLen, y + 1);
  if (employeeId) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...DARK_GREY);
    doc.text(employeeId, sL + 32, y);
  }

  lbl('Date/Time:', sR, y);
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
  lbl('Supervisor Signature:', sL, y);
  doc.line(sL + 35, y + 1, sL + 35 + lineLen - 5, y + 1);

  lbl('Supervisor ID:', sR, y);
  doc.line(sR + 24, y + 1, sR + 24 + lineLen - 5, y + 1);

  // Row 3: Date
  y += 9;
  lbl('Date:', sL, y);
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
