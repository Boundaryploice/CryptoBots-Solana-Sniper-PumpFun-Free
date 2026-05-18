"use strict";
// ─────────────────────────────────────────────────────────────────────────────
//  jito.js — Jito Bundle / Transaction submission for fast buys.
//
//  v9 — 2026-05-14 — Self-throttle to Jito's 1 req/sec free-tier limit.
//
//    Jito's free block-engine endpoints rate-limit at 1 sendBundle/sec per IP.
//    The bot was hitting bursts during high token-mint activity, triggering
//    `Rate limit exceeded` 429s with a 120-second back-off penalty. We now
//    track the last submit time across the whole process and sleep until at
//    least 1100ms has elapsed before submitting again. Adds a small queue
//    latency during bursts but eliminates 429s and the 120s back-off.
//
//  v8 — 2026-05-14 — Enforce a valid fee_recipient at submission time.
//    Overwrites account[1] of any PumpFun ix with a randomly-picked address
//    from Global.fee_recipients (8 valid options). Fixes 6000 NotAuthorized.
//
//  v7 — 2026-05-13 — (deprecated) Mayhem-mode fee_recipient swap. Was based
//    on a misread of the IDL; v8 supersedes.
//
//  v6 — 2026-05-13 — Diagnostics on bundle rejection. RPC simulate + full
//    instruction dump + Solscan/Jito Explorer URLs.
//
//  v3 — 2026-05-13 — Critical fixes:
//    B-10  poll Jito bundle status, not Solana RPC signature status
//    B-11  extract signature from serialized wire format, not tx.signature
//    B-12  fetch live tip-account list from Jito instead of stale hardcoded
//    B-13  bs58.encode requires a fresh Uint8Array, not a Buffer subarray
// ─────────────────────────────────────────────────────────────────────────────
const path = require("path");
const fs = require("fs");
const { Transaction, SystemProgram, PublicKey } = require("@solana/web3.js");
const { getRecentBlockhash } = require("./blockhash");
const { PUBKEY, PAYER_KEYPAIR, RPC_CLIENT } = require("../config");
const { parseJitoConfig } = require("./jitoConfig");

const VARS_PATH = path.join(__dirname, "../../variables.json");
const PUMPFUN_PROGRAM_ID_STR = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

// v9: minimum gap between sendBundle calls. Jito free tier enforces 1 req/sec
// strictly, so we use 1100ms to leave a 10% buffer for clock-drift edge cases.
const JITO_MIN_SUBMIT_INTERVAL_MS = 1100;
let _lastJitoSubmitAt = 0;

const JITO_TIP_ACCOUNTS_FALLBACK = [
  "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
  "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
  "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
  "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaSm3",
  "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDcvr",
  "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
  "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
  "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT",
];

let JITO_TIP_ACCOUNTS = JITO_TIP_ACCOUNTS_FALLBACK.slice();
let _tipAccountsLastRefresh = 0;
const TIP_ACCOUNTS_REFRESH_MS = 5 * 60 * 1000;

async function refreshTipAccounts(blockEngine) {
  if (Date.now() - _tipAccountsLastRefresh < TIP_ACCOUNTS_REFRESH_MS) return;
  try {
    const result = await jitoRpc(blockEngine, "getTipAccounts", [], 5000);
    if (Array.isArray(result) && result.length > 0) {
      JITO_TIP_ACCOUNTS = result;
      _tipAccountsLastRefresh = Date.now();
      console.log(`[Jito] Tip accounts refreshed: ${result.length} accounts from ${blockEngine}`);
    }
  } catch (e) {
    console.warn(`[Jito] getTipAccounts failed (${e.message}); using fallback list`);
    _tipAccountsLastRefresh = Date.now();
  }
}

function readVars() {
  try { return JSON.parse(fs.readFileSync(VARS_PATH, "utf8")); }
  catch { return {}; }
}

function getJitoConfig() {
  return parseJitoConfig(readVars());
}

function isJitoEnabled() { return getJitoConfig().enabled; }

function randomTipAccount() {
  return new PublicKey(JITO_TIP_ACCOUNTS[Math.floor(Math.random() * JITO_TIP_ACCOUNTS.length)]);
}

function buildTipInstruction(tipLamports) {
  return SystemProgram.transfer({
    fromPubkey: PUBKEY,
    toPubkey: randomTipAccount(),
    lamports: tipLamports,
  });
}

