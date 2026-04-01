import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * Generate the Human Remains Document Checklist PDF
 * Single page, thick red border, checkmark column, notes, clean signature area
 */
export function generateChecklistPDF(data) {
  const {
    awbNumber,
    origin,
    destination,
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
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const innerLeft = margin + 4;
  const innerRight = pageWidth - margin - 4;
  const contentWidth = innerRight - innerLeft;

  // ── THICK RED BORDER ──
  doc.setDrawColor(180, 0, 0);
  doc.setLineWidth(2.5);
  doc.rect(margin - 2, margin - 2, pageWidth - 2 * (margin - 2), pageHeight - 2 * (margin - 2));

  // Inner thin red border
  doc.setLineWidth(0.5);
  doc.rect(margin + 1, margin + 1, pageWidth - 2 * (margin + 1), pageHeight - 2 * (margin + 1));

  let y = margin + 10;

  // ── HEADER ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(180, 0, 0);
  doc.text('HUMAN REMAINS DOCUMENT CHECKLIST AND VERIFICATION', pageWidth / 2, y, { align: 'center' });

  y += 6;
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text('ALL DOCUMENTS MUST BE ORIGINAL UNLESS NOTED ON THE CHECKLIST BELOW', pageWidth / 2, y, { align: 'center' });

  // ── RED DIVIDER ──
  y += 4;
  doc.setDrawColor(180, 0, 0);
  doc.setLineWidth(0.8);
  doc.line(innerLeft, y, innerRight, y);

  // ── SHIPMENT INFO (compact 2-column grid) ──
  y += 6;
  doc.setFontSize(8.5);

  const col1 = innerLeft + 2;
  const col2 = pageWidth / 2 + 4;

  function infoRow(label, value, x, yPos) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 80, 80);
    doc.text(label, x, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(value || '', x + doc.getTextWidth(label) + 2, yPos);
  }

  infoRow('AWB:', awbNumber || '', col1, y);
  infoRow('Type:', remainsType || '', col2, y);

  y += 5.5;
  infoRow('Origin:', origin || '', col1, y);
  infoRow('Destination:', destination || '', col2, y);

  y += 5.5;
  infoRow('Routing:', routing || '', col1, y);
  infoRow('Shipment:', shipmentType || '', col2, y);

  y += 5.5;
  infoRow('Flight Info:', flightNumbers || '', col1, y);
  if (submittedAt) {
    const dateStr = new Date(submittedAt).toLocaleString('en-US', {
      month: '2-digit', day: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
    infoRow('Date:', dateStr, col2, y);
  }

  // ── RED DIVIDER ──
  y += 4;
  doc.setDrawColor(180, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(innerLeft, y, innerRight, y);

  // ── CHECKLIST TABLE (with checkmark column) ──
  y += 2;

  const tableRows = checklistItems.map((item, idx) => [
    (idx + 1).toString(),
    item.document_name,
    item.status || '',
    item.verification || '',
    '',  // checkmark column (empty for manual check)
  ]);

  doc.autoTable({
    startY: y,
    head: [['#', 'Document Requirement', 'Status', 'Verification', '\u2713']],
    body: tableRows,
    margin: { left: innerLeft, right: margin + 4 },
    styles: {
      fontSize: 7.5,
      cellPadding: 1.8,
      lineColor: [120, 120, 120],
      lineWidth: 0.15,
      textColor: [30, 30, 30],
    },
    headStyles: {
      fillColor: [180, 0, 0],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      cellPadding: 2.2,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 32, halign: 'center', fontSize: 7 },
      3: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 12, halign: 'center' },
    },
    alternateRowStyles: {
      fillColor: [252, 248, 248],
    },
    didParseCell: function (hookData) {
      if (hookData.section === 'body' && hookData.column.index === 3) {
        if (hookData.cell.raw === 'Missing') {
          hookData.cell.styles.textColor = [180, 0, 0];
          hookData.cell.styles.fontStyle = 'bold';
        } else if (hookData.cell.raw === 'Verified') {
          hookData.cell.styles.textColor = [0, 120, 0];
        }
      }
    },
    // Draw checkbox squares in the checkmark column
    didDrawCell: function (hookData) {
      if (hookData.section === 'body' && hookData.column.index === 4) {
        const cellX = hookData.cell.x + hookData.cell.width / 2 - 2;
        const cellY = hookData.cell.y + hookData.cell.height / 2 - 2;
        doc.setDrawColor(120, 120, 120);
        doc.setLineWidth(0.3);
        doc.rect(cellX, cellY, 4, 4);
      }
    },
  });

  y = doc.lastAutoTable.finalY + 4;

  // ── NOTES SECTION ──
  doc.setDrawColor(180, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(innerLeft, y, innerRight, y);

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text('NOTES:', innerLeft + 2, y);

  y += 1;
  if (notes && notes.trim()) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 30, 30);
    const splitNotes = doc.splitTextToSize(notes.trim(), contentWidth - 8);
    doc.text(splitNotes, innerLeft + 2, y + 4);
    y += 4 + splitNotes.length * 3.5;
  } else {
    // Draw blank lines for handwritten notes
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    for (let i = 0; i < 3; i++) {
      y += 5;
      doc.line(innerLeft + 2, y, innerRight - 2, y);
    }
  }

  y += 4;

  // ── SIGNATURE / AUTHORIZATION SECTION ──
  doc.setDrawColor(180, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(innerLeft, y, innerRight, y);

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(180, 0, 0);
  doc.text('VERIFICATION & AUTHORIZATION', pageWidth / 2, y, { align: 'center' });

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 60);
  doc.text('I certify that I have reviewed and verified all documents listed above.', pageWidth / 2, y, { align: 'center' });

  // ── Clean signature grid ──
  y += 7;
  const sigCol1 = innerLeft + 2;
  const sigCol2 = pageWidth / 2 + 8;
  const sigLineLen = 55;
  const labelSize = 7;

  doc.setTextColor(80, 80, 80);
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.3);

  // Row 1: Agent ID & Date
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(labelSize);
  doc.text('Agent ID (V/U#):', sigCol1, y);
  doc.setFont('helvetica', 'normal');
  if (employeeId) {
    doc.setTextColor(0, 0, 0);
    doc.text(employeeId, sigCol1 + 32, y);
  }
  doc.line(sigCol1 + 30, y + 1, sigCol1 + 30 + sigLineLen, y + 1);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 80);
  doc.text('Date/Time:', sigCol2, y);
  doc.setFont('helvetica', 'normal');
  if (submittedAt) {
    doc.setTextColor(0, 0, 0);
    const ts = new Date(submittedAt).toLocaleString('en-US', {
      month: '2-digit', day: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
    doc.text(ts, sigCol2 + 20, y);
  }
  doc.line(sigCol2 + 19, y + 1, sigCol2 + 19 + sigLineLen, y + 1);

  // Row 2: Supervisor Signature & Supervisor ID
  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 80);
  doc.text('Supervisor Signature:', sigCol1, y);
  doc.line(sigCol1 + 35, y + 1, sigCol1 + 35 + sigLineLen - 5, y + 1);

  doc.text('Supervisor ID:', sigCol2, y);
  doc.line(sigCol2 + 24, y + 1, sigCol2 + 24 + sigLineLen - 5, y + 1);

  // Row 3: Supervisor Date
  y += 10;
  doc.text('Date:', sigCol1, y);
  doc.line(sigCol1 + 10, y + 1, sigCol1 + 10 + sigLineLen, y + 1);

  // ── FOOTER ──
  const footerY = pageHeight - margin - 5;
  doc.setFontSize(6);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(140, 140, 140);
  doc.text('United Cargo \u2014 Human Remains Document Checklist', pageWidth / 2, footerY, { align: 'center' });
  doc.text('Generated: ' + new Date().toLocaleString(), pageWidth / 2, footerY + 3, { align: 'center' });

  return doc;
}
