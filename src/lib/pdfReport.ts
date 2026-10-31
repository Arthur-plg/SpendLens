import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AccountInfo, Transaction } from '../types';
import type { MonthSummary } from './analytics';
import { categoryBreakdown, largestExpenses, scopeFor } from './analytics';
import { dateLong, euros, monthLong, percent, plural } from './format';
import { getCategory } from '../utils/categories';

interface GenerateReportOptions {
  transactions: Transaction[];
  months: MonthSummary[];
  average: MonthSummary;
  averageCount: number;
  account: AccountInfo | null;
  firstDate?: string;
  lastDate?: string;
}

export function exportExpenseReportPdf({
  transactions,
  months,
  average,
  averageCount,
  account,
  firstDate,
  lastDate,
}: GenerateReportOptions): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  const totalExpenses = months.reduce((sum, m) => sum + m.expenses, 0);
  const totalCount = months.reduce((sum, m) => sum + m.count, 0);

  // Overall category slices across the entire history
  const globalSlices = categoryBreakdown(transactions, 1);

  /* ----------------------------------------------------
   * Page 1 : Synthèse Globale des Dépenses
   * ---------------------------------------------------- */

  // Top header bar
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('SPENDLENS', margin, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('RAPPORT DES DÉPENSES · ANALYSE BUDGÉTAIRE', margin, 19);

  const todayStr = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  doc.setFontSize(8);
  doc.text(`Généré le ${todayStr}`, pageWidth - margin, 19, { align: 'right' });

  // Context metadata block
  let y = 35;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('Synthèse Globale des Dépenses', margin, y);

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);

  const bankText = account?.detectedBank && account.detectedBank !== 'Générique'
    ? `${account.detectedBank}${account.accountNumber ? ` · Compte ···${account.accountNumber.slice(-4)}` : ''}`
    : 'Relevé bancaire';
  const periodText = firstDate && lastDate
    ? `Période couverte : du ${dateLong(firstDate)} au ${dateLong(lastDate)} (${plural(months.length, 'mois analysé', 'mois analysés')})`
    : `${plural(months.length, 'mois analysé', 'mois analysés')}`;

  doc.text(`${bankText} — ${periodText}`, margin, y);

  // 3 KPI metric boxes
  y += 7;
  const boxWidth = (pageWidth - margin * 2 - 8) / 3;
  const boxHeight = 20;

  // Box 1: Total dépensé
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(margin, y, boxWidth, boxHeight, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL CUMULÉ DÉPENSÉ', margin + 4, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(euros(totalExpenses, { decimals: false }), margin + 4, y + 14);

  // Box 2: Moyenne par mois
  const box2X = margin + boxWidth + 4;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(box2X, y, boxWidth, boxHeight, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`MOYENNE MENSUELLE (${averageCount} mois)`, box2X + 4, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(`${euros(average.expenses, { decimals: false })} / mois`, box2X + 4, y + 14);

  // Box 3: Nombre de dépenses
  const box3X = box2X + boxWidth + 4;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(box3X, y, boxWidth, boxHeight, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('VOLUME DÉPENSES', box3X + 4, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(`${totalCount} opérations`, box3X + 4, y + 14);

  // Table 1: Category breakdown over the entire history
  y += boxHeight + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Répartition globale par catégorie de dépense', margin, y);

  const categoryTableData = globalSlices.map((s) => [
    s.name,
    euros(s.amount, { decimals: true }),
    `${euros(s.amount / Math.max(1, averageCount), { decimals: false })} / m`,
    percent(s.share),
    String(s.count),
    s.topMerchants.map((m) => m.name).join(', ') || '—',
  ]);

  autoTable(doc, {
    startY: y + 3,
    margin: { left: margin, right: margin },
    head: [['Catégorie', 'Total dépensé', 'Moyenne / mois', 'Part', 'Nb ops', 'Principaux commerçants']],
    body: categoryTableData,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 40 },
      1: { halign: 'right', fontStyle: 'bold', cellWidth: 26 },
      2: { halign: 'right', cellWidth: 26 },
      3: { halign: 'right', cellWidth: 15 },
      4: { halign: 'right', cellWidth: 14 },
      5: { cellWidth: 'auto', textColor: [100, 116, 139] },
    },
  });

  // Table 2: Chronological month-by-month spending summary
  const lastTable = (doc as any).lastAutoTable;
  y = (lastTable ? lastTable.finalY : y) + 8;

  // Check if we have room for the months summary table, otherwise add a page
  if (y > pageHeight - 65) {
    doc.addPage();
    y = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Évolution des dépenses mois par mois', margin, y);

  const monthsTableData = months.map((m) => {
    const vsAvg = average.expenses > 0 ? ((m.expenses - average.expenses) / average.expenses) * 100 : 0;
    const vsAvgStr = Math.abs(vsAvg) < 1 ? 'Dans la moyenne' : percent(vsAvg, { sign: true });
    
    // Find top spending category for this month
    const mScope = scopeFor(transactions, months, m.key);
    const mSlices = categoryBreakdown(mScope.items, 1);
    const topCat = mSlices[0] ? `${mSlices[0].name} (${euros(mSlices[0].amount, { decimals: false })})` : '—';

    return [
      monthLong(m.key),
      euros(m.expenses, { decimals: true }),
      vsAvgStr,
      topCat,
      String(m.count),
      m.partial ? 'Relevé partiel' : 'Complet',
    ];
  });

  autoTable(doc, {
    startY: y + 3,
    margin: { left: margin, right: margin },
    head: [['Mois', 'Dépenses totales', 'Vs mois moyen', 'Poste principal', 'Nb ops', 'Statut']],
    body: monthsTableData,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 35 },
      1: { halign: 'right', fontStyle: 'bold', cellWidth: 28 },
      2: { halign: 'right', cellWidth: 28 },
      3: { cellWidth: 'auto' },
      4: { halign: 'right', cellWidth: 16 },
      5: { halign: 'center', cellWidth: 24, textColor: [100, 116, 139] },
    },
  });

  /* ----------------------------------------------------
   * Section 2 : Détail des Dépenses Mois par Mois
   * (Pour chaque mois du plus récent au plus ancien)
   * ---------------------------------------------------- */
  const reversedMonths = [...months].reverse();

  for (const m of reversedMonths) {
    doc.addPage();
    let my = 16;

    // Header bar for each month
    doc.setFillColor(241, 245, 249); // slate-100
    doc.roundedRect(margin, my, pageWidth - margin * 2, 14, 2, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(`Détail des dépenses · ${monthLong(m.key)}`, margin + 4, my + 9);

    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(
      `Total : ${euros(m.expenses, { decimals: true })} (${plural(m.count, 'dépense', 'dépenses')})`,
      pageWidth - margin - 4,
      my + 9,
      { align: 'right' }
    );

    my += 20;

    // Category breakdown for this month
    const mScope = scopeFor(transactions, months, m.key);
    const mSlices = categoryBreakdown(mScope.items, 1);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('Ventilation par catégorie', margin, my);

    const mTableData = mSlices.map((s) => [
      s.name,
      euros(s.amount, { decimals: true }),
      percent(s.share),
      String(s.count),
      s.topMerchants.map((t) => `${t.name} (${euros(t.amount, { decimals: false })})`).join(', ') || '—',
    ]);

    autoTable(doc, {
      startY: my + 3,
      margin: { left: margin, right: margin },
      head: [['Catégorie', 'Montant', 'Part', 'Nb ops', 'Principaux commerçants']],
      body: mTableData.length > 0 ? mTableData : [['Aucune dépense', '0,00 €', '0%', '0', '—']],
      theme: 'grid',
      headStyles: {
        fillColor: [51, 65, 85], // slate-700
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 1.8,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 40 },
        1: { halign: 'right', fontStyle: 'bold', cellWidth: 28 },
        2: { halign: 'right', cellWidth: 18 },
        3: { halign: 'right', cellWidth: 16 },
        4: { cellWidth: 'auto', textColor: [100, 116, 139] },
      },
    });

    const mTableEnd = (doc as any).lastAutoTable;
    my = (mTableEnd ? mTableEnd.finalY : my) + 8;

    // Top 5 largest expenses in this month
    const mLargest = largestExpenses(mScope.items, 5);

    if (mLargest.length > 0 && my < pageHeight - 35) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text('Plus grosses dépenses du mois', margin, my);

      const largestTableData = mLargest.map((t) => [
        t.rawDate || t.date,
        t.cleanMerchant,
        getCategory(t.category).name,
        euros(t.absAmount, { decimals: true }),
      ]);

      autoTable(doc, {
        startY: my + 3,
        margin: { left: margin, right: margin },
        head: [['Date', 'Commerçant / Bénéficiaire', 'Catégorie', 'Montant']],
        body: largestTableData,
        theme: 'plain',
        headStyles: {
          textColor: [100, 116, 139],
          fontStyle: 'bold',
          fontSize: 7,
          cellPadding: 1.5,
        },
        styles: {
          fontSize: 7.5,
          cellPadding: 1.8,
          textColor: [30, 41, 59],
          lineColor: [241, 245, 249],
          lineWidth: 0.1,
        },
        columnStyles: {
          0: { cellWidth: 26, textColor: [100, 116, 139] },
          1: { fontStyle: 'bold', cellWidth: 'auto' },
          2: { cellWidth: 45, textColor: [71, 85, 105] },
          3: { halign: 'right', fontStyle: 'bold', cellWidth: 30 },
        },
      });
    }
  }

  /* ----------------------------------------------------
   * Footer on all pages (Page numbers and confidentiality)
   * ---------------------------------------------------- */
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('SpendLens · Rapport confidentiel des dépenses (Analyse locale)', margin, pageHeight - 6);
    doc.text(`Page ${i} sur ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
  }

  // Trigger immediate download without browser prompt
  doc.save('SpendLens_Rapport_Depenses.pdf');
}
