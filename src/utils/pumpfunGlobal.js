"use strict";
// ─────────────────────────────────────────────────────────────────────────────
//  pumpfunGlobal.js — live fetchers for PumpFun program state.
//
//  v4 — 2026-05-14 — Read BUYBACK_FEE_RECIPIENTS from Global.
//
//    The PumpFun Global account stores:
//      offset 41:  fee_recipient (1x)        — legacy single recipient
//      offset 162: fee_recipients[7]         — additional 7 allowed recipients
//      offset 387: buyback_fee_recipients[8] — buyback recipients (NEW REQUIREMENT)
//
//    Note offset 387 has a 1-byte alignment pad after is_cashback_enabled
//    (offset 385) → confirmed empirically by reading mainnet Global PDA
//    4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf on 2026-05-14.
//
//    The program now requires either ZERO or exactly EIGHT buyback recipients
//    as remaining_accounts on every buy/sell (error 6061
//    WrongBuybackFeeRecipientsCount, error 6062 BuybackFeeRecipientMissing).
//    The "chosen" recipient — selected by mint_bytes[0] % 8 — must be marked
//    writable; the other 7 are read-only.
//
//    All older exports (getCachedFeeRecipient, fetchFeeRecipient,
//    fetchFeeRecipientForToken, fetchIsMayhem, getCachedBuybackRecipients,
//    fetchBondingCurveState, MAYHEM_FALLBACK) are preserved as backwards-
//    compat shims so existing processor code keeps working.
// ─────────────────────────────────────────────────────────────────────────────
const { PublicKey } = require("@solana/web3.js");
const { RPC_CLIENT, PUMPFUN_PROGRAM_ID } = require("../config");

const FEE_RECIPIENT_CACHE_MS = 30_000;
const REFRESH_INTERVAL_MS = 15_000;

const FEE_RECIPIENT_OFFSET = 41;
const FEE_RECIPIENTS_ARRAY_OFFSET = 162;
const FEE_RECIPIENTS_ARRAY_LEN = 7;

// Verified empirically on mainnet: there's a 1-byte alignment pad after
// is_cashback_enabled (offset 385) before the buyback array starts.
const BUYBACK_RECIPIENTS_OFFSET = 387;
const BUYBACK_RECIPIENTS_LEN = 8;

let _allowedRecipients = [];      // The 8 valid fee_recipients
let _legacyFeeRecipient = null;   // The first one (Global.fee_recipient)
let _buybackRecipients = [];      // The 8 buyback recipients
let _fetchedAt = 0;
let _globalPda = null;
let _refreshTimer = null;

function getGlobalPda() {
  if (!_globalPda) {
    _globalPda = PublicKey.findProgramAddressSync([Buffer.from("global")], PUMPFUN_PROGRAM_ID)[0];
  }
  return _globalPda;
}

/**
 * Reads the Global account and populates BOTH the allowed fee_recipient set
 * and the buyback_fee_recipients array.
 * Returns the array of 8 PublicKeys (fee_recipients), or null on failure.
 */
async function fetchAllowedFeeRecipients(force = false) {
  const now = Date.now();
  if (!force && _allowedRecipients.length > 0 && (now - _fetchedAt) < FEE_RECIPIENT_CACHE_MS) {
    return _allowedRecipients;
  }
  try {
    const info = await RPC_CLIENT.getAccountInfo(getGlobalPda(), "processed");
    if (!info || !info.data) return null;
    const d = info.data;
    if (d.length < BUYBACK_RECIPIENTS_OFFSET + BUYBACK_RECIPIENTS_LEN * 32) {
      console.warn(`[PumpFun] Global account too short: ${d.length} bytes`);
      return null;
    }

    // Read the 8 fee_recipients
    const legacy = new PublicKey(d.slice(FEE_RECIPIENT_OFFSET, FEE_RECIPIENT_OFFSET + 32));
    const extras = [];
    for (let i = 0; i < FEE_RECIPIENTS_ARRAY_LEN; i++) {
      const off = FEE_RECIPIENTS_ARRAY_OFFSET + i * 32;
      extras.push(new PublicKey(d.slice(off, off + 32)));
    }
    _legacyFeeRecipient = legacy;
    _allowedRecipients = [legacy, ...extras];

    // Read the 8 buyback_fee_recipients
    const buyback = [];
    for (let i = 0; i < BUYBACK_RECIPIENTS_LEN; i++) {
      const off = BUYBACK_RECIPIENTS_OFFSET + i * 32;
      buyback.push(new PublicKey(d.slice(off, off + 32)));
    }
    _buybackRecipients = buyback;

    _fetchedAt = now;

    if (process.env.JITO_DEBUG === "true") {
      console.log(`[PumpFun] fee_recipients (${_allowedRecipients.length}):`);
      _allowedRecipients.forEach((pk, i) => console.log(`  [${i}] ${pk.toBase58()}`));
      console.log(`[PumpFun] buyback_fee_recipients (${_buybackRecipients.length}):`);
      _buybackRecipients.forEach((pk, i) => console.log(`  [${i}] ${pk.toBase58()}`));
    }
    return _allowedRecipients;
  } catch (e) {
    console.warn(`[PumpFun] fetchAllowedFeeRecipients failed: ${e.message}`);
    return null;
  }
}

