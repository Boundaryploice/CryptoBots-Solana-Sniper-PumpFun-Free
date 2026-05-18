"use strict";
// ─────────────────────────────────────────────────────────────────────────────
//  autoSell.js — Phases 1-2-3-6 combined
//
//  v3 — 2026-05-14 — FIX SELL OVERFLOW (6024 at lib.rs:844)
//    PumpFun's sell instruction overflows when amount * v_sol_reserves
//    exceeds u64::MAX. For a fresh-launch bonding curve with ~30 SOL
//    virtual reserves, the safe amount cap is roughly:
//        u64_max / 34e9 ≈ 540,000,000 raw units (= ~540 tokens at 6 decimals)
//    But we typically buy ~150,000-250,000 tokens at 6 decimals
//    (~1.5e11 to 2.5e11 raw units). Selling the full balance in one
//    instruction overflows.
//
//    Fix: compute the max safe amount per call as u64_max / v_sol_reserves
//    and chunk the sell across multiple instructions if needed. For a
//    snipe-sized position, this typically means 2-3 sub-sells.
//
//  v2 — 2026-05-14 — FIX SELL-CREATOR-DRIFT
//  ...
// ─────────────────────────────────────────────────────────────────────────────
const { Transaction, ComputeBudgetProgram, SystemProgram, PublicKey } = require("@solana/web3.js");
const { getAssociatedTokenAddressSync } = require("@solana/spl-token");
const {
  PUBKEY, PAYER_KEYPAIR, RPC_CLIENT,
  PUMPFUN_PROGRAM_ID, PUMPFUN_FEE_RECIPIENT, PUMPFUN_FEE_CONFIG, PUMPFUN_FEE_PROGRAM,
  SLIPPAGE, PRIORITY_FEE_CU, PRIORITY_FEE_MICRO_LAMPORTS,
  AUTO_SELL_ENABLED,
  TAKE_PROFIT_LEVEL_1, TAKE_PROFIT_LEVEL_2, TAKE_PROFIT_LEVEL_3,
  PERCENTAGE_OF_TOKENS_TO_SELL_AT_LEVEL_1, PERCENTAGE_OF_TOKENS_TO_SELL_AT_LEVEL_2,
  STOP_LOSS_PERCENTAGE, AUTO_SELL_LIFETIME_SECONDS, PRICE_CHECK_INTERVAL_SECONDS,
  TOKEN_PROGRAM_ID, WSOL_MINT,
} = require("../config");

const variables = require("../../variables.json");
const { getSellIx } = require("../instructions/pumpfunSell");
const { getSwapBaseInputIx } = require("../instructions/raydiumCpmmSwap");
const { TokenPriceService } = require("./tokenPrice");
const { getRecentBlockhash } = require("./blockhash");
const { cpmmSwapBaseInput } = require("./cpmmSwapQuote");
const { fetchFeeRecipient, getCachedBuybackRecipients, pickFeeRecipient } = require("./pumpfunGlobal");
const sellLogic = require("./sellLogic");
const { pctOf, calcPnL, evalTakeProfit, evalTrailingStop } = sellLogic;

const TRAILING_STOP_ENABLED       = false;
const TRAILING_STOP_ACTIVATION_PCT = parseFloat(String(variables.TRAILING_STOP_ACTIVATION_PCT ?? "10"));
const TRAILING_STOP_DISTANCE_PCT   = parseFloat(String(variables.TRAILING_STOP_DISTANCE_PCT   ?? "5"));

const U64_MAX = (1n << 64n) - 1n;

const DexType = { Pumpfun: 0, RaydiumCpmm: 1 };
let _dash = null;
function setDashboardEmitter(fn) { _dash = fn; }
function emit(ev, data) { if (_dash) _dash(ev, data); }

let botPaused = false;
function isBotPaused() { return botPaused; }
function setBotPaused(v) { botPaused = v; }

async function fetchFreshCreator(bondingCurve) {
  try {
    const info = await RPC_CLIENT.getAccountInfo(bondingCurve, "processed");
    if (!info || !info.data || info.data.length < 81) return null;
    return new PublicKey(info.data.slice(49, 81));
  } catch {
    return null;
  }
}

