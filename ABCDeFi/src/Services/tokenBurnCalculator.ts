// ============================================================================
// Token Burn Value Mechanism (Whitepaper Specific Example)
// Example: 112 X Tokens ➔ Burn 12 X Tokens ➔ 100 ABCD Tokens ➔ Increase ABCD Value
// ============================================================================

export interface WhitepaperBurnCalculationResult {
  inputXTokens: number;             // e.g. 112 X Tokens
  burnedXTokens: number;            // e.g. 12 X Tokens burned
  abcdTokensUnlocked: number;       // e.g. 100 ABCD Tokens received
  burnRatioPct: number;             // e.g. 10.71%
  abcdValueIncreasePct: number;     // e.g. +0.12%
  previousAbcdFloorPriceUSD: number;
  newAbcdFloorPriceUSD: number;
  timestamp: string;
}

export const WHITEPAPER_EXAMPLE: WhitepaperBurnCalculationResult = {
  inputXTokens: 112,
  burnedXTokens: 12,
  abcdTokensUnlocked: 100,
  burnRatioPct: 10.71,
  abcdValueIncreasePct: 0.12,
  previousAbcdFloorPriceUSD: 0.1850,
  newAbcdFloorPriceUSD: 0.1852,
  timestamp: 'Just now',
};

/**
 * Calculates Token Burn Value adjustment based on Whitepaper formula:
 * (X Tokens - Burned Tokens = ABCD Tokens Released ➔ Increases ABCD Value)
 */
export function calculateTokenBurnValue(
  inputXTokens: number,
  burnPercentagePct: number = 10.71,
  currentFloorPriceUSD: number = 0.1850
): WhitepaperBurnCalculationResult {
  if (inputXTokens <= 0) {
    return WHITEPAPER_EXAMPLE;
  }

  const burnedXTokens = Math.round(inputXTokens * (burnPercentagePct / 100));
  const abcdTokensUnlocked = inputXTokens - burnedXTokens;
  const burnRatioPct = Math.round((burnedXTokens / inputXTokens) * 10000) / 100;

  // Each burned token increases floor price proportionally
  const abcdValueIncreasePct = Math.round((burnedXTokens / 100) * 0.01 * 100) / 100;
  const newAbcdFloorPriceUSD = Math.round((currentFloorPriceUSD * (1 + abcdValueIncreasePct / 100)) * 10000) / 10000;

  return {
    inputXTokens,
    burnedXTokens,
    abcdTokensUnlocked,
    burnRatioPct,
    abcdValueIncreasePct,
    previousAbcdFloorPriceUSD: currentFloorPriceUSD,
    newAbcdFloorPriceUSD,
    timestamp: new Date().toLocaleTimeString(),
  };
}
