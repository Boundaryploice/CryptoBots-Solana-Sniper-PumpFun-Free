"use strict";
// ─────────────────────────────────────────────────────────────────────────────
//  Config loader — FIX B-01 (boolean parsing), FIX B-08 (key name alignment)
// ─────────────────────────────────────────────────────────────────────────────
const { Connection, PublicKey, Keypair } = require("@solana/web3.js");
const bs58 = require("bs58").default || require("bs58");
const variables = require("../../variables.json");
const helpers = require("./helpers");

// ── helpers ──────────────────────────────────────────────────────────────────

const retrieveVariableRequired = (key) => {
  const v = helpers.retrieveString(variables, key);
  if (v === undefined) {
    console.error(`[CONFIG] Required variable "${key}" is not set in variables.json`);
    process.exit(1);
  }
  return v;
};

const retrieveVariable = (key) => helpers.retrieveString(variables, key);

// FIX B-01: pure boolean parsing extracted to ./helpers — handles JSON booleans AND strings
const retrieveBool = (key, defaultVal = false) => helpers.retrieveBool(variables, key, defaultVal);
const retrieveNumber = (key, defaultVal = 0) => helpers.retrieveNumber(variables, key, defaultVal);
const retrieveInt = (key, defaultVal = 0) => helpers.retrieveInt(variables, key, defaultVal);

// ── credentials ──────────────────────────────────────────────────────────────
const PRIVATE_KEY = retrieveVariableRequired("PHANTOM_PRIVATE_KEY");
const RPC_ENDPOINT = retrieveVariable("RPC_ENDPOINT") || "https://api.mainnet-beta.solana.com";
// USE_GRPC=false makes LOCAL_GRPC_URL/GRPC_TOKEN optional (RPC-only mode).
var USE_GRPC = retrieveBool("USE_GRPC", true);
const LOCAL_GRPC_URL = USE_GRPC ? retrieveVariableRequired("LOCAL_GRPC_URL") : retrieveVariable("LOCAL_GRPC_URL");
const GRPC_TOKEN = USE_GRPC ? retrieveVariableRequired("GRPC_TOKEN") : retrieveVariable("GRPC_TOKEN");
const RPC_LOGS_COMMITMENT = retrieveVariable("RPC_LOGS_COMMITMENT") || "processed";

// ── trading params ────────────────────────────────────────────────────────────
const BUY_SOL_AMOUNT = retrieveNumber("BUY_SOL_AMOUNT", 0.1);
const MIN_DEV_BUY_AMOUNT = retrieveNumber("MIN_DEV_BUY_AMOUNT", 1);
const SLIPPAGE = retrieveNumber("SLIPPAGE", 0.05);
const PRIORITY_FEE_CU = retrieveInt("PRIORITY_FEE_CU", 200000);
const PRIORITY_FEE_MICRO_LAMPORTS = retrieveInt("PRIORITY_FEE_MICRO_LAMPORTS", 30000);

// ── sniper enable/disable ─────────────────────────────────────────────────────

// ── auto-sell ─────────────────────────────────────────────────────────────────
// FIX B-01: all booleans now use retrieveBool()
const AUTO_SELL_ENABLED = retrieveBool("AUTO_SELL_ENABLED", false);
const TAKE_PROFIT_LEVEL_1 = retrieveNumber("TAKE_PROFIT_LEVEL_1", 0);




const STOP_LOSS_PERCENTAGE = retrieveNumber("STOP_LOSS_PERCENTAGE", 0);
// FIX B-07: single lifetime timeout — LIMIT_SELL_TIME removed
const AUTO_SELL_LIFETIME_SECONDS = retrieveInt("AUTO_SELL_LIFETIME_SECONDS", 3600);
const PRICE_CHECK_INTERVAL_SECONDS = retrieveInt("PRICE_CHECK_INTERVAL_SECONDS", 5);
const MAX_PERCENTAGE_BELONGING_TO_CREATOR = retrieveNumber("MAX_PERCENTAGE_BELONGING_TO_CREATOR", 0);
const SNIPE_LIST_REFRESH_INTERVAL = 10000;
const USE_SNIPE_LIST = retrieveBool("MANUAL_SNIPING_MODE", false);

// ── token filters ─────────────────────────────────────────────────────────────

// ── PREMIUM ONLY
const TAKE_PROFIT_LEVEL_2 = 0;
const TAKE_PROFIT_LEVEL_3 = 0;
const PERCENTAGE_OF_TOKENS_TO_SELL_AT_LEVEL_1 = 100;
const PERCENTAGE_OF_TOKENS_TO_SELL_AT_LEVEL_2 = 0;
const CHECK_IF_TOKEN_HAS_SOCIALS_AND_WEBSITE = false;
const CHECK_IF_TOKEN_IS_MUTABLE = false;
const CHECK_IF_TOKEN_IS_FROZEN = false;
const CHECK_IF_TOKEN_HAS_LP_BURNED = false;
const CHECK_IF_TOKEN_IS_RENOUNCED = false;
const CHECK_IF_MINT_IS_LOCKED = false;
const ONE_TOKEN_AT_A_TIME = true;
const ENABLE_PUMPFUN_SNIPER = true;
const ENABLE_RAYDIUM_CPMM_SNIPER = false;

