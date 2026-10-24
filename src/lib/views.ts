import { ChartColumn, LayoutGrid, List, Repeat, SlidersHorizontal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type View = 'overview' | 'transactions' | 'trends' | 'recurring' | 'simulator';

export const VIEWS: { id: View; label: string; short: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Synthèse', short: 'Synthèse', icon: LayoutGrid },
  { id: 'transactions', label: 'Opérations', short: 'Opérations', icon: List },
  { id: 'trends', label: 'Évolution', short: 'Évolution', icon: ChartColumn },
  { id: 'recurring', label: 'Charges fixes', short: 'Charges', icon: Repeat },
  { id: 'simulator', label: 'Simulateur', short: 'Simuler', icon: SlidersHorizontal },
];
