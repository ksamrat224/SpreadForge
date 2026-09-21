# SpreadForge — Complete UI/UX Design & Architecture Specification

> **Purpose:** This specification provides the complete visual design system, interaction architecture, responsive layout rules, color tokens, animations, and component contracts needed to rebuild the **SpreadForge** web application with 1:1 precision using modern React, Tailwind CSS v4, and Tabler Icons.

---

## 1. Brand Identity & Design Language

### 1.1 Brand Concept
- **Product Name:** `SpreadForge`
- **Subheading / Tagline:** `Learn. Simulate. Compete. · Solana DeFi Market-Making Laboratory`
- **Aesthetic:** High-performance quantitative trading terminal meets futuristic Solana DeFi. Clean obsidian glass surfaces, crisp monospace telemetry, high-contrast neon accents, glowing state dots, and smooth micro-interactions.
- **Visual Influence:** Hyperliquid, Drift Protocol, Jupiter Exchange, Origin UI, and Bloomberg terminal typography.

### 1.2 Iconography & Brand Mark
- **Forge Brand Mark (`ForgeMark`):**
  - Outer: 34×34px Hexagon (`IconHexagon`, stroke width 1.4) in primary neon mint/cyan.
  - Inner: Centered flame icon (`IconFlame`, stroke width 2, size 15px) positioned absolute.
  - Animation: `forge-pulse 2.8s infinite` applying drop-shadow filters from 4px to 12px neon bloom.
- **Icon Library:** `@tabler/icons-react` (icons used: `IconFlame`, `IconActivity`, `IconTrophy`, `IconCode`, `IconBolt`, `IconWallet`, `IconChevronDown`, `IconSun`, `IconPlayerPlay`, `IconPlayerPause`, `IconRefresh`, `IconSettings`, `IconBrandDatabricks`, `IconTerminal2`, `IconArrowUpRight`, `IconArrowDownRight`, `IconCrown`, `IconGauge`, `IconCircleCheckFilled`, `IconShieldCheck`, `IconCopy`, `IconRocket`, `IconHistory`, `IconCheck`, `IconBrandGithub`).

---

## 2. Typography & Design Tokens

### 2.1 Fonts
```css
--font-sans: "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
--font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
```
- **Body & Headings:** `DM Sans` with letter-spacing 0 to tight tracking.
- **Telemetry, Figures, Prices, Codes & Timestamps:** `JetBrains Mono` for tabular alignment and quantitative readability.

### 2.2 Color System (OKLCH Format)

#### Dark Theme (Default / Primary Mode)
```css
:root, .dark {
  --radius: 0.45rem; /* 7.2px base corner radius */
  
  /* Core Surfaces */
  --background: oklch(0.12 0.025 235);         /* Deep obsidian midnight navy */
  --foreground: oklch(0.94 0.012 205);         /* Crisp off-white */
  --card: oklch(0.155 0.025 231);              /* Elevated panel surface */
  --card-foreground: oklch(0.984 0.003 247.8);
  --popover: oklch(0.208 0.042 265.7);
  --popover-foreground: oklch(0.984 0.003 247.8);

  /* Brand Accents */
  --primary: oklch(0.78 0.17 170);             /* Vibrant neon mint / electric cyan */
  --primary-foreground: oklch(0.12 0.025 215); /* Deep contrast text */
  --secondary: oklch(0.20 0.025 230);          /* Subtle inset surface */
  --secondary-foreground: oklch(0.984 0.003 247.8);
  --muted: oklch(0.19 0.022 230);
  --muted-foreground: oklch(0.65 0.025 220);   /* Soft slate gray */
  --accent: oklch(0.23 0.045 183);
  --accent-foreground: oklch(0.984 0.003 247.8);

  /* Semantic Trading Colors */
  --profit: oklch(0.75 0.16 167);              /* Solana mint green (Long / Bid / Profit) */
  --loss: oklch(0.70 0.19 24);                 /* Radiant crimson red (Short / Ask / Loss) */
  --warning: oklch(0.76 0.16 79);              /* Amber warning / Whale event */
  
  /* Borders & Inputs */
  --border: oklch(0.82 0.035 205 / 14%);
  --input: oklch(0.82 0.035 205 / 18%);
  --ring: oklch(0.78 0.17 170);
}
```

