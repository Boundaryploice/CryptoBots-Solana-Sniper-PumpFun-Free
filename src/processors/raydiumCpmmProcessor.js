"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
// Stub — loadConfig was referenced in original compiled output but never defined
function loadConfig() { return require("../config"); }
exports.loadConfig = loadConfig;
exports.processRaydiumCpmmInitialize = processRaydiumCpmmInitialize;
var web3_js_1 = require("@solana/web3.js");
var spl_token_1 = require("@solana/spl-token");
var fs = __importStar(require("fs"));
var config_1 = require("../config");
var raydiumCpmmSwap_1 = require("../instructions/raydiumCpmmSwap");
var q = __importStar(require("../config"));
var w = q;
var cpmmSwapQuote_1 = require("../utils/cpmmSwapQuote");
var token_1 = require("../utils/token");
var tokenFilters_1 = require("../utils/tokenFilters");
// Store processed signatures to avoid duplicates
var processedSignatures = new Set();
// Initialize instruction discriminator: [175, 175, 109, 31, 13, 152, 155, 237]
var INITIALIZE_DISCRIMINATOR = Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]);
/**
 * Get pre/post token balance from token balances
 */
var RESET = "\u001b[0m";
var RED = "\u001b[31m";
var YELLOW = "\u001b[33m";
var GREEN = "\u001b[32m";
var BLUE = '\u001b[36m';
function getPrePostTokenBalance(preBalances, postBalances, owner, mint) {
    var preBalance = preBalances.find(function (b) { return b.owner === owner && b.mint === mint; });
    var postBalance = postBalances.find(function (b) { return b.owner === owner && b.mint === mint; });
    var pre = preBalance ? BigInt(preBalance.uiTokenAmount.amount) : BigInt(0);
    var post = postBalance ? BigInt(postBalance.uiTokenAmount.amount) : BigInt(0);
    return [pre, post];
}
function removeString(fileName, strToRemove) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            fs.readFile(fileName, 'utf8', function (err, data) {
                var splitArray = data.split('\n');
                splitArray.splice(strToRemove, 1);
                var result = splitArray.join('\n');
                fs.writeFileSync(fileName, result);
            });
            return [2 /*return*/];
        });
    });
}
/**
 * Process Raydium CPMM Initialize instruction
 */
