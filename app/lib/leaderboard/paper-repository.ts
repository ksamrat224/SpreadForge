import {
  getPaperAccountDecoder,
  getPaperAccountSize,
  getPriceUpdateV2Decoder,
} from "../../generated/result_registry";
import type { Address, ReadonlyUint8Array } from "@solana/kit";
import { PAPER_ASSETS, type PaperAsset } from "../simulation/paper";
import { getPaperPriceFeedAddress, PAPER_PYTH_FEEDS } from "../paper-oracle";
import { createSolanaClient, type ClusterMoniker } from "../solana-client";
import {
  rankPaperPortfolios,
  type PaperLeaderboardSnapshot,
  type PaperOraclePrice,
  type PaperPortfolioRecord,
} from "./paper-ranking";

export const PAPER_ORACLE_MAX_AGE_SECONDS = 30;
const PYTH_RECEIVER_PROGRAM_ADDRESS =
  "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ";

function fromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function hexToBytes(value: string) {
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (byte) =>
    Number.parseInt(byte, 16)
  );
}

function sameBytes(a: ReadonlyUint8Array, b: Uint8Array) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function priceToCents(price: bigint, exponent: number): bigint | null {
  if (price <= 0n || exponent < -18 || exponent > 18) return null;
  const scale = 10n ** BigInt(Math.abs(exponent));
  return exponent >= 0 ? price * scale * 100n : (price * 100n) / scale;
}

export type PaperOracleAccount = {
  owner: string;
  data: readonly [string, string];
};

export function decodePaperOraclePrice(
  asset: PaperAsset,
  account: PaperOracleAccount | null,
  nowSeconds: number
): PaperOraclePrice | null {
  if (!account || account.owner !== PYTH_RECEIVER_PROGRAM_ADDRESS) return null;
  try {
    const bytes = fromBase64(account.data[0]);
    if (bytes.length < 9) return null;
    const update = getPriceUpdateV2Decoder().decode(bytes.slice(8));
    const message = update.priceMessage;
    const priceCents = priceToCents(message.price, message.exponent);
    const publishedAt = Number(message.publishTime);
    if (
      !priceCents ||
      !Number.isSafeInteger(publishedAt) ||
      nowSeconds - publishedAt > PAPER_ORACLE_MAX_AGE_SECONDS ||
      publishedAt > nowSeconds + PAPER_ORACLE_MAX_AGE_SECONDS ||
      !sameBytes(message.feedId, hexToBytes(PAPER_PYTH_FEEDS[asset]))
    ) {
      return null;
    }
    return { asset, priceCents, publishedAt };
  } catch {
    return null;
  }
}

export type PaperLeaderboardRepository = {
  list: () => Promise<PaperLeaderboardSnapshot>;
};

export function createRpcPaperLeaderboardRepository({
  programAddress,
  cluster = "devnet",
  now = () => Date.now(),
}: {
  programAddress: string;
  cluster?: ClusterMoniker;
  now?: () => number;
}): PaperLeaderboardRepository {
  return {
    async list() {
      const client = createSolanaClient(cluster);
      const accounts = await client.rpc
        .getProgramAccounts(programAddress as Address, { encoding: "base64" })
        .send();
      const portfolios = accounts.flatMap((item): PaperPortfolioRecord[] => {
        try {
          if (
            item.account.owner !== programAddress ||
            fromBase64(item.account.data[0]).length !== getPaperAccountSize()
          ) {
            return [];
          }
          return [
            {
              address: item.pubkey,
              account: getPaperAccountDecoder().decode(
                fromBase64(item.account.data[0])
              ),
            },
          ];
        } catch {
          return [];
        }
      });
      const addresses = PAPER_ASSETS.map(
        (asset) => getPaperPriceFeedAddress(asset) as Address
      );
      const { value: priceAccounts } = await client.rpc
        .getMultipleAccounts(addresses, {
          encoding: "base64",
          commitment: "confirmed",
        })
        .send();
      const nowSeconds = Math.floor(now() / 1000);
      const prices = Object.fromEntries(
        PAPER_ASSETS.map((asset, index) => [
          asset,
          decodePaperOraclePrice(asset, priceAccounts[index], nowSeconds),
        ])
      ) as Partial<Record<PaperAsset, PaperOraclePrice | null>>;
      return rankPaperPortfolios({
        portfolios,
        prices: Object.fromEntries(
          Object.entries(prices).filter(([, price]) => price)
        ) as Partial<Record<PaperAsset, PaperOraclePrice>>,
      });
    },
  };
}
