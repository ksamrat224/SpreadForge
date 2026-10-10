#!/usr/bin/env node
/**
 * Maintains shard-zero Pyth PriceFeed accounts used by devnet paper trades.
 * Run as a supervised process: `node scripts/pyth-price-pusher.mjs`.
 * The fee-payer keypair path is server-only and must never be exposed to Next.
 */
import { readFile } from "node:fs/promises";
import { HermesClient } from "@pythnetwork/hermes-client";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import { sendTransactions } from "@pythnetwork/solana-utils";
import { Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair } from "@solana/web3.js";

const ALL_FEEDS = [
  "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  "ec5d399846a9209f3fe5881d70aae9268c94339ff9817e8d18ff19fa05eea1c8",
  "2a01deaec9e51a579277b34b122399984d0bbf57e2458a7e42fecd2829867a0d",
  "dcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c",
  "93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7",
  "8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221",
  "ca3eed9b267293f6595901c734c7525ce8ef49adafe8284606ceb307afa2ca5b",
  "6e3f3fa8253588df9326580180233eb791e03b443a3ba7a1d892e73874e19a54",
  "3dd2b63686a450ec7290df3a1e0b583c0481f651351edfa7636f39aed55cf8a3",
  "78d185a741d07edb3412b09008b7c5cfb9bbbd7d568bf00ba737b456ba171501",
  "2b9ab1e972a281585084148ba1389800799bd4be63b957507db1349314e47445",
  "23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744",
  "b00b60f88b03a6a625a8d1c048c3f66653edf217439983d037e7222c4e612819",
  "c415de8d2eba7db216527dff4b60e8f3a5311c740dadb233e13e12547e226750",
  "7f5cc8d963fc5b3d2ae41fe5685ada89fd4f14b435f8050f28c7fd409f40c2d8",
  "b7a8eba68a997cd0210c2e1e4ee811ad2d174b3611c22d9ebf16f4cb7e9ba850",
  "3728e591097635310e6341af53db8b7ee42da9b3a8d918f9463ce9cca886dfbd",
  "f0d57deca57b3da2fe63a493f4c25925fdfd8edf834b20f93e1f84dbd1504d4a",
];
const requestedFeeds = process.env.PAPER_PYTH_FEED_IDS?.split(",")
  .map((feed) => feed.trim())
  .filter(Boolean);
const FEEDS = requestedFeeds ?? ALL_FEEDS;
if (FEEDS.length === 0 || FEEDS.some((feed) => !/^[0-9a-f]{64}$/i.test(feed))) {
  throw new Error(
    "PAPER_PYTH_FEED_IDS must be a comma-separated list of 32-byte hexadecimal Pyth feed IDs."
  );
}
const keypairPath = process.env.PAPER_PYTH_PUSHER_KEYPAIR;
if (!keypairPath)
  throw new Error(
    "PAPER_PYTH_PUSHER_KEYPAIR must point to a server-only Solana keypair JSON file."
  );
const connection = new Connection(
  process.env.PAPER_PYTH_RPC_URL ?? "https://api.devnet.solana.com",
  "confirmed"
);
const keypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(await readFile(keypairPath, "utf8")))
);
const wallet = new Wallet(keypair);
const receiver = new PythSolanaReceiver({ connection, wallet });
const hermes = new HermesClient(
  process.env.PAPER_PYTH_HERMES_URL ?? "https://pyth.dourolabs.app/hermes",
  process.env.PYTH_HERMES_API_KEY
    ? { accessToken: process.env.PYTH_HERMES_API_KEY }
    : undefined
);

let pushing = false;
async function push() {
  if (pushing) return;
  pushing = true;
  try {
    const updates = await hermes.getLatestPriceUpdates(FEEDS, {
      encoding: "base64",
    });
    const builder = receiver.newTransactionBuilder({});
    await builder.addUpdatePriceFeed(updates.binary.data, 0);
    const signatures = await sendTransactions(
      await builder.buildVersionedTransactions({
        computeUnitPriceMicroLamports: 0,
        tightComputeBudget: true,
      }),
      connection,
      wallet
    );
    console.log(
      new Date().toISOString(),
      "updated",
      updates.binary.data.length,
      "feeds",
      signatures
    );
  } finally {
    pushing = false;
  }
}

await push();
if (!process.argv.includes("--once")) {
  setInterval(
    () =>
      void push().catch((error) =>
        console.error("Pyth price push failed", error)
      ),
    10_000
  );
}
