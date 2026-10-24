import type { CategoryDefinition, Rule } from '../types';

export const DEFAULT_CATEGORIES: CategoryDefinition[] = [
  {
    id: 'alimentation',
    name: 'Alimentation & Courses',
    color: '#10b981', // Emerald
    bgLight: 'rgba(16, 185, 129, 0.12)',
    iconName: 'ShoppingCart',
  },
  {
    id: 'restaurants',
    name: 'Restaurants, Bars & Cafés',
    color: '#f59e0b', // Amber
    bgLight: 'rgba(245, 158, 11, 0.12)',
    iconName: 'Utensils',
  },
  {
    id: 'transports',
    name: 'Transports & Voyages',
    color: '#06b6d4', // Cyan
    bgLight: 'rgba(6, 182, 212, 0.12)',
    iconName: 'Plane',
  },
  {
    id: 'logement',
    name: 'Logement & Factures',
    color: '#6366f1', // Indigo
    bgLight: 'rgba(99, 102, 241, 0.12)',
    iconName: 'Home',
  },
  {
    id: 'abonnements',
    name: 'Abonnements & Tech',
    color: '#a855f7', // Purple
    bgLight: 'rgba(168, 85, 247, 0.12)',
    iconName: 'Tv',
  },
  {
    id: 'epargne',
    name: 'Investissement & Épargne',
    color: '#14b8a6', // Teal
    bgLight: 'rgba(20, 184, 166, 0.12)',
    iconName: 'TrendingUp',
  },
  {
    id: 'loisirs',
    name: 'Loisirs, Sport & Shopping',
    color: '#ec4899', // Pink
    bgLight: 'rgba(236, 72, 153, 0.12)',
    iconName: 'Dumbbell',
  },
  {
    id: 'proches_amis',
    name: 'Virements proches & amis',
    color: '#f43f5e', // Rose
    bgLight: 'rgba(244, 63, 94, 0.12)',
    iconName: 'Users',
  },
  {
    id: 'sante',
    name: 'Santé & Pharmacie',
    color: '#ef4444', // Red
    bgLight: 'rgba(239, 68, 68, 0.12)',
    iconName: 'HeartPulse',
  },
  {
    id: 'frais_bancaires',
    name: 'Frais bancaires & Retraits',
    color: '#94a3b8', // Slate
    bgLight: 'rgba(148, 163, 184, 0.12)',
    iconName: 'CreditCard',
  },
  {
    id: 'virement_interne',
    name: 'Virement interne / Épargne',
    color: '#475569',
    bgLight: 'rgba(71, 85, 105, 0.12)',
    iconName: 'ArrowLeftRight',
    isTransfer: true,
  },
  {
    id: 'revenus',
    name: 'Revenus & Salaires',
    color: '#22c55e',
    bgLight: 'rgba(34, 197, 94, 0.12)',
    iconName: 'BadgePercent',
    isIncome: true,
  },
  {
    id: 'autre',
    name: 'Autres dépenses',
    color: '#64748b',
    bgLight: 'rgba(100, 116, 139, 0.12)',
    iconName: 'HelpCircle',
  },
];