#### Light Theme
```css
:root:not(.dark) {
  --background: oklch(0.975 0.006 220);
  --foreground: oklch(0.20 0.03 242);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.129 0.042 264.7);
  --primary: oklch(0.67 0.17 171);
  --primary-foreground: oklch(0.12 0.03 210);
  --secondary: oklch(0.968 0.007 247.9);
  --secondary-foreground: oklch(0.208 0.042 265.8);
  --muted: oklch(0.968 0.007 247.9);
  --muted-foreground: oklch(0.554 0.046 257.4);
  --border: oklch(0.929 0.013 255.5);
}
```

### 2.3 Background Treatment & Grid
- **App Shell Grid:** Linear repeating background grid with 48px × 48px square cells:
  ```css
  background-image: 
    linear-gradient(color-mix(in oklab, var(--border) 32%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in oklab, var(--border) 24%, transparent) 1px, transparent 1px);
  background-size: 48px 48px;
  ```
- **Chart Grid:** 60px × 42px micro-grid behind SVG price lines at 36% opacity.

---

## 3. Persistent Header & Shell Navigation

### 3.1 Topbar Specifications
- **Height:** 64px, `position: sticky; top: 0; z-index: 40;`
- **Surface:** Glassmorphic blur (`backdrop-filter: blur(20px)`), background `color-mix(in oklab, var(--background) 88%, transparent)`, 1px bottom border `var(--border)`.
- **Layout:** Flex row with 22px padding and 22px gap.

#### Header Left:
- **Brand Clickable:**
  - `ForgeMark` icon with continuous glowing pulse.
  - Bold wordmark: `<span className="brand"><b>SPREAD</b>FORGE<em>LAB</em></span>`
  - `em` badge: 8px monospaced uppercase, primary border, 3px padding.

#### Header Center: Desktop Navigation
- 4 primary tabs:
  1. `Strategy Lab` (`IconFlame`)
  2. `Paper Trading` (`IconActivity`)
  3. `Leaderboard` (`IconTrophy`)
  4. `MagicBlock` (`IconCode`)
- Active style: Active bottom border (2px `var(--primary)`), text `var(--foreground)`, subtle primary glow background. Inactive: `var(--muted-foreground)` with hover state.

#### Header Right: Action Controls
1. **Challenges Drawer Trigger:** Ghost button with `IconBolt`, opens the challenge sheet.
2. **Cluster Selector:** Compact pill dropdown (`Devnet`, `Testnet`, `Mainnet`, `Localnet`) with animated glowing pulsing status dot.
3. **Theme Switcher:** 34×34px button toggling Dark (`IconSun`) and Light (`IconFlame`).
4. **Wallet Connect Button:**
   - Disconnected: Primary button with `IconWallet` and text `"Connect"`.
   - Connected: Bordered monospace chip showing formatted address `8xK4…v9Qp` and pulsing green live dot.

#### Mobile Bottom Bar:
- Fixed to viewport bottom on displays < 820px (`height: 58px; backdrop-filter: blur(18px); z-index: 50;`).
- 4 icon-only tab buttons distributing space equally.

---

## 4. Strategy Lab — Complete Architecture

The Strategy Lab is a 3-column real-time simulation workspace (`lab-grid` layout: `252px minmax(460px, 1fr) 242px`).

### 4.1 Top Context Banner
- **Eyebrow:** `ACTIVE CHALLENGE · BEGINNER / INTERMEDIATE / ADVANCED`
- **Heading:** Challenge title (e.g. `Whale Sell`, `Stable Market`, `Flash Crash & Recovery`)
- **Quant Tip:** Real-time strategic guidance with `IconBolt` (e.g., *"Build inventory headroom before the whale sell at tick 32."*)
- **Right telemetry:** `60 TICKS`, Volatility rating (`LOW`, `EVENT`, or `EXTREME`).
- **Styling:** Linear gradient with 34-degree decorative cyber slash line.

