# Apex Sniper Bot — v2.0

A high-speed PumpFun token sniper for Solana. Detects new token launches via gRPC stream, applies configurable filters, and executes buys through Jito bundles for MEV-protected, low-latency entry.

---

## Requirements

- Node.js v18 or later
- A Helius (or equivalent) RPC endpoint
- A Yellowstone gRPC endpoint (recommended) or standard RPC fallback
- A Jito block engine URL (default: `mainnet.block-engine.jito.wtf`)

---

## Quick Start

**1. Install dependencies**

```bash
npm install
```

**2. Configure `variables.json`**

Fill in your credentials and trading parameters:

```json
{
  "PHANTOM_PRIVATE_KEY": "your_base58_private_key",
  "RPC_ENDPOINT":        "https://mainnet.helius-rpc.com/?api-key=YOUR_KEY",
  "LOCAL_GRPC_URL":      "https://basic.grpc.solanavibestation.com",
  "GRPC_TOKEN":          "your_grpc_token"
}
```

**3. (Optional) Run preflight checks**

Verifies your keypair, RPC connectivity, wallet balance, PumpFun fee recipient, and Jito reachability — no SOL spent.

```bash
npm run preflight
```

**4. Start the bot**

```bash
npm start
```

Or use `npm run live` to start with automatic log capture to `logs/run-YYYYMMDD-HHMMSS.log`.

**5. Open the dashboard**

```
http://localhost:3000
```

---

## Terminal Controls

While the bot is running, use these keypresses:

| Key | Action |
|-----|--------|
| `P` | Pause / Resume sniping |
| `S` | Sell ALL open positions immediately |
| `H` | Sell 50% of every open position |
| `L` | List all open positions with age and P/L |
| `Q` | Graceful exit — sells all, then shuts down |
| `?` | Show help |

---

## Configuration Reference

All settings live in `variables.json`. Changes take effect on the next buy without restarting.

### Credentials

| Key | Description |
|-----|-------------|
| `PHANTOM_PRIVATE_KEY` | Wallet private key in base58 |
| `RPC_ENDPOINT` | Solana RPC URL (Helius recommended) |
| `LOCAL_GRPC_URL` | Yellowstone gRPC URL |
| `GRPC_TOKEN` | gRPC authentication token |

### Trading

| Key | Default | Description |
|-----|---------|-------------|
| `BUY_SOL_AMOUNT` | `0.01` | SOL to spend per snipe |
| `SLIPPAGE` | `0.05` | Slippage tolerance (5%) |
| `PRIORITY_FEE_CU` | `400000` | Compute unit budget |
| `PRIORITY_FEE_MICRO_LAMPORTS` | `60000` | Priority fee per compute unit |
| `ENABLE_PUMPFUN_SNIPER` | `true` | Enable PumpFun sniping |
| `ENABLE_RAYDIUM_CPMM_SNIPER` | `false` | Enable Raydium CPMM sniping |
| `SNIPE_ONE_TOKEN_AT_A_TIME` | `false` | Queue snipes; only one open position at a time |
| `MANUAL_SNIPING_MODE` | `false` | Disable auto-buy; detect only |

### Auto-Sell & Take Profit

| Key | Default | Description |
|-----|---------|-------------|
| `AUTO_SELL_ENABLED` | `true` | Enable the auto-sell manager |
| `AUTO_SELL_LIFETIME_SECONDS` | `300` | Force-exit any position after N seconds |
| `PRICE_CHECK_INTERVAL_SECONDS` | `1` | How often to evaluate open positions |
| `TAKE_PROFIT_LEVEL_1` | `5` | First TP threshold (%) |
| `TAKE_PROFIT_LEVEL_2` | `10` | Second TP threshold (%) |
| `TAKE_PROFIT_LEVEL_3` | `50` | Final TP — sells all remaining (%) |
| `PERCENTAGE_OF_TOKENS_TO_SELL_AT_LEVEL_1` | `50` | % of position to sell at TP1 |
| `PERCENTAGE_OF_TOKENS_TO_SELL_AT_LEVEL_2` | `50` | % of remaining to sell at TP2 |
| `STOP_LOSS_PERCENTAGE` | `20` | Fixed stop-loss (%) |

### Trailing Stop

When enabled, the trailing stop replaces the fixed stop-loss once activated.

| Key | Default | Description |
|-----|---------|-------------|
| `TRAILING_STOP_ENABLED` | `false` | Enable trailing stop |
| `TRAILING_STOP_ACTIVATION_PCT` | `10` | Minimum gain (%) before trail arms |
| `TRAILING_STOP_DISTANCE_PCT` | `5` | % drop below peak to trigger exit |

**Example** (with defaults): Token bought at 0.000001 SOL → rises to 0.0000115 → trail **activates** (≥10% gain) → peaks at 0.000015 → drops to 0.00001425 (5% below peak) → **sells all**.

### Token Filters

All filters default to `true`. Set any to `false` to disable individually.

| Key | Default | Description |
|-----|---------|-------------|
| `MIN_DEV_BUY_AMOUNT` | `3` | Minimum dev buy in SOL |
| `CHECK_IF_TOKEN_HAS_SOCIALS_AND_WEBSITE` | `true` | Require socials/website metadata |
| `CHECK_IF_TOKEN_IS_MUTABLE` | `true` | Requires non-mutable token |
| `CHECK_IF_TOKEN_IS_FREEZABLE` | `true` | Reject freezable tokens |
| `CHECK_IF_TOKEN_HAS_LP_BURNED` | `true` | Require liquidity burned |
| `CHECK_IF_TOKEN_IS_RENOUNCED` | `true` | Require renounced mint authority |
| `CHECK_IF_TOKEN_HAS_LP_LOCKED` | `true` | Require locked liquidity |
| `MAX_PERCENTAGE_BELONGING_TO_CREATOR` | `30` | Reject if creator holds >N% of supply |
| `MINIMUM_POOL_SIZE_IN_SOL` | `1` | Minimum pool size in SOL |
| `MAXIMUM_POOL_SIZE_IN_SOL` | `500000000` | Maximum pool size in SOL |

### Jito Bundle Settings

| Key | Default | Description |
|-----|---------|-------------|
| `JITO_ENABLED` | `true` | Route buys through Jito bundles |
| `JITO_TIP_LAMPORTS` | `10000` | Tip per bundle (minimum 1000) |
| `JITO_BLOCK_ENGINE` | `mainnet.block-engine.jito.wtf` | Jito block engine endpoint |
| `JITO_FALLBACK_TO_RPC` | `true` | Fall back to RPC if Jito submission fails |

> `variables.json` is re-read on every bundle submission. Toggling `JITO_ENABLED` from the dashboard takes effect immediately without a restart.

### Source & Dashboard

| Key | Default | Description |
|-----|---------|-------------|
| `USE_GRPC` | `true` | `true` = Yellowstone gRPC (<100ms); `false` = RPC logsSubscribe (250–500ms) |
| `RPC_LOGS_COMMITMENT` | `processed` | Commitment level for RPC-only mode |
| `DASHBOARD_PORT` | `3000` | Web dashboard port |

---

