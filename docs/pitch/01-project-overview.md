# Project Overview

## What is SpreadForge?

SpreadForge is an educational trading application built on Solana devnet. It lets users:

- Run market-making strategy challenges
- Paper trade 20 crypto assets
- Understand portfolio performance
- Compare verified results on leaderboards
- Create and back simulated social-trading pools

No real assets are traded. Devnet SOL is used only for transaction fees and account rent.

## The problem

Trading tools often have one of these weaknesses:

- Learning content is passive.
- Simulations are not connected to live market context.
- Results are calculated privately and are difficult to verify.
- Social trading asks users to trust a trader or centralized platform.

## The solution

SpreadForge combines learning, simulation, and verifiable results in one product.

| User need                      | SpreadForge feature |
| ------------------------------ | ------------------- |
| Learn how market making works  | Strategy Lab        |
| Practice buying and selling    | Paper Trading       |
| Understand gains and risk      | Portfolio           |
| Compare performance fairly     | Leaderboard         |
| Experiment with social trading | Forge Syndicates    |

## Why Solana?

Solana gives the application durable and publicly inspectable accounts. A user's paper portfolio and final challenge result do not depend only on browser memory or a private database.

## Why MagicBlock?

Trading sessions contain many fast state updates. MagicBlock lets SpreadForge execute those repeated updates on an Ephemeral Rollup and return the final state to Solana devnet for durable settlement.

## What to say during the pitch

> We are not putting a trading interface on-chain just for the label. We use Solana where durable ownership and verification matter, and MagicBlock where repeated low-latency interactions matter.

## Current stage

- The core product runs on devnet.
- Ranked runs, paper portfolios, and leaderboards are implemented.
- The Forge Syndicates program is deployed, initialized, and smoke-tested.
- The current Syndicates UI supports discovery, faucet claims, creation, and backing.
- Full trader-session and withdrawal controls are the next Syndicates UI milestone.
