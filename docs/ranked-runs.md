# Ranked-run devnet release

Strategy Lab has no browser-simulated fallback. It requires both
`NEXT_PUBLIC_MAGICBLOCK_ENABLED=true` and
`NEXT_PUBLIC_RANKED_RUNS_ENABLED=true`. The devnet program upgrade and live
smoke test have passed; enable both flags in a rebuilt devnet frontend.

## Transaction boundaries

1. The wallet approves one base-layer devnet transaction: create the
   `RankedRun` PDA, delegate it, and transfer 1,000,000 devnet lamports to the
   temporary session signer. The wallet also pays account rent and transaction
   fees. No real trading tokens move.
2. The router resolves the ER for that PDA. The scoped signer sends 60
   `advance_ranked_run` transactions and one `finalize_ranked_run` transaction
   to that ER.
3. The finalizer commits and undelegates the account. The UI waits for the
   base RPC to return a program-owned, schema-v1, settled account with tick 60.
   Only then does it display a score. The leaderboard scans only such accounts.

The signer is intentionally kept only in browser memory. If a tab closes or a
transaction fails after delegation, the run may need manual recovery. Do not
advertise reliable resume or automatic fee recovery yet. The 1,000,000-lamport
funding transfer was verified on the router-selected ER in the live smoke test.

## Verified devnet deployment

Program `2EXN7tmfAekEn2Noq8j8AkVx9bTi96zuakHUKSsW4u9w` was upgraded at
slot `509948068`; the deployed binary matches SHA-256
`c7f20d5f0810992e9520d966f99414e55d378a48922620aec5ecbf0e927258f8`.
A fresh run at PDA `ERkmWJ2nTQAGBffhP5ctJNcT1PkPzaaPyuUhREL1xmMw`
completed 60 scoped-signer ticks, finalized, and settled on base devnet with
score `9425`. The strategy leaderboard read both this run and the earlier
recovered run from program accounts. No real trading tokens moved.

## Upgrade review

Before signing an upgrade, check the program ID and authority with
`solana program show <program-id> --url devnet`, build with
`npm run anchor-build`, run `cd anchor && cargo test`, and record the SHA-256
of `anchor/target/deploy/result_registry.so`. Review the exact binary and
account-layout changes. An upgrade is a signed, externally visible operation;
do not run it without the authority holder's explicit approval.

## Smoke test after upgrade

1. With the feature flag still off, verify the upgraded program ID and binary
   deployment slot on devnet.
2. Use a dedicated devnet wallet with enough SOL to cover PDA rent, delegation
   deposits, the 1,000,000-lamport signer transfer, and fees. Simulate the start
   transaction and review its accounts before signing.
3. Start one Stable Market run and confirm the PDA is delegated according to
   `getDelegationStatus`; record the router-selected FQDN.
4. On that ER, check the temporary signer balance and confirm each tick is
   sequential through tick 60. If the signer cannot pay, stop and diagnose the
   ER funding path rather than enabling the feature for users.
5. Finalize, then verify the PDA is again owned by the registry program on
   base-layer devnet, with `status=2`, `tick=60`, `schemaVersion=1`, and a
   nonzero `finalizedAt`.
6. Confirm the strategy leaderboard shows that run with the same score and
   excludes legacy self-reported `ResultRecord` accounts. Confirm paper
   trading and its leaderboard still work.
7. Only after all steps pass, set `NEXT_PUBLIC_RANKED_RUNS_ENABLED=true` in
   the frontend deployment and rebuild. A public env-var change alone does not
   update an already-built Next.js client bundle.

If a future deployment fails the smoke test, leave the flag off. Strategy Lab
will not start runs until the issue is resolved; it never falls back to
browser-simulated execution.
