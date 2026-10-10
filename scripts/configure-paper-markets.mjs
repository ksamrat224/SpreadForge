#!/usr/bin/env node
/**
 * Registers the immutable Pyth feed identity for each paper market.
 * Default mode only prints the exact devnet changes. --send simulates every
 * instruction and sends only simulations that pass.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

const PROGRAM_ID = new PublicKey(
  process.env.PAPER_PROGRAM_ID ?? "2EXN7tmfAekEn2Noq8j8AkVx9bTi96zuakHUKSsW4u9w"
);
const RPC_URL =
  process.env.PAPER_PYTH_RPC_URL ?? "https://api.devnet.solana.com";
const EXCHANGE = PublicKey.findProgramAddressSync(
  [Buffer.from("paper-config")],
  PROGRAM_ID
)[0];
const MARKETS = [
  ["BTC", "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"],
  ["ETH", "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace"],
  ["SOL", "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d"],
  ["XRP", "ec5d399846a9209f3fe5881d70aae9268c94339ff9817e8d18ff19fa05eea1c8"],
  ["ADA", "2a01deaec9e51a579277b34b122399984d0bbf57e2458a7e42fecd2829867a0d"],
  ["DOGE", "dcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c"],
  ["AVAX", "93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7"],
  ["LINK", "8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221"],
  ["DOT", "ca3eed9b267293f6595901c734c7525ce8ef49adafe8284606ceb307afa2ca5b"],
  ["LTC", "6e3f3fa8253588df9326580180233eb791e03b443a3ba7a1d892e73874e19a54"],
  ["BCH", "3dd2b63686a450ec7290df3a1e0b583c0481f651351edfa7636f39aed55cf8a3"],
  ["UNI", "78d185a741d07edb3412b09008b7c5cfb9bbbd7d568bf00ba737b456ba171501"],
  ["AAVE", "2b9ab1e972a281585084148ba1389800799bd4be63b957507db1349314e47445"],
  ["SUI", "23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744"],
  ["ATOM", "b00b60f88b03a6a625a8d1c048c3f66653edf217439983d037e7222c4e612819"],
  ["NEAR", "c415de8d2eba7db216527dff4b60e8f3a5311c740dadb233e13e12547e226750"],
  ["ETC", "7f5cc8d963fc5b3d2ae41fe5685ada89fd4f14b435f8050f28c7fd409f40c2d8"],
  ["XLM", "b7a8eba68a997cd0210c2e1e4ee811ad2d174b3611c22d9ebf16f4cb7e9ba850"],
  ["HBAR", "3728e591097635310e6341af53db8b7ee42da9b3a8d918f9463ce9cca886dfbd"],
  ["SHIB", "f0d57deca57b3da2fe63a493f4c25925fdfd8edf834b20f93e1f84dbd1504d4a"],
];
const requestedSymbols = process.env.PAPER_MARKET_SYMBOLS?.split(",")
  .map((symbol) => symbol.trim().toUpperCase())
  .filter(Boolean);
const SELECTED_MARKETS = requestedSymbols
  ? MARKETS.filter(([symbol]) => requestedSymbols.includes(symbol))
  : MARKETS;
if (
  SELECTED_MARKETS.length === 0 ||
  (requestedSymbols && SELECTED_MARKETS.length !== requestedSymbols.length)
) {
  throw new Error(
    "PAPER_MARKET_SYMBOLS must contain one or more supported symbols, such as SOL or SOL,BTC."
  );
}
const SEND = process.argv.includes("--send");
const discriminator = createHash("sha256")
  .update("global:configure_paper_market")
  .digest()
  .subarray(0, 8);

function marketPda(asset) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("paper-market"), Buffer.from([asset])],
    PROGRAM_ID
  )[0];
}
function instruction(admin, asset, feed) {
  const market = marketPda(asset);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: admin, isSigner: true, isWritable: true },
      { pubkey: EXCHANGE, isSigner: false, isWritable: false },
      { pubkey: market, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([
      discriminator,
      Buffer.from([asset]),
      Buffer.from(feed, "hex"),
    ]),
  });
}

console.log(
  `cluster: devnet (${RPC_URL})\nprogram: ${PROGRAM_ID}\nexchange: ${EXCHANGE}`
);
if (!SEND) {
  for (const [symbol, feed] of SELECTED_MARKETS) {
    const asset = MARKETS.findIndex(([candidate]) => candidate === symbol);
    console.log(
      `${asset.toString().padStart(2, "0")} ${symbol.padEnd(4)} ${marketPda(asset)} ${feed}`
    );
  }
  console.log(
    "Dry run only. Set PAPER_ADMIN_KEYPAIR and rerun with --send to simulate and register these immutable mappings."
  );
  process.exit(0);
}

const keypairPath = process.env.PAPER_ADMIN_KEYPAIR;
if (!keypairPath)
  throw new Error(
    "PAPER_ADMIN_KEYPAIR must point to the authorized devnet admin keypair JSON file."
  );
const admin = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(await readFile(keypairPath, "utf8")))
);
const connection = new Connection(RPC_URL, "confirmed");
const exchangeInfo = await connection.getAccountInfo(EXCHANGE, "confirmed");
if (!exchangeInfo || !exchangeInfo.owner.equals(PROGRAM_ID))
  throw new Error(
    "PaperExchange PDA is missing or not owned by the configured program."
  );
for (const [symbol, feed] of SELECTED_MARKETS) {
  const asset = MARKETS.findIndex(([candidate]) => candidate === symbol);
  const market = marketPda(asset);
  const existing = await connection.getAccountInfo(market, "confirmed");
  if (existing) {
    if (
      !existing.owner.equals(PROGRAM_ID) ||
      !existing.data.subarray(9, 41).equals(Buffer.from(feed, "hex"))
    )
      throw new Error(
        `${symbol} market already exists with a different owner or feed; refusing to overwrite.`
      );
    console.log(`${symbol}: already registered (${market})`);
    continue;
  }
  const transaction = new Transaction().add(
    instruction(admin.publicKey, asset, feed)
  );
  transaction.feePayer = admin.publicKey;
  transaction.recentBlockhash = (
    await connection.getLatestBlockhash("confirmed")
  ).blockhash;
  const simulation = await connection.simulateTransaction(transaction, [admin]);
  if (simulation.value.err)
    throw new Error(
      `${symbol} simulation failed: ${JSON.stringify(simulation.value.err)}\n${simulation.value.logs?.join("\n") ?? ""}`
    );
  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [admin],
    { commitment: "confirmed" }
  );
  console.log(`${symbol}: ${signature}`);
}