function processRaydiumCpmmInitialize(signature, accountKeys, innerInstructions, logMessages, transaction, preTokenBalances, postTokenBalances) {
    return __awaiter(this, void 0, void 0, function () {
        var initializeIx, accountKeyIndexes, instructions_1, i, ix, programIdIndex, programId, instructionData, dataBuffer, discriminator, groupIdx, group, groupInstructions, i, innerIx, programId, dataBuffer, discriminator, allInstructions, instructionIndex, foundIx, possibleFields, _i, possibleFields_1, field, arr, creator_1, ammConfig_1, authority_1, poolState_1, token0Mint_1, token1Mint_1, token0Vault_1, token1Vault_1, observationState_1, token0Program_1, token1Program_1, creator, ammConfig, authority, poolState, token0Mint, token1Mint, token0Vault, token1Vault, observationState, token0Program, token1Program, inputTokenMint, outputTokenMint, inputVault, outputVault, inputTokenProgram, outputTokenProgram, inputTokenAccount, outputTokenAccount, poolInputTokenChange, poolOutputTokenChange, inputTokenChange, outputTokenChange, liquiditySol, outputTokenProgramId, renounced, creatorPercentage, poolStateAccount, poolData, minSize, offset, readU64, openTime, openTimeDate, currentTime, waitSeconds, maxWait, startWait, e_1, swapAccounts, buySolAmountLamports, minAmountOut, minAmountOutWithSlippage, instructions, buyPrice, buyData;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    if (processedSignatures.has(signature)) {
                        return [2 /*return*/, null];
                    }
                    processedSignatures.add(signature);
                    // Clean up old signatures after 5 seconds
                    setTimeout(function () {
                        processedSignatures.delete(signature);
                    }, 5000);
                    console.log("\n [RAYDIUM CPMM INITIALIZE DETECTED] Signature: ".concat(signature, " | Time: ").concat(new Date().toISOString()));
                    initializeIx = null;
                    accountKeyIndexes = [];
                    console.log(" [DEBUG] Checking transaction structure...");
                    console.log(" [DEBUG] Transaction exists: ".concat(!!transaction));
                    console.log(" [DEBUG] Account keys count: ".concat(accountKeys.length));
                    // Check main instructions
                    // gRPC format: transaction = data.transaction.transaction
                    // So we need: transaction.transaction.message.instructions (not transaction.transaction.transaction.message.instructions)
                    if ((_b = (_a = transaction === null || transaction === void 0 ? void 0 : transaction.transaction) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.instructions) {
                        instructions_1 = transaction.transaction.message.instructions;
                        for (i = 0; i < instructions_1.length; i++) {
                            ix = instructions_1[i];
                            if (typeof ix === "object" && "programIdIndex" in ix && "data" in ix) {
                                programIdIndex = ix.programIdIndex;
                                programId = programIdIndex !== undefined ? accountKeys[programIdIndex] : null;
                                if (programIdIndex !== undefined && (programId === null || programId === void 0 ? void 0 : programId.equals(config_1.RAYDIUM_CPMM_PROGRAM_ID))) {
                                    try {
                                        instructionData = ix.data;
                                        dataBuffer = void 0;
                                        if (Buffer.isBuffer(instructionData)) {
                                            dataBuffer = instructionData;
                                        }
                                        else if (instructionData instanceof Uint8Array) {
                                            dataBuffer = Buffer.from(instructionData);
                                        }
                                        else if (typeof instructionData === "string") {
                                            // Try base64 decode
                                            dataBuffer = Buffer.from(instructionData, "base64");
                                        }
                                        else {
                                            continue;
                                        }
                                        if (dataBuffer.length >= 8) {
                                            discriminator = dataBuffer.subarray(0, 8);
                                            if (discriminator.equals(INITIALIZE_DISCRIMINATOR)) {
                                                initializeIx = ix;
                                                // Try different field names for account indexes
                                                // Try to get account indexes from various possible fields
                                                if (ix.accountKeyIndexes && Array.isArray(ix.accountKeyIndexes) && ix.accountKeyIndexes.length > 0) {
                                                    accountKeyIndexes = ix.accountKeyIndexes;
                                                }
                                                else if (ix.accountIndexes && Array.isArray(ix.accountIndexes) && ix.accountIndexes.length > 0) {
                                                    accountKeyIndexes = ix.accountIndexes;
                                                }
                                                else if (ix.accounts && Array.isArray(ix.accounts)) {
                                                    // If accounts is an array of numbers, use it directly
                                                    if (ix.accounts.length > 0 && typeof ix.accounts[0] === "number") {
                                                        accountKeyIndexes = ix.accounts;
                                                    }
                                                    else if (ix.accounts.length > 0) {
                                                        // If accounts is an array of objects, extract indexes
                                                        accountKeyIndexes = ix.accounts.map(function (acc, idx) {
                                                            if (typeof acc === "number")
                                                                return acc;
                                                            if (acc && typeof acc === "object" && "accountIndex" in acc)
                                                                return acc.accountIndex;
                                                            if (acc && typeof acc === "object" && "index" in acc)
                                                                return acc.index;
                                                            if (acc && typeof acc === "object" && "pubkey" in acc) {
                                                                // Find the index of this pubkey in accountKeys
                                                                var pubkey_1 = acc.pubkey instanceof web3_js_1.PublicKey ? acc.pubkey : new web3_js_1.PublicKey(acc.pubkey);
                                                                var foundIdx = accountKeys.findIndex(function (k) { return k.equals(pubkey_1); });
                                                                return foundIdx >= 0 ? foundIdx : idx;
                                                            }
                                                            return idx; // Fallback to array index
                                                        });
                                                        console.log(" [DEBUG] Found accounts field (objects) with ".concat(accountKeyIndexes.length, " accounts"));
                                                    }
                                                    else {
                                                        console.warn("\u26A0\uFE0F [DEBUG] accounts field exists but is empty");
                                                    }
                                                }
                                                else {
                                                    console.warn("\u26A0\uFE0F [DEBUG] No account indexes found in instruction. Available fields: ".concat(Object.keys(ix).join(", ")));
                                                    accountKeyIndexes = [];
                                                }
                                                console.log(" [DEBUG] Initialize instruction found! Account key indexes: ".concat(accountKeyIndexes.length));
                                                console.log(" [DEBUG] Account key indexes: [".concat(accountKeyIndexes.slice(0, 20).join(", ")).concat(accountKeyIndexes.length > 20 ? "..." : "", "]"));
                                                break;
                                            }
                                        }
                                        else {
                                            console.log("\u26A0\uFE0F [DEBUG] Data buffer too short: ".concat(dataBuffer.length, " < 8"));
                                        }
                                    }
                                    catch (e) {
                                        console.error(" [DEBUG] Error parsing instruction data:", e);
                                        console.error("   Error stack:", e.stack);
                                    }
                                }
                            }
                        }
                    }
                    else {
                        console.log("\u26A0\uFE0F [DEBUG] No main instructions found in transaction");
                    }
                    // Also check inner instructions
                    if (!initializeIx && innerInstructions) {
                        console.log(" [DEBUG] Checking inner instructions...");
                        console.log(" [DEBUG] Inner instruction groups: ".concat(innerInstructions.length));
                        for (groupIdx = 0; groupIdx < innerInstructions.length; groupIdx++) {
                            group = innerInstructions[groupIdx];
                            groupInstructions = group.instructions || [];
                            console.log(" [DEBUG] Inner instruction group ".concat(groupIdx, ": ").concat(groupInstructions.length, " instructions"));
                            for (i = 0; i < groupInstructions.length; i++) {
                                innerIx = groupInstructions[i];
                                if (innerIx.programIdIndex === undefined)
                                    continue;
                                programId = accountKeys[innerIx.programIdIndex];
                                if (programId === null || programId === void 0 ? void 0 : programId.equals(config_1.RAYDIUM_CPMM_PROGRAM_ID)) {
                                    console.log(" [DEBUG] Found Raydium CPMM inner instruction at group ".concat(groupIdx, ", index ").concat(i));
                                    if (innerIx.data) {
                                        try {
                                            dataBuffer = Buffer.from(innerIx.data, "base64");
                                            if (dataBuffer.length >= 8) {
                                                discriminator = dataBuffer.subarray(0, 8);
                                                if (discriminator.equals(INITIALIZE_DISCRIMINATOR)) {
                                                    console.log(" [DEBUG] Initialize instruction found in inner instructions!");
                                                    // For inner instructions, we need to get account indexes differently
                                                    // This is a fallback - main instruction is preferred
                                                }
                                            }
                                        }
                                        catch (e) {
                                            console.error(" [DEBUG] Error parsing inner instruction data:", e);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if (!initializeIx) {
                        console.error(" [DEBUG] Initialize instruction not found in transaction");
                        return [2 /*return*/, null];
                    }
                    // If account indexes are still empty, try to extract from transaction structure
                    if (accountKeyIndexes.length < 17 && initializeIx) {
                        console.log("\u26A0\uFE0F [DEBUG] Account indexes insufficient (".concat(accountKeyIndexes.length, "), trying alternative extraction..."));
                        // Try to get accounts from the transaction's instruction structure
                        // gRPC format: transaction = data.transaction.transaction
                        // So we need: transaction.transaction.message.instructions
                        if ((_d = (_c = transaction === null || transaction === void 0 ? void 0 : transaction.transaction) === null || _c === void 0 ? void 0 : _c.message) === null || _d === void 0 ? void 0 : _d.instructions) {
                            allInstructions = transaction.transaction.message.instructions;
                            instructionIndex = allInstructions.findIndex(function (inst) {
                                if (inst === initializeIx)
                                    return true;
                                // Check if it's the same instruction by comparing data
                                try {
                                    var instData = inst.data;
                                    var ixData = initializeIx.data;
                                    if (Buffer.isBuffer(instData) && Buffer.isBuffer(ixData)) {
                                        return instData.equals(ixData);
                                    }
                                }
                                catch (_a) { }
                                return false;
                            });
                            if (instructionIndex >= 0) {
                                foundIx = allInstructions[instructionIndex];
                                console.log(" [DEBUG] Found instruction at index ".concat(instructionIndex, " in transaction"));
                                console.log(" [DEBUG] Found instruction fields:", Object.keys(foundIx));
                                possibleFields = ['accountKeyIndexes', 'accountIndexes', 'accounts', 'accountKeys', 'accountIndexes'];
                                for (_i = 0, possibleFields_1 = possibleFields; _i < possibleFields_1.length; _i++) {
                                    field = possibleFields_1[_i];
                                    if (foundIx[field] && Array.isArray(foundIx[field])) {
                                        arr = foundIx[field];
                                        if (arr.length > 0) {
                                            if (typeof arr[0] === "number") {
                                                accountKeyIndexes = arr;
                                                console.log(" [DEBUG] Found accounts in field '".concat(field, "': ").concat(accountKeyIndexes.length, " accounts"));
                                                break;
                                            }
                                            else if (arr[0] && typeof arr[0] === "object") {
                                                // Extract from objects
                                                accountKeyIndexes = arr.map(function (acc) {
                                                    if (typeof acc === "number")
                                                        return acc;
                                                    if (acc.accountIndex !== undefined)
                                                        return acc.accountIndex;
                                                    if (acc.index !== undefined)
                                                        return acc.index;
                                                    return -1;
                                                }).filter(function (idx) { return idx >= 0; });
                                                if (accountKeyIndexes.length > 0) {
                                                    console.log(" [DEBUG] Found accounts in field '".concat(field, "' (extracted from objects): ").concat(accountKeyIndexes.length, " accounts"));
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if (accountKeyIndexes.length < 17) {
                        console.error(" [DEBUG] Insufficient account key indexes: ".concat(accountKeyIndexes.length, " (need at least 17)"));
                        console.error(" [DEBUG] Available account keys in transaction: ".concat(accountKeys.length));
                        console.error(" [DEBUG] Instruction object:", JSON.stringify(initializeIx, function (key, value) {
                            if (Buffer.isBuffer(value))
                                return "Buffer(".concat(value.length, ")");
                            if (value instanceof Uint8Array)
                                return "Uint8Array(".concat(value.length, ")");
                            if (value instanceof web3_js_1.PublicKey)
                                return value.toBase58();
                            return value;
                        }, 2));
                        return [2 /*return*/, null];
                    }
                    console.log(" [DEBUG] Initialize instruction validated, proceeding with account extraction...");
                    // Extract accounts from Initialize instruction
                    // #1: Creator, #2: Amm Config, #3: Authority, #4: Pool State,
                    // #5: Token 0 Mint, #6: Token 1 Mint, #11: Token 0 Vault, #12: Token 1 Vault,
                    // #14: Observation State, #16: Token 0 Program, #17: Token 1 Program
                    console.log(" [DEBUG] Extracting accounts from Initialize instruction...");
                    try {
                        creator_1 = accountKeys[accountKeyIndexes[0]];
                        ammConfig_1 = accountKeys[accountKeyIndexes[1]];
                        authority_1 = accountKeys[accountKeyIndexes[2]];
                        poolState_1 = accountKeys[accountKeyIndexes[3]];
                        token0Mint_1 = accountKeys[accountKeyIndexes[4]];
                        token1Mint_1 = accountKeys[accountKeyIndexes[5]];
                        token0Vault_1 = accountKeyIndexes.length > 10 ? accountKeys[accountKeyIndexes[10]] : null;
                        token1Vault_1 = accountKeyIndexes.length > 11 ? accountKeys[accountKeyIndexes[11]] : null;
                        observationState_1 = accountKeyIndexes.length > 13 ? accountKeys[accountKeyIndexes[13]] : null;
                        token0Program_1 = accountKeyIndexes.length > 15 ? accountKeys[accountKeyIndexes[15]] : null;
                        token1Program_1 = accountKeyIndexes.length > 16 ? accountKeys[accountKeyIndexes[16]] : null;
                        console.log(" [DEBUG] Extracted accounts:");
                        console.log("   Creator: ".concat(creator_1 === null || creator_1 === void 0 ? void 0 : creator_1.toBase58()));
                        console.log("   AMM Config: ".concat(ammConfig_1 === null || ammConfig_1 === void 0 ? void 0 : ammConfig_1.toBase58()));
                        console.log("   Authority: ".concat(authority_1 === null || authority_1 === void 0 ? void 0 : authority_1.toBase58()));
                        console.log("   Pool State: ".concat(poolState_1 === null || poolState_1 === void 0 ? void 0 : poolState_1.toBase58()));
                        console.log("   Token 0 Mint: ".concat(token0Mint_1 === null || token0Mint_1 === void 0 ? void 0 : token0Mint_1.toBase58()));
                        console.log("   Token 1 Mint: ".concat(token1Mint_1 === null || token1Mint_1 === void 0 ? void 0 : token1Mint_1.toBase58()));
                        console.log("   Token 0 Vault: ".concat((token0Vault_1 === null || token0Vault_1 === void 0 ? void 0 : token0Vault_1.toBase58()) || "NULL"));
                        console.log("   Token 1 Vault: ".concat((token1Vault_1 === null || token1Vault_1 === void 0 ? void 0 : token1Vault_1.toBase58()) || "NULL"));
                        console.log("   Observation State: ".concat((observationState_1 === null || observationState_1 === void 0 ? void 0 : observationState_1.toBase58()) || "NULL"));
                        console.log("   Token 0 Program: ".concat((token0Program_1 === null || token0Program_1 === void 0 ? void 0 : token0Program_1.toBase58()) || "NULL"));
                        console.log("   Token 1 Program: ".concat((token1Program_1 === null || token1Program_1 === void 0 ? void 0 : token1Program_1.toBase58()) || "NULL"));
                        if (!token0Vault_1 || !token1Vault_1 || !observationState_1 || !token0Program_1 || !token1Program_1) {
                            console.error(" [DEBUG] Failed to extract all required accounts from Initialize instruction");
                            console.error("   Missing: token0Vault=".concat(!token0Vault_1, ", token1Vault=").concat(!token1Vault_1, ", observationState=").concat(!observationState_1, ", token0Program=").concat(!token0Program_1, ", token1Program=").concat(!token1Program_1));
                            return [2 /*return*/, null];
                        }
                    }
                    catch (e) {
                        console.error(" [DEBUG] Error extracting accounts:", e);
                        return [2 /*return*/, null];
                    }
                    creator = accountKeys[accountKeyIndexes[0]];
                    ammConfig = accountKeys[accountKeyIndexes[1]];
                    authority = accountKeys[accountKeyIndexes[2]];
                    poolState = accountKeys[accountKeyIndexes[3]];
                    token0Mint = accountKeys[accountKeyIndexes[4]];
                    token1Mint = accountKeys[accountKeyIndexes[5]];
                    token0Vault = accountKeys[accountKeyIndexes[10]];
                    token1Vault = accountKeys[accountKeyIndexes[11]];
                    observationState = accountKeys[accountKeyIndexes[13]];
                    token0Program = accountKeys[accountKeyIndexes[15]];
                    token1Program = accountKeys[accountKeyIndexes[16]];
                    if (token0Mint.equals(config_1.WSOL_MINT)) {
                        // Token 0 is WSOL, so input = Token 0, output = Token 1
                        inputTokenMint = token0Mint;
                        outputTokenMint = token1Mint;
                        inputVault = token0Vault;
                        outputVault = token1Vault;
                        inputTokenProgram = token0Program;
                        outputTokenProgram = token1Program;
                    }
                    else if (token1Mint.equals(config_1.WSOL_MINT)) {
                        // Token 1 is WSOL, so input = Token 1, output = Token 0
                        inputTokenMint = token1Mint;
                        outputTokenMint = token0Mint;
                        inputVault = token1Vault;
                        outputVault = token0Vault;
                        inputTokenProgram = token1Program;
                        outputTokenProgram = token0Program;
                    }
                    else {
                        // Neither is WSOL, default to Token 0 -> Token 1
                        inputTokenMint = token0Mint;
                        outputTokenMint = token1Mint;
                        inputVault = token0Vault;
                        outputVault = token1Vault;
                        inputTokenProgram = token0Program;
                        outputTokenProgram = token1Program;
                    }
                    inputTokenAccount = (0, spl_token_1.getAssociatedTokenAddressSync)(config_1.PUBKEY, inputTokenMint, false, inputTokenProgram);
                    outputTokenAccount = (0, spl_token_1.getAssociatedTokenAddressSync)(config_1.PUBKEY, outputTokenMint, false, outputTokenProgram);
                    // Get token balances to calculate liquidity
                    console.log(" [DEBUG] Checking token balances...");
                    console.log(" [DEBUG] Pre token balances: ".concat((preTokenBalances === null || preTokenBalances === void 0 ? void 0 : preTokenBalances.length) || 0));
                    console.log(" [DEBUG] Post token balances: ".concat((postTokenBalances === null || postTokenBalances === void 0 ? void 0 : postTokenBalances.length) || 0));
                    if (!preTokenBalances || !postTokenBalances) {
                        console.error(" [DEBUG] Token balances not available");
                        console.error("   preTokenBalances: ".concat(!!preTokenBalances, ", postTokenBalances: ").concat(!!postTokenBalances));
                        return [2 /*return*/, null];
                    }
                    console.log(" [DEBUG] Calculating token balance changes...");
                    console.log(" [DEBUG] Authority: ".concat(authority.toBase58()));
                    console.log(" [DEBUG] Input token mint: ".concat(inputTokenMint.toBase58()));
                    console.log(" [DEBUG] Output token mint: ".concat(outputTokenMint.toBase58()));
                    poolInputTokenChange = getPrePostTokenBalance(preTokenBalances, postTokenBalances, authority.toBase58(), inputTokenMint.toBase58());
                    poolOutputTokenChange = getPrePostTokenBalance(preTokenBalances, postTokenBalances, authority.toBase58(), outputTokenMint.toBase58());
                    console.log(" [DEBUG] Pool input token change: ".concat(poolInputTokenChange[0], " -> ").concat(poolInputTokenChange[1]));
                    console.log(" [DEBUG] Pool output token change: ".concat(poolOutputTokenChange[0], " -> ").concat(poolOutputTokenChange[1]));
                    inputTokenChange = poolInputTokenChange[1] - poolInputTokenChange[0];
                    outputTokenChange = poolOutputTokenChange[1] - poolOutputTokenChange[0];
                    console.log(" [DEBUG] Input token change: ".concat(inputTokenChange.toString()));
                    console.log(" [DEBUG] Output token change: ".concat(outputTokenChange.toString()));
                    if (inputTokenChange === BigInt(0) || outputTokenChange === BigInt(0)) {
                        console.error(" [DEBUG] Invalid token changes detected");
                        console.error("   inputTokenChange: ".concat(inputTokenChange.toString(), ", outputTokenChange: ").concat(outputTokenChange.toString()));
                        return [2 /*return*/, null];
                    }
                    liquiditySol = inputTokenMint.equals(config_1.WSOL_MINT)
                        ? Number(inputTokenChange) / 1e9
                        : Number(outputTokenChange) / 1e9;
                    return [4 /*yield*/, (0, token_1.getTokenProgramIdFromMint)(config_1.RPC_CLIENT, outputTokenMint)];
                case 1:
                    outputTokenProgramId = _e.sent();
                    if (!config_1.CHECK_IF_TOKEN_IS_RENOUNCED) return [3 /*break*/, 3];
                    return [4 /*yield*/, (0, tokenFilters_1.isTokenRenounced)(outputTokenMint, outputTokenProgramId)];
                case 2:
                    renounced = _e.sent();
                    if (!renounced) {
                        console.log(RED + " [FILTER] Token ".concat(outputTokenMint.toBase58(), " rejected: Token ownership is not renounced (dev still has control)") + RESET);
                        return [2 /*return*/, null];
                    }
                    console.log(" [FILTER] Token ".concat(outputTokenMint.toBase58(), " passed: Renounced check"));
                    _e.label = 3;
                case 3:
                    if (!(config_1.MAX_PERCENTAGE_BELONGING_TO_CREATOR > 0)) return [3 /*break*/, 5];
                    return [4 /*yield*/, (0, tokenFilters_1.getCreatorTokenPercentage)(outputTokenMint, creator, outputTokenProgramId)];
                case 4:
                    creatorPercentage = _e.sent();
                    if (creatorPercentage > config_1.MAX_PERCENTAGE_BELONGING_TO_CREATOR) {
                        console.log(RED + " [FILTER] Token ".concat(outputTokenMint.toBase58(), " rejected: Creator owns ").concat(creatorPercentage.toFixed(2), "% > Maximum ").concat(config_1.MAX_PERCENTAGE_BELONGING_TO_CREATOR, "%") + RESET);
                        return [2 /*return*/, null];
                    }
                    console.log(" [FILTER] Token ".concat(outputTokenMint.toBase58(), " passed: Creator owns ").concat(creatorPercentage.toFixed(2), "% <= Maximum ").concat(config_1.MAX_PERCENTAGE_BELONGING_TO_CREATOR, "%"));
                    _e.label = 5;
                case 5:
                    console.log(GREEN + " [FILTER] Token ".concat(outputTokenMint.toBase58(), " passed all filters: Liquidity ").concat(liquiditySol.toFixed(6), " SOL") + RESET);
                    // Fetch and parse pool state data (similar to Rust implementation)
                    console.log(" [DEBUG] Fetching pool state account...");
                    _e.label = 6;
                case 6:
                    _e.trys.push([6, 13, , 14]);
                    return [4 /*yield*/, config_1.RPC_CLIENT.getAccountInfo(poolState)];
                case 7:
                    poolStateAccount = _e.sent();
                    if (!poolStateAccount || !poolStateAccount.data) {
                        console.error(RED + " Failed to fetch pool state account" + RESET);
                        return [2 /*return*/, null];
                    }
                    poolData = poolStateAccount.data;
                    minSize = 8 + 32 * 10 + 1 + 1 + 1 + 1 + 1 + 3 + 8 + 8 + 8 + 8 + 8 + 8;
                    if (poolData.length < minSize) {
                        console.error(RED + " Pool state data too short: ".concat(poolData.length, " bytes (need at least ").concat(minSize, ")") + RESET);
                        return [2 /*return*/, null];
                    }
                    console.log(" Pool state account fetched: ".concat(poolData.length, " bytes"));
                    console.log("\n".concat("=".repeat(80)));
                    console.log("\uD83D\uDCCA Pool State Data");
                    console.log("".concat("=".repeat(80)));
                    offset = 8;
                    offset += 32;
                    offset += 32;
                    offset += 32;
                    offset += 32;
                    offset += 32;
                    offset += 32;
                    offset += 32;
                    offset += 32;
                    offset += 32;
                    offset += 32;
                    offset += 1;
                    offset += 1;
                    offset += 1;
                    offset += 1;
                    offset += 1;
                    readU64 = function (data, offset) {
                        return data.readBigUInt64LE(offset);
                    };
                    offset += 8;
                    offset += 8;
                    offset += 8;
                    offset += 8;
                    offset += 8;
                    openTime = readU64(poolData, offset);
                    offset += 8;
                    openTimeDate = new Date(Number(openTime) * 1000);
                    console.log("openTime: ".concat(openTime.toString(), " (Unix timestamp: ").concat(openTimeDate.toISOString(), ")"));
                    currentTime = BigInt(Math.floor(Date.now() / 1000));
                    if (!(currentTime < openTime)) return [3 /*break*/, 11];
                    waitSeconds = Number(openTime - currentTime);
                    console.log("\u23F3 Pool not yet open. Current time: ".concat(currentTime, ", Open time: ").concat(openTime, ", Waiting ").concat(waitSeconds, " seconds..."));
                    maxWait = 2000;
                    startWait = Date.now();
                    _e.label = 8;
                case 8:
                    if (!(Date.now() - startWait < maxWait && BigInt(Math.floor(Date.now() / 1000)) < openTime)) return [3 /*break*/, 10];
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 100); })];
                case 9:
                    _e.sent();
                    return [3 /*break*/, 8];
                case 10:
                    if (BigInt(Math.floor(Date.now() / 1000)) < openTime) {
                        console.log(RED + " Max wait time exceeded, skipping pool..." + RESET);
                        return [2 /*return*/, null];
                    }
                    console.log(" Pool is now open, proceeding with swap...");
                    return [3 /*break*/, 12];
                case 11:
                    console.log(" Pool is already open");
                    _e.label = 12;
                case 12: return [3 /*break*/, 14];
                case 13:
                    e_1 = _e.sent();
                    console.error(" Failed to parse pool state: ".concat(e_1.message));
                    console.error("   Error stack:", e_1.stack);
                    return [2 /*return*/, null];
                case 14:
                    // Build swap accounts
                    console.log(" [DEBUG] Building swap accounts...");
                    swapAccounts = {
                        payer: config_1.PUBKEY,
                        authority: authority,
                        ammConfig: ammConfig,
                        poolState: poolState,
                        inputTokenAccount: inputTokenAccount,
                        outputTokenAccount: outputTokenAccount,
                        inputVault: inputVault,
                        outputVault: outputVault,
                        inputTokenProgram: inputTokenProgram,
                        outputTokenProgram: outputTokenProgram,
                        inputTokenMint: inputTokenMint,
                        outputTokenMint: outputTokenMint,
                        observationState: observationState,
                    };
                    console.log(" [DEBUG] Swap accounts:");
                    console.log("   Payer: ".concat(swapAccounts.payer.toBase58()));
                    console.log("   Input Token Account: ".concat(swapAccounts.inputTokenAccount.toBase58()));
                    console.log("   Output Token Account: ".concat(swapAccounts.outputTokenAccount.toBase58()));
                    console.log("   Input Vault: ".concat(swapAccounts.inputVault.toBase58()));
                    console.log("   Output Vault: ".concat(swapAccounts.outputVault.toBase58()));
                    // Calculate swap quote
                    console.log(" [DEBUG] Calculating swap quote...");
                    buySolAmountLamports = BigInt(Math.floor(config_1.BUY_SOL_AMOUNT * 1e9));
                    console.log(" [DEBUG] Buy SOL amount: ".concat(buySolAmountLamports.toString(), " lamports (").concat(config_1.BUY_SOL_AMOUNT, " SOL)"));
                    console.log(" [DEBUG] Pool input reserves: ".concat(poolInputTokenChange[1].toString()));
                    console.log(" [DEBUG] Pool output reserves: ".concat(poolOutputTokenChange[1].toString()));
                    console.log(" [DEBUG] AMM Config: ".concat(ammConfig.toBase58()));
                    minAmountOut = (0, cpmmSwapQuote_1.cpmmSwapBaseInput)(buySolAmountLamports, poolInputTokenChange[1], poolOutputTokenChange[1], ammConfig.toBase58());
                    console.log(" [DEBUG] Min amount out (before slippage): ".concat(minAmountOut.toString()));
                    minAmountOutWithSlippage = (minAmountOut * BigInt(Math.floor((1 - config_1.SLIPPAGE) * 1000))) / BigInt(1000);
                    console.log(" [DEBUG] Min amount out (with slippage ".concat(config_1.SLIPPAGE * 100, "%): ").concat(minAmountOutWithSlippage.toString()));
                    // Build instructions
                    console.log(" [DEBUG] Building transaction instructions...");
                    instructions = [];
                    // Compute budget
                    instructions.push(web3_js_1.ComputeBudgetProgram.setComputeUnitLimit({ units: config_1.PRIORITY_FEE_CU }));
                    instructions.push(web3_js_1.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: config_1.PRIORITY_FEE_MICRO_LAMPORTS }));
                    // Create ATAs
                    instructions.push.apply(instructions, (0, raydiumCpmmSwap_1.getCreateIdempotentAtaIx)(swapAccounts));
                    // Wrap SOL if input is WSOL
                    if (inputTokenMint.equals(config_1.WSOL_MINT)) {
                        instructions.push.apply(instructions, (0, raydiumCpmmSwap_1.getWrapSolIx)(swapAccounts, buySolAmountLamports));
                    }
                    // Swap instruction
                    instructions.push((0, raydiumCpmmSwap_1.getSwapBaseInputIx)(swapAccounts, {
                        amountIn: buySolAmountLamports,
                        minimumAmountOut: minAmountOutWithSlippage,
                    }));
                    // Close WSOL if input was WSOL
                    if (inputTokenMint.equals(config_1.WSOL_MINT)) {
                        instructions.push((0, raydiumCpmmSwap_1.getCloseWsolIx)(swapAccounts));
                    }
                    buyPrice = Number(poolInputTokenChange[1]) / Number(poolOutputTokenChange[1]);
                    buyData = {
                        mint: outputTokenMint,
                        buyPrice: buyPrice,
                        tokenAmount: minAmountOut,
                        bondingCurve: poolState, // Use poolState as bondingCurve equivalent
                        associatedBondingCurve: outputTokenAccount, // Use output token account
                        creator: creator,
                        tokenProgramId: outputTokenProgram,
                        virtualSolReserves: poolInputTokenChange[1],
                        virtualTokenReserves: poolOutputTokenChange[1],
                        poolState: poolState,
                        ammConfig: ammConfig,
                        authority: authority,
                        inputVault: inputVault,
                        outputVault: outputVault,
                        observationState: observationState,
                    };
                    console.log(" [DEBUG] Transaction preparation complete!");
                    console.log(" Token: ".concat(outputTokenMint.toBase58()));
                    console.log(" Pool State: ".concat(poolState.toBase58()));
                    console.log("\uD83D\uDCB0 Buying ".concat((0, token_1.tokenAmountUi)(Number(minAmountOut), 6), " tokens"));
                    console.log("\uD83D\uDCB0 Max SOL cost: ".concat(config_1.BUY_SOL_AMOUNT, " SOL"));
                    console.log(" Instruction count: ".concat(instructions.length));
                    return [2 /*return*/, {
                            instructions: instructions,
                            buyData: buyData,
                        }];
            }
        });
    });
}
