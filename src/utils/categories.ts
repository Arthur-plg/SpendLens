import type { CategoryDefinition, Rule } from '../types';

export const DEFAULT_CATEGORIES: CategoryDefinition[] = [
  { id: 'logement', name: 'Logement & factures', color: 'var(--cat-logement)' },
  { id: 'alimentation', name: 'Courses', color: 'var(--cat-alimentation)' },
  { id: 'restaurants', name: 'Restaurants & cafés', color: 'var(--cat-restaurants)' },
  { id: 'transports', name: 'Transports', color: 'var(--cat-transports)' },
  { id: 'voyages', name: 'Voyages', color: 'var(--cat-voyages)' },
  { id: 'shopping', name: 'Shopping', color: 'var(--cat-shopping)' },
  { id: 'loisirs', name: 'Loisirs & sport', color: 'var(--cat-loisirs)' },
  { id: 'abonnements', name: 'Abonnements', color: 'var(--cat-abonnements)' },
  { id: 'sante', name: 'Santé', color: 'var(--cat-sante)' },
  { id: 'impots', name: 'Impôts & administration', color: 'var(--cat-impots)' },
  { id: 'proches_amis', name: 'Proches & amis', color: 'var(--cat-proches_amis)' },
  { id: 'epargne', name: 'Épargne & placements', color: 'var(--cat-epargne)' },
  { id: 'frais_bancaires', name: 'Frais & retraits', color: 'var(--cat-frais_bancaires)' },
  { id: 'revenus', name: 'Revenus', color: 'var(--cat-revenus)', isIncome: true },
  { id: 'virement_interne', name: 'Virements internes', color: 'var(--cat-virement_interne)', isTransfer: true },
  { id: 'autre', name: 'Non classé', color: 'var(--cat-autre)' },
];

const FALLBACK: CategoryDefinition = { id: 'autre', name: 'Non classé', color: 'var(--cat-autre)' };

export function getCategory(id: string): CategoryDefinition {
  return DEFAULT_CATEGORIES.find((c) => c.id === id) ?? { ...FALLBACK, id, name: id };
}

/**
 * The user's starting rule list. Built-in knowledge (merchants, line structure) lives in the
 * classification engine, so this only holds rules people add themselves.
 */
export const DEFAULT_RULES: Rule[] = [];
