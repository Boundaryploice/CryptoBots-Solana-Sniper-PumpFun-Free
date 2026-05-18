"use strict";
// Pure decision helpers extracted from autoSell.js so the take-profit ordering
// (B-02), cost-basis math (B-06), and trailing-stop logic (Phase 6) can be
// unit-tested without booting RPC, the keypair, or the AutoSellManager singleton.
//
// Behaviour is byte-identical to the original inlined formulas.

function pctOf(amount, pct) {
  return (amount * BigInt(Math.floor(pct * 100))) / 10000n;
}

// FIX B-06: proportional cost basis after partial sells.
// `m` is an AutoSellManager monitor; we read the same fields the inlined
// version did, no extras.
function calcPnL(m, price) {
  const rem   = Number(m.remainingTokenAmount);
  const total = Number(m.totalTokenAmount);
  const curSol  = (rem * price) / 1e9;
  const costSol = total > 0 && m.totalSolSpent > 0
    ? (rem / total) * (m.totalSolSpent / 1e9)
    : (rem * m.buyPrice) / 1e9;
  const pnlSol = curSol - costSol;
  const pnlPct = costSol > 0 ? (pnlSol / costSol) * 100 : ((price - m.buyPrice) / m.buyPrice) * 100;
  return { pnlSol, pnlPct };
}

// FIX B-02: Take-profit ordering. TP2 cannot fire until TP1 has, TP3 cannot
// fire until TP2 has. At most one level fires per evaluation tick.
function evalTakeProfit({ pnlPct, level1Triggered, level2Triggered, level3Triggered, tp1, tp2, tp3 }) {
  if (tp1 > 0 && pnlPct >= tp1 && !level1Triggered) return { level: 1 };
  if (tp2 > 0 && pnlPct >= tp2 && level1Triggered && !level2Triggered) return { level: 2 };
  if (tp3 > 0 && pnlPct >= tp3 && level2Triggered && !level3Triggered) return { level: 3 };
  return { level: null };
}

// PHASE 6: trailing-stop decision.
// Pure: takes current state, returns the new peak + whether activation/trigger
// should occur. Caller mutates the monitor and emits events.
function evalTrailingStop({
  enabled,
  price,
  peakPrice,
  activated,
  pnlPct,
  activationPct,
  distancePct,
}) {
  if (!enabled) {
    return { newPeak: peakPrice, activated, newlyActivated: false, triggered: false, drawdownPct: 0 };
  }
  const newPeak = price > peakPrice ? price : peakPrice;
  const newlyActivated = !activated && pnlPct >= activationPct;
  const isActivated = activated || newlyActivated;
  if (isActivated) {
    const stopPrice = newPeak * (1 - distancePct / 100);
    if (price <= stopPrice) {
      const drawdownPct = newPeak > 0 ? ((newPeak - price) / newPeak) * 100 : 0;
      return { newPeak, activated: true, newlyActivated, triggered: true, drawdownPct };
    }
  }
  return { newPeak, activated: isActivated, newlyActivated, triggered: false, drawdownPct: 0 };
}

module.exports = { pctOf, calcPnL, evalTakeProfit, evalTrailingStop };