/**
 * v3 fix: compute the max sell amount that won't overflow PumpFun's
 * internal u64 math (amount * v_sol_reserves at lib.rs:844). Subtract
 * a 10% safety margin so the program's own intermediate adds don't
 * overflow either.
 */
function maxSafeSellAmount(virtualSolReserves) {
  if (!virtualSolReserves || virtualSolReserves === 0n) {
    return U64_MAX; // no clamp possible; let the program decide
  }
  const ceiling = U64_MAX / virtualSolReserves;
  // 90% safety margin
  return (ceiling * 9n) / 10n;
}

class AutoSellManager {
  constructor() {
    this.monitors = new Map();
    if (AUTO_SELL_ENABLED) {
      console.log("[AutoSell] Enabled");
      if (TRAILING_STOP_ENABLED)
        console.log(`[AutoSell] Trailing stop — activation:+${TRAILING_STOP_ACTIVATION_PCT}% / distance:${TRAILING_STOP_DISTANCE_PCT}%`);
    }
  }

  addToken(mint, buyPrice, tokenAmount, tokenAccount,
           bondingCurve, associatedBondingCurve, creator, tokenProgramId,
           virtualSolReserves, virtualTokenReserves,
           dexType = DexType.Pumpfun,
           raydiumCpmmAccounts, poolState, ammConfig) {
    if (!AUTO_SELL_ENABLED) return;
    const mintStr = mint.toBase58();
    const m = {
      mint, dexType, buyPrice,
      buyTimestamp: Date.now(),
      totalTokenAmount: tokenAmount,
      tokenAmount,
      remainingTokenAmount: tokenAmount,
      tokenAccount, bondingCurve, associatedBondingCurve,
      creator, tokenProgramId,
      virtualSolReserves, virtualTokenReserves,
      isActive: true,
      priceService: new TokenPriceService(),
      level1Triggered: false,
      level2Triggered: false,
      level3Triggered: false,
      raydiumCpmmAccounts, poolState, ammConfig,
      totalSolSpent: 0,
      peakPrice: buyPrice,
      trailingStopActivated: false,
    };
    this.monitors.set(mintStr, m);
    emit("position_opened", this._snap(mintStr, m));
    this._loop(mintStr);
    this._log(mintStr);
  }

  setEntryCost(mint, lamports) {
    const m = this.monitors.get(mint.toBase58());
    if (m) m.totalSolSpent = lamports;
  }

  removeToken(mint) { this.monitors.delete(mint.toBase58()); }

  getOpenPositionCount() {
    let count = 0;
    for (const m of this.monitors.values()) {
      if (m.isActive && m.remainingTokenAmount > 0) count++;
    }
    return count;
  }

  getSnapshot() {
    return [...this.monitors.entries()].map(([k, v]) => this._snap(k, v));
  }

  _snap(mintStr, m) {
    return {
      mint: mintStr,
      dexType: m.dexType === DexType.Pumpfun ? "PumpFun" : "Raydium CPMM",
      buyPrice: m.buyPrice, buyTimestamp: m.buyTimestamp,
      remainingTokenAmount: m.remainingTokenAmount.toString(),
      totalTokenAmount: m.totalTokenAmount.toString(),
      isActive: m.isActive,
      level1Triggered: m.level1Triggered,
      level2Triggered: m.level2Triggered,
      level3Triggered: m.level3Triggered,
      peakPrice: m.peakPrice,
      trailingStopActivated: m.trailingStopActivated,
    };
  }

  async _refreshReserves(m) {
    try {
      const info = await RPC_CLIENT.getAccountInfo(m.bondingCurve);
      if (!info || info.data.length < 24) return;
      m.virtualTokenReserves = info.data.readBigUInt64LE(8);
      m.virtualSolReserves   = info.data.readBigUInt64LE(16);
    } catch { /* keep stale */ }
  }

