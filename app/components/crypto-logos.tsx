import type { PaperAsset } from "../lib/simulation/paper";
import { SolanaLogo } from "./solana-logo";

// Official marks sourced from svgrepo.com (bitcoin-logo #303287, ethereum #349356).
export function BitcoinLogo({ size = 24 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0.004 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#f7931a"
        d="M63.04 39.741c-4.274 17.143-21.638 27.575-38.783 23.301C7.12 58.768-3.313 41.404.962 24.262 5.234 7.117 22.597-3.317 39.737.957c17.144 4.274 27.576 21.64 23.302 38.784z"
      />
      <path
        fill="#ffffff"
        d="M46.11 27.441c.636-4.258-2.606-6.547-7.039-8.074l1.438-5.768-3.512-.875-1.4 5.616c-.922-.23-1.87-.447-2.812-.662l1.41-5.653-3.509-.875-1.439 5.766c-.764-.174-1.514-.346-2.242-.527l.004-.018-4.842-1.209-.934 3.75s2.605.597 2.55.634c1.422.355 1.68 1.296 1.636 2.042l-1.638 6.571c.098.025.225.061.365.117l-.37-.092-2.297 9.205c-.174.432-.615 1.08-1.609.834.035.051-2.552-.637-2.552-.637l-1.743 4.02 4.57 1.139c.85.213 1.683.436 2.502.646l-1.453 5.835 3.507.875 1.44-5.772c.957.26 1.887.5 2.797.726L27.504 50.8l3.511.875 1.453-5.823c5.987 1.133 10.49.676 12.383-4.738 1.527-4.36-.075-6.875-3.225-8.516 2.294-.531 4.022-2.04 4.483-5.157zM38.087 38.69c-1.086 4.36-8.426 2.004-10.807 1.412l1.928-7.729c2.38.594 10.011 1.77 8.88 6.317zm1.085-11.312c-.99 3.966-7.1 1.951-9.083 1.457l1.748-7.01c1.983.494 8.367 1.416 7.335 5.553z"
      />
    </svg>
  );
}

export function EthereumLogo({ size = 24 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className="eth-logo"
      width={(size * 263) / 428}
      height={size}
      viewBox="124 41 263 428"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path fill="#3C3C3B" d="m256 362v107l131-185z" />
      <path fill="#343434" d="m256 41l131 218-131 78-132-78" />
      <path fill="#8C8C8C" d="m256 41v158l-132 60m0 25l132 78v107" />
      <path fill="#141414" d="m256 199v138l131-78" />
      <path fill="#393939" d="m124 259l132-60v138" />
    </svg>
  );
}

export function AssetLogo({
  asset,
  size = 24,
}: {
  asset: PaperAsset;
  size?: number;
}) {
  if (asset === "BTC") return <BitcoinLogo size={size} />;
  if (asset === "ETH") return <EthereumLogo size={size} />;
  return <SolanaLogo size={size} />;
}
