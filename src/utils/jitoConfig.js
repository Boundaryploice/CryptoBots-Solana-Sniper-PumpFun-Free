"use strict";
// Pure helpers for resolving the Jito runtime config from a `variables`-like
// object. Lives in its own file so tests can exercise the defaults / floor /
// dashboard-string-boolean handling without booting @solana/web3.js or the
// keypair load.

const MIN_JITO_TIP = 1000; // Jito's hard floor

function asBool(v, d = false) {
  if (v === undefined || v === null || v === "") return d;
  return String(v).toLowerCase() === "true";
}

function asInt(v, d) {
  if (v === undefined || v === null || v === "") return d;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : d;
}

function parseJitoConfig(v) {
  v = v || {};
  return {
    enabled: true,
    tipLamports: Math.max(MIN_JITO_TIP, 10000000),
    blockEngine: (v.JITO_BLOCK_ENGINE || "https://mainnet.block-engine.jito.wtf").replace(/\/+$/, ""),
    fallbackRpc: asBool(v.JITO_FALLBACK_TO_RPC, true),
  };
}

module.exports = { MIN_JITO_TIP, asBool, asInt, parseJitoConfig };