export const DEFAULT_RULES: Rule[] = [
  // 1. Virements internes (Arthur Pelong)
  {
    id: 'rule_interne_1',
    pattern: 'PELONG ARTHUR',
    categoryId: 'virement_interne',
    targetMerchantName: 'Virement interne (Pelong Arthur)',
    priority: 100,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'rule_interne_2',
    pattern: 'intercompte|compte a compte|vers livret|de livret',
    isRegex: true,
    categoryId: 'virement_interne',
    targetMerchantName: 'Virement interne',
    priority: 95,
    createdAt: new Date().toISOString(),
  },

  // 2. Frais bancaires, incidents & retraits distributeur
  {
    id: 'rule_frais_bancaires',
    pattern: "globe trotter|frais irreg|cotisation|frais bancaire|incident|commission d'inter|rejet",
    isRegex: true,
    categoryId: 'frais_bancaires',
    targetMerchantName: 'Frais bancaires (CA)',
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
    pattern: 'wero|vir inst|rembourser|remboursement|cadeau|maman|charles pelong|paquier|salome pierre|lydia|leetchi|helloasso|ouanes|dieme|lionel quach',
    isRegex: true,
    categoryId: 'proches_amis',
    targetMerchantName: 'Virement proche / ami',
    priority: 92,
    createdAt: new Date().toISOString(),
  },

  // 4. Logement, Loyers, Charges & Assurances
  {
    id: 'rule_logement_loyer',
    pattern: 'argaux immo|loyer|charges copro|maif|edf|engie|totalenergies|veolia|assurance habitation',
    isRegex: true,
    categoryId: 'logement',
    targetMerchantName: 'Loyer & Charges (Argaux Immo)',
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
    pattern: 'sncf|ratp|navigo|trainline|idtgv|ter |ouigo|tcl|transports en commun|spl relation|uber(?!.*eats)|ubr\\*(?!.*eats)|bolt|lime|tier|dott|voi|pony|bicing|total|shell|bp|peage|aprr|vinci autoroutes|esso|air france|transavia|easyjet|ryanair|lufthansa|vueling|relais h|aix-marseille|wagon-lit|wagons-lits|part-dieu|aeroport|orly|horodateur|metro|areas portugal|concessions gares',
    isRegex: true,
    categoryId: 'transports',
    priority: 85,
    createdAt: new Date().toISOString(),
  },

  // 7. Santé, Médecins, Pharmacies
  {
    id: 'rule_sante_doctors',
    pattern: 'pharmacie|doctolib|laboratoire|biolab|eurofins|dentiste|dent|opticien|ophtalmo|kine|medecin|derma|soins devis|aude thibous|dr matard|dr remy|dr dov gozlan|docteur',
    isRegex: true,
    categoryId: 'sante',
    priority: 85,
    createdAt: new Date().toISOString(),
  },

  // 8. Alimentation & Supermarchés
  {
    id: 'rule_alimentation_courses',
    pattern: 'carrefour|monoprix|franprix|lidl|auchan|leclerc|aldi|intermarche|naturalia|picard|bio c bon|u express|super u|casino|boulangerie|boulanger|victoris|mk mail|paul|kayser|crous|ru ecole|civette|9 shop|8 a huit|votre marche|superette|marche |epicerie|primeur|7 eleven|lagkagehuset|mix markt|palet solognot|uep\\*alim',
    isRegex: true,
    categoryId: 'alimentation',
    priority: 83,
    createdAt: new Date().toISOString(),
  },

  // 9. Restaurants, Bars, Cafés & Street Food
  {
    id: 'rule_restaurants_bars',
    pattern: "bistrot|restaurant|resto|brasserie|bistro|ramen|konoha|pho|sushi|m'suschi|pizzeria|pizza|burger|mcdonald|deliveroo|starbucks|forzacafe|cafe|café|bar |pub |maelvina|jcp|la petite bourse|pere et fils|gn france|piadineria|alla mano|momo house|les amis de l|ess'pace|ancora|taverne de zhao|yose|copenhagen coffee|cyrano|petit duc|selecta|ivs|newrest|tipam|magd sebastopol|st eustache|merci|mazagran|catovien|restau star|tacos|o'tacos|so noodles|acropolis|wok4you|banque|balto|village|attirail|cantina|canela|cyclo banh|saumur|gourmandise|pau canela|ruem distri|distriprot|pause gourmande|bonne nouvelles|moom mam|calumet|creperie|matmatan|cabane bambou|kawa saki|masalmeh|traiteur|cantine|boulang|peixes cave|leloki|moona chicken|pad port|kashem|borboleta|zen bo bun|banh mi kim|diwan express|damazia|laurencin|mie caline|food'lab|parisienne|berliner|etudiant|viaduc|good news|new osaka|clay|istanbul grill|apostrophe|fabro pasta|kazuki|reffen|sumup|festival|waterfall|ballanger",
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
    pattern: "urbansoccer|urban soccer|wellpass|neoness|winamax|tennis-point|basic fit|fitness park|decathlon|cinema|ugc|pathe|gaumont|megarama|climbing|escalade|mpg paris|footshop|coiffure|s & h|tchip|ankama|vinted|histoire d'or|nyx payments|tabac|presse|boit a skis|bhv|uniqlo|souvenir|danish|le salon|le havane",
    isRegex: true,
    categoryId: 'loisirs',
    priority: 78,
    createdAt: new Date().toISOString(),
  },

  // 12. Revenus & Salaires (Only applied to genuine credits)
  {
    id: 'rule_revenus_salaires',
    pattern: 'qonto|olinda|bulletin de paie|fiche de paie|salaire|caf du rhone|caf |cpam|budget vie etudian|aeecl bde',
    isRegex: true,
    categoryId: 'revenus',
    priority: 75,
    createdAt: new Date().toISOString(),
  },
];
