import { eurosParts } from '../lib/format';

interface MoneyProps {
  value: number;
  /** Prefix positive values with "+". */
  sign?: boolean;
  size?: 'display' | 'lg' | 'md';
  className?: string;
}

/** Pixel figure with lighter cents: the signature way amounts are set. */
export function Money({ value, sign = false, size = 'md', className = '' }: MoneyProps) {
  const parts = eurosParts(value);
  const prefix = parts.sign || (sign && value > 0 ? '+' : '');
  return (
    <span className={`money money--${size} ${className}`}>
      <span className="money__whole">
        {prefix}
        {parts.whole}
      </span>
      <span className="money__cents">{parts.cents}</span>
      <span className="money__cur">€</span>
    </span>
  );
}
