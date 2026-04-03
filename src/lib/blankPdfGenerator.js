import jsPDF from 'jspdf';
import 'jspdf-autotable';

export function generateBlankChecklistPDF(data) {
  const { destination, destinationDisplay, remainsType, checklistItems } = data;
  const doc = new jsPDF('portrait', 'mm', 'letter');
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const M = 16, L = M, R = W - M, CW = R - L;
  const DB = [5, 20, 100], DG = [36, 36, 36], MG = [85, 85, 85], LT = [247, 244, 242], MT = [215, 215, 212], WH = [255, 255, 255];

  let y = M;
  doc.setFillColor(...DB); doc.rect(L, y, CW, 16, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...WH);
  doc.text('DOCUMENT REQUIREMENTS', W / 2, y + 7, { align: 'center' });
  doc.setFontSize(10); doc.setTextColor(164, 235, 255);
  doc.text('REFERENCE CHECKLIST', W / 2, y + 12.5, { align: 'center' });
  y += 22;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...DG);
  doc.text('Destination:', L, y); doc.setFont('helvetica', 'normal');
  doc.text(destinationDisplay || destination || '', L + doc.getTextWidth('Destination:  '), y);
  doc.setFont('helvetica', 'bold'); const tx = W / 2 + 10;
  doc.text('Type:', tx, y); doc.setFont('helvetica', 'normal');
  doc.text(remainsType || '', tx + doc.getTextWidth('Type:  '), y);
  y += 3; doc.setDrawColor(20, 20, 210); doc.setLineWidth(0.6); doc.line(L, y, R, y); y += 5;

  // Table — custom notes as linebreak text, not separate cells
  const rows = checklistItems.map((item, i) => [
    (i + 1).toString(),
    item.custom_note ? `${item.document_name}\n\u26A0 ${item.custom_note}` : item.document_name,
    item.status || 'Required', '',
  ]);

  doc.autoTable({
    startY: y, head: [['#', 'Document Requirement', 'Status', '\u2713']], body: rows,
    margin: { left: L, right: M },
    styles: { fontSize: 10, cellPadding: 3.5, lineColor: MT, lineWidth: 0.2, textColor: DG, font: 'helvetica', overflow: 'linebreak' },
    headStyles: { fillColor: DB, textColor: WH, fontStyle: 'bold', fontSize: 9.5, cellPadding: 4 },
    columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 40, halign: 'center', fontSize: 9 }, 3: { cellWidth: 14, halign: 'center' } },
    alternateRowStyles: { fillColor: LT },
    didDrawCell(h) {
      if (h.section === 'body' && h.column.index === 3) {
        const bx = h.cell.x + h.cell.width / 2 - 2.5, by = h.cell.y + h.cell.height / 2 - 2.5;
        doc.setDrawColor(...MG); doc.setLineWidth(0.3); doc.rect(bx, by, 5, 5);
      }
    },
  });

  y = doc.lastAutoTable.finalY + 8;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...MG); doc.text('NOTES', L, y);
  doc.setDrawColor(...MT); doc.setLineWidth(0.15);
  for (let i = 0; i < 4; i++) { y += 7; doc.line(L, y, R, y); }

  const fy = H - M;
  doc.setDrawColor(20, 20, 210); doc.setLineWidth(0.4); doc.line(L, fy - 4, R, fy - 4);
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...MG);
  doc.text('United Cargo \u2014 Document Requirements Reference', L, fy);
  doc.text('Generated: ' + new Date().toLocaleDateString(), R, fy, { align: 'right' });
  return doc;
}
