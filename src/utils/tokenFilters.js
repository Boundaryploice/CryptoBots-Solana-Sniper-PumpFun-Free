"use strict";
// ─────────────────────────────────────────────────────────────────────────────
//  tokenFilters.js — Unified Filter Pipeline
//  FIX B-08: mutable filter logic inverted (now correctly rejects mutable tokens)
//  FEATURE: unified runFilters() with structured result + clear logging
// ─────────────────────────────────────────────────────────────────────────────
const { getMint, getAccount, getAssociatedTokenAddressSync } = require("@solana/spl-token");
const {
  RPC_CLIENT, TOKEN_PROGRAM_ID, PUBKEY,
  CHECK_IF_TOKEN_HAS_SOCIALS_AND_WEBSITE,
  CHECK_IF_TOKEN_IS_MUTABLE,
  CHECK_IF_TOKEN_IS_FROZEN,
  CHECK_IF_TOKEN_HAS_LP_BURNED,
  CHECK_IF_TOKEN_IS_RENOUNCED,
  CHECK_IF_MINT_IS_LOCKED,
  MAX_PERCENTAGE_BELONGING_TO_CREATOR,
} = require("../config");

// ── individual checks ─────────────────────────────────────────────────────────

async function hasSocialsAndWebsite(uri) {
  try {
    if (!uri || uri.trim().length === 0) return false;
    const response = await fetch(uri, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return false;
    const metadata = await response.json();
    const hasTwitter = !!(metadata.twitter || metadata.extensions?.twitter);
    const hasTelegram = !!(metadata.telegram || metadata.extensions?.telegram);
    const hasWebsite = !!(metadata.website || metadata.extensions?.website);
    return (hasTwitter || hasTelegram) && hasWebsite;
  } catch {
    return false;
  }
}

async function isTokenMutable(mint, tokenProgramId = TOKEN_PROGRAM_ID) {
  try {
    const mintInfo = await getMint(RPC_CLIENT, mint, undefined, tokenProgramId);
    return mintInfo.mintAuthority !== null; // true = mutable (risky)
  } catch {
    return true; // assume mutable if check fails (safer)
  }
}

async function isTokenFrozen(mint, owner, tokenProgramId = TOKEN_PROGRAM_ID) {
  try {
    const ata = getAssociatedTokenAddressSync(mint, owner, false, tokenProgramId);
    try {
      const tokenAccount = await getAccount(RPC_CLIENT, ata, undefined, tokenProgramId);
      return tokenAccount.isFrozen;
    } catch (e) {
      if (e.message?.includes("could not find account")) return false;
      throw e;
    }
  } catch {
    return false;
  }
}

async function hasLpBurned(bondingCurve) {
  try {
    const accountInfo = await RPC_CLIENT.getAccountInfo(bondingCurve);
    if (!accountInfo) return true; // account closed = curve complete = LP burned
    const IS_COMPLETED_OFFSET = 81;
    if (accountInfo.data.length < IS_COMPLETED_OFFSET + 1) return false;
    return accountInfo.data[IS_COMPLETED_OFFSET] !== 0;
  } catch {
    return false;
  }
}

async function isTokenRenounced(mint, tokenProgramId = TOKEN_PROGRAM_ID) {
  try {
    const mintInfo = await getMint(RPC_CLIENT, mint, undefined, tokenProgramId);
    return mintInfo.mintAuthority === null;
  } catch {
    return false;
  }
}

async function getCreatorTokenPercentage(mint, creator, tokenProgramId = TOKEN_PROGRAM_ID) {
  try {
    const mintInfo = await getMint(RPC_CLIENT, mint, undefined, tokenProgramId);
    const totalSupply = mintInfo.supply;
    if (totalSupply === BigInt(0)) return 0;
    const creatorAta = getAssociatedTokenAddressSync(mint, creator, false, tokenProgramId);
    let creatorBalance = BigInt(0);
    try {
      const creatorAccount = await getAccount(RPC_CLIENT, creatorAta, undefined, tokenProgramId);
      creatorBalance = creatorAccount.amount;
    } catch (e) {
      if (!e.message?.includes("could not find account")) throw e;
    }
    return (Number(creatorBalance) / Number(totalSupply)) * 100;
  } catch {
    return 100; // high value = reject (safe default)
  }
}

// ── FEATURE: Unified filter pipeline ─────────────────────────────────────────

/**
 * Run all enabled filters in sequence.
 * Returns { passed: boolean, reason: string | null }
 */
async function runFilters({ mint, creator, bondingCurve, tokenProgramId, uri }) {
  const checks = [];

  if (CHECK_IF_TOKEN_HAS_SOCIALS_AND_WEBSITE) {
    checks.push({
      name: "SOCIALS_AND_WEBSITE",
      run: async () => {
        const ok = await hasSocialsAndWebsite(uri);
        return { ok, reason: ok ? null : "no socials/website in metadata" };
      },
    });
  }

  if (CHECK_IF_TOKEN_IS_MUTABLE) {
    checks.push({
      name: "IMMUTABILITY",
      run: async () => {
        // FIX B-08: mutable=true means risky → reject. Previous code rejected when false (backwards)
        const mutable = await isTokenMutable(mint, tokenProgramId);
        const ok = !mutable; // pass only if NOT mutable
        return { ok, reason: ok ? null : "mint authority still exists (mutable)" };
      },
    });
  }

  if (CHECK_IF_TOKEN_IS_FROZEN) {
    checks.push({
      name: "NOT_FROZEN",
      run: async () => {
        const frozen = await isTokenFrozen(mint, PUBKEY, tokenProgramId);
        const ok = !frozen;
        return { ok, reason: ok ? null : "token account is frozen" };
      },
    });
  }

  if (CHECK_IF_TOKEN_HAS_LP_BURNED) {
    checks.push({
      name: "LP_BURNED",
      run: async () => {
        const burned = await hasLpBurned(bondingCurve);
        return { ok: burned, reason: burned ? null : "LP not burned" };
      },
    });
  }

  if (CHECK_IF_TOKEN_IS_RENOUNCED) {
    checks.push({
      name: "RENOUNCED",
      run: async () => {
        const renounced = await isTokenRenounced(mint, tokenProgramId);
        return { ok: renounced, reason: renounced ? null : "mint not renounced" };
      },
    });
  }

  if (MAX_PERCENTAGE_BELONGING_TO_CREATOR > 0 && creator) {
    checks.push({
      name: "CREATOR_HOLDINGS",
      run: async () => {
        const pct = await getCreatorTokenPercentage(mint, creator, tokenProgramId);
        const ok = pct <= MAX_PERCENTAGE_BELONGING_TO_CREATOR;
        return { ok, reason: ok ? null : `creator holds ${pct.toFixed(1)}% (max ${MAX_PERCENTAGE_BELONGING_TO_CREATOR}%)` };
      },
    });
  }

  if (checks.length === 0) {
    return { passed: true, reason: null, results: [] };
  }

  const results = [];
  for (const check of checks) {
    try {
      const { ok, reason } = await check.run();
      results.push({ name: check.name, ok, reason });
      if (!ok) {
        return { passed: false, reason: `[${check.name}] ${reason}`, results };
      }
    } catch (err) {
      results.push({ name: check.name, ok: false, reason: `error: ${err.message}` });
      return { passed: false, reason: `[${check.name}] check threw: ${err.message}`, results };
    }
  }

  return { passed: true, reason: null, results };
}

module.exports = {
  hasSocialsAndWebsite,
  isTokenMutable,
  isTokenFrozen,
  hasLpBurned,
  isTokenRenounced,
  getCreatorTokenPercentage,
  runFilters,
};
