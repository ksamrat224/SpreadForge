export const FUSD_DECIMALS = 6;
export const FUSD_SCALE = 1_000_000n;
export const PERFORMANCE_FEE_BPS = 1_000n;
export const BPS_SCALE = 10_000n;

export function sharesForDeposit(
  depositMicro: bigint,
  totalShares: bigint,
  vaultMicro: bigint
) {
  if (depositMicro <= 0n) throw new Error("Deposit must be positive.");
  if (totalShares === 0n) return depositMicro;
  if (vaultMicro <= 0n)
    throw new Error("A funded share supply needs a vault balance.");
  return (depositMicro * totalShares) / vaultMicro;
}

export function tokensForWithdrawal(
  shares: bigint,
  totalShares: bigint,
  vaultMicro: bigint
) {
  if (shares <= 0n || totalShares <= 0n || shares > totalShares)
    throw new Error("Invalid share amount.");
  return (shares * vaultMicro) / totalShares;
}

export function calculateSettlement({
  startingEquity,
  endingEquity,
  totalShares,
  highWaterPriceE6,
}: {
  startingEquity: bigint;
  endingEquity: bigint;
  totalShares: bigint;
  highWaterPriceE6: bigint;
}) {
  if (startingEquity <= 0n || totalShares <= 0n)
    throw new Error("A session needs backed shares.");
  if (endingEquity <= startingEquity)
    return {
      mintAmount: 0n,
      burnAmount: startingEquity - endingEquity,
      feeAmount: 0n,
      nextHighWaterPriceE6: highWaterPriceE6,
    };

  const profit = endingEquity - startingEquity;
  const grossSharePrice = (endingEquity * FUSD_SCALE) / totalShares;
  const eligibleProfit =
    grossSharePrice > highWaterPriceE6
      ? ((grossSharePrice - highWaterPriceE6) * totalShares) / FUSD_SCALE
      : 0n;
  const feeAmount =
    (min(eligibleProfit, profit) * PERFORMANCE_FEE_BPS) / BPS_SCALE;
  const postFeeEquity = endingEquity - feeAmount;
  const nextHighWaterPriceE6 = max(
    highWaterPriceE6,
    (postFeeEquity * FUSD_SCALE) / totalShares
  );
  return {
    mintAmount: profit,
    burnAmount: 0n,
    feeAmount,
    nextHighWaterPriceE6,
  };
}

export function formatFusd(micro: bigint) {
  return `${(Number(micro) / Number(FUSD_SCALE)).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} fUSD`;
}

const min = (a: bigint, b: bigint) => (a < b ? a : b);
const max = (a: bigint, b: bigint) => (a > b ? a : b);
