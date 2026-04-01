import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * Generate the Human Remains Document Checklist PDF
 * Single page, thick red border, formatted per requirements
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
    employeeId,
    submittedAt,
  } = data;

  const doc = new jsPDF('portrait', 'mm', 'letter');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;

  // ── THICK RED BORDER ──
  doc.setDrawColor(180, 0, 0);
  doc.setLineWidth(2.5);
  doc.rect(margin - 2, margin - 2, pageWidth - 2 * (margin - 2), pageHeight - 2 * (margin - 2));

  // Inner thin red border for double-border effect
  doc.setLineWidth(0.5);
  doc.rect(margin + 1, margin + 1, pageWidth - 2 * (margin + 1), pageHeight - 2 * (margin + 1));

  let y = margin + 10;

  // ── HEADER ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(180, 0, 0);
  doc.text('HUMAN REMAINS DOCUMENT CHECKLIST AND VERIFICATION', pageWidth / 2, y, { align: 'center' });

  y += 7;
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text('ALL DOCUMENTS MUST BE ORIGINAL UNLESS NOTED ON THE CHECKLIST BELOW', pageWidth / 2, y, { align: 'center' });

  // ── RED DIVIDER LINE ──
  y += 4;
  doc.setDrawColor(180, 0, 0);
  doc.setLineWidth(1);
  doc.line(margin + 4, y, pageWidth - margin - 4, y);

  // ── SHIPMENT INFO SECTION ──
  y += 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');

  const col1X = margin + 8;
  const col2X = pageWidth / 2 + 5;
  const labelWidth = 40;

  // Row 1
  doc.text('AWB Number:', col1X, y);
  doc.setFont('helvetica', 'normal');
  doc.text(awbNumber || '', col1X + labelWidth, y);
  doc.setFont('helvetica', 'bold');
  doc.text('Type:', col2X, y);
  doc.setFont('helvetica', 'normal');
  doc.text(remainsType || '', col2X + 22, y);

  // Row 2
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Origin:', col1X, y);
  doc.setFont('helvetica', 'normal');
  doc.text(origin || '', col1X + labelWidth, y);
  doc.setFont('helvetica', 'bold');
  doc.text('Destination:', col2X, y);
  doc.setFont('helvetica', 'normal');
  doc.text(destination || '', col2X + 30, y);

  // Row 3
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Routing:', col1X, y);
  doc.setFont('helvetica', 'normal');
  doc.text(routing || '', col1X + labelWidth, y);
  doc.setFont('helvetica', 'bold');
  doc.text('Shipment:', col2X, y);
  doc.setFont('helvetica', 'normal');
  doc.text(shipmentType || '', col2X + 28, y);

  // Row 4
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Flight Info:', col1X, y);
  doc.setFont('helvetica', 'normal');
  doc.text(flightNumbers || '', col1X + labelWidth, y);

  // ── RED DIVIDER ──
  y += 5;
  doc.setDrawColor(180, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(margin + 4, y, pageWidth - margin - 4, y);

  // ── CHECKLIST TABLE ──
  y += 3;

  const tableRows = checklistItems.map((item, idx) => [
    (idx + 1).toString(),
    item.document_name,
    item.status || '',
    item.verification || 'Verified',
  ]);

  doc.autoTable({
    startY: y,
    head: [['#', 'Document Requirement', 'Requirement Status', 'Verification']],
    body: tableRows,
    margin: { left: margin + 4, right: margin + 4 },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [100, 100, 100],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [180, 0, 0],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 38, halign: 'center' },
      3: { cellWidth: 30, halign: 'center', fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [248, 240, 240],
    },
    didParseCell: function (data) {
      if (data.section === 'body' && data.column.index === 3) {
        if (data.cell.raw === 'Missing') {
          data.cell.styles.textColor = [180, 0, 0];
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [0, 120, 0];
        }
      }
    },
  });

  y = doc.lastAutoTable.finalY + 6;

  // ── RED DIVIDER ──
  doc.setDrawColor(180, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(margin + 4, y, pageWidth - margin - 4, y);

  // ── VERIFICATION / SIGNATURE SECTION ──
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text('VERIFICATION & AUTHORIZATION', pageWidth / 2, y, { align: 'center' });

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('I certify that I have reviewed and verified all documents listed above.', col1X, y);

  y += 10;
  // Employee ID
  doc.setFont('helvetica', 'bold');
  doc.text('Agent ID (V/U#):', col1X, y);
  doc.setFont('helvetica', 'normal');
  doc.text(employeeId || '_______________', col1X + 38, y);

  // Date
  doc.setFont('helvetica', 'bold');
  doc.text('Date/Time:', col2X, y);
  doc.setFont('helvetica', 'normal');
  const dateStr = submittedAt
    ? new Date(submittedAt).toLocaleString('en-US', {
        month: '2-digit', day: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '_______________';
  doc.text(dateStr, col2X + 26, y);

  // Supervisor signature line
  y += 14;
  doc.setFont('helvetica', 'bold');
  doc.text('Supervisor Signature:', col1X, y);
  doc.line(col1X + 42, y + 1, col1X + 110, y + 1);

  doc.text('Supervisor ID:', col2X, y);
  doc.line(col2X + 32, y + 1, col2X + 80, y + 1);

  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('Date:', col1X, y);
  doc.line(col1X + 14, y + 1, col1X + 60, y + 1);

  // ── FOOTER ──
  const footerY = pageHeight - margin - 6;
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120, 120, 120);
  doc.text('United Cargo – Human Remains Document Checklist', pageWidth / 2, footerY, { align: 'center' });
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, footerY + 3.5, { align: 'center' });

  return doc;
}
