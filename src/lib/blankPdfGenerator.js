import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * Generate a clean blank checklist PDF — Atmos UX styled
 * No red border, no AWB info, no verification statement.
 * Just destination + requirements list.
 */
export function generateBlankChecklistPDF(data) {
  const { destination, destinationDisplay, remainsType, checklistItems } = data;

  const doc = new jsPDF('portrait', 'mm', 'letter');
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 16;
  const L = M;
  const R = W - M;
  const CW = R - L;

  // Atmos colors
  const DARK_BLUE   = [5, 20, 100];
  const UNITED_BLUE = [20, 20, 210];
  const DARK_GREY   = [36, 36, 36];
  const MED_GREY    = [85, 85, 85];
  const LIGHT_TONAL = [247, 244, 242];
  const MED_TONAL   = [215, 215, 212];
  const WHITE       = [255, 255, 255];

  let y = M;

  // ═══════════════════════════════════════
  //  HEADER — Dark blue bar
  // ═══════════════════════════════════════
  const headerH = 16;
  doc.setFillColor(...DARK_BLUE);
  doc.rect(L, y, CW, headerH, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...WHITE);
  doc.text('HUMAN REMAINS — DOCUMENT REQUIREMENTS', W / 2, y + 7, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(164, 235, 255); // Atmos Light Blue
  doc.text('REFERENCE CHECKLIST', W / 2, y + 12.5, { align: 'center' });

  y += headerH + 6;

  // ═══════════════════════════════════════
  //  DESTINATION & TYPE
  // ═══════════════════════════════════════
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...DARK_GREY);
  doc.text('Destination:', L, y);
  doc.setFont('helvetica', 'normal');
  doc.text(destinationDisplay || destination || '', L + doc.getTextWidth('Destination:  '), y);

  doc.setFont('helvetica', 'bold');
  const typeX = W / 2 + 10;
  doc.text('Type:', typeX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(remainsType || '', typeX + doc.getTextWidth('Type:  '), y);

  y += 3;
  doc.setDrawColor(...UNITED_BLUE);
  doc.setLineWidth(0.6);
  doc.line(L, y, R, y);

  y += 5;

  // ═══════════════════════════════════════
  //  CHECKLIST TABLE — Clean, no verification column
  // ═══════════════════════════════════════
  const rows = checklistItems.map((item, i) => [
    (i + 1).toString(),
    item.custom_note
      ? item.document_name + '\n  \u26A0 ' + item.custom_note
      : item.document_name,
    item.status || 'Required',
    '', // checkbox
  ]);

  doc.autoTable({
    startY: y,
    head: [['#', 'Document Requirement', 'Status', '\u2713']],
    body: rows,
    margin: { left: L, right: M },
    styles: {
      fontSize: 9,
      cellPadding: 3,
      lineColor: MED_TONAL,
      lineWidth: 0.2,
      textColor: DARK_GREY,
      font: 'helvetica',
    },
    headStyles: {
      fillColor: DARK_BLUE,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: 3.5,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 38, halign: 'center', fontSize: 8 },
      3: { cellWidth: 14, halign: 'center' },
    },
    alternateRowStyles: {
      fillColor: LIGHT_TONAL,
    },
    didDrawCell(hook) {
      if (hook.section === 'body' && hook.column.index === 3) {
        const bx = hook.cell.x + hook.cell.width / 2 - 2.2;
        const by = hook.cell.y + hook.cell.height / 2 - 2.2;
        doc.setDrawColor(...MED_GREY);
        doc.setLineWidth(0.3);
        doc.rect(bx, by, 4.4, 4.4);
      }
    },
  });

  y = doc.lastAutoTable.finalY + 8;

  // ═══════════════════════════════════════
  //  NOTES LINES
  // ═══════════════════════════════════════
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...MED_GREY);
  doc.text('NOTES', L, y);

  doc.setDrawColor(...MED_TONAL);
  doc.setLineWidth(0.15);
  for (let i = 0; i < 4; i++) {
    y += 6;
    doc.line(L, y, R, y);
  }

  // ═══════════════════════════════════════
  //  FOOTER
  // ═══════════════════════════════════════
  const fy = H - M;
  doc.setDrawColor(...UNITED_BLUE);
  doc.setLineWidth(0.4);
  doc.line(L, fy - 4, R, fy - 4);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MED_GREY);
  doc.text('United Cargo \u2014 Document Requirements Reference', L, fy);
  doc.text('Generated: ' + new Date().toLocaleDateString(), R, fy, { align: 'right' });

  return doc;
}
