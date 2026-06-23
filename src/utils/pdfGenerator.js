import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

/**
 * Generates and downloads a PDF of the schedule.
 * @param {Object} options - Parameters for the PDF
 * @param {Array} options.schedules - Array of schedule objects
 * @param {String} options.title - Document Title
 * @param {String} options.subtitle - Subtitle (e.g. "Kelas: SI-1A" or "Tahun Akademik: 2025/2026")
 * @param {String} options.fileName - Output filename (without extension)
 */
export function exportScheduleToPDF({ schedules, title, subtitle, fileName = 'jadwal-perkuliahan' }) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // Colors
  const primaryColor = [15, 23, 42]; // Slate 900
  const secondaryColor = [71, 85, 105]; // Slate 600
  
  // Document Header
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('PROGRAM STUDI SISTEM INFORMASI', 14, 18);
  doc.text('UIN ALAUDDIN MAKASSAR', 14, 25);
  
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(12);
  doc.text(title, 14, 32);
  
  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text(subtitle, 14, 38);
  }

  // Draw divider line
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.setLineWidth(0.5);
  doc.line(14, 42, 283, 42);

  // Table columns (with separate SKS column)
  const tableColumn = [
    'No',
    'Hari',
    'Waktu',
    'Kelas',
    'Mata Kuliah',
    'SKS',
    'Dosen Pengampu',
    'Asisten Dosen',
    'Ruangan'
  ];

  // Table rows
  const tableRows = schedules.map((item, index) => [
    index + 1,
    item.timeSlot?.day || '-',
    `${item.timeSlot?.startTime || ''} - ${item.timeSlot?.endTime || ''}`,
    item.class?.name || '-',
    item.course?.name || '-',
    item.course?.credits || 0,
    item.lecturer?.name || '-',
    item.assistant?.name || '-',
    item.room?.code || '-'
  ]);

  // Generate Table
  doc.autoTable({
    head: [tableColumn],
    body: tableRows,
    startY: 46,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59], // Slate 800
      textColor: [255, 255, 255],
      fontSize: 10,
      fontStyle: 'bold',
      halign: 'left'
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [15, 23, 42]
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252] // Slate 50
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 20 },
      2: { cellWidth: 28 },
      3: { cellWidth: 18 },
      4: { cellWidth: 60 },
      5: { cellWidth: 12, halign: 'center' },
      6: { cellWidth: 55 },
      7: { cellWidth: 45 },
      8: { cellWidth: 20 }
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      // Footer
      const str = `Halaman ${doc.internal.getNumberOfPages()}`;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text(str, 283 - doc.getTextWidth(str), 200);
      
      const dateStr = `Dicetak pada: ${new Date().toLocaleString('id-ID')}`;
      doc.text(dateStr, 14, 200);
    }
  });

  // Save the PDF
  doc.save(`${fileName}.pdf`);
}
