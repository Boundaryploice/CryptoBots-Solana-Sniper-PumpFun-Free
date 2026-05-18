"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCreateIdempotentAtaIx = getCreateIdempotentAtaIx;
exports.getBuyIx = getBuyIx;
exports.BREAKING_FEE_RECIPIENTS = void 0;

var web3_js_1 = require("@solana/web3.js");
var spl_token_1 = require("@solana/spl-token");

// ─────────────────────────────────────────────────────────────────────────────
//  pumpfunBuy.js — legacy `buy` instruction builder.
//
//  v5 — 2026-05-14 — POST-2026-04-28 PROGRAM UPGRADE FIX.
//
//  Per the official PumpFun upgrade doc
//  (https://github.com/pump-fun/pump-public-docs/blob/main/docs/BREAKING_FEE_RECIPIENT.md):
//
//  Bonding-curve buy now requires 18 accounts:
//    0-15: Base 16 accounts from IDL (unchanged)
//    16:   bonding_curve_v2 PDA  — seeds: ["bonding-curve-v2", mint]
//    17:   ONE of 8 BREAKING_FEE_RECIPIENTS (mutable, random pick per tx)
//
//  This single fix replaces all prior attempts:
//    - The 16-account-only build that triggered 6062 BuybackFeeRecipientMissing
//    - The 24-account build (16 + 8 buybacks as remaining_accounts) that
//      triggered 6057 BuybackFeeRecipientNotAuthorized
//    - The earlier bonding_curve_v2-as-17th-account build that omitted #17
//
//  The fee_recipient at base index 1 is still picked from Global.fee_recipients
//  by the jito.js enforceValidFeeRecipient() function. That part is correct.
// ─────────────────────────────────────────────────────────────────────────────

// The 8 official BREAKING_FEE_RECIPIENTS published by PumpFun for the
// 2026-04-28 upgrade. One of these (randomly chosen per tx) must be appended
// as the 18th and final account on every buy, AFTER bonding_curve_v2.
var BREAKING_FEE_RECIPIENT_STRINGS = [
    "5YxQFdt3Tr9zJLvkFccqXVUwhdTWJQc1fFg2YPbxvxeD",
    "9M4giFFMxmFGXtc3feFzRai56WbBqehoSeRE5GK7gf7",
    "GXPFM2caqTtQYC2cJ5yJRi9VDkpsYZXzYdwYpGnLmtDL",
    "3BpXnfJaUTiwXnJNe7Ej1rcbzqTTQUvLShZaWazebsVR",
    "5cjcW9wExnJJiqgLjq7DEG75Pm6JBgE1hNv4B2vHXUW6",
    "EHAAiTxcdDwQ3U4bU6YcMsQGaekdzLS3B5SmYo46kJtL",
    "5eHhjP8JaYkz83CWwvGU2uMUXefd3AazWGx4gpcuEEYD",
    "A7hAgCzFw14fejgCp387JUJRMNyz4j89JKnhtKU8piqW",
];
var BREAKING_FEE_RECIPIENTS = BREAKING_FEE_RECIPIENT_STRINGS.map(function (s) { return new web3_js_1.PublicKey(s); });
exports.BREAKING_FEE_RECIPIENTS = BREAKING_FEE_RECIPIENTS;

function pickBreakingFeeRecipient() {
    return BREAKING_FEE_RECIPIENTS[Math.floor(Math.random() * BREAKING_FEE_RECIPIENTS.length)];
}

function deriveBondingCurveV2(mint, programId) {
    return web3_js_1.PublicKey.findProgramAddressSync(
        [Buffer.from("bonding-curve-v2"), mint.toBuffer()],
        programId
    )[0];
}