async function jitoRpc(blockEngine, method, params, timeoutMs = 8000) {
  const url = `${blockEngine}/api/v1/bundles`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Jito ${method} ${res.status}: ${text || res.statusText}`);
  }
  const json = await res.json();
  if (json.error) throw new Error(`Jito ${method} error: ${json.error.message || JSON.stringify(json.error)}`);
  return json.result;
}

async function sendBundle(blockEngine, b64Txs) {
  return jitoRpc(blockEngine, "sendBundle", [b64Txs, { encoding: "base64" }]);
}

/**
 * v9: self-throttle to stay under Jito's 1 req/sec free-tier limit.
 * Returns immediately if enough time has passed; otherwise sleeps the
 * minimum required gap. Updates the timestamp BEFORE returning so concurrent
 * callers all serialize through this gate.
 */
async function awaitJitoRateLimitSlot() {
  const now = Date.now();
  const elapsed = now - _lastJitoSubmitAt;
  if (elapsed < JITO_MIN_SUBMIT_INTERVAL_MS) {
    const wait = JITO_MIN_SUBMIT_INTERVAL_MS - elapsed;
    console.log(`[Jito] Throttle: waiting ${wait}ms to stay under 1 req/sec`);
    await sleep(wait);
  }
  _lastJitoSubmitAt = Date.now();
}

async function confirmBundle(blockEngine, bundleId, deadlineMs) {
  while (Date.now() < deadlineMs) {
    try {
      const inflight = await jitoRpc(blockEngine, "getInflightBundleStatuses", [[bundleId]], 3000);
      const s = inflight?.value?.[0];
      if (s) {
        if (s.status === "Landed") return { ok: true, source: "inflight" };
        if (s.status === "Failed" || s.status === "Invalid") {
          return { ok: false, reason: s.status };
        }
      }

      const final = await jitoRpc(blockEngine, "getBundleStatuses", [[bundleId]], 3000);
      const fs2 = final?.value?.[0];
      if (fs2) {
        if (fs2.confirmation_status === "confirmed" || fs2.confirmation_status === "finalized") {
          return { ok: true, source: "final", slot: fs2.slot };
        }
        if (fs2.err && fs2.err !== null) {
          return { ok: false, reason: `Tx err: ${JSON.stringify(fs2.err)}` };
        }
      }
    } catch (e) {
      // network blip - keep trying until deadline
    }
    await sleep(400);
  }
  return { ok: false, reason: "deadline exceeded" };
}

async function confirmBySignature(signature, deadlineMs) {
  while (Date.now() < deadlineMs) {
    try {
      const status = await RPC_CLIENT.getSignatureStatuses([signature], { searchTransactionHistory: false });
      const s = status?.value?.[0];
      if (s) {
        if (s.err) throw new Error(`Tx failed on-chain: ${JSON.stringify(s.err)}`);
        if (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized") return true;
      }
    } catch (e) {
      if (String(e.message || "").includes("Tx failed on-chain")) throw e;
    }
    await sleep(500);
  }
  return false;
}

function extractSignature(serialized) {
  if (serialized.length < 65) throw new Error("Serialized tx too short to contain a signature");
  const sigBytes = new Uint8Array(serialized.buffer, serialized.byteOffset + 1, 64);
  return bs58.encode(Uint8Array.from(sigBytes));
}

/**
 * v8: Enforce a valid fee_recipient at submission time. Overwrites account[1]
 * of any PumpFun ix with a freshly-picked address from Global.fee_recipients.
 */
async function enforceValidFeeRecipient(instructions) {
  try {
    const { pickFeeRecipient } = require("./pumpfunGlobal");
    for (const ix of instructions) {
      if (!ix.programId || ix.programId.toBase58() !== PUMPFUN_PROGRAM_ID_STR) continue;
      if (!ix.keys || ix.keys.length < 4) continue;

      const validRecipient = await pickFeeRecipient();
      if (!validRecipient) {
        console.warn(`[FeeRecipient] No live recipient available, leaving as-is`);
        continue;
      }
      const before = ix.keys[1].pubkey.toBase58();
      const after = validRecipient.toBase58();
      if (before === after) continue;

      console.log(`[FeeRecipient] Swapping ${before.slice(0, 8)}… → ${after.slice(0, 8)}…`);
      ix.keys[1] = {
        pubkey: validRecipient,
        isSigner: ix.keys[1].isSigner,
        isWritable: ix.keys[1].isWritable,
      };
    }
  } catch (e) {
    console.warn(`[FeeRecipient] swap check failed (${e.message}) — proceeding as-is`);
  }
}

async function simulateForDiagnostics(serializedTx, label) {
  try {
    const b64 = serializedTx.toString("base64");
    const res = await fetch(RPC_CLIENT._rpcEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "simulateTransaction",
        params: [
          b64,
          {
            encoding: "base64",
            sigVerify: false,
            replaceRecentBlockhash: true,
            commitment: "processed",
          },
        ],
      }),
    });
    const json = await res.json();
    const value = json?.result?.value;
    if (!value) {
      console.warn(`[Diag] ${label} — RPC simulate returned no data: ${JSON.stringify(json)}`);
      return;
    }
    console.warn(`[Diag] ${label} — RPC simulation result:`);
    if (value.err) {
      console.warn(`[Diag]   err: ${JSON.stringify(value.err)}`);
    } else {
      console.warn(`[Diag]   err: null  (tx would have SUCCEEDED via RPC — Jito-side rejection)`);
    }
    if (value.unitsConsumed != null) {
      console.warn(`[Diag]   compute_units_consumed: ${value.unitsConsumed}`);
    }
    if (Array.isArray(value.logs) && value.logs.length) {
      console.warn(`[Diag]   --- program logs (${value.logs.length} lines) ---`);
      for (const line of value.logs) console.warn(`[Diag]   ${line}`);
      console.warn(`[Diag]   --- end logs ---`);
    } else {
      console.warn(`[Diag]   logs: <none>`);
    }
  } catch (e) {
    console.warn(`[Diag] ${label} — simulate failed: ${e.message}`);
  }
}

function dumpInstructions(instructions, label) {
  console.warn(`[Diag] ${label} — instruction dump:`);
  instructions.forEach((ix, i) => {
    console.warn(`[Diag]   ix[${i}] program=${ix.programId.toBase58()} keys=${ix.keys.length} dataLen=${ix.data?.length ?? 0}`);
    ix.keys.forEach((k, j) => {
      const flags = (k.isSigner ? "S" : "-") + (k.isWritable ? "W" : "r");
      console.warn(`[Diag]     [${String(j).padStart(2)}] ${flags}  ${k.pubkey.toBase58()}`);
    });
  });
}

async function submitTransaction(instructions, label = "TX") {
  const cfg = getJitoConfig();
  const vars = readVars();
  const debug = String(vars.JITO_DEBUG ?? process.env.JITO_DEBUG ?? "false").toLowerCase() === "true";
  const recentBlockhash = await getRecentBlockhash();

  if (cfg.enabled) {
    try {
      await refreshTipAccounts(cfg.blockEngine);

      const tipIx = buildTipInstruction(cfg.tipLamports);

      // v8: rewrite fee_recipient to a valid Global.fee_recipients pick.
      await enforceValidFeeRecipient(instructions);

      const tx = new Transaction();
      for (const ix of instructions) tx.add(ix);
      tx.add(tipIx);
      tx.recentBlockhash = recentBlockhash;
      tx.feePayer = PUBKEY;
      tx.sign(PAYER_KEYPAIR);

      const serialized = tx.serialize();
      const signature = extractSignature(serialized);
      const b64 = serialized.toString("base64");

      if (debug) dumpInstructions(tx.instructions, label);

      // v9: self-throttle to 1 req/sec to avoid Jito free-tier 429s.
      await awaitJitoRateLimitSlot();

      console.log(`[Jito] ${label} — submitting bundle (tip ${cfg.tipLamports} lamports → ${cfg.blockEngine})`);
      const bundleId = await sendBundle(cfg.blockEngine, [b64]);
      console.log(`[Jito] Bundle accepted: ${bundleId} | sig:${signature}`);

      const result = await confirmBundle(cfg.blockEngine, bundleId, Date.now() + 15000);
      if (result.ok) {
        console.log(`[Jito] Landed on-chain: ${signature} (via ${result.source}${result.slot ? ` slot ${result.slot}` : ""})`);
        return { signature, method: "jito", bundleId };
      }

      const landedViaSig = await confirmBySignature(signature, Date.now() + 3000);
      if (landedViaSig) {
        console.log(`[Jito] Landed via signature poll (Jito status was ${result.reason}): ${signature}`);
        return { signature, method: "jito", bundleId };
      }

      console.warn(`[Jito] ${label} — bundle did NOT land (reason: ${result.reason}). Running diagnostic simulate…`);
      console.warn(`[Diag] tx-base64: ${b64}`);
      console.warn(`[Diag] tx-signature: ${signature}`);
      console.warn(`[Diag] inspect on Solscan: https://solscan.io/tx/${signature} (will say 'tx not found' if it never landed)`);
      console.warn(`[Diag] inspect bundle on Jito: https://explorer.jito.wtf/bundle/${bundleId}`);
      if (!debug) dumpInstructions(tx.instructions, label);
      await simulateForDiagnostics(serialized, label);

      throw new Error(`Jito bundle did not land: ${result.reason}`);
    } catch (err) {
      if (!cfg.fallbackRpc) throw err;
      console.warn(`[Jito] ${err.message} — falling back to RPC`);
    }
  }

  const tx = new Transaction();
  for (const ix of instructions) tx.add(ix);
  tx.recentBlockhash = recentBlockhash;
  tx.feePayer = PUBKEY;
  tx.sign(PAYER_KEYPAIR);

  const signature = await RPC_CLIENT.sendRawTransaction(tx.serialize(), {
    skipPreflight: true,
    maxRetries: 0,
  });
  console.log(`[RPC] ${label} — submitted: ${signature}`);
  return { signature, method: "rpc" };
}

const bs58 = require("bs58").default || require("bs58");

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

Object.defineProperty(module.exports, "JITO_ENABLED", {
  enumerable: true,
  get: () => getJitoConfig().enabled,
});

module.exports.submitTransaction = submitTransaction;
module.exports.buildTipInstruction = buildTipInstruction;
module.exports.isJitoEnabled = isJitoEnabled;
module.exports.getJitoConfig = getJitoConfig;
module.exports.parseJitoConfig = parseJitoConfig;
module.exports.extractSignature = extractSignature;