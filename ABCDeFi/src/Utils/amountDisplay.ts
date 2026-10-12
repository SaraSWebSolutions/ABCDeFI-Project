/**
 * Formats an already-decoded token amount for display only. It never feeds a
 * contract call or changes the canonical raw amount returned by the wallet.
 */
export function formatTokenDisplay(value: string, maximumFractionDigits = 4): string {
  const source = value.trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(source)) return 'Unavailable';
  const negative = source.startsWith('-');
  const unsigned = negative ? source.slice(1) : source;
  const [whole, fraction = ''] = unsigned.split('.');
  const groupedWhole = BigInt(whole).toLocaleString('en-US');
  // Truncate only the visual representation. The full value remains in the
  // canonical wallet/contract read and is never rounded for a transaction.
  const visibleFraction = fraction.slice(0, maximumFractionDigits).replace(/0+$/, '');
  if (whole === '0' && !visibleFraction && /[1-9]/.test(fraction)) return `<0.${'0'.repeat(Math.max(0, maximumFractionDigits - 1))}1`;
  return `${negative ? '-' : ''}${groupedWhole}${visibleFraction ? `.${visibleFraction}` : ''}`;
}