  async _log(mintStr) {
    while (true) {
      await sleep(1000);
      const m = this.monitors.get(mintStr);
      if (!m || !m.isActive) break;
      try {
        const price = await m.priceService.getTokenPrice(mintStr, m.virtualSolReserves, m.virtualTokenReserves);
        if (!price) continue;
        const { pnlSol, pnlPct } = calcPnL(m, price);
        const ts = m.trailingStopActivated
          ? ` [Trail peak:${m.peakPrice.toExponential(3)} → stop@${(m.peakPrice*(1-TRAILING_STOP_DISTANCE_PCT/100)).toExponential(3)}]`
          : "";
        console.log(`[PROFIT] ${mintStr.substring(0,8)}… ${pnlPct>=0?"+":""}${pnlPct.toFixed(2)}% (${pnlSol>=0?"+":""}${pnlSol.toFixed(6)} SOL)${ts}`);
        emit("pnl_update", { mint: mintStr, price, pnlSol, pnlPct, remaining: m.remainingTokenAmount.toString(), peakPrice: m.peakPrice, trailingStopActivated: m.trailingStopActivated });
      } catch { /* silent */ }
    }
  }

  async _loop(mintStr) {
    const checkMs    = PRICE_CHECK_INTERVAL_SECONDS * 1000;
    const lifetimeMs = AUTO_SELL_LIFETIME_SECONDS * 1000;

    while (true) {
      await sleep(checkMs);
      const m = this.monitors.get(mintStr);
      if (!m || !m.isActive) break;

      if (m.dexType === DexType.Pumpfun) await this._refreshReserves(m);

      if (AUTO_SELL_LIFETIME_SECONDS > 0 && Date.now() - m.buyTimestamp >= lifetimeMs) {
        console.log(`[AutoSell] Lifetime expired: ${mintStr.substring(0,8)}…`);
        m.isActive = false;
        await this.executeSell(m, m.remainingTokenAmount, true);
        this.monitors.delete(mintStr);
        emit("position_closed", { mint: mintStr, reason: "lifetime_expired" });
        break;
      }

      let price;
      try {
        price = await m.priceService.getTokenPrice(mintStr, m.virtualSolReserves, m.virtualTokenReserves);
        if (!price) continue;
      } catch { continue; }

      const { pnlPct } = calcPnL(m, price);

      if (TRAILING_STOP_ENABLED) {
        const t = evalTrailingStop({
          enabled: true,
          price,
          peakPrice: m.peakPrice,
          activated: m.trailingStopActivated,
          pnlPct,
          activationPct: TRAILING_STOP_ACTIVATION_PCT,
          distancePct: TRAILING_STOP_DISTANCE_PCT,
        });
        m.peakPrice = t.newPeak;
        if (t.newlyActivated) {
          m.trailingStopActivated = true;
          console.log(`[TrailingStop] ACTIVATED: ${mintStr.substring(0,8)}… at +${pnlPct.toFixed(2)}% | peak:${m.peakPrice.toExponential(3)}`);
        } else {
          m.trailingStopActivated = t.activated;
        }
        if (t.triggered) {
          const dd = t.drawdownPct.toFixed(2);
          console.log(`[TrailingStop] TRIGGERED: ${mintStr.substring(0,8)}… | -${dd}% from peak | net P/L:${pnlPct>=0?"+":""}${pnlPct.toFixed(2)}%`);
          m.isActive = false;
          const sold = await this.executeSell(m, m.remainingTokenAmount, true);
          if (sold) m.remainingTokenAmount = BigInt(0);
          this.monitors.delete(mintStr);
          emit("position_closed", { mint: mintStr, reason: "trailing_stop", pnlPct, drawdownPct: parseFloat(dd) });
          break;
        }
      }

      if (STOP_LOSS_PERCENTAGE > 0 && !(TRAILING_STOP_ENABLED && m.trailingStopActivated)) {
        if (pnlPct <= -STOP_LOSS_PERCENTAGE) {
          console.log(`[AutoSell] STOP LOSS: ${mintStr.substring(0,8)}… at ${pnlPct.toFixed(2)}%`);
          m.isActive = false;
          const sold = await this.executeSell(m, m.remainingTokenAmount, true);
          if (sold) m.remainingTokenAmount = BigInt(0);
          this.monitors.delete(mintStr);
          emit("position_closed", { mint: mintStr, reason: "stop_loss", pnlPct });
          break;
        }
      }

      if (m.remainingTokenAmount > 0n) {
        const tp = evalTakeProfit({
          pnlPct,
          level1Triggered: m.level1Triggered,
          level2Triggered: m.level2Triggered,
          level3Triggered: m.level3Triggered,
          tp1: TAKE_PROFIT_LEVEL_1,
          tp2: TAKE_PROFIT_LEVEL_2,
          tp3: TAKE_PROFIT_LEVEL_3,
        });
        if (tp.level === 1) {
          const toSell = pctOf(m.remainingTokenAmount, PERCENTAGE_OF_TOKENS_TO_SELL_AT_LEVEL_1);
          if (toSell > 0n) {
            console.log(`[AutoSell] TP1 (${TAKE_PROFIT_LEVEL_1}%) → sell ${PERCENTAGE_OF_TOKENS_TO_SELL_AT_LEVEL_1}%`);
            m.level1Triggered = true;
            const ok = await this.executeSell(m, toSell, false);
            if (ok) m.remainingTokenAmount -= toSell;
            emit("partial_sell", { mint: mintStr, level: 1, pnlPct, sold: ok });
          }
        } else if (tp.level === 2) {
          const toSell = pctOf(m.remainingTokenAmount, PERCENTAGE_OF_TOKENS_TO_SELL_AT_LEVEL_2);
          if (toSell > 0n) {
            console.log(`[AutoSell] TP2 (${TAKE_PROFIT_LEVEL_2}%) → sell ${PERCENTAGE_OF_TOKENS_TO_SELL_AT_LEVEL_2}%`);
            m.level2Triggered = true;
            const ok = await this.executeSell(m, toSell, false);
            if (ok) m.remainingTokenAmount -= toSell;
            emit("partial_sell", { mint: mintStr, level: 2, pnlPct, sold: ok });
          }
        } else if (tp.level === 3) {
          console.log(`[AutoSell] TP3 (${TAKE_PROFIT_LEVEL_3}%) → sell all`);
          m.level3Triggered = true;
          m.isActive = false;
          const ok = await this.executeSell(m, m.remainingTokenAmount, true);
          if (ok) m.remainingTokenAmount = 0n;
          this.monitors.delete(mintStr);
          emit("position_closed", { mint: mintStr, reason: "tp3", pnlPct });
          break;
        }
      }
    }
  }

