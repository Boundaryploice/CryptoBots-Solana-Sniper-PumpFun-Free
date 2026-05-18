"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSellIx = getSellIx;
exports.getCloseAtaIx = getCloseAtaIx;
exports.BREAKING_FEE_RECIPIENTS = void 0;

var spl_token_1 = require("@solana/spl-token");
var web3_js_1 = require("@solana/web3.js");

// ─────────────────────────────────────────────────────────────────────────────
//  pumpfunSell.js — legacy `sell` instruction builder.
//
//  v2 — 2026-05-14 — POST-2026-04-28 PROGRAM UPGRADE FIX.
//
//  Per the official PumpFun upgrade doc
//  (https://github.com/pump-fun/pump-public-docs/blob/main/docs/BREAKING_FEE_RECIPIENT.md):
//
//  Sell instruction is now 16 accounts for non-cashback coins:
//    0-13: Base 14 accounts from IDL (unchanged)
//    14:   bonding_curve_v2 PDA — seeds: ["bonding-curve-v2", mint]
//    15:   ONE of 8 BREAKING_FEE_RECIPIENTS (mutable, random pick per tx)
//
//  v1 (this file's previous version) used an optional `if (accounts.bondingCurveV2)`
//  guard that almost never fired, so the sell instruction was 14 accounts most
//  of the time — causing AnchorError 6024 Overflow at lib.rs:844 because the
//  program reads past the end of the account list and gets garbage numbers.
// ─────────────────────────────────────────────────────────────────────────────

// Same 8 official recipients as pumpfunBuy.js. Sell uses the same pool.
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

function u64ToLeBytes(value) {
    var buffer = Buffer.allocUnsafe(8);
    buffer.writeBigUInt64LE(value, 0);
    return buffer;
}

/**
 * Create sell instruction (post-2026-04-28 upgrade, 16 accounts).
 * Discriminator: [51, 230, 133, 164, 1, 127, 131, 173]
 *
 * 16 accounts:
 *   0  global
 *   1  fee_recipient              (writable, from Global.fee_recipients)
 *   2  mint
 *   3  bonding_curve              (writable, PDA)
 *   4  associated_bonding_curve   (writable)
 *   5  associated_user            (writable)
 *   6  user                       (signer + writable)
 *   7  system_program
 *   8  creator_vault              (writable, PDA)
 *   9  token_program
 *  10  event_authority            (PDA)
 *  11  program
 *  12  fee_config                 (PDA)
 *  13  fee_program (pfeeUxB6...)
 *  14  bonding_curve_v2           (read-only PDA: ["bonding-curve-v2", mint])
 *  15  breaking_fee_recipient     (writable, random pick from 8 published)
 */
function getSellIx(accounts, params) {
    var discriminator = Buffer.from([51, 230, 133, 164, 1, 127, 131, 173]);
    var amount = typeof params.amount === "bigint" ? params.amount : BigInt(params.amount);
    var minSolOutput = typeof params.minSolOutput === "bigint" ? params.minSolOutput : BigInt(params.minSolOutput);
    var data = Buffer.concat([
        discriminator,
        u64ToLeBytes(amount),
        u64ToLeBytes(minSolOutput),
    ]);

    var bondingCurveV2 = deriveBondingCurveV2(accounts.mint, accounts.program);
    var breakingFeeRecipient = pickBreakingFeeRecipient();

    var keys = [
        { pubkey: accounts.global,                    isSigner: false, isWritable: false },
        { pubkey: accounts.feeRecipient,              isSigner: false, isWritable: true  },
        { pubkey: accounts.mint,                      isSigner: false, isWritable: false },
        { pubkey: accounts.bondingCurve,              isSigner: false, isWritable: true  },
        { pubkey: accounts.associatedBondingCurve,    isSigner: false, isWritable: true  },
        { pubkey: accounts.associatedUser,            isSigner: false, isWritable: true  },
        { pubkey: accounts.user,                      isSigner: true,  isWritable: true  },
        { pubkey: accounts.systemProgram,             isSigner: false, isWritable: false },
        { pubkey: accounts.creatorVault,              isSigner: false, isWritable: true  },
        { pubkey: accounts.tokenProgram,              isSigner: false, isWritable: false },
        { pubkey: accounts.eventAuthority,            isSigner: false, isWritable: false },
        { pubkey: accounts.program,                   isSigner: false, isWritable: false },
        { pubkey: accounts.feeConfig,                 isSigner: false, isWritable: false },
        { pubkey: accounts.feeProgram,                isSigner: false, isWritable: false },
        // ── POST-2026-04-28 UPGRADE: 2 NEW ACCOUNTS ──
        { pubkey: bondingCurveV2,                     isSigner: false, isWritable: false },
        { pubkey: breakingFeeRecipient,               isSigner: false, isWritable: true  },
    ];

    return { programId: accounts.program, keys: keys, data: data };
}

/**
 * Create close ATA instruction. Unchanged from v1.
 */
function getCloseAtaIx(account, destination, authority, tokenProgram) {
    var isToken2022 = tokenProgram.equals(spl_token_1.TOKEN_2022_PROGRAM_ID);
    var programId = isToken2022 ? spl_token_1.TOKEN_2022_PROGRAM_ID : spl_token_1.TOKEN_PROGRAM_ID;
    var data = Buffer.from([9]);
    return {
        programId: programId,
        keys: [
            { pubkey: account, isSigner: false, isWritable: true },
            { pubkey: destination, isSigner: false, isWritable: true },
            { pubkey: authority, isSigner: true, isWritable: false },
            { pubkey: authority, isSigner: false, isWritable: false },
        ],
        data: data,
    };
}