### 4.2 Left Panel: Quote & Risk Controls (`controls-panel`)
- **Panel Header:** Eyebrow `PARAMETERS`, Title `Quote & Risk`, settings icon.
- **Scenario Selector:** Native styled dropdown switching challenges.
- **Controls & Sliders:**
  1. **Spread Slider:** 10 to 100 bps (0.10% to 1.00%). Step 1 bps.
     - Includes live visual **Spread Gap Visualizer (`spread-viz`)**:
       - Green left label: `BID $XXX.XX`
       - Scalable center spacer `<i>` proportional to spread width
       - Red right label: `ASK $XXX.XX`
  2. **Order Size Slider:** 0.5 to 10.0 SOL (Step 0.5 SOL).
  3. **Max Inventory Slider:** 100 to 160 SOL (Step 1 SOL).
     - Includes visual **Headroom Bar (`headroom`)**: Linear gradient track showing current inventory percentage against cap.
  4. **Refresh Cycle Slider:** 1 to 10 ticks (Default 2 ticks).
  5. **Speed Multiplier (`segmented`):** `1×`, `2×`, `5×` speed buttons.
  6. **Simulation Action Buttons:**
     - Primary Button: `Start Challenge` (`IconPlayerPlay`), `Pause` (`IconPlayerPause`), or `Resume`.
     - Reset Button: `IconRefresh` icon button resetting state to tick 0.

### 4.3 Center Panel: Market Dynamic Visualizer
- **Market Header:**
  - Pair badge: Solana logo glyph `◎` in rounded 34px container.
  - Price display: Monospace large bold readout (e.g. `$146.820`).
  - 24H Price Change Badge: Green `+2.41%` or Crimson `−5.18%` with colored tint background.
  - High / Low 24H stats: Monospace `24H HIGH $149.32`, `24H LOW $138.71`.
- **Tick Progress Bar (`tick-row`):**
  - Left: Monospace `TICK xx / 60`
  - Center: Animated linear bar with neon glow `box-shadow: 0 0 8px var(--primary)`
  - Right: Monospace state text (`RUNNING`, `PAUSED`, `IDLE`, `COMPLETE`).
- **Interactive SVG Price Chart (`PriceChart`):**
  - Dimension: Responsive SVG `viewBox="0 0 720 210"`.
  - Gradient Area Fill: Linear gradient stopping from 28% opacity to 0% at bottom.
  - Midline: Dashed reference guide line at y=105.
  - Neon Price Polyline: 2px stroke `var(--primary)` with neon drop shadow.
  - Scenario Events: Vertical dashed amber line at Tick 32 (`WHALE SELL · T32`) with pulsing amber event dot.
  - Fill Dots: Green circles (`.buy`) and Red circles (`.sell`) at execution points with browser tooltip title.
  - Right Price Axis: 3-tier prices (Min, Mid, Max).
- **4-Metric Realtime HUD (`hud-grid`):**
  - `YOUR BID`: Monospace dollar quote (e.g. `$146.56`), subtext `xx bps below`.
  - `YOUR ASK`: Monospace dollar quote (e.g. `$147.08`), subtext `xx bps above`.
  - `TOTAL FILLS`: Total execution count, subtext `xx.x SOL volume`.
  - `INVENTORY`: Current holding (starts 100.0 SOL), subtext headroom, color turns red/bad when exceeding 90% of cap.
- **Lower Sub-Grid (`bottom-grid`):**
  - **Depth Ladder (`orderbook`):**
    - 3 Ask rows (Red prices, size in SOL, proportional red depth bars).
    - Center Mid-Market Row: Mark price banner with border.
    - 3 Bid rows (Green prices, size in SOL, proportional green depth bars).
  - **Live Terminal Feed (`terminal`):**
    - Live indicator with blinking green LED dot.
    - Rows with timestamp `xx:00:xx` and activity event text (Quote staged, fills, whale shock alert, inventory guard pauses).

### 4.4 Right Panel: Score & Risk Analytics (`score-column`)
- **Net Simulated P&L Card (`pnl-card`):**
  - Bold 25px monospace number with `+` or `−` sign.
  - Green for positive, Crimson for negative.
  - Return percentage indicator with `IconArrowUpRight`.
- **Radial Score Meter (`score-card`):**
  - 142px circular ring with conic gradient `--score: xx%` fill.
  - Inner card knockout creating clean donut gauge.
  - Center readouts: 24px bold score e.g. `9,184` + `/ 10,000`.
  - Tier badge: `DIAMOND PACE` (`IconCrown`).
- **Score Quality Breakdown (`breakdown`):**
  - 5 canonical weighted progress bars:
    1. Liquidity Uptime (30% weight) — Target: 90%+
    2. Spread Efficiency (25% weight) — Target: 80%+
    3. Inventory Control (20% weight) — Target: 85%+
    4. Drawdown Control (15% weight) — Target: 75%+
    5. Net P&L Contribution (10% weight) — Target: 80%+
