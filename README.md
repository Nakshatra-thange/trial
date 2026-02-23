A decentralized token launchpad on Solana with bonding curve mechanics. Create and trade tokens with zero upfront liquidity.

1 ] Overview
Moonshot is a permissionless token launchpad that enables anyone to create SPL tokens without requiring upfront liquidity. Built on Solana, it uses a bonding curve mechanism where token prices automatically adjust based on supply and demand.

2 ] Key Features

Instant Token Creation - Launch tokens in under 2 minutes

Automated Pricing - Bonding curve adjusts prices automatically

No Rug Pulls - Liquidity locked in smart contract

Gas Efficient - ~0.02 SOL per token creation

IPFS Metadata - Decentralized storage

Fair Launch - Pure market discovery, no pre-sales

3 ] Bonding Curve Mechanics
Uses constant product formula: virtual_sol × virtual_token = k

Initial reserves: 30 SOL virtual, 1.073B tokens
Graduation: 85 SOL raised
Platform fee: 1%

4 ] Tech Stack
Contract: Rust + Anchor
Backend: Bun + Hono + PostgreSQL
Frontend: React + TypeScript + TailwindCSS
Infrastructure: Railway + Vercel + Neon

5 ] Performance Metrics

Transaction time: ~400ms
API response: <100ms
Contract size: 127KB
Gas per trade: ~0.00001 SOL

6 ] Quick Start

git clone https://github.com/yourusername/moonshot.git

6 ]  Install
cd be && bun install
cd fe && npm install

7 ] Deploy contract
anchor build && anchor deploy

8 ]  Run
bun run dev  # backend
npm run dev  # frontend

9 ] Roadmap

 Bonding curve trading
 Event indexing
 Raydium integration
 Social features
 Mobile app



10 ] Built on Solana