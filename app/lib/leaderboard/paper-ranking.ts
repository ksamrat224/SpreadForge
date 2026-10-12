import type { PaperAccount } from "../../generated/result_registry";
import { PAPER_ASSETS, type PaperAsset } from "../simulation/paper";

export const PAPER_START_EQUITY_CENTS = 1_000_000n;

export type PaperOraclePrice = {
  asset: PaperAsset;
  priceCents: bigint;
  publishedAt: number;
};

export type PaperPortfolioRecord = {
  address: string;
  account: PaperAccount;
};

export type PaperLeaderboardEntry = {
  walletAddress: string;
  returnBps: number;
  equityCents: number;
  realizedPnlCents: number;
  tradeCount: number;
  lastActivityAt: number;
};

export type PaperLeaderboardSnapshot = {
  entries: PaperLeaderboardEntry[];
  excludedUnpricedPortfolios: number;
};

function asSafeNumber(value: bigint): number | null {
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

function compareEntries(a: PaperLeaderboardEntry, b: PaperLeaderboardEntry) {
  return (
    b.returnBps - a.returnBps ||
    b.equityCents - a.equityCents ||
    b.lastActivityAt - a.lastActivityAt ||
    a.walletAddress.localeCompare(b.walletAddress)
  );
}

/** Values portfolios exactly in the program's cents and milli-asset units. */
export function rankPaperPortfolios({
  portfolios,
  prices,
}: {
  portfolios: PaperPortfolioRecord[];
  prices: Partial<Record<PaperAsset, PaperOraclePrice>>;
}): PaperLeaderboardSnapshot {
  const entries: PaperLeaderboardEntry[] = [];
  let excludedUnpricedPortfolios = 0;

  for (const { account } of portfolios) {
    if (account.tradeCount === 0) continue;
    let equity = account.usdcCents;
    let missingPrice = false;

    for (const [index, asset] of PAPER_ASSETS.entries()) {
      const position = account.positions[index];
      if (position.quantityMilli === 0n) continue;
      const price = prices[asset];
      if (!price || price.priceCents <= 0n) {
        missingPrice = true;
        break;
      }
      equity += (price.priceCents * position.quantityMilli) / 1_000n;
    }

    if (missingPrice || account.startEquityCents <= 0n) {
      excludedUnpricedPortfolios += 1;
      continue;
    }

    const returnBps =
      ((equity - account.startEquityCents) * 10_000n) /
      account.startEquityCents;
    const equityCents = asSafeNumber(equity);
    const returnBpsNumber = asSafeNumber(returnBps);
    const realizedPnlCents = asSafeNumber(account.realizedPnlCents);
    const lastActivityAt = asSafeNumber(account.updatedAt);
    if (
      equityCents === null ||
      returnBpsNumber === null ||
      realizedPnlCents === null ||
      lastActivityAt === null
    ) {
      excludedUnpricedPortfolios += 1;
      continue;
    }

    entries.push({
      walletAddress: account.authority,
      returnBps: returnBpsNumber,
      equityCents,
      realizedPnlCents,
      tradeCount: account.tradeCount,
      lastActivityAt,
    });
  }

  return { entries: entries.sort(compareEntries), excludedUnpricedPortfolios };
}
