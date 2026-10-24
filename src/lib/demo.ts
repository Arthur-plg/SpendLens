import type { AccountInfo, Rule, Transaction } from '../types';
import { categorizeTransaction, extractCleanMerchant } from '../utils/rules';

/**
 * A fictional statement covering the last twelve months plus the current one,
 * written in Crédit Agricole's label format so it goes through the real rule engine.
 * Every name, merchant and amount is made up.
 */

export const DEMO_ACCOUNT: AccountInfo = { holderName: 'Alexandre Martin', detectedBank: 'Démo' };

const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

/** Small deterministic PRNG so the demo looks the same on every load. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Line {
  date: Date;
  label: string;
  amount: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
const card = (merchant: string, city: string, d: Date, display: string) =>
  `Paiement par carte - X4821 ${merchant} ${city} ${pad(d.getDate())}/${pad(d.getMonth() + 1)} - ${display}`;

const GROCERIES: [string, string, number, number][] = [
  ['MONOPRIX', 'Monoprix', 12, 64],
  ['CARREFOUR CITY', 'Carrefour City', 6, 38],
  ['FRANPRIX', 'Franprix', 5, 29],
  ['PICARD', 'Picard', 14, 46],
  ['BOULANGERIE DU MARCHE', 'Boulangerie du Marché', 3, 12],
];

const RESTAURANTS: [string, string, number, number][] = [
  ['BISTROT DES ARTISTES', 'Bistrot des Artistes', 18, 46],
  ['PIZZERIA NAPOLI', 'Pizzeria Napoli', 14, 32],
  ['SUSHI KAZE', 'Sushi Kaze', 16, 34],
  ['UBER * EATS', 'Uber Eats', 15, 31],
  ['CAFE DE LA GARE', 'Café de la Gare', 3, 9],
  ['BURGER FACTORY', 'Burger Factory', 12, 21],
];

/** A few merchants the default rules do not know, to show the "À classer" flow. */
const UNKNOWN: [string, string, number, number][] = [
  ['ATELIER CERAMIQUE', 'Atelier Céramique', 25, 60],
  ['LIBRAIRIE DES ECOLES', 'Librairie des Écoles', 9, 34],
  ['ETSY', 'Etsy', 18, 52],
];

