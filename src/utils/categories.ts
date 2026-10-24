import type { CategoryDefinition, Rule } from '../types';

export const DEFAULT_CATEGORIES: CategoryDefinition[] = [
  { id: 'logement', name: 'Logement & factures', color: 'var(--cat-logement)' },
  { id: 'alimentation', name: 'Courses', color: 'var(--cat-alimentation)' },
  { id: 'restaurants', name: 'Restaurants & cafés', color: 'var(--cat-restaurants)' },
  { id: 'transports', name: 'Transports', color: 'var(--cat-transports)' },
  { id: 'loisirs', name: 'Loisirs & shopping', color: 'var(--cat-loisirs)' },
  { id: 'abonnements', name: 'Abonnements', color: 'var(--cat-abonnements)' },
  { id: 'epargne', name: 'Épargne & placements', color: 'var(--cat-epargne)' },
  { id: 'proches_amis', name: 'Proches & amis', color: 'var(--cat-proches_amis)' },
  { id: 'sante', name: 'Santé', color: 'var(--cat-sante)' },
  { id: 'frais_bancaires', name: 'Frais & retraits', color: 'var(--cat-frais_bancaires)' },
  { id: 'revenus', name: 'Revenus', color: 'var(--cat-revenus)', isIncome: true },
  { id: 'virement_interne', name: 'Virements internes', color: 'var(--cat-virement_interne)', isTransfer: true },
  { id: 'autre', name: 'Non classé', color: 'var(--cat-autre)' },
];

const FALLBACK: CategoryDefinition = { id: 'autre', name: 'Non classé', color: 'var(--cat-autre)' };

export function getCategory(id: string): CategoryDefinition {
  return DEFAULT_CATEGORIES.find((c) => c.id === id) ?? { ...FALLBACK, id, name: id };
}

