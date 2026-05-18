"use strict";
// ─────────────────────────────────────────────────────────────────────────────
//  index.js — Sniper Bot v2 Entry Point
//  Phase 1-2: All 8 bugs fixed via config, autoSell, tokenFilters
//  Phase 3:   One-token-at-a-time queue + terminal keypress controls
//  Phase 5:   Jito bundle integration for buy transactions
//  Phase 6:   Trailing stop loss (handled inside autoSell)
//  Phase 9:   Web dashboard at http://localhost:DASHBOARD_PORT
// ─────────────────────────────────────────────────────────────────────────────
require("dotenv").config();

const Client = require("@triton-one/yellowstone-grpc").default;
const { CommitmentLevel } = require("@triton-one/yellowstone-grpc");
const { PublicKey, Transaction } = require("@solana/web3.js");
const { getAssociatedTokenAddressSync } = require("@solana/spl-token");
const bs58 = require("bs58").default || require("bs58");

const {
  LOCAL_GRPC_URL, GRPC_TOKEN, USE_GRPC, RPC_LOGS_COMMITMENT,
  PUBKEY, PAYER_KEYPAIR, RPC_CLIENT,
  PUMPFUN_PROGRAM_ID, RAYDIUM_CPMM_PROGRAM_ID,
  ENABLE_PUMPFUN_SNIPER, ENABLE_RAYDIUM_CPMM_SNIPER,
  ONE_TOKEN_AT_A_TIME, DASHBOARD_PORT,
  WSOL_MINT, TOKEN_PROGRAM_ID,
} = require("./config");

const { processCreateInstruction, preloadConnection } = require("./processors/pumpfunProcessor_original");
const { processRaydiumCpmmInitialize } = require("./processors/raydiumCpmmProcessor");
const { autoSellManager, isBotPaused, setBotPaused, setDashboardEmitter, DexType } = require("./utils/autoSell");
const { submitTransaction, JITO_ENABLED } = require("./utils/jito");
const { startGlobalRefreshLoop, getCachedFeeRecipient } = require("./utils/pumpfunGlobal");
const { startDashboard } = require("./dashboard/server");

// ── discriminators ────────────────────────────────────────────────────────────
const CREATE_DISCRIMINATOR     = Buffer.from([27, 114, 169, 77, 222, 235, 99, 118]);
const INITIALIZE_DISCRIMINATOR = Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]);

// ── dedup ─────────────────────────────────────────────────────────────────────
const processedTxns = new Set();

