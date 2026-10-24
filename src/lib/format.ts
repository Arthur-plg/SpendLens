const eur2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const eur0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const pct1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const DAYS_SHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];


/** True minus sign reads better than a hyphen in tabular figures. */
const MINUS = String.fromCharCode(0x2212);
/** Intl groups digits with a narrow no-break space, too thin in Archivo: use a regular one. */
const NBSP = String.fromCharCode(0xa0);
const NARROW_NBSP = new RegExp(String.fromCharCode(0x202f), 'g');
const widen = (s: string) => s.replace(NARROW_NBSP, NBSP);

export function euros(value: number, opts: { decimals?: boolean; sign?: boolean } = {}): string {
  const { decimals = true, sign = false } = opts;
  const body = widen((decimals ? eur2 : eur0).format(Math.abs(value)));
  const prefix = value < 0 ? MINUS : sign && value > 0 ? '+' : '';
  return `${prefix}${body}${NBSP}€`;
}

/** Splits a euro amount for typographic treatment: "1 489" + ",60". */
export function eurosParts(value: number): { sign: string; whole: string; cents: string } {
  const [whole, cents] = widen(eur2.format(Math.abs(value))).split(',');
  return { sign: value < 0 ? MINUS : '', whole, cents: `,${cents}` };
}

export function percent(value: number, opts: { sign?: boolean } = {}): string {
  if (!Number.isFinite(value)) return '—';
  const prefix = value < 0 ? MINUS : opts.sign && value > 0 ? '+' : '';
  return `${prefix}${widen(pct1.format(Math.abs(value)))}${NBSP}%`;
}

export function count(value: number): string {
  return widen(eur0.format(value));
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d || 1);
}

/** "2026-10" → "Octobre 2026" */
export function monthLong(monthKey: string): string {
  const d = parseIso(monthKey);
  const name = MONTHS_LONG[d.getMonth()];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${d.getFullYear()}`;
}

/** "2026-10" → "oct. 2026" or "oct." */
export function monthShort(monthKey: string, withYear = true): string {
  const d = parseIso(monthKey);
  return withYear ? `${MONTHS_SHORT[d.getMonth()]}${NBSP}${d.getFullYear()}` : MONTHS_SHORT[d.getMonth()];
}

/** "2026-10-22" → "jeu. 22 oct." */
export function dayLabel(iso: string): string {
  const d = parseIso(iso);
  return `${DAYS_SHORT[d.getDay()]} ${d.getDate()}${NBSP}${MONTHS_SHORT[d.getMonth()]}`;
}

/** "2026-10-22" → "22 oct. 2026" */
export function dateLong(iso: string): string {
  const d = parseIso(iso);
  return `${d.getDate()}${NBSP}${MONTHS_SHORT[d.getMonth()]}${NBSP}${d.getFullYear()}`;
}

/** "2026-10-22" → "22/10" */
export function dateShort(iso: string): string {
  const d = parseIso(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function plural(n: number, one: string, many: string): string {
  return `${count(n)} ${n > 1 ? many : one}`;
}
