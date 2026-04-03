import jsPDF from 'jspdf';
import 'jspdf-autotable';

export function generateChecklistPDF(data) {
  const { awbNumber, origin, originDisplay, destination, destinationDisplay, routing, flightNumbers, shipmentType, remainsType, checklistItems, notes, employeeId, submittedAt, supervisorId, supervisorStation } = data;

  const doc = new jsPDF('portrait', 'mm', 'letter');
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const M = 12, L = M + 5, R = W - M - 5, CW = R - L;
  const DB = [5, 20, 100], AR = [213, 0, 50], AG = [27, 119, 66], DG = [36, 36, 36], MG = [85, 85, 85], LT = [247, 244, 242], MT = [215, 215, 212], WH = [255, 255, 255];

  let stations = [];
  if (routing) { const s = routing.replace(/\s*-\s*/g, ' ').trim().split(/\s+/).filter(Boolean).map(s => s.toUpperCase()); if (s.length > 1) stations = s.slice(0, -1); }
  if (!stations.length && origin) stations = [origin.toUpperCase()];
  if (stations.length > 5) stations = stations.slice(0, 5);

  // Red border
  doc.setDrawColor(...AR); doc.setLineWidth(2.5);
  doc.rect(M - 2, M - 2, W - 2 * (M - 2), H - 2 * (M - 2));
  doc.setLineWidth(0.4); doc.rect(M + 1, M + 1, W - 2 * (M + 1), H - 2 * (M + 1));

  let y = M + 8;

  // ── HEADER ──
  doc.setFillColor(...DB); doc.rect(L, y - 4, CW, 18, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...WH);
  doc.text('DOCUMENT CHECKLIST AND VERIFICATION', W / 2, y + 3, { align: 'center' });
  doc.setFontSize(11); doc.setTextColor(164, 235, 255);
  doc.text('COVERSHEET', W / 2, y + 10, { align: 'center' });
  y += 20;

  // ── RED STATEMENT ──
  doc.setFillColor(255, 230, 220); doc.rect(L, y, CW, 14, 'F');
  doc.setDrawColor(...AR); doc.setLineWidth(0.8); doc.line(L, y, L, y + 14); doc.line(L + CW, y, L + CW, y + 14);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...AR);
  doc.text('ALL DOCUMENTS MUST BE ORIGINAL UNLESS NOTED ON THE CHECKLIST BELOW', W / 2, y + 5, { align: 'center' });
  doc.setFontSize(7.5);
  doc.text('THIS SHEET MUST TRAVEL WITH THE SHIPMENT AND ACCOMPANYING DOCUMENTS AT ALL TIMES', W / 2, y + 10.5, { align: 'center' });
  y += 16;

  // ── SHIPMENT INFO ──
  doc.setDrawColor(...AR); doc.setLineWidth(0.5); doc.line(L, y, R, y);
  y += 6;
  const c1 = L + 1, c2 = W / 2 + 4;
  const lbl = (t, x, yy) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...MG); doc.text(t, x, yy); return x + doc.getTextWidth(t) + 2; };
  const val = (t, x, yy) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...DG); doc.text(t || '', x, yy); };

  let vx;
  vx = lbl('AWB:', c1, y); val(awbNumber || '', vx, y); vx = lbl('Type:', c2, y); val(remainsType || '', vx, y);
  y += 6; vx = lbl('Origin:', c1, y); val(originDisplay || origin || '', vx, y); vx = lbl('Dest:', c2, y); val(destinationDisplay || destination || '', vx, y);
  y += 6; vx = lbl('Routing:', c1, y); val(routing || '', vx, y); vx = lbl('Flights:', c2, y); val(flightNumbers || '', vx, y);
  y += 6; if (submittedAt) { vx = lbl('Date:', c1, y); val(new Date(submittedAt).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }), vx, y); }
  y += 5;
  doc.setDrawColor(...AR); doc.setLineWidth(0.5); doc.line(L, y, R, y);
  y += 3;

  // ── TABLE ──
  const headRow = ['#', 'Document Requirement', 'Status', 'Verification'];
  stations.forEach(c => headRow.push(c));
  const bodyRows = checklistItems.map((item, i) => {
    const docText = item.custom_note ? `${item.document_name}\n\u26A0 ${item.custom_note}` : item.document_name;
    const row = [(i + 1).toString(), docText, item.status || '', item.verification || ''];
    stations.forEach(() => row.push(''));
    return row;
  });

  const scW = Math.min(13, 55 / Math.max(stations.length, 1));
  const cs = { 0: { cellWidth: 8, halign: 'center' }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 28, halign: 'center', fontSize: 7.5 }, 3: { cellWidth: 22, halign: 'center', fontStyle: 'bold' } };
  stations.forEach((_, i) => { cs[4 + i] = { cellWidth: scW, halign: 'center' }; });

  doc.autoTable({
    startY: y, head: [headRow], body: bodyRows,
    margin: { left: L, right: W - R },
    styles: { fontSize: 8.5, cellPadding: 2.5, lineColor: MT, lineWidth: 0.2, textColor: DG, font: 'helvetica', overflow: 'linebreak' },
    headStyles: { fillColor: DB, textColor: WH, fontStyle: 'bold', fontSize: 7.5, cellPadding: 2.5, halign: 'center' },
    columnStyles: cs,
    alternateRowStyles: { fillColor: LT },
    didParseCell(h) {
      if (h.section === 'body' && h.column.index === 3) {
        if (h.cell.raw === 'Missing') { h.cell.styles.textColor = AR; h.cell.styles.fontStyle = 'bold'; h.cell.styles.fillColor = [255, 230, 220]; }
        else if (h.cell.raw === 'Verified') { h.cell.styles.textColor = AG; h.cell.styles.fontStyle = 'bold'; h.cell.styles.fillColor = [220, 250, 230]; }
      }
    },
    didDrawCell(h) {
      if (h.section === 'body' && h.column.index >= 4) {
        const bx = h.cell.x + h.cell.width / 2 - 1.8, by = h.cell.y + h.cell.height / 2 - 1.8;
        doc.setDrawColor(...MG); doc.setLineWidth(0.3); doc.rect(bx, by, 3.6, 3.6);
      }
    },
  });

  y = doc.lastAutoTable.finalY + 4;

  // ── NOTES ──
  doc.setDrawColor(...MT); doc.setLineWidth(0.3); doc.line(L, y, R, y);
  y += 5; doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...MG); doc.text('NOTES', L + 1, y);
  if (notes && notes.trim()) { y += 1; doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...DG); const ln = doc.splitTextToSize(notes.trim(), CW - 4); doc.text(ln, L + 1, y + 3.5); y += 3.5 + ln.length * 3.5; }
  else { doc.setDrawColor(...MT); doc.setLineWidth(0.15); for (let i = 0; i < 2; i++) { y += 5; doc.line(L + 1, y, R - 1, y); } }
  y += 6;

  // ── CERTIFICATION ──
  doc.setFillColor(220, 250, 230); doc.rect(L, y, CW, 12, 'F');
  doc.setDrawColor(...AG); doc.setLineWidth(0.8); doc.line(L, y, L, y + 12); doc.line(L + CW, y, L + CW, y + 12);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...DB);
  doc.text('CERTIFICATION: I have checked, verified, and confirm all documents are complete.', W / 2, y + 5, { align: 'center' });
  doc.text('Any discrepancies have been noted above.', W / 2, y + 9.5, { align: 'center' });
  y += 18;

  // ── AGENT ID ──
  doc.setDrawColor(...MG); doc.setLineWidth(0.25);
  lbl('Agent ID:', L + 1, y); doc.line(L + 22, y + 1, L + 75, y + 1);
  if (employeeId) { val(employeeId, L + 24, y); }
  lbl('Date/Time:', c2, y); doc.line(c2 + 20, y + 1, c2 + 75, y + 1);
  if (submittedAt) { val(new Date(submittedAt).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }), c2 + 22, y); }
  y += 8;

  // ── STATION SUPERVISOR ──
  doc.setDrawColor(...AR); doc.setLineWidth(0.5); doc.line(L, y, R, y);
  y += 4; doc.setFillColor(...DB); doc.rect(L, y, CW, 6, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...WH);
  doc.text('STATION SUPERVISOR VERIFICATION', W / 2, y + 3.5, { align: 'center' });
  y += 9;

  const bW = CW / Math.min(stations.length, 3), pr = Math.min(stations.length, 3);
  for (let i = 0; i < stations.length; i++) {
    const col = i % pr, row = Math.floor(i / pr), bx = L + col * bW + 2, by = y + row * 20;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...DB); doc.text(stations[i], bx, by);
    doc.setDrawColor(...DB); doc.setLineWidth(0.5); doc.line(bx, by + 1, bx + doc.getTextWidth(stations[i]), by + 1);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MG); doc.setDrawColor(...MG); doc.setLineWidth(0.2);
    if (supervisorId && supervisorStation === stations[i]) {
      doc.text('Signature:', bx, by + 5.5); doc.setTextColor(...DB); doc.text('ELECTRONICALLY SIGNED', bx + 17, by + 5.5); doc.setTextColor(...MG);
      doc.text('ID:', bx, by + 10); doc.setTextColor(...DB); doc.text(supervisorId, bx + 7, by + 10); doc.setTextColor(...MG);
      doc.text('Date:', bx, by + 14.5); doc.setTextColor(...DB); doc.text(new Date().toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }), bx + 10, by + 14.5);
    } else {
      doc.text('Signature:', bx, by + 5.5); doc.line(bx + 17, by + 6, bx + 58, by + 6);
      doc.text('ID:', bx, by + 10); doc.line(bx + 7, by + 10.5, bx + 58, by + 10.5);
      doc.text('Date:', bx, by + 14.5); doc.line(bx + 10, by + 15, bx + 58, by + 15);
    }
  }

  // Footer
  const fy = H - M - 4; doc.setFontSize(6); doc.setFont('helvetica', 'italic'); doc.setTextColor(160, 160, 160);
  doc.text('United Cargo \u2014 Document Checklist Coversheet', W / 2, fy, { align: 'center' });
  doc.text('Generated: ' + new Date().toLocaleString(), W / 2, fy + 2.5, { align: 'center' });
  return doc;
}
