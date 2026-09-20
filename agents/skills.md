# Solana Agent Skills

> Foundation-maintained skills for AI agents building on Solana.
> Install any skill: `npx skills add <url>`

## Install All Skills

```
npx skills add https://github.com/solana-foundation/solana-dev-skill
```

## Skills

### Common Errors & Solutions
Diagnose and fix common errors encountered when building on Solana, including GLIBC issues, Anchor version conflicts, and RPC errors.
- **Category**: Reference

### Version Compatibility Matrix
Reference table for matching Anchor, Solana CLI, Rust, and Node.js versions to avoid toolchain conflicts.
- **Category**: Tooling

### Solana Runtime Concepts
How Solana's runtime actually works — rent as a deposit, Ed25519 keys and off-curve PDAs, entrypoint dispatch, on-chain cryptography, and the transaction wire format.
- **Category**: Skill

### Confidential Transfers
Implement private, encrypted token balances on Solana using the Token-2022 confidential transfers extension.
- **Category**: Tokens

### Frontend with Solana Kit
Build React and Next.js Solana apps with a Kit plugin client, Wallet Standard connection via @solana/kit-plugin-wallet (+ its React hooks), and @solana/react client bindings.
- **Category**: Skill

### IDL & Client Code Generation
Generate type-safe program clients from IDLs using Codama, eliminating hand-maintained serializers across languages.
- **Category**: Tooling

### Kit ↔ web3.js Interop
How to handle legacy web3.js code — web3.js v3 (Kit internals, currently RC) is the migration target; defer migration mechanics to the official migration skill.
- **Category**: Tooling

### Payments & Commerce
Build checkout flows, payment buttons, and QR-based payment requests using Solana Pay conventions, Kit instruction builders, and Kora for gasless flows.
- **Category**: Payments

### Curated Resources
Authoritative Solana learning platforms, documentation, tooling references, and community resources.
- **Category**: Reference

### rpc-quick-lookups

- **Category**: Skill

### Security Checklist
Program and client security checklist covering account validation, signer checks, and common attack vectors to review before deploying.
- **Category**: Security

### Testing Strategy
A testing pyramid for Solana programs using LiteSVM and Mollusk for fast unit tests and Surfpool (CLI or embedded SDK) as the integration-testing centerpiece, with mainnet forking, cheatcodes, and CI patterns.
- **Category**: Testing

### Transaction v1 (SIMD-0385 / SIMD-0296)
The v1 transaction format that raises the size limit to 4096 bytes — how to check activation status, read and index v1 transactions without breaking, and build and send them with @solana/kit 8 or the Rust 4.2 crates.
- **Category**: Skill