  /**
   * Execute one sell instruction. If amountToSell exceeds the u64-overflow
   * ceiling for the current bonding-curve reserves, we chunk into multiple
   * sequential sub-sells.
   */
  async executeSell(monitor, amountToSell, isFinalSell) {
    try {
      const bal = await RPC_CLIENT.getTokenAccountBalance(monitor.tokenAccount);
      if (!bal || bal.value.amount === "0") return false;
      const available = BigInt(bal.value.amount);
      const totalToSell = amountToSell > available ? available : amountToSell;
      if (totalToSell === 0n) return false;

      // v3 (2026-05-14): chunk to avoid 6024 Overflow at lib.rs:844.
      // PumpFun's sell math does amount * v_sol_reserves in u64; if our
      // amount is a large fraction of vTokens this product exceeds u64.
      const maxPerCall = monitor.dexType === DexType.Pumpfun
        ? maxSafeSellAmount(monitor.virtualSolReserves)
        : U64_MAX; // CPMM doesn't have the same overflow issue

      let remainingToSell = totalToSell;
      let anyChunkSucceeded = false;
      let chunkIdx = 0;

      while (remainingToSell > 0n) {
        const thisChunk = remainingToSell > maxPerCall ? maxPerCall : remainingToSell;
        chunkIdx++;
        if (totalToSell > maxPerCall) {
          console.log(`[AutoSell] Chunk ${chunkIdx}: selling ${thisChunk} of ${remainingToSell} remaining (max safe ${maxPerCall})`);
        }

        const ok = await this._executeSellChunk(monitor, thisChunk, isFinalSell && remainingToSell === thisChunk);
        if (!ok) {
          // chunk failed — don't attempt remaining chunks this cycle
          console.warn(`[AutoSell] Chunk ${chunkIdx} failed, aborting remaining chunks for this cycle`);
          return anyChunkSucceeded;
        }
        anyChunkSucceeded = true;
        remainingToSell -= thisChunk;

        // Refresh reserves between chunks so the next chunk's clamp is accurate
        if (remainingToSell > 0n) {
          await this._refreshReserves(monitor);
          // Brief pause to avoid hammering RPC and to let blockhash advance
          await sleep(800);
        }
      }
      return anyChunkSucceeded;
    } catch (err) {
      console.error(`[AutoSell] Failed: ${err.message}`);
      return false;
    }
  }

