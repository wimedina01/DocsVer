import jsPDF from 'jspdf';
import 'jspdf-autotable';

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

  const DARK_BLUE   = [5, 20, 100];
  const ALERT_RED   = [213, 0, 50];
  const ALERT_GREEN = [27, 119, 66];
  const DARK_GREY   = [36, 36, 36];
  const MED_GREY    = [85, 85, 85];
  const LIGHT_TONAL = [247, 244, 242];
  const MED_TONAL   = [215, 215, 212];
  const WHITE       = [255, 255, 255];

  // Stations
  let stations = [];
  if (routing && routing.trim()) {
    const allStops = routing.replace(/\s*-\s*/g, ' ').trim().split(/\s+/).filter(Boolean).map(s => s.toUpperCase());
    if (allStops.length > 1) stations = allStops.slice(0, -1);
  }
  if (stations.length === 0 && origin) stations = [origin.toUpperCase()];
  if (stations.length > 5) stations = stations.slice(0, 5);

  // Red border
  doc.setDrawColor(...ALERT_RED);
  doc.setLineWidth(2.5);
  doc.rect(M - 2, M - 2, W - 2 * (M - 2), H - 2 * (M - 2));
  doc.setLineWidth(0.4);
  doc.rect(M + 1, M + 1, W - 2 * (M + 1), H - 2 * (M + 1));

  let y = M + 8;

  // Header
  const headerH = 18;
  doc.setFillColor(...DARK_BLUE);
  doc.rect(L, y - 4, CW, headerH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...WHITE);
  doc.text('DOCUMENT CHECKLIST AND VERIFICATION', W / 2, y + 3, { align: 'center' });
  doc.setFontSize(11);
  doc.setTextColor(164, 235, 255);
  doc.text('COVERSHEET', W / 2, y + 10, { align: 'center' });

  y += headerH + 1;

  // Red statement
  const stmtH = 9;
  doc.setFillColor(255, 230, 220);
  doc.rect(L, y, CW, stmtH, 'F');
  doc.setDrawColor(...ALERT_RED);
  doc.setLineWidth(0.8);
  doc.line(L, y, L, y + stmtH);
  doc.line(L + CW, y, L + CW, y + stmtH);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...ALERT_RED);
  doc.text('ALL DOCUMENTS MUST BE ORIGINAL UNLESS NOTED ON THE CHECKLIST BELOW', W / 2, y + 5.8, { align: 'center' });
  y += stmtH + 1;

  doc.setDrawColor(...ALERT_RED);
  doc.setLineWidth(0.5);
  doc.line(L, y, R, y);

  // Shipment info
  y += 5;
  const c1 = L + 1, c2 = W / 2 + 4;

  function lbl(text, x, yy) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...MED_GREY);
    doc.text(text, x, yy); return x + doc.getTextWidth(text) + 1.5;
  }
  function val(text, x, yy) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...DARK_GREY);
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
  vx = lbl('Flights:', c2, y); val(flightNumbers || '', vx, y);
  y += 5;
  if (submittedAt) {
    const ds = new Date(submittedAt).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    vx = lbl('Date:', c1, y); val(ds, vx, y);
  }

  y += 4;
  doc.setDrawColor(...ALERT_RED); doc.setLineWidth(0.5); doc.line(L, y, R, y);

  // Table
  y += 2;
  const headRow = ['#', 'Document Requirement', 'Status', 'Verification'];
  stations.forEach(code => headRow.push(code));

  const bodyRows = checklistItems.map((item, i) => {
    const row = [(i + 1).toString(),
      item.custom_note ? item.document_name + '\n  \u26A0 ' + item.custom_note : item.document_name,
      item.status || '', item.verification || ''];
    stations.forEach(() => row.push(''));
    return row;
  });

  const stationColW = Math.min(13, 55 / Math.max(stations.length, 1));
  const colStyles = { 0: { cellWidth: 8, halign: 'center' }, 1: { cellWidth: 'auto' },
    2: { cellWidth: 30, halign: 'center', fontSize: 7.5 }, 3: { cellWidth: 22, halign: 'center', fontStyle: 'bold' } };
  stations.forEach((_, i) => { colStyles[4 + i] = { cellWidth: stationColW, halign: 'center' }; });

  doc.autoTable({
    startY: y, head: [headRow], body: bodyRows,
    margin: { left: L, right: W - R },
    styles: { fontSize: 8, cellPadding: 2, lineColor: MED_TONAL, lineWidth: 0.2, textColor: DARK_GREY, font: 'helvetica' },
    headStyles: { fillColor: DARK_BLUE, textColor: WHITE, fontStyle: 'bold', fontSize: 7.5, cellPadding: 2.2, halign: 'center' },
    columnStyles: colStyles,
    alternateRowStyles: { fillColor: LIGHT_TONAL },
    didParseCell(hook) {
      if (hook.section === 'body' && hook.column.index === 3) {
        if (hook.cell.raw === 'Missing') { hook.cell.styles.textColor = ALERT_RED; hook.cell.styles.fontStyle = 'bold'; hook.cell.styles.fillColor = [255, 230, 220]; }
        else if (hook.cell.raw === 'Verified') { hook.cell.styles.textColor = ALERT_GREEN; hook.cell.styles.fontStyle = 'bold'; hook.cell.styles.fillColor = [220, 250, 230]; }
      }
    },
    didDrawCell(hook) {
      if (hook.section === 'body' && hook.column.index >= 4) {
        const bx = hook.cell.x + hook.cell.width / 2 - 1.8, by = hook.cell.y + hook.cell.height / 2 - 1.8;
        doc.setDrawColor(...MED_GREY); doc.setLineWidth(0.3); doc.rect(bx, by, 3.6, 3.6);
      }
    },
  });

  y = doc.lastAutoTable.finalY + 3;

  // Notes
  doc.setDrawColor(...MED_TONAL); doc.setLineWidth(0.3); doc.line(L, y, R, y);
  y += 4;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...MED_GREY);
  doc.text('NOTES', L + 1, y);
  if (notes && notes.trim()) {
    y += 1; doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...DARK_GREY);
    const lines = doc.splitTextToSize(notes.trim(), CW - 4); doc.text(lines, L + 1, y + 3); y += 3 + lines.length * 3.2;
  } else {
    doc.setDrawColor(...MED_TONAL); doc.setLineWidth(0.15);
    for (let i = 0; i < 2; i++) { y += 4.5; doc.line(L + 1, y, R - 1, y); }
  }

  y += 5;

  // Certification — with MORE padding before agent ID
  const certH = 11;
  doc.setFillColor(220, 250, 230);
  doc.rect(L, y, CW, certH, 'F');
  doc.setDrawColor(...ALERT_GREEN); doc.setLineWidth(0.8);
  doc.line(L, y, L, y + certH); doc.line(L + CW, y, L + CW, y + certH);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...DARK_BLUE);
  doc.text('CERTIFICATION: I have checked, verified, and confirm that all documents listed above are', W / 2, y + 4.5, { align: 'center' });
  doc.text('complete and accurate. Any discrepancies have been noted.', W / 2, y + 8.5, { align: 'center' });

  y += certH + 6; // Extra padding before agent info

  // Agent ID
  const lineLen = 48;
  doc.setDrawColor(...MED_GREY); doc.setLineWidth(0.25);
  lbl('Agent ID (V/U#):', L + 1, y);
  doc.line(L + 33, y + 1, L + 33 + lineLen, y + 1);
  if (employeeId) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...DARK_GREY); doc.text(employeeId, L + 35, y); }

  const dateX = W / 2 + 6;
  lbl('Date/Time:', dateX, y);
  doc.line(dateX + 20, y + 1, dateX + 20 + lineLen, y + 1);
  if (submittedAt) {
    const ts = new Date(submittedAt).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...DARK_GREY); doc.text(ts, dateX + 22, y);
  }

  // Station supervisor blocks
  y += 6;
  doc.setDrawColor(...ALERT_RED); doc.setLineWidth(0.5); doc.line(L, y, R, y);
  y += 4;
  doc.setFillColor(...DARK_BLUE); doc.rect(L, y - 1, CW, 6, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...WHITE);
  doc.text('STATION SUPERVISOR VERIFICATION', W / 2, y + 2.8, { align: 'center' });
  y += 8;

  const sigLineW = 42;
  const blockW = CW / Math.min(stations.length, 3);
  const stationsPerRow = Math.min(stations.length, 3);
  for (let i = 0; i < stations.length; i++) {
    const col = i % stationsPerRow, row = Math.floor(i / stationsPerRow);
    const bx = L + col * blockW + 2, by = y + row * 22;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...DARK_BLUE);
    doc.text(stations[i], bx, by);
    doc.setDrawColor(...DARK_BLUE); doc.setLineWidth(0.5);
    doc.line(bx, by + 1, bx + doc.getTextWidth(stations[i]), by + 1);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MED_GREY); doc.setDrawColor(...MED_GREY); doc.setLineWidth(0.2);
    doc.text('Signature:', bx, by + 6); doc.line(bx + 16, by + 6.5, bx + 16 + sigLineW, by + 6.5);
    doc.text('ID:', bx, by + 11); doc.line(bx + 6, by + 11.5, bx + 6 + sigLineW + 10, by + 11.5);
    doc.text('Date:', bx, by + 16); doc.line(bx + 9, by + 16.5, bx + 9 + sigLineW + 7, by + 16.5);
  }

  // Footer
  const fy = H - M - 4;
  doc.setFontSize(6); doc.setFont('helvetica', 'italic'); doc.setTextColor(160, 160, 160);
  doc.text('United Cargo \u2014 Document Checklist Coversheet', W / 2, fy, { align: 'center' });
  doc.text('Generated: ' + new Date().toLocaleString(), W / 2, fy + 2.5, { align: 'center' });

  return doc;
}