// ── Phase 3 / FIX B-09: one-token-at-a-time mutex ───────────────────────────
// The old gate only blocked while a buy *attempt* was in flight, releasing
// the lock the moment the buy resolved. As soon as the buy confirmed and the
// position was handed to autoSellManager, the gate opened and the next
// create event triggered another buy — resulting in 5+ parallel positions
// even with SNIPE_ONE_TOKEN_AT_A_TIME=true (see screenshots from the
// 2026-05-10 session).  Fix: gate must also check open-position count.
let sniping = false;
function acquireSnipe() {
  if (!ONE_TOKEN_AT_A_TIME) return true;
  if (sniping) return false;
  if (autoSellManager.getOpenPositionCount() > 0) return false;
  sniping = true;
  return true;
}
function releaseSnipe() { sniping = false; }
const sleep = (min, max) => {
  const ms = max === undefined 
      ? min 
      : Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, ms));
};
// ── terminal controls ─────────────────────────────────────────────────────────
let _terminalControlsInstalled = false;
async function setupTerminalControls(stream) {
  if (!process.stdin.isTTY) return;
  if (_terminalControlsInstalled) return; // guard against re-install on reconnect
  _terminalControlsInstalled = true;
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  var YELLOW = "\u001b[33m";
  var RESET = "\u001b[0m";


  console.log("")
  console.log("")
  console.log("░██████╗███╗░░██╗██╗██████╗░███████╗██████╗░  ██████╗░░█████╗░████████╗")
  console.log("██╔════╝████╗░██║██║██╔══██╗██╔════╝██╔══██╗  ██╔══██╗██╔══██╗╚══██╔══╝")
  console.log("╚█████╗░██╔██╗██║██║██████╔╝█████╗░░██████╔╝  ██████╦╝██║░░██║░░░██║░░░")
  console.log("░╚═══██╗██║╚████║██║██╔═══╝░██╔══╝░░██╔══██╗  ██╔══██╗██║░░██║░░░██║░░░")
  console.log("██████╔╝██║░╚███║██║██║░░░░░███████╗██║░░██║  ██████╦╝╚█████╔╝░░░██║░░░")
  console.log("╚═════╝░╚═╝░░╚══╝╚═╝╚═╝░░░░░╚══════╝╚═╝░░╚═╝  ╚═════╝░░╚════╝░░░░╚═╝░░░")
  await sleep(1000,3000);
  console.log(YELLOW+"  You are currently running on a FREE Version with limited features"+RESET)
  await sleep(1000,3000);
  console.log("")
  console.log("")

  const help = () => {

    console.log("\n╔═══════════════════════════════════════╗");
    console.log("║          TERMINAL CONTROLS            ║");
    console.log("╠═══════════════════════════════════════╣");
    console.log("║  [P] Pause / Resume sniping           ║");
    console.log("║  [S] Sell ALL open positions          ║");
    console.log("║  [H] Sell 50% of all positions        ║");
    console.log("║  [L] List open positions + P/L        ║");
    console.log("║  [Q] Graceful exit (sell then quit)   ║");
    console.log("║  [?] Show this help                   ║");
    console.log("╚═══════════════════════════════════════╝\n");
  };
  help();

  process.stdin.on("data", async (key) => {
    const k = key.toLowerCase().trim();
    if (k === "p") {
      setBotPaused(!isBotPaused());
      console.log(`\n[Controls] Bot ${isBotPaused() ? "⏸  PAUSED — no new snipes" : "▶  RESUMED"}\n`);
    } else if (k === "s") {
      console.log("\n[Controls] Selling ALL positions…");
      await autoSellManager.sellAll(100);
    } else if (k === "h") {
      console.log("\n[Controls] Selling 50% of all positions…");
      await autoSellManager.sellAll(50);
    } else if (k === "l") {
      autoSellManager.listPositions();
    } else if (k === "q" || key === "\u0003") {
      console.log("\n[Controls] Graceful shutdown — selling all then exiting…");
      await autoSellManager.sellAll(100);
      stream.destroy();
      process.exit(0);
    } else if (k === "?") {
      help();
    }
  });
}

// ── colour helpers ────────────────────────────────────────────────────────────
const C = { R: "\x1b[0m", Y: "\x1b[33m", G: "\x1b[32m", B: "\x1b[36m", E: "\x1b[31m" };

// ── extract account keys from gRPC tx ────────────────────────────────────────
function extractAccountKeys(transaction) {
  const keys = [];
  for (const key of (transaction.transaction?.message?.accountKeys || [])) {
    try {
      if (typeof key === "string") keys.push(new PublicKey(key));
      else if (key?.pubkey) keys.push(new PublicKey(key.pubkey));
      else if (Buffer.isBuffer(key) || key instanceof Uint8Array) keys.push(new PublicKey(key));
    } catch { /* skip malformed */ }
  }
  return keys;
}

// ── scan instructions for a discriminator ────────────────────────────────────
function hasDiscriminator(transaction, accountKeys, programId, discriminator) {
  for (const ix of (transaction.transaction?.message?.instructions || [])) {
    if (typeof ix !== "object" || !("programIdIndex" in ix)) continue;
    if (!accountKeys[ix.programIdIndex]?.equals(programId)) continue;
    if (!ix.data) continue;
    try {
      let buf;
      if (Buffer.isBuffer(ix.data)) buf = ix.data;
      else if (ix.data instanceof Uint8Array) buf = Buffer.from(ix.data);
      else buf = Buffer.from(ix.data, "base64");
      if (buf.length >= 8 && buf.subarray(0, 8).equals(discriminator)) return true;
    } catch { /* skip */ }
  }
  return false;
}

// ── core snipe handler — shared by gRPC and RPC-only paths ───────────────────
let dashEmit = (() => {});