- **Risk Grid (`risk-grid`):**
  - `MAX DRAWDOWN`: Percentage (e.g. `1.71%`, Sub: `Limit 8.00%`).
  - `VALUE AT RISK (VaR)`: Estimated 95% confidence dollar risk (e.g. `$25.12`).

---

## 5. Results & Completion Modal (`ResultsDialog`)

Triggered automatically at Tick 60.

- **Visual Aura:** Cyan/mint ambient blur glow (`result-glow`, 90px blur, 18% opacity) at modal top.
- **Header:**
  - Circular badge with `IconCrown`.
  - Eyebrow: `CHALLENGE COMPLETE`
  - Title: Performance tier title (e.g. `Diamond Market Maker`).
  - Subtitle: `{Scenario Name} · 60 ticks settled`.
- **Large Final Score:**
  - `FINAL SCORE` / `9,184` in 36px monospace / `/ 10,000`.
- **5 Score Dimension Bars:**
  - Liquidity uptime, Spread efficiency, Inventory control, Drawdown control, Net P&L.
- **Key Quant Lesson Callout (`lesson`):**
  - Actionable feedback based on run performance (e.g., *"Your quotes captured 86% of available spread while maintaining 91% inventory discipline. Widen 6–8 bps two ticks before the shock to reduce peak drawdown."*).
- **Solana Verification Flow:**
  - Clicking `Verify on Solana` triggers simulated cryptographic commitment:
    - Verified badge: `Verified on Solana Devnet`
    - Hashes: `ER: 5RtQ…mB7f · PDA: FgR7…QPda`
- **Actions:**
  - Primary button: `Run again` (`IconRefresh`).
  - Secondary button: `Verify on Solana` (`IconShieldCheck`).

---

## 6. Paper Trading Desk (`PaperDesk`)

Independent manual practice desk with simulated balances: **$1,500.00 USDC** and **10.00 SOL**.

### 6.1 Feed Banner & Portfolio Strip
- **Top Banner:** Eyebrow `SYNTHETIC PYTH FEED · 400MS`, Title `Paper Trading Desk`, `FEED LIVE` pulsing indicator.
- **Portfolio Strip:** 4 equal horizontal metric tiles:
  1. `SOL BALANCE`: `10.00 SOL` ($1,468.20 notional)
  2. `USDC BALANCE`: `$1,500.00`
  3. `PORTFOLIO VALUE`: `$2,968.20`
  4. `TOTAL P&L`: `+$0.00` (Realized / Unrealized)

### 6.2 Chart & Instant Market Orders
- **Interactive SOL/USD Chart:**
  - Pair info + 24H change.
  - Timeframe selector buttons: `1M`, `5M`, `15M`, `1H`, `4H`.
  - Area SVG chart with responsive curves.
- **Instant Execution Buttons (`quick-trade`):**
  - Green Button: `Buy 1 SOL $146.82` (`IconArrowUpRight`)
  - Red Button: `Sell 1 SOL $146.82` (`IconArrowDownRight`)
  - Triggers instant Sonner toast notification with fill price.

### 6.3 Limit Quote Entry Form (`quote-form`)
- Eyebrow: `ORDER ENTRY`, Title: `Limit Quote`.
- Side toggle: Segmented `BUY` (mint) and `SELL` (crimson) tabs.
- Inputs with suffix units:
  - `Limit price` input with `USDC` suffix.
  - `Size` input with `SOL` suffix.
- Live Metrics: `Distance to market %` and `Estimated notional $`.
- Submission Button: `Place buy quote` / `Place sell quote`.

### 6.4 Tables: Active Quotes & Trade History
- **Open Quotes Table:** Side tag (`BUY`/`SELL`), Price, Size, Distance %, and `Cancel` button.
- **Recent Fills Table:** Execution type (`LIMIT`/`MARKET`), Side, Execution price, and timestamp.

---

## 7. MagicBlock Architecture & Settlement Hub (`Architecture`)

Interactive visualization demonstrating high-speed Ephemeral Rollups to permanent Solana devnet proof.

### 7.1 3-Node Architecture Flowchart
```
[ 01 Delegated Session ] ───> [ 02 Ephemeral Rollup ] ───> [ 03 Commit & Settle ]
  Wallet signs 1 key            10–50ms tick execution         Undelegate to Devnet
  session_8xK4…v9Qp             18.4ms FINALITY                5RtQ…mB7f·e927
```
- Interactive step-through state machine (0 to 3) triggered by `"Simulate session"` button.
- Glowing active node styling, animated directional arrows, and monospace code badges.