/**
 * Returns a random valid fee_recipient. Falls back to legacy if cache empty
 * and refresh fails.
 */
async function pickFeeRecipient() {
  const list = await fetchAllowedFeeRecipients();
  if (list && list.length > 0) {
    return list[Math.floor(Math.random() * list.length)];
  }
  return _legacyFeeRecipient;
}

/**
 * Reads virtualSolReserves + virtualTokenReserves from a bonding curve.
 * BondingCurve layout (per IDL):
 *   8  bytes: anchor discriminator
 *   8  bytes: virtual_token_reserves   <-- offset 8
 *   8  bytes: virtual_quote_reserves   <-- offset 16
 */
async function fetchLiveReserves(bondingCurve) {
  try {
    const info = await RPC_CLIENT.getAccountInfo(bondingCurve, "processed");
    if (!info || !info.data || info.data.length < 24) return null;
    return {
      virtualTokenReserves: info.data.readBigUInt64LE(8),
      virtualSolReserves: info.data.readBigUInt64LE(16),
    };
  } catch {
    return null;
  }
}

/**
 * Reads full BondingCurve state per IDL:
 *   8  discriminator
 *   8  virtual_token_reserves
 *   8  virtual_quote_reserves
 *   8  real_token_reserves
 *   8  real_quote_reserves
 *   8  token_total_supply
 *   1  complete
 *   32 creator                  → offset 81
 *   1  is_mayhem_mode           → offset 113
 *   1  is_cashback_coin         → offset 114
 *   32 quote_mint
 */
async function fetchBondingCurveState(bondingCurve) {
  try {
    const info = await RPC_CLIENT.getAccountInfo(bondingCurve, "processed");
    if (!info || !info.data || info.data.length < 115) return null;
    const d = info.data;
    return {
      virtualTokenReserves: d.readBigUInt64LE(8),
      virtualSolReserves: d.readBigUInt64LE(16),
      realTokenReserves: d.readBigUInt64LE(24),
      realSolReserves: d.readBigUInt64LE(32),
      tokenTotalSupply: d.readBigUInt64LE(40),
      complete: d[48] !== 0,
      creator: new PublicKey(d.slice(49, 81)),
      isMayhemMode: d[81] !== 0,
      isCashbackCoin: d[82] !== 0,
    };
  } catch (e) {
    return null;
  }
}

/**
 * Background refresh loop. Idempotent.
 */
function startGlobalRefreshLoop() {
  if (_refreshTimer) return Promise.resolve(_allowedRecipients);
  _refreshTimer = setInterval(() => { fetchAllowedFeeRecipients(true).catch(() => {}); }, REFRESH_INTERVAL_MS);
  if (_refreshTimer.unref) _refreshTimer.unref();
  return fetchAllowedFeeRecipients(true);
}

// ─────────────────────────────────────────────────────────────────────────────
// Backwards-compat shims for older processor code.
// ─────────────────────────────────────────────────────────────────────────────

async function fetchFeeRecipient(force = false) {
  await fetchAllowedFeeRecipients(force);
  return _legacyFeeRecipient;
}

function getCachedFeeRecipient() {
  return _legacyFeeRecipient;
}

/**
 * Returns the 8 buyback_fee_recipients from Global. These are appended as
 * remaining_accounts on every buy/sell to satisfy the post-2026 cashback
 * upgrade. The processor calls this to populate buyAccounts.buybackRecipients.
 */
function getCachedBuybackRecipients() {
  return _buybackRecipients.length > 0 ? _buybackRecipients.slice() : [];
}

function getCachedFeeRecipientForToken() {
  if (_allowedRecipients.length === 0) {
    return { feeRecipient: _legacyFeeRecipient, isMayhem: false };
  }
  const pick = _allowedRecipients[Math.floor(Math.random() * _allowedRecipients.length)];
  return { feeRecipient: pick, isMayhem: false };
}

async function fetchFeeRecipientForToken(_bondingCurve) {
  const pick = await pickFeeRecipient();
  return { feeRecipient: pick, isMayhem: false };
}

async function fetchIsMayhem(bondingCurve) {
  const state = await fetchBondingCurveState(bondingCurve);
  return state ? state.isMayhemMode : false;
}

const MAYHEM_FALLBACK = [];

module.exports = {
  // New (IDL-correct) API
  fetchAllowedFeeRecipients,
  pickFeeRecipient,
  fetchLiveReserves,
  fetchBondingCurveState,
  startGlobalRefreshLoop,

  // Backwards-compat shims for the processor
  fetchFeeRecipient,
  getCachedFeeRecipient,
  getCachedFeeRecipientForToken,
  getCachedBuybackRecipients,
  fetchFeeRecipientForToken,
  fetchIsMayhem,
  MAYHEM_FALLBACK,
};