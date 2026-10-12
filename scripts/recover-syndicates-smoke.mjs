#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import * as anchor from "@coral-xyz/anchor";
import BN from "bn.js";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

const BASE_RPC = "https://api.devnet.solana.com";
const ROUTER = "https://devnet-router.magicblock.app/";
const PROGRAM_ID = new PublicKey(
  "HPNkzwiFHbWtCJLRhp7oKE1iHttjxCWvDsjtNHT9o1ZM"
);
const MAGIC_PROGRAM = new PublicKey(
  "Magic11111111111111111111111111111111111111"
);
const MAGIC_CONTEXT = new PublicKey(
  "MagicContext1111111111111111111111111111111"
);
const TOKEN_PROGRAM = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);
const keypairPath = process.env.SYNDICATES_ADMIN_KEYPAIR;
if (!keypairPath) throw new Error("SYNDICATES_ADMIN_KEYPAIR is required.");
const authority = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(await readFile(keypairPath, "utf8")))
);
const wallet = new anchor.Wallet(authority);
const base = new Connection(BASE_RPC, "confirmed");
const idl = JSON.parse(
  await readFile("anchor/target/idl/forge_syndicates.json", "utf8")
);
const baseProvider = new anchor.AnchorProvider(base, wallet, {
  commitment: "confirmed",
  preflightCommitment: "confirmed",
});
const baseProgram = new anchor.Program(idl, baseProvider);
const pda = (seeds) => PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];
const nonce = new BN(2_026_101_201);
const sessionNonce = new BN(1);
const config = pda([Buffer.from("syndicate-config")]);
const mint = pda([Buffer.from("fusd-mint")]);
const syndicate = pda([
  Buffer.from("syndicate"),
  authority.publicKey.toBuffer(),
  nonce.toArrayLike(Buffer, "le", 8),
]);
const session = pda([
  Buffer.from("syndicate-session"),
  syndicate.toBuffer(),
  sessionNonce.toArrayLike(Buffer, "le", 8),
]);
const vault = PublicKey.findProgramAddressSync(
  [syndicate.toBuffer(), TOKEN_PROGRAM.toBuffer(), mint.toBuffer()],
  new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
)[0];
const traderAta = PublicKey.findProgramAddressSync(
  [authority.publicKey.toBuffer(), TOKEN_PROGRAM.toBuffer(), mint.toBuffer()],
  new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
)[0];
const receipt = pda([Buffer.from("settlement"), session.toBuffer()]);
const routerResponse = await fetch(ROUTER, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "getDelegationStatus",
    params: [session.toBase58()],
  }),
});
const status = (await routerResponse.json()).result;
if (!status?.isDelegated || !status.fqdn) {
  throw new Error("Smoke session is not delegated.");
}
const erUrl = status.fqdn.includes("://")
  ? status.fqdn
  : `https://${status.fqdn}`;
const er = new Connection(erUrl, "confirmed");
const erProvider = new anchor.AnchorProvider(er, wallet, {
  commitment: "confirmed",
  preflightCommitment: "confirmed",
});
const erProgram = new anchor.Program(idl, erProvider);
const expire = await erProgram.methods
  .expireSession()
  .accounts({ session })
  .rpc({ skipPreflight: false });
console.log(`Manual recovery expiry: ${expire}`);
const finalize = await erProgram.methods
  .finalizeSession()
  .accounts({
    payer: authority.publicKey,
    session,
    magicContext: MAGIC_CONTEXT,
    magicProgram: MAGIC_PROGRAM,
  })
  .rpc({ skipPreflight: false });
console.log(`Commit and undelegate: ${finalize}`);
const started = Date.now();
while (Date.now() - started < 120_000) {
  const info = await base.getAccountInfo(session, "confirmed");
  if (info?.owner.equals(PROGRAM_ID)) break;
  await new Promise((resolve) => setTimeout(resolve, 2_000));
}
const info = await base.getAccountInfo(session, "confirmed");
if (!info?.owner.equals(PROGRAM_ID)) {
  throw new Error("Session did not return to the base program.");
}
const settle = await baseProgram.methods
  .settleSession()
  .accounts({
    payer: authority.publicKey,
    config,
    fusdMint: mint,
    syndicate,
    trader: authority.publicKey,
    session,
    vault,
    traderAta,
    receipt,
    tokenProgram: TOKEN_PROGRAM,
  })
  .rpc({ skipPreflight: false });
console.log(`Settled recovery: ${settle}`);
