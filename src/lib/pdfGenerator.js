import jsPDF from 'jspdf';
import 'jspdf-autotable';

export function generateChecklistPDF(data) {
  const { awbNumber, origin, originDisplay, destination, destinationDisplay, routing, flightNumbers, remainsType, checklistItems, notes, employeeId, submittedAt, supervisorSignoffs } = data;

  const doc = new jsPDF('portrait', 'mm', 'letter');
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const M = 12, L = M + 5, R = W - M - 5, CW = R - L;
  const DB = [5, 20, 100], AR = [213, 0, 50], AG = [27, 119, 66], DG = [36, 36, 36], MG = [85, 85, 85], LT = [247, 244, 242], MT = [215, 215, 212], WH = [255, 255, 255];

  // Build signoff lookup: { stationCode: { id, at, manual } }
  const signoffMap = {};
  if (supervisorSignoffs) {
    for (const s of supervisorSignoffs) {
      signoffMap[s.station] = s;
    }
  }
  // Legacy support for old single-supervisor format
  if (data.supervisorId && data.supervisorStation && !signoffMap[data.supervisorStation]) {
    signoffMap[data.supervisorStation] = { station: data.supervisorStation, id: data.supervisorId, at: new Date().toISOString() };
  }

  let stations = [];
  if (routing) { const s = routing.replace(/\s*-\s*/g, ' ').trim().split(/\s+/).filter(Boolean).map(s => s.toUpperCase()); if (s.length > 1) stations = s.slice(0, -1); }
  if (!stations.length && origin) stations = [origin.toUpperCase()];
  if (stations.length > 5) stations = stations.slice(0, 5);

  // Red border
  doc.setDrawColor(...AR); doc.setLineWidth(2.5);
  doc.rect(M - 2, M - 2, W - 2 * (M - 2), H - 2 * (M - 2));
  doc.setLineWidth(0.4); doc.rect(M + 1, M + 1, W - 2 * (M + 1), H - 2 * (M + 1));

  let y = M + 7;

  // Header
  doc.setFillColor(...DB); doc.rect(L, y - 3, CW, 16, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...WH);
  doc.text('DOCUMENT CHECKLIST AND VERIFICATION', W / 2, y + 3, { align: 'center' });
  doc.setFontSize(10); doc.setTextColor(164, 235, 255);
  doc.text('COVERSHEET', W / 2, y + 9, { align: 'center' });
  y += 15;

  // Statement
  doc.setFillColor(255, 230, 220); doc.rect(L, y, CW, 12, 'F');
  doc.setDrawColor(...AR); doc.setLineWidth(0.8); doc.line(L, y, L, y + 12); doc.line(L + CW, y, L + CW, y + 12);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...AR);
  doc.text('ALL DOCUMENTS MUST BE ORIGINAL UNLESS NOTED ON THE CHECKLIST BELOW', W / 2, y + 4.5, { align: 'center' });
  doc.setFontSize(7);
  doc.text('THIS SHEET MUST TRAVEL WITH THE SHIPMENT AND ACCOMPANYING DOCUMENTS AT ALL TIMES', W / 2, y + 9, { align: 'center' });
  y += 13;

  doc.setDrawColor(...AR); doc.setLineWidth(0.4); doc.line(L, y, R, y);

  // Info
  y += 4;
  const c1 = L + 1, c2 = W / 2 + 4;
  const lbl = (t, x, yy) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...MG); doc.text(t, x, yy); return x + doc.getTextWidth(t) + 1.5; };
  const val = (t, x, yy) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...DG); doc.text(t || '', x, yy); };

  let vx;
  vx = lbl('AWB:', c1, y); val(awbNumber, vx, y); vx = lbl('Type:', c2, y); val(remainsType, vx, y);
  y += 4.5; vx = lbl('Origin:', c1, y); val(originDisplay || origin || '', vx, y); vx = lbl('Dest:', c2, y); val(destinationDisplay || destination || '', vx, y);
  y += 4.5; vx = lbl('Routing:', c1, y); val(routing || '', vx, y); vx = lbl('Flights:', c2, y); val(flightNumbers || '', vx, y);
  y += 4.5; if (submittedAt) { vx = lbl('Date:', c1, y); val(new Date(submittedAt).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }), vx, y); }
  y += 3.5; doc.setDrawColor(...AR); doc.setLineWidth(0.4); doc.line(L, y, R, y);
  y += 2;

  // Table
  const headRow = ['#', 'Document Requirement', 'Status', 'Verification'];
  stations.forEach(c => headRow.push(c));

  const bodyRows = checklistItems.map((item, i) => {
    let docText = item.document_name;
    if (item.custom_note) docText += '\n& ' + item.custom_note;
    const row = [(i + 1).toString(), docText, item.status || '', item.verification || ''];
    stations.forEach(() => row.push(''));
    return row;
  });

  const scW = Math.min(13, 55 / Math.max(stations.length, 1));
  const cs = { 0: { cellWidth: 8, halign: 'center' }, 1: { cellWidth: 'auto', fontSize: 8 }, 2: { cellWidth: 26, halign: 'center', fontSize: 7 }, 3: { cellWidth: 20, halign: 'center', fontStyle: 'bold', fontSize: 7 } };
  stations.forEach((_, i) => { cs[4 + i] = { cellWidth: scW, halign: 'center' }; });

  doc.autoTable({
    startY: y, head: [headRow], body: bodyRows,
    margin: { left: L, right: W - R },
    styles: { fontSize: 8, cellPadding: 1.8, lineColor: MT, lineWidth: 0.15, textColor: DG, font: 'helvetica', overflow: 'linebreak', cellWidth: 'wrap' },
    headStyles: { fillColor: DB, textColor: WH, fontStyle: 'bold', fontSize: 7, cellPadding: 2, halign: 'center' },
    columnStyles: cs,
    alternateRowStyles: { fillColor: LT },
    didParseCell(h) {
      if (h.section === 'body' && h.column.index === 3) {
        if (h.cell.raw === 'Missing') { h.cell.styles.textColor = AR; h.cell.styles.fontStyle = 'bold'; h.cell.styles.fillColor = [255, 230, 220]; }
        else if (h.cell.raw === 'Verified') { h.cell.styles.textColor = AG; h.cell.styles.fontStyle = 'bold'; h.cell.styles.fillColor = [220, 250, 230]; }
      }
      if (h.section === 'body' && h.column.index === 1) { h.cell.styles.overflow = 'linebreak'; h.cell.styles.fontSize = 8; }
    },
    didDrawCell(h) {
      if (h.section === 'body' && h.column.index >= 4) {
        const boxSize = 4;
        const bx = h.cell.x + h.cell.width / 2 - boxSize / 2;
        const by = h.cell.y + h.cell.height / 2 - boxSize / 2;
        doc.setDrawColor(...MG); doc.setLineWidth(0.3); doc.rect(bx, by, boxSize, boxSize);

        // Draw checkmark for ANY supervisor who signed this station
        const stIdx = h.column.index - 4;
        const stCode = stations[stIdx];
        if (stCode && signoffMap[stCode]) {
          // Draw green checkmark
          doc.setDrawColor(...AG); doc.setLineWidth(0.9);
          const cx = bx + 0.6, cy = by + boxSize * 0.5;
          doc.line(cx, cy, cx + boxSize * 0.3, cy + boxSize * 0.4);
          doc.line(cx + boxSize * 0.3, cy + boxSize * 0.4, cx + boxSize * 0.9, cy - boxSize * 0.4);
        }
      }
    },
  });

  y = doc.lastAutoTable.finalY + 3;

  // Notes
  doc.setDrawColor(...MT); doc.setLineWidth(0.2); doc.line(L, y, R, y);
  y += 3.5; doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...MG); doc.text('NOTES', L + 1, y);
  if (notes && notes.trim()) { y += 0.5; doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...DG); const ln = doc.splitTextToSize(notes.trim(), CW - 4); doc.text(ln, L + 1, y + 3); y += 3 + ln.length * 3; }
  else { doc.setDrawColor(...MT); doc.setLineWidth(0.1); for (let i = 0; i < 2; i++) { y += 4; doc.line(L + 1, y, R - 1, y); } }
  y += 4;

  // Cert
  doc.setFillColor(220, 250, 230); doc.rect(L, y, CW, 10, 'F');
  doc.setDrawColor(...AG); doc.setLineWidth(0.6); doc.line(L, y, L, y + 10); doc.line(L + CW, y, L + CW, y + 10);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...DB);
  doc.text('CERTIFICATION: I have checked, verified, and confirm all documents are complete.', W / 2, y + 4, { align: 'center' });
  doc.text('Any discrepancies have been noted above.', W / 2, y + 8, { align: 'center' });
  y += 14;

  // Agent
  doc.setDrawColor(...MG); doc.setLineWidth(0.2);
  lbl('Agent ID:', L + 1, y); doc.line(L + 20, y + 1, L + 68, y + 1);
  if (employeeId) val(employeeId, L + 22, y);
  lbl('Date/Time:', c2, y); doc.line(c2 + 18, y + 1, c2 + 68, y + 1);
  if (submittedAt) val(new Date(submittedAt).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }), c2 + 20, y);
  y += 5;

  // Supervisor blocks — show ALL signoffs
  doc.setDrawColor(...AR); doc.setLineWidth(0.4); doc.line(L, y, R, y);
  y += 3; doc.setFillColor(...DB); doc.rect(L, y, CW, 5.5, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...WH);
  doc.text('STATION SUPERVISOR VERIFICATION', W / 2, y + 3.3, { align: 'center' });
  y += 7.5;

  const bW = CW / Math.min(stations.length, 3), pr = Math.min(stations.length, 3);
  for (let i = 0; i < stations.length; i++) {
    const col = i % pr, row = Math.floor(i / pr), bx = L + col * bW + 2, by = y + row * 18;
    const stCode = stations[i];
    const signoff = signoffMap[stCode];

    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...DB); doc.text(stCode, bx, by);
    doc.setDrawColor(...DB); doc.setLineWidth(0.4); doc.line(bx, by + 1, bx + doc.getTextWidth(stCode), by + 1);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...MG); doc.setDrawColor(...MG); doc.setLineWidth(0.15);

    if (signoff) {
      // Electronically signed
      const sigLabel = signoff.manual ? 'MANUALLY VERIFIED' : 'ELECTRONICALLY SIGNED';
      doc.text('Signature:', bx, by + 5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...DB); doc.text(sigLabel, bx + 15, by + 5);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...MG);
      doc.text('ID:', bx, by + 9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...DB); doc.text(signoff.id, bx + 6, by + 9);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...MG);
      doc.text('Date:', bx, by + 13); doc.setFont('helvetica', 'bold'); doc.setTextColor(...DB);
      doc.text(new Date(signoff.at).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }), bx + 9, by + 13);
    } else {
      doc.text('Signature:', bx, by + 5); doc.line(bx + 15, by + 5.5, bx + 52, by + 5.5);
      doc.text('ID:', bx, by + 9); doc.line(bx + 6, by + 9.5, bx + 52, by + 9.5);
      doc.text('Date:', bx, by + 13); doc.line(bx + 9, by + 13.5, bx + 52, by + 13.5);
    }
  }

  const fy = H - M - 3.5; doc.setFontSize(5.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(160, 160, 160);
  doc.text('United Cargo \u2014 Document Checklist Coversheet', W / 2, fy, { align: 'center' });
  doc.text('Generated: ' + new Date().toLocaleString(), W / 2, fy + 2.5, { align: 'center' });
  return doc;
}