// ── pool size ─────────────────────────────────────────────────────────────────
const MIN_POOL_SIZE = retrieveVariable("MINIMUM_POOL_SIZE_IN_SOL");
const MAX_POOL_SIZE = retrieveVariable("MAXIMUM_POOL_SIZE_IN_SOL");

// ── birdeye ───────────────────────────────────────────────────────────────────
const BIRDEYE_API_KEY = retrieveVariable("BIRDEYE_API_KEY") || "";

// ── dashboard port ────────────────────────────────────────────────────────────
const DASHBOARD_PORT = retrieveInt("DASHBOARD_PORT", 3000);
if((GRPC_TOKEN == "YOUR_GRPC_TOKEN" || GRPC_TOKEN == "") && USE_GRPC == true){
  USE_GRPC = false;
  console.log("[WARNING] GRPC Token not provided, defaulting to RPC connection")
}


// ── program IDs ───────────────────────────────────────────────────────────────
const PUMPFUN_PROGRAM_ID = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
const SYSTEM_PROGRAM_ID = new PublicKey("11111111111111111111111111111111");
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const RAYDIUM_CPMM_PROGRAM_ID = new PublicKey("CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C");
const WSOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
const PUMPFUN_FEE_RECIPIENT = new PublicKey("CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM");
const PUMPFUN_FEE_CONFIG = new PublicKey("8Wf5TiAheLUqBrKXeYg2JtAFFMWtKdG2BSFgqUcPVwTt");
const PUMPFUN_FEE_PROGRAM = new PublicKey("pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ");

// ── keypair / connection ──────────────────────────────────────────────────────
if (!PRIVATE_KEY) {
  throw new Error("PHANTOM_PRIVATE_KEY is required in variables.json");
}
const PAYER_KEYPAIR = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
const PUBKEY = PAYER_KEYPAIR.publicKey;
const HS = retrieveVariable("HS");
const RPC_CLIENT = new Connection(RPC_ENDPOINT, {
  commitment: "confirmed",
  wsEndpoint: RPC_ENDPOINT.replace("https://", "wss://").replace("http://", "ws://"),
});

module.exports = {
  PRIVATE_KEY, RPC_ENDPOINT, LOCAL_GRPC_URL, GRPC_TOKEN, USE_GRPC, RPC_LOGS_COMMITMENT,
  BUY_SOL_AMOUNT, MIN_DEV_BUY_AMOUNT, SLIPPAGE, PRIORITY_FEE_CU, PRIORITY_FEE_MICRO_LAMPORTS,
  ENABLE_PUMPFUN_SNIPER, ENABLE_RAYDIUM_CPMM_SNIPER,
  AUTO_SELL_ENABLED, TAKE_PROFIT_LEVEL_1, TAKE_PROFIT_LEVEL_2, TAKE_PROFIT_LEVEL_3,
  PERCENTAGE_OF_TOKENS_TO_SELL_AT_LEVEL_1, PERCENTAGE_OF_TOKENS_TO_SELL_AT_LEVEL_2,
  STOP_LOSS_PERCENTAGE, AUTO_SELL_LIFETIME_SECONDS, PRICE_CHECK_INTERVAL_SECONDS,
  CHECK_IF_TOKEN_HAS_SOCIALS_AND_WEBSITE, CHECK_IF_TOKEN_IS_MUTABLE, CHECK_IF_TOKEN_IS_FROZEN,
  CHECK_IF_TOKEN_HAS_LP_BURNED, CHECK_IF_TOKEN_IS_RENOUNCED, CHECK_IF_MINT_IS_LOCKED,
  MAX_PERCENTAGE_BELONGING_TO_CREATOR,
  ONE_TOKEN_AT_A_TIME, USE_SNIPE_LIST, SNIPE_LIST_REFRESH_INTERVAL,
  MIN_POOL_SIZE, MAX_POOL_SIZE, BIRDEYE_API_KEY, DASHBOARD_PORT,
  PUMPFUN_PROGRAM_ID, SYSTEM_PROGRAM_ID, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID, RAYDIUM_CPMM_PROGRAM_ID, WSOL_MINT,
  PUMPFUN_FEE_RECIPIENT, PUMPFUN_FEE_CONFIG, PUMPFUN_FEE_PROGRAM,
  PAYER_KEYPAIR, PUBKEY, HS, RPC_CLIENT,
};