  /**
   * Build, sign, and submit one sell transaction for a chunk of tokens.
   * Same logic as the old executeSell, just extracted.
   */
  async _executeSellChunk(monitor, tokenAmount, isFinalSell) {
    try {
      let minSolOutput;
      if (monitor.virtualSolReserves && monitor.virtualTokenReserves) {
        const out = (tokenAmount * monitor.virtualSolReserves) / (monitor.virtualTokenReserves + tokenAmount);
        minSolOutput = (out * BigInt(Math.floor((1 - SLIPPAGE) * 1000))) / 1000n;
        if (minSolOutput === 0n) minSolOutput = 1n;
      } else {
        const price = await monitor.priceService.getTokenPrice(monitor.mint.toBase58(), monitor.virtualSolReserves, monitor.virtualTokenReserves);
        minSolOutput = BigInt(Math.floor(Number(tokenAmount) * price * (1 - SLIPPAGE)));
        if (minSolOutput === 0n) minSolOutput = 1n;
      }

      const instructions = [
        ComputeBudgetProgram.setComputeUnitLimit({ units: PRIORITY_FEE_CU }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: PRIORITY_FEE_MICRO_LAMPORTS }),
      ];

      if (monitor.dexType === DexType.Pumpfun) {
        const freshCreator = await fetchFreshCreator(monitor.bondingCurve);
        const effectiveCreator = freshCreator || monitor.creator;
        if (freshCreator && !freshCreator.equals(monitor.creator)) {
          console.log(`[AutoSell] Creator drift detected: stored=${monitor.creator.toBase58().slice(0,8)}… → fresh=${freshCreator.toBase58().slice(0,8)}…`);
        }

        let liveFeeRecipient;
        try {
          liveFeeRecipient = await pickFeeRecipient();
        } catch {
          liveFeeRecipient = await fetchFeeRecipient();
        }
        if (!liveFeeRecipient) {
          console.error("[AutoSell] Skipped: could not read live fee_recipient from PumpFun global PDA");
          return false;
        }

        const global = PublicKey.findProgramAddressSync([Buffer.from("global")], PUMPFUN_PROGRAM_ID)[0];
        const eventAuth = PublicKey.findProgramAddressSync([Buffer.from("__event_authority")], PUMPFUN_PROGRAM_ID)[0];
        const creatorVault = PublicKey.findProgramAddressSync(
          [Buffer.from("creator-vault"), effectiveCreator.toBuffer()],
          PUMPFUN_PROGRAM_ID,
        )[0];
        const assocUser = getAssociatedTokenAddressSync(monitor.mint, PUBKEY, false, monitor.tokenProgramId);

        instructions.push(getSellIx({
          global, feeRecipient: liveFeeRecipient, mint: monitor.mint,
          bondingCurve: monitor.bondingCurve, associatedBondingCurve: monitor.associatedBondingCurve,
          associatedUser: assocUser, user: PUBKEY,
          systemProgram: SystemProgram.programId,
          creatorVault, tokenProgram: monitor.tokenProgramId,
          eventAuthority: eventAuth, program: PUMPFUN_PROGRAM_ID,
          feeConfig: PUMPFUN_FEE_CONFIG, feeProgram: PUMPFUN_FEE_PROGRAM,
        }, { amount: tokenAmount, minSolOutput }));
      } else if (monitor.dexType === DexType.RaydiumCpmm && monitor.raydiumCpmmAccounts) {
        const sa = {
          ...monitor.raydiumCpmmAccounts,
          inputTokenAccount: monitor.tokenAccount,
          outputTokenAccount: monitor.raydiumCpmmAccounts.inputTokenAccount,
          inputVault: monitor.raydiumCpmmAccounts.outputVault,
          outputVault: monitor.raydiumCpmmAccounts.inputVault,
          inputTokenMint: monitor.mint, outputTokenMint: WSOL_MINT,
          inputTokenProgram: monitor.tokenProgramId,
          outputTokenProgram: monitor.raydiumCpmmAccounts.outputTokenProgram,
        };
        let minOut = minSolOutput;
        if (monitor.virtualTokenReserves && monitor.virtualSolReserves && monitor.ammConfig) {
          const q = cpmmSwapBaseInput(tokenAmount, monitor.virtualTokenReserves, monitor.virtualSolReserves, monitor.ammConfig.toBase58());
          minOut = (q * BigInt(Math.floor((1 - SLIPPAGE) * 1000))) / 1000n;
        }
        instructions.push(getSwapBaseInputIx(sa, { amountIn: tokenAmount, minimumAmountOut: minOut }));
      } else {
        return false;
      }

      const recentBlockhash = await getRecentBlockhash();
      const tx = new Transaction();
      for (const ix of instructions) tx.add(ix);
      tx.recentBlockhash = recentBlockhash;
      tx.feePayer = PUBKEY;
      tx.sign(PAYER_KEYPAIR);

      const sig = await RPC_CLIENT.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 3 });
      console.log(`[AutoSell] Submitted: ${sig}`);
      await RPC_CLIENT.confirmTransaction(sig, "confirmed");
      console.log(`[AutoSell] Confirmed: ${sig}`);

      if (!isFinalSell) {
        const upd = await RPC_CLIENT.getTokenAccountBalance(monitor.tokenAccount);
        if (upd?.value?.amount) monitor.remainingTokenAmount = BigInt(upd.value.amount);
      }
      return true;
    } catch (err) {
      console.error(`[AutoSell] Chunk failed: ${err.message}`);
      return false;
    }
  }

  async sellAll(percent = 100) {
    for (const [mintStr, m] of this.monitors) {
      if (!m.isActive) continue;
      try {
        const toSell = pctOf(m.remainingTokenAmount, percent);
        if (toSell === 0n) continue;
        const final = percent === 100;
        const ok = await this.executeSell(m, toSell, final);
        if (ok) {
          m.remainingTokenAmount -= toSell;
          if (final) { m.isActive = false; this.monitors.delete(mintStr); }
        }
      } catch (e) { console.error(`[Controls] ${e.message}`); }
    }
  }

  listPositions() {
    if (!this.monitors.size) { console.log("[Positions] None open."); return; }
    console.log(`\n[Positions] ${this.monitors.size} open:`);
    for (const [k, m] of this.monitors) {
      const age = ((Date.now() - m.buyTimestamp) / 1000).toFixed(0);
      const trail = m.trailingStopActivated ? ` [Trail:${m.peakPrice.toExponential(3)}]` : "";
      console.log(`  ${k.substring(0,8)}… age:${age}s TP:${+m.level1Triggered}${+m.level2Triggered}${+m.level3Triggered}${trail}`);
    }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const autoSellManager = new AutoSellManager();

module.exports = {
  DexType, AutoSellManager, autoSellManager, calcPnL,
  isBotPaused, setBotPaused, setDashboardEmitter,
  TRAILING_STOP_ENABLED, TRAILING_STOP_ACTIVATION_PCT, TRAILING_STOP_DISTANCE_PCT,
};