import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * Human Remains Document Checklist & Verification — COVERSHEET PDF
 *
 * Features:
 *  - Large, prominent header with "COVERSHEET"
 *  - Bold document-original statement
 *  - Dynamic station checkbox columns (origin + intermediates, no destination)
 *  - Per-station supervisor signature/ID/date blocks
 *  - Prominent certify statement
 *  - Red double border preserved
 */
export function generateChecklistPDF(data) {
  const {
    awbNumber, origin, originDisplay, destination, destinationDisplay,
    routing, flightNumbers, shipmentType, remainsType,
    checklistItems, notes, employeeId, submittedAt,
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
  const ALERT_RED   = [213, 0, 50];
  const ALERT_GREEN = [27, 119, 66];
  const DARK_GREY   = [36, 36, 36];
  const MED_GREY    = [85, 85, 85];
  const LIGHT_TONAL = [247, 244, 242];
  const MED_TONAL   = [215, 215, 212];
  const WHITE       = [255, 255, 255];

  // ═══════════════════════════════════════
  //  PARSE STATIONS (origin + intermediates, skip destination)
  // ═══════════════════════════════════════
  let stations = [];
  if (routing && routing.trim()) {
    const allStops = routing.replace(/\s*-\s*/g, ' ').trim().split(/\s+/).filter(Boolean).map(s => s.toUpperCase());
    if (allStops.length > 1) stations = allStops.slice(0, -1);
  }
  if (stations.length === 0 && origin) stations = [origin.toUpperCase()];
  if (stations.length > 5) stations = stations.slice(0, 5);

  // ═══════════════════════════════════════
  //  RED DOUBLE BORDER
  // ═══════════════════════════════════════
  doc.setDrawColor(...ALERT_RED);
  doc.setLineWidth(2.5);
  doc.rect(M - 2, M - 2, W - 2 * (M - 2), H - 2 * (M - 2));
  doc.setLineWidth(0.4);
  doc.rect(M + 1, M + 1, W - 2 * (M + 1), H - 2 * (M + 1));

  let y = M + 8;

  // ═══════════════════════════════════════
  //  HEADER — Large, prominent with COVERSHEET
  // ═══════════════════════════════════════
  // Dark blue header bar — taller and more prominent
  const headerH = 18;
  doc.setFillColor(...DARK_BLUE);
  doc.rect(L, y - 4, CW, headerH, 'F');

  // Main title — large
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...WHITE);
  doc.text('HUMAN REMAINS DOCUMENT CHECKLIST AND VERIFICATION', W / 2, y + 3, { align: 'center' });

  // COVERSHEET subtitle — prominent
  doc.setFontSize(11);
  doc.setTextColor(164, 235, 255); // Atmos Light Blue for contrast
  doc.text('COVERSHEET', W / 2, y + 10, { align: 'center' });

  y += headerH + 1;

  // ── Bold document-original statement with red accent bar ──
  const stmtH = 8;
  doc.setFillColor(255, 230, 220); // Atmos Light Red bg
  doc.rect(L, y, CW, stmtH, 'F');
  doc.setDrawColor(...ALERT_RED);
  doc.setLineWidth(0.8);
  doc.line(L, y, L, y + stmtH); // left red accent
  doc.line(L + CW, y, L + CW, y + stmtH); // right red accent

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...ALERT_RED);
  doc.text('ALL DOCUMENTS MUST BE ORIGINAL UNLESS NOTED ON THE CHECKLIST BELOW', W / 2, y + 5.2, { align: 'center' });

  y += stmtH + 1;

  // ── Red divider ──
  doc.setDrawColor(...ALERT_RED);
  doc.setLineWidth(0.5);
  doc.line(L, y, R, y);

  // ═══════════════════════════════════════
  //  SHIPMENT INFO
  // ═══════════════════════════════════════
  y += 4.5;
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

  y += 4.5;
  vx = lbl('Origin:', c1, y); val(originDisplay || origin || '', vx, y);
  vx = lbl('Destination:', c2, y); val(destinationDisplay || destination || '', vx, y);

  y += 4.5;
  vx = lbl('Routing:', c1, y); val(routing || '', vx, y);
  vx = lbl('Flights:', c2, y); val(flightNumbers || '', vx, y);

  y += 4.5;
  if (submittedAt) {
    const ds = new Date(submittedAt).toLocaleString('en-US', {
      month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    vx = lbl('Date:', c1, y); val(ds, vx, y);
  }

  y += 3.5;
  doc.setDrawColor(...ALERT_RED);
  doc.setLineWidth(0.5);
  doc.line(L, y, R, y);

  // ═══════════════════════════════════════
  //  CHECKLIST TABLE
  // ═══════════════════════════════════════
  y += 1.5;

  const headRow = ['#', 'Document Requirement', 'Status', 'Verification'];
  stations.forEach(code => headRow.push(code));

  const bodyRows = checklistItems.map((item, i) => {
    const row = [
      (i + 1).toString(),
      item.custom_note ? item.document_name + '\n  \u26A0 ' + item.custom_note : item.document_name,
      item.status || '',
      item.verification || '',
    ];
    stations.forEach(() => row.push(''));
    return row;
  });

  const stationColW = Math.min(13, 55 / Math.max(stations.length, 1));
  const colStyles = {
    0: { cellWidth: 7, halign: 'center' },
    1: { cellWidth: 'auto' },
    2: { cellWidth: 28, halign: 'center', fontSize: 6 },
    3: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
  };
  stations.forEach((_, i) => {
    colStyles[4 + i] = { cellWidth: stationColW, halign: 'center' };
  });

  doc.autoTable({
    startY: y,
    head: [headRow],
    body: bodyRows,
    margin: { left: L, right: W - R },
    styles: {
      fontSize: 6.5, cellPadding: 1.5, lineColor: MED_TONAL,
      lineWidth: 0.2, textColor: DARK_GREY, font: 'helvetica',
    },
    headStyles: {
      fillColor: DARK_BLUE, textColor: WHITE, fontStyle: 'bold',
      fontSize: 6, cellPadding: 2, halign: 'center',
    },
    columnStyles: colStyles,
    alternateRowStyles: { fillColor: LIGHT_TONAL },
    didParseCell(hook) {
      if (hook.section === 'body' && hook.column.index === 3) {
        if (hook.cell.raw === 'Missing') {
          hook.cell.styles.textColor = ALERT_RED;
          hook.cell.styles.fontStyle = 'bold';
          hook.cell.styles.fillColor = [255, 230, 220]; // Atmos Light Red #FFE6DC
        } else if (hook.cell.raw === 'Verified') {
          hook.cell.styles.textColor = ALERT_GREEN;
          hook.cell.styles.fontStyle = 'bold';
          hook.cell.styles.fillColor = [220, 250, 230]; // Atmos Light Green #DCFAE6
        }
      }
    },
    didDrawCell(hook) {
      if (hook.section === 'body' && hook.column.index >= 4) {
        const bx = hook.cell.x + hook.cell.width / 2 - 1.8;
        const by = hook.cell.y + hook.cell.height / 2 - 1.8;
        doc.setDrawColor(...MED_GREY);
        doc.setLineWidth(0.3);
        doc.rect(bx, by, 3.6, 3.6);
      }
    },
  });

  y = doc.lastAutoTable.finalY + 2.5;

  // ═══════════════════════════════════════
  //  NOTES
  // ═══════════════════════════════════════
  doc.setDrawColor(...MED_TONAL);
  doc.setLineWidth(0.3);
  doc.line(L, y, R, y);

  y += 3.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...MED_GREY);
  doc.text('NOTES', L + 1, y);

  if (notes && notes.trim()) {
    y += 0.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...DARK_GREY);
    const lines = doc.splitTextToSize(notes.trim(), CW - 4);
    doc.text(lines, L + 1, y + 3);
    y += 3 + lines.length * 2.8;
  } else {
    doc.setDrawColor(...MED_TONAL);
    doc.setLineWidth(0.15);
    for (let i = 0; i < 2; i++) {
      y += 4;
      doc.line(L + 1, y, R - 1, y);
    }
  }

  y += 3;

  // ═══════════════════════════════════════
  //  CERTIFICATION STATEMENT — prominent
  // ═══════════════════════════════════════
  const certH = 10;
  doc.setFillColor(220, 250, 230); // Atmos Light Green bg
  doc.rect(L, y, CW, certH, 'F');
  doc.setDrawColor(...ALERT_GREEN);
  doc.setLineWidth(0.8);
  doc.line(L, y, L, y + certH);
  doc.line(L + CW, y, L + CW, y + certH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...DARK_BLUE);
  doc.text('CERTIFICATION: I have checked, verified, and confirm that all documents listed above are', W / 2, y + 4, { align: 'center' });
  doc.text('complete and accurate. Any discrepancies have been noted.', W / 2, y + 7.5, { align: 'center' });

  y += certH + 2;

  // ═══════════════════════════════════════
  //  AGENT / CREATOR SIGNATURE (single row)
  // ═══════════════════════════════════════
  const lineLen = 48;
  doc.setDrawColor(...MED_GREY);
  doc.setLineWidth(0.25);

  lbl('Agent ID (V/U#):', L + 1, y);
  doc.line(L + 31, y + 1, L + 31 + lineLen, y + 1);
  if (employeeId) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...DARK_GREY);
    doc.text(employeeId, L + 33, y);
  }

  const dateX = W / 2 + 6;
  lbl('Date/Time:', dateX, y);
  doc.line(dateX + 19, y + 1, dateX + 19 + lineLen, y + 1);
  if (submittedAt) {
    const ts = new Date(submittedAt).toLocaleString('en-US', {
      month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...DARK_GREY);
    doc.text(ts, dateX + 21, y);
  }

  y += 5;

  // ═══════════════════════════════════════
  //  PER-STATION SUPERVISOR SIGN-OFF BLOCKS
  // ═══════════════════════════════════════
  doc.setDrawColor(...ALERT_RED);
  doc.setLineWidth(0.5);
  doc.line(L, y, R, y);

  y += 4;
  doc.setFillColor(...DARK_BLUE);
  doc.rect(L, y - 1, CW, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...WHITE);
  doc.text('STATION SUPERVISOR VERIFICATION — Each station supervisor must sign to confirm all documents were verified at their location', W / 2, y + 2.8, { align: 'center' });

  y += 8;

  // Draw sign-off block for each station
  const sigLineW = 42;
  const blockW = CW / Math.min(stations.length, 3);
  const stationsPerRow = Math.min(stations.length, 3);

  for (let i = 0; i < stations.length; i++) {
    const col = i % stationsPerRow;
    const row = Math.floor(i / stationsPerRow);
    const bx = L + col * blockW + 2;
    const by = y + row * 24;

    // Station code header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...DARK_BLUE);
    doc.text(stations[i], bx, by);

    // Underline station code
    const codeW = doc.getTextWidth(stations[i]);
    doc.setDrawColor(...DARK_BLUE);
    doc.setLineWidth(0.5);
    doc.line(bx, by + 1, bx + codeW, by + 1);

    // Signature line
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...MED_GREY);
    doc.setDrawColor(...MED_GREY);
    doc.setLineWidth(0.2);

    doc.text('Signature:', bx, by + 6);
    doc.line(bx + 16, by + 6.5, bx + 16 + sigLineW, by + 6.5);

    doc.text('ID:', bx, by + 11);
    doc.line(bx + 6, by + 11.5, bx + 6 + sigLineW + 10, by + 11.5);

    doc.text('Date:', bx, by + 16);
    doc.line(bx + 9, by + 16.5, bx + 9 + sigLineW + 7, by + 16.5);
  }

  // Calculate how many rows of station blocks
  const stationRows = Math.ceil(stations.length / stationsPerRow);

  // ═══════════════════════════════════════
  //  FOOTER
  // ═══════════════════════════════════════
  const fy = H - M - 4;
  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(160, 160, 160);
  doc.text('United Cargo \u2014 Human Remains Document Checklist Coversheet', W / 2, fy, { align: 'center' });
  doc.text('Generated: ' + new Date().toLocaleString(), W / 2, fy + 2.5, { align: 'center' });

  return doc;
}
