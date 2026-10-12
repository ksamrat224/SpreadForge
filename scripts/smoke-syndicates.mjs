#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import * as anchor from "@coral-xyz/anchor";
import BN from "bn.js";
import { SessionTokenManager } from "@magicblock-labs/gum-sdk";
import { HermesClient } from "@pythnetwork/hermes-client";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import { sendTransactions } from "@pythnetwork/solana-utils";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";

const BASE_RPC =
  process.env.SYNDICATES_RPC_URL ?? "https://rpc.magicblock.app/devnet";
const ROUTER =
  process.env.NEXT_PUBLIC_MAGICBLOCK_ROUTER_URL ??
  "https://devnet-router.magicblock.app/";
const PROGRAM_ID = new PublicKey(
  process.env.SYNDICATES_PROGRAM_ID ??
    process.env.NEXT_PUBLIC_FORGE_SYNDICATES_PROGRAM_ID ??
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
const ASSOCIATED_TOKEN_PROGRAM = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);
const SOL_FEED =
  "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
const SOL_PRICE_UPDATE = new PublicKey(
  "7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE"
);
const SMOKE_NONCE = new BN(2_026_101_201);
const SESSION_NONCE = new BN(
  process.env.SYNDICATES_SMOKE_SESSION_NONCE ?? "2"
);
const FUNDING_MICRO = new BN(1_000_000_000);

const keypairPath = process.env.SYNDICATES_ADMIN_KEYPAIR;
if (!keypairPath) {
  throw new Error("SYNDICATES_ADMIN_KEYPAIR must point to a devnet keypair.");
}
const authority = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(await readFile(keypairPath, "utf8")))
);
const base = new Connection(BASE_RPC, "confirmed");
const wallet = new anchor.Wallet(authority);
const baseProvider = new anchor.AnchorProvider(base, wallet, {
  commitment: "confirmed",
  preflightCommitment: "confirmed",
  skipPreflight: false,
});
const idl = JSON.parse(
  await readFile("anchor/target/idl/forge_syndicates.json", "utf8")
);
const baseProgram = new anchor.Program(idl, baseProvider);

const pda = (seeds) => PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];
const config = pda([Buffer.from("syndicate-config")]);
const mint = pda([Buffer.from("fusd-mint")]);
const faucetReceipt = pda([
  Buffer.from("faucet"),
  authority.publicKey.toBuffer(),
]);
const syndicate = pda([
  Buffer.from("syndicate"),
  authority.publicKey.toBuffer(),
  SMOKE_NONCE.toArrayLike(Buffer, "le", 8),
]);
const session = pda([
  Buffer.from("syndicate-session"),
  syndicate.toBuffer(),
  SESSION_NONCE.toArrayLike(Buffer, "le", 8),
]);
const crankTaskBytes = createHash("sha256")
  .update(PROGRAM_ID.toBuffer())
  .update(session.toBuffer())
  .update(authority.publicKey.toBuffer())
  .digest()
  .subarray(0, 8);
// MagicBlock's scheduler accepts a signed i64 task ID. Clearing the sign bit
// keeps the deterministic, session-specific identifier in the positive range.
crankTaskBytes[7] &= 0x7f;
const CRANK_TASK_ID = new BN(crankTaskBytes, "le");
const member = pda([
  Buffer.from("member"),
  syndicate.toBuffer(),
  authority.publicKey.toBuffer(),
]);
const settlementReceipt = pda([Buffer.from("settlement"), session.toBuffer()]);
const ata = (owner) =>
  PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM
  )[0];
const authorityAta = ata(authority.publicKey);
const vault = ata(syndicate);

function logStep(label, value) {
  console.log(
    `${new Date().toISOString()} ${label}${value ? `: ${value}` : ""}`
  );
}

async function sendBase(label, builder, signers = []) {
  const transaction = await builder.transaction();
  const simulation = await base.simulateTransaction(transaction, [
    authority,
    ...signers,
  ]);
  if (simulation.value.err) {
    throw new Error(
      `${label} simulation failed: ${JSON.stringify(simulation.value.err)}\n${simulation.value.logs?.join("\n") ?? ""}`
    );
  }
  const signature = await baseProvider.sendAndConfirm(transaction, signers, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
    skipPreflight: false,
  });
  logStep(label, signature);
  return signature;
}

