/**
 * Convert a human-readable amount to raw token units
 * Frontend: 0.000001 (displayed) -> 1 (raw token unit) -> 1e18 wei (for transfers)
 */
export function displayAmountToTokenUnits(displayAmount: number): number {
  if (isNaN(displayAmount) || displayAmount < 0) {
    throw new Error("Amount must be a non-negative number");
  }
  return Math.round(displayAmount * 1_000_000);
}

/**
 * Convert raw token units to wei for blockchain transfers
 */
export function tokenUnitsToWei(tokenUnits: number): bigint {
  const wei = BigInt(tokenUnits) * BigInt("1000000000000");
  return wei;
}

/**
 * Convert raw token units to display amount
 */
export function tokenUnitsToDisplayAmount(tokenUnits: number): number {
  return tokenUnits / 1_000_000;
}

/**
 * Convert wei balance to display amount
 * @param weiBalance Balance in wei (1e18)
 * @param decimals Number of decimal places to show
 * @returns Formatted display amount string
 */
export function weiToDisplayAmount(
  weiBalance: bigint,
  decimals: number = 6
): string {
  return (Number(weiBalance) / 1e18).toFixed(decimals);
}

// Constants for validation
export const MIN_DISPLAY_AMOUNT = 0.000001;
export const MAX_DISPLAY_AMOUNT = 2147.483647;

/**
 * Validate a display amount is within acceptable bounds
 */
export function validateDisplayAmount(displayAmount: number): void {
  if (isNaN(displayAmount) || displayAmount <= 0) {
    throw new Error("Amount must be a positive number");
  }

  if (displayAmount < MIN_DISPLAY_AMOUNT) {
    throw new Error(`Amount too small. Minimum is ${MIN_DISPLAY_AMOUNT}`);
  }

  if (displayAmount > MAX_DISPLAY_AMOUNT) {
    throw new Error(`Amount too large. Maximum is ${MAX_DISPLAY_AMOUNT}`);
  }
}