async function handleDetectedTx({
  signature,
  accountKeys = [],
  innerInstructions = [],
  logMessages = [],
  transaction = null,
  preTokenBalances = [],
  postTokenBalances = [],
}) {
  if (!signature || isBotPaused()) return;
  if (processedTxns.has(signature)) return;
  processedTxns.add(signature);
  if (processedTxns.size > 1000) processedTxns.delete(processedTxns.values().next().value);

  // Detect PumpFun create (logs path always works; outer/inner ix path is gRPC-only)
  let hasPumpfun = false;
  for (const log of logMessages) {
    if (typeof log !== "string") continue;
    const match = log.match(/Program data: ([A-Za-z0-9+/=]+)/);
    if (match) {
      try {
        const buf = Buffer.from(match[1], "base64");
        if (buf.length >= 8 && buf.subarray(0, 8).equals(CREATE_DISCRIMINATOR)) { hasPumpfun = true; break; }
      } catch { /* skip */ }
    }
  }
  if (!hasPumpfun && transaction) {
    hasPumpfun = hasDiscriminator(transaction, accountKeys, PUMPFUN_PROGRAM_ID, CREATE_DISCRIMINATOR);
  }

  // Raydium CPMM detection requires the full transaction (gRPC only)
  const hasRaydium = transaction
    ? hasDiscriminator(transaction, accountKeys, RAYDIUM_CPMM_PROGRAM_ID, INITIALIZE_DISCRIMINATOR)
    : false;

  if (hasPumpfun && ENABLE_PUMPFUN_SNIPER) {
    if (!acquireSnipe()) { console.log("[Queue] Skipping — queue busy"); return; }
    const t0 = Date.now();
    try {
      const result = await processCreateInstruction(signature, accountKeys, innerInstructions, logMessages);
      if (!result?.instructions?.length) { releaseSnipe(); return; }

      const { signature: txSig, method } = await submitTransaction(result.instructions, "PumpFun BUY");
      console.log(`${C.Y}[PumpFun BUY] ${method.toUpperCase()} — ${txSig} (${Date.now() - t0}ms)${C.R}`);
      dashEmit("buy_submitted", { dex: "PumpFun", sig: txSig, ms: Date.now() - t0, method });

      if (result.buyData) {
        try {
          if (method === "rpc") await RPC_CLIENT.confirmTransaction(txSig, "confirmed");
          console.log(`${C.G}[PumpFun BUY] Confirmed: ${txSig}${C.R}`);
          const { mint, buyPrice, tokenAmount, bondingCurve, associatedBondingCurve,
                  creator, tokenProgramId, virtualSolReserves, virtualTokenReserves } = result.buyData;
          const tokenAccount = getAssociatedTokenAddressSync(mint, PUBKEY, false, tokenProgramId);
          autoSellManager.addToken(
            mint, buyPrice, tokenAmount, tokenAccount,
            bondingCurve, associatedBondingCurve, creator, tokenProgramId,
            virtualSolReserves, virtualTokenReserves, DexType.Pumpfun,
            undefined, undefined, undefined
          );
        } catch (e) { console.error(`[PumpFun BUY] Confirm error: ${e.message}`); }
      }
    } catch (e) {
      console.error(`${C.E}[PumpFun BUY] Error: ${e.message}${C.R}`);
    } finally {
      releaseSnipe();
    }
  }

  if (hasRaydium && ENABLE_RAYDIUM_CPMM_SNIPER) {
    if (!acquireSnipe()) { console.log("[Queue] Skipping Raydium — queue busy"); return; }
    const t0 = Date.now();
    try {
      const result = await processRaydiumCpmmInitialize(
        signature, accountKeys, innerInstructions, logMessages, transaction, preTokenBalances, postTokenBalances
      );
      if (!result?.instructions?.length) { releaseSnipe(); return; }

      const { signature: txSig, method } = await submitTransaction(result.instructions, "Raydium BUY");
      console.log(`[Raydium BUY] ${method.toUpperCase()} — ${txSig} (${Date.now() - t0}ms)`);
      dashEmit("buy_submitted", { dex: "Raydium CPMM", sig: txSig, ms: Date.now() - t0, method });

      if (result.buyData) {
        try {
          if (method === "rpc") await RPC_CLIENT.confirmTransaction(txSig, "confirmed");
          const { mint, buyPrice, tokenAmount, bondingCurve, associatedBondingCurve,
                  creator, tokenProgramId, virtualSolReserves, virtualTokenReserves,
                  authority, ammConfig, poolState, observationState } = result.buyData;
          const tokenAccount = getAssociatedTokenAddressSync(mint, PUBKEY, false, tokenProgramId);
          const wsolAta = getAssociatedTokenAddressSync(PUBKEY, WSOL_MINT, false, TOKEN_PROGRAM_ID);
          const swapAccounts = {
            payer: PUBKEY, authority, ammConfig, poolState,
            inputTokenAccount: tokenAccount, outputTokenAccount: wsolAta,
            inputVault: result.buyData.outputVault, outputVault: result.buyData.inputVault,
            inputTokenProgram: tokenProgramId, outputTokenProgram: TOKEN_PROGRAM_ID,
            inputTokenMint: mint, outputTokenMint: WSOL_MINT,
            observationState,
          };
          autoSellManager.addToken(
            mint, buyPrice, tokenAmount, tokenAccount,
            bondingCurve, associatedBondingCurve, creator, tokenProgramId,
            virtualSolReserves, virtualTokenReserves, DexType.RaydiumCpmm,
            swapAccounts, poolState, ammConfig
          );
        } catch (e) { console.error(`[Raydium BUY] Confirm error: ${e.message}`); }
      }
    } catch (e) {
      console.error(`[Raydium BUY] Error: ${e.message}`);
    } finally {
      releaseSnipe();
    }
  }
}