async function delegationStatus() {
  const response = await fetch(ROUTER, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getDelegationStatus",
      params: [session.toBase58()],
    }),
  });
  const body = await response.json();
  if (!response.ok || body.error) {
    throw new Error(body.error?.message ?? `Router HTTP ${response.status}`);
  }
  return body.result;
}

async function poll(label, read, accept, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await read();
    if (accept(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`${label} timed out after ${timeoutMs / 1_000}s.`);
}

async function pushSolPrice() {
  const hermes = new HermesClient(
    process.env.PYTH_HERMES_URL ?? "https://pyth.dourolabs.app/hermes",
    process.env.PYTH_HERMES_API_KEY
      ? { accessToken: process.env.PYTH_HERMES_API_KEY }
      : undefined
  );
  const receiver = new PythSolanaReceiver({ connection: base, wallet });
  const updates = await hermes.getLatestPriceUpdates([SOL_FEED], {
    encoding: "base64",
    parsed: true,
  });
  const builder = receiver.newTransactionBuilder({});
  await builder.addUpdatePriceFeed(updates.binary.data, 0);
  const signatures = await sendTransactions(
    await builder.buildVersionedTransactions({
      computeUnitPriceMicroLamports: 0,
      tightComputeBudget: true,
    }),
    base,
    wallet
  );
  logStep("Pyth SOL update", signatures.join(","));
  const price = updates.parsed?.[0]?.price;
  if (!price) throw new Error("Hermes returned no parsed SOL price.");
  const priceMicro =
    (BigInt(price.price) * 1_000_000n) / 10n ** BigInt(-price.expo);
  return priceMicro;
}

logStep("Authority", authority.publicKey.toBase58());
logStep("Syndicate", syndicate.toBase58());
logStep("Session", session.toBase58());

if (!(await base.getAccountInfo(faucetReceipt))) {
  await sendBase(
    "Claimed fUSD",
    baseProgram.methods.claimFusd().accounts({
      authority: authority.publicKey,
      config,
      fusdMint: mint,
      receipt: faucetReceipt,
      recipientAta: authorityAta,
      tokenProgram: TOKEN_PROGRAM,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM,
      systemProgram: SystemProgram.programId,
    })
  );
} else logStep("Claimed fUSD", "already complete");

if (!(await base.getAccountInfo(syndicate))) {
  const name = Buffer.alloc(32);
  name.write("Devnet Smoke Forge");
  await sendBase(
    "Created syndicate",
    baseProgram.methods.createSyndicate(SMOKE_NONCE, [...name]).accounts({
      trader: authority.publicKey,
      config,
      fusdMint: mint,
      syndicate,
      vault,
      tokenProgram: TOKEN_PROGRAM,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM,
      systemProgram: SystemProgram.programId,
    })
  );
} else logStep("Created syndicate", "already complete");

if (!(await base.getAccountInfo(member))) {
  await sendBase(
    "Deposited 1,000 fUSD",
    baseProgram.methods.deposit(FUNDING_MICRO).accounts({
      depositor: authority.publicKey,
      syndicate,
      member,
      depositorAta: authorityAta,
      vault,
      tokenProgram: TOKEN_PROGRAM,
      systemProgram: SystemProgram.programId,
    })
  );
} else logStep("Deposited 1,000 fUSD", "already complete");

const sessionSigner = Keypair.generate();
const sessionManager = new SessionTokenManager(wallet, base);
const [sessionToken] = PublicKey.findProgramAddressSync(
  [
    Buffer.from("session_token_v2"),
    PROGRAM_ID.toBuffer(),
    sessionSigner.publicKey.toBuffer(),
    authority.publicKey.toBuffer(),
  ],
  sessionManager.program.programId
);
await sendBase(
  "Created SessionTokenV2",
  sessionManager.program.methods
    .createSessionV2(
      false,
      new BN(Math.floor(Date.now() / 1_000) + 900),
      null
    )
    .accounts({
      sessionToken,
      sessionSigner: sessionSigner.publicKey,
      feePayer: authority.publicKey,
      authority: authority.publicKey,
      targetProgram: PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    }),
  [sessionSigner]
);

if (!(await base.getAccountInfo(session))) {
  await sendBase(
    "Started session",
    baseProgram.methods
      .startSession({ nonce: SESSION_NONCE, crankTaskId: CRANK_TASK_ID })
      .accounts({
        trader: authority.publicKey,
        syndicate,
        config,
        vault,
        session,
        systemProgram: SystemProgram.programId,
      })
  );
  await sendBase(
    "Delegated session",
    baseProgram.methods.delegateSession(SESSION_NONCE).accounts({
      trader: authority.publicKey,
      syndicate,
      session,
    })
  );
}

const delegated = await poll(
  "router delegation",
  delegationStatus,
  (value) => value?.isDelegated === true && typeof value.fqdn === "string",
  90_000
);
const erUrl = delegated.fqdn.includes("://")
  ? delegated.fqdn
  : `https://${delegated.fqdn}`;
logStep("Router-selected ER", erUrl);
const er = new Connection(erUrl, "confirmed");
const erWallet = new anchor.Wallet(sessionSigner);
const erProvider = new anchor.AnchorProvider(er, erWallet, {
  commitment: "confirmed",
  preflightCommitment: "confirmed",
  skipPreflight: false,
});
const erProgram = new anchor.Program(idl, erProvider);

const scheduleSignature = await erProgram.methods
  .scheduleExpiry(SESSION_NONCE)
  .accounts({
    magicProgram: MAGIC_PROGRAM,
    payer: sessionSigner.publicKey,
    session,
  })
  .rpc({ skipPreflight: false });
logStep("Expiry crank accepted", scheduleSignature);

const priceMicro = await pushSolPrice();
await poll(
  "SOL price visibility on ER",
  () => er.getAccountInfo(SOL_PRICE_UPDATE),
  (value) => value !== null,
  60_000
);
const quantityMicro = (10_000_000n * 1_000_000n) / priceMicro;
const tradeSignature = await erProgram.methods
  .trade({
    asset: 0,
    side: 0,
    quantityMicro: new BN(quantityMicro.toString()),
    expectedPriceMicro: new BN(priceMicro.toString()),
    maxSlippageBps: 100,
  })
  .accounts({
    actor: sessionSigner.publicKey,
    session,
    priceUpdate: SOL_PRICE_UPDATE,
    sessionToken,
  })
  .rpc({ skipPreflight: false });
logStep("Session-key SOL trade", tradeSignature);

logStep("Waiting for expiry crank", "up to 11 minutes");
await poll(
  "expiry crank",
  () => erProgram.account.syndicateSession.fetch(session),
  (value) => value.status === 2,
  660_000
);
logStep("Expiry crank observed", "session frozen");

const finalizeSignature = await erProgram.methods
  .finalizeSession()
  .accounts({
    payer: sessionSigner.publicKey,
    session,
    magicContext: MAGIC_CONTEXT,
    magicProgram: MAGIC_PROGRAM,
  })
  .rpc({ skipPreflight: false });
logStep("Commit and undelegate accepted", finalizeSignature);

await poll(
  "base-layer return",
  () => base.getAccountInfo(session, "confirmed"),
  (value) => value?.owner.equals(PROGRAM_ID) === true,
  120_000
);
await sendBase(
  "Settled session",
  baseProgram.methods.settleSession().accounts({
    payer: authority.publicKey,
    config,
    fusdMint: mint,
    syndicate,
    trader: authority.publicKey,
    session,
    vault,
    traderAta: authorityAta,
    receipt: settlementReceipt,
    tokenProgram: TOKEN_PROGRAM,
    systemProgram: SystemProgram.programId,
  })
);

const finalSyndicate = await baseProgram.account.syndicate.fetch(syndicate);
const receipt =
  await baseProgram.account.settlementReceipt.fetch(settlementReceipt);
if (finalSyndicate.status !== 0 || !receipt.session.equals(session)) {
  throw new Error("Settlement assertions failed.");
}
logStep("SMOKE TEST PASSED", settlementReceipt.toBase58());
