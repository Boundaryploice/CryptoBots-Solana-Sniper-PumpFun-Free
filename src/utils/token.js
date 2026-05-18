"use strict";
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
exports.solTokenQuote = solTokenQuote;
exports.getTokenProgramIdFromMint = getTokenProgramIdFromMint;
exports.lamportsToSol = lamportsToSol;
exports.tokenAmountUi = tokenAmountUi;
var config_1 = require("../config");
/**
 * Calculate token amount from SOL input using constant product formula
 * Formula: (sol_in * token_reserves) / (sol_reserves + sol_in)
 */
function solTokenQuote(solAmount, solReserves, tokenReserves, isBuy) {
    var solIn = BigInt(Math.floor(solAmount * 1e9)); // Convert to lamports
    var solRes = BigInt(solReserves);
    var tokenRes = BigInt(tokenReserves);
    if (solRes === BigInt(0)) {
        // First buy - return a fraction of supply
        return Number(tokenRes / BigInt(1000)); // 0.1% of supply
    }
    if (isBuy) {
        // Buy: (sol_in * token_reserves) / (sol_reserves + sol_in)
        var numerator = solIn * tokenRes;
        var denominator = solRes + solIn;
        return Number(numerator / denominator);
    }
    else {
        // Sell: (token_in * sol_reserves) / (token_reserves + token_in)
        var numerator = solIn * solRes;
        var denominator = tokenRes + solIn;
        return Number(numerator / denominator);
    }
}
/**
 * Get token program ID from mint address
 */
function getTokenProgramIdFromMint(connection, mintAddress) {
    return __awaiter(this, void 0, void 0, function () {
        var mintAccountInfo, tokenProgramId, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, connection.getAccountInfo(mintAddress)];
                case 1:
                    mintAccountInfo = _a.sent();
                    if (!mintAccountInfo) {
                        console.log("Mint account not found for ".concat(mintAddress.toBase58(), ", defaulting to TOKEN_PROGRAM_ID"));
                        return [2 /*return*/, config_1.TOKEN_PROGRAM_ID];
                    }
                    tokenProgramId = mintAccountInfo.owner;
                    if (tokenProgramId.equals(config_1.TOKEN_PROGRAM_ID)) {
                        return [2 /*return*/, config_1.TOKEN_PROGRAM_ID];
                    }
                    else if (tokenProgramId.equals(config_1.TOKEN_2022_PROGRAM_ID)) {
                        return [2 /*return*/, config_1.TOKEN_2022_PROGRAM_ID];
                    }
                    else {
                        console.log("Unknown token program for mint ".concat(mintAddress.toBase58(), ": ").concat(tokenProgramId.toBase58()));
                        return [2 /*return*/, tokenProgramId];
                    }
                    return [3 /*break*/, 3];
                case 2:
                    error_1 = _a.sent();
                    console.error("Error getting token program ID for mint ".concat(mintAddress.toBase58(), ":"), error_1);
                    return [2 /*return*/, config_1.TOKEN_PROGRAM_ID];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Convert lamports to SOL
 */
function lamportsToSol(lamports) {
    return Number(lamports) / 1e9;
}
/**
 * Format token amount with decimals
 */
function tokenAmountUi(amount, decimals) {
    if (decimals === void 0) { decimals = 6; }
    return (Number(amount) / Math.pow(10, decimals)).toFixed(decimals);
}