// ── boot ──────────────────────────────────────────────────────────────────────
let _dashStarted = false;
async function bootDashboard() {
  if (_dashStarted) return;
  _dashStarted = true;
  dashEmit = await startDashboard(DASHBOARD_PORT, autoSellManager);
  setDashboardEmitter(dashEmit);
  console.log(`${C.B}[Dashboard] http://localhost:${DASHBOARD_PORT}${C.R}`);
  console.log(`${C.B}[Jito]      ${JITO_ENABLED ? "ENABLED" : "DISABLED — using standard RPC"}${C.R}`);
  console.log(`${C.B}[Source]    ${USE_GRPC ? "gRPC stream" : "RPC logsSubscribe (no gRPC)"}${C.R}`);
  const solBalance = await RPC_CLIENT.getBalance(PUBKEY);
  console.log(`${C.B}[Wallet]    ${PUBKEY.toBase58()} | ${(solBalance / 1e9).toFixed(4)} SOL${C.R}`);

  // Prefetch the live PumpFun fee_recipient so the very first snipe has it.
  // The cache is refreshed every 15s thereafter — keeps us correct when
  // PumpFun rotates the recipient on-chain.
  await startGlobalRefreshLoop();
  const fr = getCachedFeeRecipient();
  if (fr) console.log(`${C.B}[PumpFun]   fee_recipient: ${fr.toBase58()}${C.R}`);
  else    console.warn(`${C.Y}[PumpFun]   fee_recipient prefetch failed — first snipe(s) may be skipped until cache populates${C.R}`);
}

// ── gRPC mode ─────────────────────────────────────────────────────────────────
// Reconnect counters live at module scope so they survive reconnects without
// spawning a new bootDashboard each time. The previous design called mainGrpc()
// recursively from inside the error handler — every reconnect re-ran the boot
// path, re-started the dashboard listener (port-in-use), and stacked parallel
// streams (logs from 2026-05-13 show 22k "Listening via gRPC…" lines).
let _grpcReconnects = 0;
const GRPC_MAX_RECONNECTS = 20;