function buildLines(today: Date): Line[] {
  const rand = mulberry32(20261024);
  const between = (min: number, max: number) => Math.round((min + rand() * (max - min)) * 100) / 100;
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)];
  const lines: Line[] = [];

  const start = new Date(today.getFullYear(), today.getMonth() - 12, 1);
  for (let m = 0; m <= 12; m++) {
    const year = start.getFullYear();
    const month = start.getMonth() + m;
    const day = (d: number) => new Date(year, month, d);
    const days = new Date(year, month + 1, 0).getDate();
    const add = (d: number, label: string, amount: number) => {
      const date = day(Math.min(d, days));
      if (date <= today) lines.push({ date, label, amount });
    };
    const monthIndex = new Date(year, month, 1).getMonth();
    const isSummer = monthIndex === 6 || monthIndex === 7;
    const isDecember = monthIndex === 11;

    // Income and fixed charges
    add(1, 'Virement en votre faveur - VIREMENT SALAIRE SAS TECHLAB - Salaire', 2850);
    add(2, 'Virement émis - VERS LIVRET A - Épargne mensuelle', -200);
    add(5, 'Prélèvement - AGENCE NATION - Agence Nation - LOYER APPARTEMENT', -650);
    add(7, 'Prélèvement - EDF CLIENTS PARTICULIERS - EDF - Mandat 4417021', -between(42, 71));
    add(9, 'Prélèvement - FREE MOBILE - Free Mobile - Forfait mobile', -19.99);
    add(10, 'Prélèvement - IMAGINE R NAVIGO - Navigo - Forfait mensuel', -86.4);
    add(12, 'Prélèvement - BASIC FIT FRANCE - Basic-Fit - Abonnement', -29.99);
    add(14, card('SPOTIFY', 'STOCKHOLM', day(14), 'Spotify'), -10.99);
    add(16, card('NETFLIX.COM', 'AMSTERDAM', day(16), 'Netflix'), -13.49);
    if (m < 6) add(18, card('DISNEY PLUS', 'PARIS', day(18), 'Disney+'), -8.99); // cancelled half-way
    add(3, card('TRADE REPUBLIC', 'BERLIN', day(3), 'Trade Republic'), -150);
    add(28, 'Cotisation - COTISATION OFFRE BANCAIRE', -4.5);

    // Everyday spending
    const groceryRuns = 8 + Math.floor(rand() * 5);
    for (let i = 0; i < groceryRuns; i++) {
      const [label, display, min, max] = pick(GROCERIES);
      const d = 1 + Math.floor(rand() * days);
      add(d, card(label, 'PARIS', day(d), display), -between(min, max));
    }
    const meals = 5 + Math.floor(rand() * 5) + (isDecember ? 3 : 0);
    for (let i = 0; i < meals; i++) {
      const [label, display, min, max] = pick(RESTAURANTS);
      const d = 1 + Math.floor(rand() * days);
      add(d, card(label, 'PARIS', day(d), display), -between(min, max));
    }
    for (let i = 0; i < 2; i++) {
      const d = 1 + Math.floor(rand() * days);
      add(d, card('UBER', 'PARIS', day(d), 'Uber'), -between(11, 26));
    }
    if (rand() < 0.7) {
      const d = 1 + Math.floor(rand() * days);
      add(d, card('SNCF CONNECT', 'PARIS', day(d), 'SNCF'), -between(32, 96));
    }
    if (rand() < 0.6) {
      const d = 1 + Math.floor(rand() * days);
      add(d, card('UGC CINE CITE', 'PARIS', day(d), 'UGC'), -11.9);
    }
    if (rand() < 0.5) {
      const d = 1 + Math.floor(rand() * days);
      add(d, card('DECATHLON', 'PARIS', day(d), 'Decathlon'), -between(19, 74));
    }

    // Health, with the matching reimbursement a few days later
    if (rand() < 0.55) {
      const d = 3 + Math.floor(rand() * (days - 10));
      add(d, card('DR LEMAIRE MEDECIN', 'PARIS', day(d), 'Dr Lemaire'), -30);
      add(d + 6, 'Virement en votre faveur - CPAM DE PARIS - Remboursement soins', 21);
    }
    if (rand() < 0.6) {
      const d = 1 + Math.floor(rand() * days);
      add(d, card('PHARMACIE DE LA MAIRIE', 'PARIS', day(d), 'Pharmacie de la Mairie'), -between(6, 28));
    }

    // Friends: paying back and being paid back
    if (rand() < 0.6) {
      const d = 1 + Math.floor(rand() * days);
      add(d, 'Virement émis - WERO - Julien Roux - remboursement resto', -between(15, 45));
    }
    if (rand() < 0.4) {
      const d = 1 + Math.floor(rand() * days);
      add(d, 'Virement en votre faveur - VIR INST de Mlle LEA PETIT - partage courses', between(12, 40));
    }

    // Unknown merchants for the categorisation drawer
    if (rand() < 0.5) {
      const [label, display, min, max] = pick(UNKNOWN);
      const d = 1 + Math.floor(rand() * days);
      add(d, card(label, 'PARIS', day(d), display), -between(min, max));
    }

    // Seasons
    if (isSummer) {
      add(4, card('TRANSAVIA', 'PARIS', day(4), 'Transavia'), -between(140, 220));
      add(20, card('AIRBNB', 'DUBLIN', day(20), 'Airbnb'), -between(280, 420));
    }
    if (isDecember) {
      add(12, card('GALERIES LAFAYETTE', 'PARIS', day(12), 'Galeries Lafayette'), -between(120, 210));
      add(15, 'Virement en votre faveur - VIREMENT SALAIRE SAS TECHLAB - Prime annuelle', 1200);
    }
  }
  return lines;
}

export function buildDemo(rules: Rule[], today = new Date()): Transaction[] {
  const internal = /intercompte|compte a compte|vers livret|de livret/i;
  return buildLines(today)
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map((line, i) => {
      const y = line.date.getFullYear();
      const m = line.date.getMonth();
      const d = line.date.getDate();
      const date = `${y}-${pad(m + 1)}-${pad(d)}`;
      const type = line.amount < 0 ? ('debit' as const) : ('credit' as const);
      const extractedMerchant = extractCleanMerchant(line.label);
      const isInternalTransfer = internal.test(line.label);
      const result = categorizeTransaction(line.label, type, extractedMerchant, rules);
      return {
        id: `demo_${date}_${i}`,
        date,
        rawDate: `${pad(d)}/${pad(m + 1)}/${y}`,
        monthKey: `${y}-${pad(m + 1)}`,
        monthLabel: `${MONTHS_FR[m]} ${y}`,
        rawLabel: line.label,
        extractedMerchant,
        cleanMerchant: isInternalTransfer ? 'Virement interne' : (result.overrideMerchant ?? extractedMerchant),
        amount: line.amount,
        absAmount: Math.abs(line.amount),
        type,
        isInternalTransfer,
        category: isInternalTransfer ? 'virement_interne' : result.category,
        categorizationMethod: result.method,
        ruleMatched: result.ruleId,
      };
    });
}