### 7.2 Terminal & Result Registry PDA
- **Verifier Terminal (`big-terminal`):**
  - Mac-style window controls (Red, Amber, Green dots) + `session-verifier.sh`.
  - Step items with `IconCircleCheckFilled` checkmarks:
    1. Initializing delegated account… `OK`
    2. Deriving deterministic scenario hash… `OK`
    3. Executing 60 tick state transitions… `OK`
    4. Compressing score telemetry… `OK`
    5. Committing result registry PDA… `OK`
- **Result Registry PDA Card (`pda-card`):**
  - Eyebrow: `RESULT REGISTRY PDA`, Title: `Canonical proof address`.
  - Derivation stack: `["result"] + owner_pubkey + scenario_hash + nonce`.
  - Hash box: `FgR7xK9a2w…4nQPda` with 1-click copy action.

---

## 8. Leaderboard & Competitions (`Leaderboard`)

- **Tournament Banner:**
  - Eyebrow: `WEEKLY TOURNAMENT · SEASON 07`
  - Headline: `The Liquidity Gauntlet`
  - Subtitle: `$5,000 simulated prize pool · Whale Sell challenge · Top 100 qualify`
  - Countdown clock with 4 monospace digit boxes: `DAYS`, `HRS`, `MIN`, `SEC`.
- **Global Rankings Table:**
  - Tabs: `Weekly`, `All time`, `Friends`.
  - Columns: `Rank`, `Trader`, `Score`, `Best scenario`, `Net P&L`, `Proof`.
  - Ranks 1-3 have circular gold/amber badge styling.
  - Row 3 features a `YOU` badge.
  - Proof column displays `VERIFIED` with `IconShieldCheck` in green.

---

## 9. Modals & Drawers

### 9.1 Challenge Selection Drawer (`ChallengeDrawer` / Sheet)
- Slides in from right (max 430px).
- **"Learn in 3 steps" Guide:**
  1. `Configure` — Set quote and risk parameters.
  2. `Simulate` — React to deterministic market events.
  3. `Debrief` — Study your score and verified proof.
- **Challenge Cards:**
  - `Stable Market` (Beginner, Mint tag)
  - `Whale Sell` (Intermediate, Amber tag)
  - `Flash Crash & Recovery` (Advanced, Rose tag)
  - Selected card shows active primary border and `IconCheck`.
- Custom sandbox configuration button.

### 9.2 Wallet Connection Modal (`WalletDialog`)
- **Disconnected View:**
  - Wallets list: Phantom (Detected), Solflare, Backpack, Torus.
  - Clicking triggers smooth "Requesting approval…" simulation before connecting.
- **Connected View:**
  - Monospace public address with copy button.
  - Balance grid: `SOL DEVNET 18.42 SOL` & `USDC DEVNET $2,840.50`.
  - Session key status badge: `Session key active · Scoped to simulation program · 42m remaining`.
  - Disconnect action.

---

## 10. Responsive Breakpoint Rules

| Breakpoint | Layout Adjustments |
|---|---|
| **Desktop (> 1200px)** | Full 3-column lab grid (`252px 1fr 242px`), persistent topbar navigation, 4-column HUD. |
| **Tablet (820px – 1200px)** | Lab grid adapts to 2 columns (`230px 1fr`), score panel drops below as 4-card row. |
| **Mobile (< 820px)** | Topbar hides desktop links; persistent bottom bar activates; lab stacks in order: Market Column -> Controls Panel -> Score Panel; HUD & Portfolio strip collapse to 2×2 grids; tables gain horizontal scroll. |

---

## 11. Complete CSS Stylesheet (`src/styles.css`)

