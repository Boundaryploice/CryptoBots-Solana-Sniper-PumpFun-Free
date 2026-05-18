"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSwapBaseInputIx = getSwapBaseInputIx;
exports.getCreateIdempotentAtaIx = getCreateIdempotentAtaIx;
exports.getWrapSolIx = getWrapSolIx;
exports.getCloseWsolIx = getCloseWsolIx;
var web3_js_1 = require("@solana/web3.js");
var spl_token_1 = require("@solana/spl-token");
var config_1 = require("../config");
/**
 * Helper to convert BigInt to little-endian 8-byte buffer
 */
function u64ToLeBytes(value) {
    var buffer = Buffer.allocUnsafe(8);
    buffer.writeBigUInt64LE(value, 0);
    return buffer;
}
/**
 * Create swap base input instruction for Raydium CPMM
 * Discriminator: [143, 190, 90, 218, 196, 30, 51, 222]
 */
function getSwapBaseInputIx(accounts, params) {
    var discriminator = Buffer.from([143, 190, 90, 218, 196, 30, 51, 222]);
    var data = Buffer.concat([
        discriminator,
        u64ToLeBytes(params.amountIn),
        u64ToLeBytes(params.minimumAmountOut),
    ]);
    return {
        programId: config_1.RAYDIUM_CPMM_PROGRAM_ID,
        keys: [
            { pubkey: accounts.payer, isSigner: true, isWritable: true },
            { pubkey: accounts.authority, isSigner: false, isWritable: false },
            { pubkey: accounts.ammConfig, isSigner: false, isWritable: false },
            { pubkey: accounts.poolState, isSigner: false, isWritable: true },
            { pubkey: accounts.inputTokenAccount, isSigner: false, isWritable: true },
            { pubkey: accounts.outputTokenAccount, isSigner: false, isWritable: true },
            { pubkey: accounts.inputVault, isSigner: false, isWritable: true },
            { pubkey: accounts.outputVault, isSigner: false, isWritable: true },
            { pubkey: accounts.inputTokenProgram, isSigner: false, isWritable: false },
            { pubkey: accounts.outputTokenProgram, isSigner: false, isWritable: false },
            { pubkey: accounts.inputTokenMint, isSigner: false, isWritable: false },
            { pubkey: accounts.outputTokenMint, isSigner: false, isWritable: false },
            { pubkey: accounts.observationState, isSigner: false, isWritable: true },
        ],
        data: data,
    };
}
/**
 * Create idempotent ATA instructions for both input and output tokens
 */
function getCreateIdempotentAtaIx(accounts) {
    var instructions = [];
    // Create ATA for input token
    var createInputAtaIx = {
        programId: config_1.ASSOCIATED_TOKEN_PROGRAM_ID,
        keys: [
            { pubkey: accounts.payer, isSigner: true, isWritable: true },
            { pubkey: accounts.inputTokenAccount, isSigner: false, isWritable: true },
            { pubkey: accounts.payer, isSigner: false, isWritable: false },
            { pubkey: accounts.inputTokenMint, isSigner: false, isWritable: false },
            { pubkey: web3_js_1.SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: accounts.inputTokenProgram, isSigner: false, isWritable: false },
        ],
        data: Buffer.from([0x01]), // CreateIdempotent instruction discriminator
    };
    // Create ATA for output token
    var createOutputAtaIx = {
        programId: config_1.ASSOCIATED_TOKEN_PROGRAM_ID,
        keys: [
            { pubkey: accounts.payer, isSigner: true, isWritable: true },
            { pubkey: accounts.outputTokenAccount, isSigner: false, isWritable: true },
            { pubkey: accounts.payer, isSigner: false, isWritable: false },
            { pubkey: accounts.outputTokenMint, isSigner: false, isWritable: false },
            { pubkey: web3_js_1.SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: accounts.outputTokenProgram, isSigner: false, isWritable: false },
        ],
        data: Buffer.from([0x01]), // CreateIdempotent instruction discriminator
    };
    instructions.push(createInputAtaIx);
    instructions.push(createOutputAtaIx);
    return instructions;
}
/**
 * Create wrap SOL instructions (transfer SOL to WSOL ATA and sync native)
 */
function getWrapSolIx(accounts, amountIn) {
    var instructions = [];
    // Transfer SOL to WSOL ATA
    var transferIx = web3_js_1.SystemProgram.transfer({
        fromPubkey: accounts.payer,
        toPubkey: accounts.inputTokenAccount,
        lamports: Number(amountIn),
    });
    // Sync native (wrap SOL)
    var syncNativeIx = (0, spl_token_1.createSyncNativeInstruction)(accounts.inputTokenAccount, accounts.inputTokenProgram.equals(spl_token_1.TOKEN_2022_PROGRAM_ID)
        ? spl_token_1.TOKEN_2022_PROGRAM_ID
        : spl_token_1.TOKEN_PROGRAM_ID);
    instructions.push(transferIx);
    instructions.push(syncNativeIx);
    return instructions;
}
/**
 * Create close WSOL account instruction
 */
function getCloseWsolIx(accounts) {
    var wsolAta = (0, spl_token_1.getAssociatedTokenAddressSync)(accounts.payer, config_1.WSOL_MINT, false, accounts.inputTokenProgram.equals(spl_token_1.TOKEN_2022_PROGRAM_ID)
        ? spl_token_1.TOKEN_2022_PROGRAM_ID
        : spl_token_1.TOKEN_PROGRAM_ID);
    // Close account instruction: [9]
    var data = Buffer.from([9]);
    var tokenProgram = accounts.inputTokenProgram.equals(spl_token_1.TOKEN_2022_PROGRAM_ID)
        ? spl_token_1.TOKEN_2022_PROGRAM_ID
        : spl_token_1.TOKEN_PROGRAM_ID;
    return {
        programId: tokenProgram,
        keys: [
            { pubkey: wsolAta, isSigner: false, isWritable: true },
            { pubkey: accounts.payer, isSigner: false, isWritable: true },
            { pubkey: accounts.payer, isSigner: true, isWritable: false },
            { pubkey: accounts.payer, isSigner: false, isWritable: false }, // owner (same as payer for ATA)
        ],
        data: data,
    };
}
