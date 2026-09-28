export type IcoV2AdminStage = Readonly<{
  startTime: string;
  endTime: string;
  inventory: string;
  sold: string;
  priceUsdWad: string;
}>;

const isUnsignedInteger = (value: unknown): value is string => typeof value === 'string' && /^\d+$/.test(value);

/**
 * The canonical ICO V2 read API deliberately serializes Solidity's `stage(uint8)`
 * tuple as a positional array. Convert it at this UI boundary only; malformed
 * payloads return null so the UI can fail closed rather than render invented zeroes.
 */
export function normalizeIcoV2AdminStage(value: unknown): IcoV2AdminStage | null {
  if (!Array.isArray(value) || value.length !== 5 || !value.every(isUnsignedInteger)) return null;
  const [startTime, endTime, inventory, sold, priceUsdWad] = value;
  return { startTime, endTime, inventory, sold, priceUsdWad };
}

function decimalUnits(value: string, decimals: number): string {
  const padded = value.padStart(decimals + 1, '0');
  const integer = padded.slice(0, -decimals);
  const fraction = padded.slice(-decimals).replace(/0+$/, '');
  return fraction ? `${integer}.${fraction}` : integer;
}

function groupInteger(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatIcoV2Abcd(value: string): string {
  const [integer, fraction] = decimalUnits(value, 18).split('.');
  return `${groupInteger(integer)}${fraction ? `.${fraction}` : ''} ABCD`;
}

export function formatIcoV2UsdWad(value: string): string {
  const [integer, fraction] = decimalUnits(value, 18).split('.');
  const displayFraction = (fraction || '').padEnd(3, '0');
  return `${groupInteger(integer)}.${displayFraction} USD`;
}