function getCreateIdempotentAtaIx(payer, mint, owner, tokenProgram) {
    var ata = (0, spl_token_1.getAssociatedTokenAddressSync)(mint, owner, false, tokenProgram);
    return {
        programId: spl_token_1.ASSOCIATED_TOKEN_PROGRAM_ID,
        keys: [
            { pubkey: payer, isSigner: true, isWritable: true },
            { pubkey: ata, isSigner: false, isWritable: true },
            { pubkey: owner, isSigner: false, isWritable: false },
            { pubkey: mint, isSigner: false, isWritable: false },
            { pubkey: web3_js_1.SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: tokenProgram, isSigner: false, isWritable: false },
        ],
        data: Buffer.from([1]),
    };
}

function u64ToLeBytes(value) {
    var buffer = Buffer.allocUnsafe(8);
    buffer.writeBigUInt64LE(value, 0);
    return buffer;
}

/**
 * Builds the PumpFun `buy` instruction with the post-2026-04-28 layout.
 *
 * 18 accounts:
 *   0  global
 *   1  fee_recipient                     (writable, from Global.fee_recipients)
 *   2  mint
 *   3  bonding_curve                     (writable, PDA)
 *   4  associated_bonding_curve          (writable)
 *   5  associated_user                   (writable)
 *   6  user                              (signer + writable)
 *   7  system_program
 *   8  token_program
 *   9  creator_vault                     (writable, PDA)
 *  10  event_authority                   (PDA)
 *  11  program (PumpFun)
 *  12  global_volume_accumulator         (PDA)
 *  13  user_volume_accumulator           (writable, PDA)
 *  14  fee_config                        (PDA)
 *  15  fee_program (pfeeUxB6...)
 *  16  bonding_curve_v2                  (read-only PDA: ["bonding-curve-v2", mint])
 *  17  breaking_fee_recipient            (writable, random pick from 8 published)
 */
function getBuyIx(accounts, params) {
    var discriminator = Buffer.from([102, 6, 61, 18, 1, 218, 235, 234]);
    var amount = typeof params.amount === "bigint" ? params.amount : BigInt(params.amount);
    var maxSolCost = typeof params.maxSolCost === "bigint" ? params.maxSolCost : BigInt(params.maxSolCost);
    var data = Buffer.concat([
        discriminator,
        u64ToLeBytes(amount),
        u64ToLeBytes(maxSolCost),
        Buffer.from([params.trackVolume ? 1 : 0]),
    ]);

    var bondingCurveV2 = deriveBondingCurveV2(accounts.mint, accounts.program);
    var breakingFeeRecipient = pickBreakingFeeRecipient();

    return {
        programId: accounts.program,
        keys: [
            { pubkey: accounts.global,                    isSigner: false, isWritable: false },
            { pubkey: accounts.feeRecipient,              isSigner: false, isWritable: true  },
            { pubkey: accounts.mint,                      isSigner: false, isWritable: false },
            { pubkey: accounts.bondingCurve,              isSigner: false, isWritable: true  },
            { pubkey: accounts.associatedBondingCurve,    isSigner: false, isWritable: true  },
            { pubkey: accounts.associatedUser,            isSigner: false, isWritable: true  },
            { pubkey: accounts.user,                      isSigner: true,  isWritable: true  },
            { pubkey: accounts.systemProgram,             isSigner: false, isWritable: false },
            { pubkey: accounts.tokenProgram,              isSigner: false, isWritable: false },
            { pubkey: accounts.creatorVault,              isSigner: false, isWritable: true  },
            { pubkey: accounts.eventAuthority,            isSigner: false, isWritable: false },
            { pubkey: accounts.program,                   isSigner: false, isWritable: false },
            { pubkey: accounts.globalVolumeAccumulator,   isSigner: false, isWritable: false },
            { pubkey: accounts.userVolumeAccumulator,     isSigner: false, isWritable: true  },
            { pubkey: accounts.feeConfig,                 isSigner: false, isWritable: false },
            { pubkey: accounts.feeProgram,                isSigner: false, isWritable: false },
            // ── POST-2026-04-28 UPGRADE: 2 NEW ACCOUNTS ──
            { pubkey: bondingCurveV2,                     isSigner: false, isWritable: false },
            { pubkey: breakingFeeRecipient,               isSigner: false, isWritable: true  },
        ],
        data: data,
    };
}