async function openGrpcStream() {
  if (!LOCAL_GRPC_URL) throw new Error("LOCAL_GRPC_URL is required when USE_GRPC=true");

  const client = new Client(LOCAL_GRPC_URL, GRPC_TOKEN || undefined, undefined);
  const transactions = {};

  if (ENABLE_PUMPFUN_SNIPER) {
    transactions.pumpfun_transactions = {
      vote: false, failed: false,
      accountInclude: [PUMPFUN_PROGRAM_ID.toBase58()],
      accountExclude: [], accountRequired: [],
    };
  }
  if (ENABLE_RAYDIUM_CPMM_SNIPER) {
    transactions.raydium_cpmm_transactions = {
      vote: false, failed: false,
      accountInclude: [RAYDIUM_CPMM_PROGRAM_ID.toBase58()],
      accountExclude: [], accountRequired: [],
    };
  }
  if (!Object.keys(transactions).length) throw new Error("Enable at least one sniper in variables.json");

  const stream = await client.subscribe();
  stream.write({
    transactions,
    commitment: CommitmentLevel.PROCESSED,
    accounts: {}, slots: {}, transactionsStatus: {}, blocks: {}, blocksMeta: {}, entry: {},
    accountsDataSlice: [],
  });

  await setupTerminalControls(stream);
  console.log(`${C.G}[Bot] Listening via gRPC…${C.R}`);

  stream.on("data", async (data) => {
    if (!data.transaction) return;
    const sigBytes = data.transaction.transaction?.signature;
    if (!sigBytes) return;
    const sig = bs58.encode(sigBytes);
    const transaction = data.transaction.transaction;
    const meta = transaction?.meta;
    if (!transaction || !meta || meta.err) return;

    await handleDetectedTx({
      signature: sig,
      accountKeys: extractAccountKeys(transaction),
      innerInstructions: meta.innerInstructions || [],
      logMessages: meta.logMessages || [],
      transaction,
      preTokenBalances: meta.preTokenBalances || [],
      postTokenBalances: meta.postTokenBalances || [],
    });
  });

  let scheduledReconnect = false;
  function scheduleReconnect(reason) {
    if (scheduledReconnect) return;
    scheduledReconnect = true;
    try { stream.destroy?.(); } catch {}
    if (_grpcReconnects >= GRPC_MAX_RECONNECTS) {
      console.error(`[Stream] Max reconnects (${GRPC_MAX_RECONNECTS}) reached. Dashboard still running at http://localhost:${DASHBOARD_PORT}`);
      return;
    }
    _grpcReconnects++;
    const delay = Math.min(2000 * _grpcReconnects, 30000);
    console.log(`[Stream] ${reason} — reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${_grpcReconnects}/${GRPC_MAX_RECONNECTS})`);
    setTimeout(() => openGrpcStream().catch((e) => {
      console.error("[Stream] reconnect failed:", e.message);
      scheduledReconnect = false;
      scheduleReconnect("reconnect threw");
    }), delay);
  }

  stream.on("error", (err) => {
    console.error("[Stream] Error:", err.message);
    if (err.message && (err.message.includes("403") || err.message.includes("PERMISSION_DENIED"))) {
      console.error("[Stream] 403 PERMISSION_DENIED — check LOCAL_GRPC_URL and GRPC_TOKEN in variables.json");
      console.error("[Stream] Cannot reconnect with invalid credentials. Fix your gRPC settings or set USE_GRPC=false.");
      return;
    }
    scheduleReconnect("stream error");
  });

  stream.on("end", () => { scheduleReconnect("stream ended"); });

  // Reset the counter once a stream survives 60s — recovers the budget after
  // a transient outage so a fresh wave of disconnects doesn't permanently
  // trip the max-reconnects ceiling.
  setTimeout(() => { if (!scheduledReconnect) _grpcReconnects = 0; }, 60000).unref?.();
}

async function mainGrpc() {
  await bootDashboard();
  await openGrpcStream();
}

// ── RPC-only mode (no gRPC) ───────────────────────────────────────────────────
// Subscribes to PumpFun program logs via the standard JSON-RPC websocket. Slower
// than gRPC (typically ~250-500ms behind, vs <100ms for Triton/Yellowstone), but
// works with any RPC provider that supports logsSubscribe.
async function mainRpcOnly() {
  await bootDashboard();
  await setupTerminalControls({ destroy() {} }); // dummy stream — controls still work

  if (ENABLE_RAYDIUM_CPMM_SNIPER) {
    console.warn(`${C.Y}[RPC mode] Raydium CPMM detection requires gRPC — only PumpFun will be sniped.${C.R}`);
  }

  if (!ENABLE_PUMPFUN_SNIPER) throw new Error("RPC-only mode requires ENABLE_PUMPFUN_SNIPER=true");

  console.log(`${C.G}[Bot] Listening via RPC logsSubscribe…${C.R}`);

  const subId = RPC_CLIENT.onLogs(
    PUMPFUN_PROGRAM_ID,
    async (logsResult, ctx) => {
      try {
        if (!logsResult || logsResult.err) return;
        const { signature, logs } = logsResult;
        if (!signature || !logs?.length) return;

        await handleDetectedTx({
          signature,
          accountKeys: [],
          innerInstructions: [],
          logMessages: logs,
          transaction: null,
        });
      } catch (e) {
        console.error(`[RPC logs] Handler error: ${e.message}`);
      }
    },
    RPC_LOGS_COMMITMENT
  );

  console.log(`[RPC logs] Subscribed (id=${subId}, commitment=${RPC_LOGS_COMMITMENT})`);

  // Keep the websocket alive — Connection auto-reconnects internally.
  process.on("SIGINT", async () => {
    try { await RPC_CLIENT.removeOnLogsListener(subId); } catch {}
    process.exit(0);
  });
}

(async function entry() {
  await preloadConnection(LOCAL_GRPC_URL,GRPC_TOKEN)

  try {
    if (USE_GRPC) await mainGrpc();
    else await mainRpcOnly();
  } catch (err) {
    console.error("[Fatal]", err);
    process.exit(1);
  }
})();
