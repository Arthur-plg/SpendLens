import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import type { Transaction, CategoryDefinition } from '../types';
import { Repeat, PieChart, BarChart3 } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface ChartsSectionProps {
  transactions: Transaction[];
  selectedMonthKey: string;
  excludeTransfers: boolean;
  categories: CategoryDefinition[];
}

export const ChartsSection: React.FC<ChartsSectionProps> = ({
  transactions,
  selectedMonthKey,
  excludeTransfers,
  categories,
}) => {
  // Filter base transactions
  const activeTransactions = transactions.filter((t) => {
    if (excludeTransfers && t.isInternalTransfer) return false;
    return true;
  });

  // 1. Prepare Monthly Cashflow Data (Cronological)
  const monthMap = new Map<string, { label: string; expenses: number; income: number }>();

  // Collect all months in chronological order
  const sortedTx = [...activeTransactions].sort((a, b) => a.date.localeCompare(b.date));
  for (const t of sortedTx) {
    if (!monthMap.has(t.monthKey)) {
      monthMap.set(t.monthKey, { label: t.monthLabel, expenses: 0, income: 0 });
    }
    const m = monthMap.get(t.monthKey)!;
    if (t.type === 'debit') {
      m.expenses += t.absAmount;
    } else if (t.type === 'credit') {
      m.income += t.absAmount;
    }
  }

  const sortedMonths = Array.from(monthMap.entries());
  const barLabels = sortedMonths.map(([, v]) => v.label.split(' ')[0]); // "Octobre", "Novembre"...
  const expenseData = sortedMonths.map(([, v]) => Math.round(v.expenses));
  const incomeData = sortedMonths.map(([, v]) => Math.round(v.income));

  const barChartData = {
    labels: barLabels,
    datasets: [
      {
        label: 'Dépenses',
        data: expenseData,
        backgroundColor: '#cd4239',
        borderColor: '#cd4239',
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: 'Revenus',
        data: incomeData,
        backgroundColor: '#2c8c66',
        borderColor: '#2c8c66',
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const barOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#4d4f46',
          font: { family: 'inherit', size: 12, weight: '600' },
          usePointStyle: true,
          pointStyle: 'rectRounded',
        },
      },
      tooltip: {
        backgroundColor: '#23251d',
        titleColor: '#ffffff',
        bodyColor: '#e5e7e0',
        borderColor: '#bfc1b7',
        borderWidth: 1,
        padding: 8,
        cornerRadius: 4,
        callbacks: {
          label: (context: any) => ` ${context.dataset.label}: ${context.raw.toLocaleString('fr-FR')} €`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#6c6e63', font: { size: 11, family: 'inherit' } },
      },
      y: {
        grid: { color: '#e5e7e0' },
        ticks: {
          color: '#6c6e63',
          callback: (value: any) => `${value} €`,
          font: { size: 11, family: 'var(--font-mono)' },
        },
      },
    },
  };

  // 2. Prepare Category Breakdown for currently selected period
  const periodTx = activeTransactions.filter((t) => {
    if (selectedMonthKey !== 'all' && t.monthKey !== selectedMonthKey) return false;
    return t.type === 'debit'; // Only expenses for category doughnut
  });

  const catTotalMap = new Map<string, number>();
  let totalPeriodExpenses = 0;

  for (const t of periodTx) {
    const current = catTotalMap.get(t.category) || 0;
    catTotalMap.set(t.category, current + t.absAmount);
    totalPeriodExpenses += t.absAmount;
  }

  // Sort categories by highest spend
  const sortedCategories = Array.from(catTotalMap.entries())
    .map(([catId, amount]) => {
      const def = categories.find((c) => c.id === catId) || {
        name: catId,
        color: '#94a3b8',
      };
      return {
        id: catId,
        name: def.name,
        color: def.color,
        amount,
        percentage: totalPeriodExpenses > 0 ? (amount / totalPeriodExpenses) * 100 : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const doughnutData = {
    labels: sortedCategories.map((c) => c.name),
    datasets: [
      {
        data: sortedCategories.map((c) => Math.round(c.amount)),
        backgroundColor: sortedCategories.map((c) => c.color),
        borderColor: '#ffffff',
        borderWidth: 2,
        hoverOffset: 4,
      },
    ],
  };

  const doughnutOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#23251d',
        titleColor: '#ffffff',
        bodyColor: '#e5e7e0',
        borderColor: '#bfc1b7',
        borderWidth: 1,
        padding: 8,
        cornerRadius: 4,
        callbacks: {
          label: (context: any) => {
            const val = context.raw;
            const pct = totalPeriodExpenses > 0 ? ((val / totalPeriodExpenses) * 100).toFixed(1) : 0;
            return ` ${val.toLocaleString('fr-FR')} € (${pct}%)`;
          },
        },
      },
    },
  };

  // 3. Detect Recurring Charges (Orange, subscriptions, fixed bills)
  const recurringCharges: { merchant: string; amount: number; count: number; category: string }[] = [];
  const merchantHistory = new Map<string, { amounts: number[]; months: Set<string>; category: string }>();

  for (const t of activeTransactions.filter((t) => t.type === 'debit')) {
    const key = t.cleanMerchant.toLowerCase();
    if (!merchantHistory.has(key)) {
      merchantHistory.set(key, { amounts: [], months: new Set(), category: t.category });
    }
    const info = merchantHistory.get(key)!;
    info.amounts.push(t.absAmount);
    info.months.add(t.monthKey);
  }

  for (const [key, info] of merchantHistory.entries()) {
    // If it happens in 3 or more distinct months
    if (info.months.size >= 3) {
      // Find mode or average amount
      const avg = info.amounts.reduce((a, b) => a + b, 0) / info.amounts.length;
      recurringCharges.push({
        merchant: key.charAt(0).toUpperCase() + key.slice(1),
        amount: avg,
        count: info.months.size,
        category: info.category,
      });
    }
  }

  recurringCharges.sort((a, b) => b.amount - a.amount);
  const totalEstimatedFixed = recurringCharges.reduce((acc, c) => acc + c.amount, 0);

  return (
    <div className="charts-grid">
      {/* 1. Bar Chart: Evolution */}
      <div className="chart-card">
        <div className="chart-card-header">
          <div className="flex-align-gap">
            <BarChart3 size={18} className="text-cyan" />
            <span className="chart-title">Évolution du Cashflow Mensuel</span>
          </div>
          <span className="chart-badge">Dépenses vs Revenus</span>
        </div>
        <div className="chart-canvas-wrap">
          <Bar data={barChartData} options={barOptions} />
        </div>
      </div>

      {/* 2. Donut Chart: Categories */}
      <div className="chart-card">
        <div className="chart-card-header">
          <div className="flex-align-gap">
            <PieChart size={18} className="text-indigo" />
            <span className="chart-title">Répartition des Dépenses</span>
          </div>
          <span className="chart-badge">{totalPeriodExpenses.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</span>
        </div>

        <div className="doughnut-content">
          <div className="doughnut-canvas-wrap">
            <Doughnut data={doughnutData} options={doughnutOptions} />
            <div className="doughnut-center-info">
              <span className="center-amount">
                {totalPeriodExpenses.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
              </span>
              <span className="center-sub">Total</span>
            </div>
          </div>

          <div className="category-legend-list">
            {sortedCategories.slice(0, 6).map((c) => (
              <div key={c.id} className="legend-row">
                <div className="legend-color-dot" style={{ backgroundColor: c.color }} />
                <span className="legend-name">{c.name}</span>
                <span className="legend-percent">{c.percentage.toFixed(0)}%</span>
                <span className="legend-amount">{Math.round(c.amount)} €</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Recurring Charges Box */}
      <div className="chart-card recurring-card">
        <div className="chart-card-header">
          <div className="flex-align-gap">
            <Repeat size={18} className="text-pink" />
            <span className="chart-title">Abonnements & Charges Détectés</span>
          </div>
          <span className="chart-badge text-pink">~{Math.round(totalEstimatedFixed)} € / mois</span>
        </div>

        <div className="recurring-list">
          {recurringCharges.length === 0 ? (
            <div className="empty-sub-text">Aucun abonnement récurrent détecté pour l'instant.</div>
          ) : (
            recurringCharges.slice(0, 5).map((charge, idx) => (
              <div key={idx} className="recurring-item">
                <div className="recurring-item-left">
                  <div className="recurring-dot" />
                  <div>
                    <div className="recurring-merchant">{charge.merchant}</div>
                    <div className="recurring-sub">Présent sur {charge.count} mois</div>
                  </div>
                </div>
                <div className="recurring-amount">~{charge.amount.toFixed(2)} €/m</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
