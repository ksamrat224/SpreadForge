#!/usr/bin/env node
/**
 * Initializes the Forge Syndicates config and classic SPL fUSD mint.
 * Default mode is read-only. --send simulates, then submits only on success.
 */
import { readFile } from "node:fs/promises";
import {
  Connection,
  Keypair,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

const PROGRAM_ID = new PublicKey(
  process.env.SYNDICATES_PROGRAM_ID ??
    process.env.NEXT_PUBLIC_FORGE_SYNDICATES_PROGRAM_ID ??
    "HPNkzwiFHbWtCJLRhp7oKE1iHttjxCWvDsjtNHT9o1ZM"
);
const RPC_URL =
  process.env.SYNDICATES_RPC_URL ??
  process.env.NEXT_PUBLIC_MAGICBLOCK_BASE_RPC_URL ??
  "https://rpc.magicblock.app/devnet";
const TOKEN_PROGRAM = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);
const SOL_FEED =
  "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
const ETH_FEED =
  "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";
const DISCRIMINATOR = Buffer.from([208, 127, 21, 1, 194, 190, 196, 70]);
const SEND = process.argv.includes("--send");

const [config] = PublicKey.findProgramAddressSync(
  [Buffer.from("syndicate-config")],
  PROGRAM_ID
);
const [mint] = PublicKey.findProgramAddressSync(
  [Buffer.from("fusd-mint")],
  PROGRAM_ID
);

console.log(`cluster: devnet (${RPC_URL})`);
console.log(`program: ${PROGRAM_ID}`);
console.log(`config: ${config}`);
console.log(`fUSD mint: ${mint}`);
console.log(`SOL/USD feed: ${SOL_FEED}`);
console.log(`ETH/USD feed: ${ETH_FEED}`);

if (!SEND) {
  console.log(
    "Dry run only. Set SYNDICATES_ADMIN_KEYPAIR and rerun with --send to simulate and initialize."
  );
  process.exit(0);
}

const keypairPath = process.env.SYNDICATES_ADMIN_KEYPAIR;
if (!keypairPath) {
  throw new Error(
    "SYNDICATES_ADMIN_KEYPAIR must point to the devnet admin keypair JSON file."
  );
}
const admin = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(await readFile(keypairPath, "utf8")))
);
const connection = new Connection(RPC_URL, "confirmed");
const programInfo = await connection.getAccountInfo(PROGRAM_ID, "confirmed");
if (!programInfo?.executable) {
  throw new Error("Deploy the Forge Syndicates program before initialization.");
}
const existing = await connection.getAccountInfo(config, "confirmed");
if (existing) {
  if (!existing.owner.equals(PROGRAM_ID)) {
    throw new Error("Config PDA exists under an unexpected owner.");
  }
  console.log("Forge Syndicates is already initialized; no transaction sent.");
  process.exit(0);
}

const instruction = new TransactionInstruction({
  programId: PROGRAM_ID,
  keys: [
    { pubkey: admin.publicKey, isSigner: true, isWritable: true },
    { pubkey: config, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ],
  data: Buffer.concat([
    DISCRIMINATOR,
    Buffer.from(SOL_FEED, "hex"),
    Buffer.from(ETH_FEED, "hex"),
  ]),
});
const latest = await connection.getLatestBlockhash("confirmed");
const transaction = new Transaction({
  feePayer: admin.publicKey,
  recentBlockhash: latest.blockhash,
}).add(instruction);
const simulation = await connection.simulateTransaction(transaction, [admin]);
if (simulation.value.err) {
  throw new Error(
    `Initialization simulation failed: ${JSON.stringify(simulation.value.err)}\n${simulation.value.logs?.join("\n") ?? ""}`
  );
}
console.log("Simulation passed.");
const signature = await sendAndConfirmTransaction(
  connection,
  transaction,
  [admin],
  { commitment: "confirmed", preflightCommitment: "confirmed" }
);
console.log(`Initialized: ${signature}`);