```css
@import "tailwindcss" source(none);
@source "../src";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --font-sans: "DM Sans", sans-serif;
  --font-mono: "JetBrains Mono", monospace;
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --radius-2xl: calc(var(--radius) + 8px);
  --radius-3xl: calc(var(--radius) + 12px);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
}

:root {
  --radius: 0.45rem;
  --background: oklch(0.975 0.006 220);
  --foreground: oklch(0.20 0.03 242);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.129 0.042 264.695);
  --primary: oklch(0.67 0.17 171);
  --primary-foreground: oklch(0.12 0.03 210);
  --secondary: oklch(0.968 0.007 247.896);
  --secondary-foreground: oklch(0.208 0.042 265.755);
  --muted: oklch(0.968 0.007 247.896);
  --muted-foreground: oklch(0.554 0.046 257.417);
  --border: oklch(0.929 0.013 255.508);
}

.dark {
  --background: oklch(0.12 0.025 235);
  --foreground: oklch(0.94 0.012 205);
  --card: oklch(0.155 0.025 231);
  --card-foreground: oklch(0.984 0.003 247.858);
  --primary: oklch(0.78 0.17 170);
  --primary-foreground: oklch(0.12 0.025 215);
  --secondary: oklch(0.20 0.025 230);
  --secondary-foreground: oklch(0.984 0.003 247.858);
  --muted: oklch(0.19 0.022 230);
  --muted-foreground: oklch(0.65 0.025 220);
  --border: oklch(0.82 0.035 205 / 14%);
  --input: oklch(0.82 0.035 205 / 18%);
}

@keyframes forge-pulse {
  0%, 100% { filter: drop-shadow(0 0 4px color-mix(in oklab, var(--primary) 45%, transparent)); }
  50% { filter: drop-shadow(0 0 12px color-mix(in oklab, var(--primary) 80%, transparent)); }
}

@keyframes live-pulse {
  50% { opacity: 0.35; transform: scale(0.8); }
}

.mono { font-family: var(--font-mono); }
.app-shell {
  min-height: 100vh;
  background: var(--background);
  background-image: 
    linear-gradient(color-mix(in oklab, var(--border) 32%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in oklab, var(--border) 24%, transparent) 1px, transparent 1px);
  background-size: 48px 48px;
  color: var(--foreground);
}

.topbar {
  height: 64px;
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--border);
  background: color-mix(in oklab, var(--background) 88%, transparent);
  backdrop-filter: blur(20px);
  padding: 0 22px;
  gap: 22px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 9px;
  background: none;
  border: 0;
  color: var(--foreground);
  cursor: pointer;
  font-weight: 500;
  font-size: 17px;
}
.brand b { font-weight: 800; }
.brand em {
  font: 600 8px var(--font-mono);
  color: var(--primary);
  border: 1px solid color-mix(in oklab, var(--primary) 40%, transparent);
  padding: 3px 4px;
  border-radius: 3px;
  font-style: normal;
}

.forge-mark {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  color: var(--primary);
  position: relative;
  animation: forge-pulse 2.8s infinite;
}

.desktop-nav {
  display: flex;
  align-items: stretch;
  align-self: stretch;
  margin-left: 20px;
}
.nav-item {
  border: 0;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--muted-foreground);
  display: flex;
  gap: 7px;
  align-items: center;
  padding: 0 13px;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.nav-item:hover, .nav-item.active {
  color: var(--foreground);
  background: color-mix(in oklab, var(--primary) 5%, transparent);
}
.nav-item.active { border-bottom-color: var(--primary); }

.header-actions { margin-left: auto; display: flex; gap: 7px; align-items: center; }
.cluster-select {
  height: 32px;
  display: flex;
  align-items: center;
  gap: 7px;
  border: 1px solid var(--border);
  background: var(--card);
  padding: 0 9px;
  border-radius: 5px;
}
.cluster-select select {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--foreground);
  font: 500 11px var(--font-mono);
  outline: 0;
}
.status-dot, .live i, .feed-live i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--primary);
  box-shadow: 0 0 8px var(--primary);
  display: inline-block;
  animation: live-pulse 1.4s infinite;
}

.workspace, .page-shell { max-width: 1600px; margin: 0 auto; padding: 20px; }
.context-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid color-mix(in oklab, var(--primary) 30%, var(--border));
  background: linear-gradient(105deg, color-mix(in oklab, var(--primary) 11%, var(--card)), var(--card));
  padding: 17px 22px;
  margin-bottom: 12px;
  position: relative;
  overflow: hidden;
  border-radius: var(--radius);
}

.lab-grid {
  display: grid;
  grid-template-columns: 252px minmax(460px, 1fr) 242px;
  gap: 12px;
}
.panel {
  background: color-mix(in oklab, var(--card) 95%, transparent);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 12px 35px color-mix(in oklab, var(--background) 60%, transparent);
}
```