export const DEFAULT_RULES: Rule[] = [
  // 1. Virements internes
  {
    id: 'rule_interne_1',
    pattern: 'virement interne|intercompte|compte a compte|vers livret|de livret',
    isRegex: true,
    categoryId: 'virement_interne',
    targetMerchantName: 'Virement interne',
    priority: 100,
    createdAt: new Date().toISOString(),
  },

  // 2. Frais bancaires, incidents & retraits distributeur
  {
    id: 'rule_frais_bancaires',
    pattern: "globe trotter|frais irreg|cotisation|frais bancaire|incident|commission d'inter|rejet",
    isRegex: true,
    categoryId: 'frais_bancaires',
    targetMerchantName: 'Frais bancaires',
    priority: 95,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'rule_retrait_dab',
    pattern: 'retrait au distributeur',
    isRegex: true,
    categoryId: 'frais_bancaires',
    targetMerchantName: 'Retrait Distributeur (DAB)',
    priority: 70,
    createdAt: new Date().toISOString(),
  },

  // 3. Virements proches et amis / famille
  {
    id: 'rule_proches_amis',
    pattern: 'wero|vir inst|rembourser|remboursement|cadeau|maman|papa|amis|partage|lydia|leetchi|helloasso',
    isRegex: true,
    categoryId: 'proches_amis',
    priority: 92,
    createdAt: new Date().toISOString(),
  },

  // 4. Logement, Loyers, Charges & Assurances
  {
    id: 'rule_logement_loyer',
    pattern: 'loyer|bail|charges copro|maif|edf|engie|totalenergies|veolia|assurance habitation',
    isRegex: true,
    categoryId: 'logement',
    priority: 90,
    createdAt: new Date().toISOString(),
  },

  // 5. Investissement & Épargne
  {
    id: 'rule_bitstack',
    pattern: 'bitstack',
    categoryId: 'epargne',
    targetMerchantName: 'Bitstack (Épargne Bitcoin)',
    priority: 88,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'rule_trade_rep',
    pattern: 'trade republic|boursobank epargne|degiro|binance|kraken|coinbase|revolut',
    isRegex: true,
    categoryId: 'epargne',
    priority: 88,
    createdAt: new Date().toISOString(),
  },

  // 5b. Livraison de repas (Uber Eats, Deliveroo) - Priorité haute avant Transports
  {
    id: 'rule_food_delivery',
    pattern: 'uber\\s*\\*?\\s*eats|deliveroo',
    isRegex: true,
    categoryId: 'restaurants',
    targetMerchantName: 'Uber Eats',
    priority: 89,
    createdAt: new Date().toISOString(),
  },

  // 6. Transports, Voyages, Mobilité & Gares (Uber VTC excluant Uber Eats)
  {
    id: 'rule_transports_mobility',
    pattern: 'sncf|ratp|navigo|trainline|idtgv|\\bter\\b|ouigo|transports en commun|uber(?!.*eats)|ubr\\*(?!.*eats)|bolt|lime|\\btier\\b|dott|\\bvoi\\b|velib|total|shell|\\bbp\\b|esso|peage|aprr|vinci autoroutes|parking|air france|transavia|easyjet|ryanair|lufthansa|vueling|aeroport|orly|metro',
    isRegex: true,
    categoryId: 'transports',
    priority: 85,
    createdAt: new Date().toISOString(),
  },

  // 7. Santé : remboursements (avant revenus et proches), puis médecins et pharmacies
  {
    id: 'rule_sante_remboursements',
    pattern: 'cpam|ameli|mutuelle',
    isRegex: true,
    categoryId: 'sante',
    priority: 97,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'rule_sante_doctors',
    pattern: 'pharmacie|doctolib|laboratoire|biolab|eurofins|dentiste|dent|opticien|ophtalmo|kine|medecin|derma|soins devis|docteur',
    isRegex: true,
    categoryId: 'sante',
    priority: 85,
    createdAt: new Date().toISOString(),
  },

  // 8. Alimentation & Supermarchés
  {
    id: 'rule_alimentation_courses',
    pattern: 'carrefour|monoprix|franprix|lidl|auchan|leclerc|aldi|intermarche|naturalia|picard|bio c bon|super u|u express|casino|boulangerie|boulanger|paul|kayser|crous|superette|marche |epicerie|primeur|biocoop|grand frais',
    isRegex: true,
    categoryId: 'alimentation',
    priority: 83,
    createdAt: new Date().toISOString(),
  },

  // 9. Restaurants, Bars, Cafés & Street Food
  {
    id: 'rule_restaurants_bars',
    pattern: "bistrot|restaurant|resto|brasserie|bistro|ramen|\\bpho\\b|sushi|pizzeria|pizza|burger|mcdonald|kfc|starbucks|cafe|café|\\bbar\\b|\\bpub\\b|creperie|traiteur|cantine|tacos|kebab|boulangerie patisserie|snack",
    isRegex: true,
    categoryId: 'restaurants',
    priority: 80,
    createdAt: new Date().toISOString(),
  },

  // 10. Abonnements & Tech
  {
    id: 'rule_abonnements_tech',
    pattern: 'orange|free mobile|sfr|bouygues|sosh|netflix|spotify|apple|google storage|icloud|chatgpt|openai|amazon prime|canal\\+|deezer|disney\\+|youtube|tiktok',
    isRegex: true,
    categoryId: 'abonnements',
    priority: 80,
    createdAt: new Date().toISOString(),
  },

  // 11. Loisirs, Sport & Shopping
  {
    id: 'rule_loisirs_sports',
    pattern: "basic fit|fitness park|neoness|wellpass|decathlon|cinema|ugc|pathe|gaumont|escalade|coiffure|coiffeur|fnac|vinted|tabac|presse|uniqlo|zara|h&m|spectacle|concert",
    isRegex: true,
    categoryId: 'loisirs',
    priority: 78,
    createdAt: new Date().toISOString(),
  },

  // 12. Revenus & Salaires (Only applied to genuine credits)
  {
    id: 'rule_revenus_salaires',
    pattern: 'bulletin de paie|fiche de paie|salaire|paie |caf |allocation|pole emploi|france travail|bourse',
    isRegex: true,
    categoryId: 'revenus',
    priority: 96,
    createdAt: new Date().toISOString(),
  },
];
