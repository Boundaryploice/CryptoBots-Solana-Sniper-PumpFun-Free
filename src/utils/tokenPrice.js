"use strict";

// FIX B-04: fetch live SOL price to avoid hardcoded $100 rate
var _solUsdCache = { price: 148, ts: 0 };
async function fetchSolUsdRate() {
  const now = Date.now();
  if (now - _solUsdCache.ts < 60000) return _solUsdCache.price; // cache 60s
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    const d = await r.json();
    if (d?.solana?.usd) { _solUsdCache = { price: d.solana.usd, ts: now }; }
  } catch { /* keep cached */ }
  return _solUsdCache.price;
}
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
exports.TokenPriceService = void 0;
/**
 * Token price service using bonding curve reserves
 * Falls back to Birdeye API if available
 */
var TokenPriceService = /** @class */ (function () {
    function TokenPriceService(birdeyeApiKey) {
        if (birdeyeApiKey === void 0) { birdeyeApiKey = ""; }
        this.cache = new Map();
        this.cacheTTL = 5000; // 5 seconds cache
        this.birdeyeApiKey = birdeyeApiKey;
    }
    /**
     * Get token price in SOL using bonding curve reserves
     */
    TokenPriceService.prototype.getTokenPriceFromReserves = function (virtualSolReserves, virtualTokenReserves) {
        return __awaiter(this, void 0, void 0, function () {
            var solReserves, tokenReserves, pricePerToken;
            return __generator(this, function (_a) {
                if (virtualSolReserves === BigInt(0) || virtualTokenReserves === BigInt(0)) {
                    return [2 /*return*/, 0];
                }
                solReserves = Number(virtualSolReserves);
                tokenReserves = Number(virtualTokenReserves);
                pricePerToken = solReserves / tokenReserves;
                // Convert to price per 1e9 tokens (1 SOL)
                return [2 /*return*/, pricePerToken];
            });
        });
    };
    /**
     * Get token price using Birdeye API (if available)
     */
    TokenPriceService.prototype.getTokenPriceFromBirdeye = async function (mint) {
        if (!this.birdeyeApiKey) return null;
        const cacheKey = "birdeye_" + mint;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) return cached.price;
        try {
            const response = await fetch("https://public-api.birdeye.so/v1/token/price?address=" + mint, {
                headers: { "X-API-KEY": this.birdeyeApiKey },
            });
            if (!response.ok) return null;
            const data = await response.json();
            if (data.success && data.data && data.data.value) {
                const priceInUSD = data.data.value;
                // FIX B-04: live SOL/USD rate — no hardcoded $100
                const solUsdRate = await fetchSolUsdRate();
                const solPrice = priceInUSD / solUsdRate;
                this.cache.set(cacheKey, { price: solPrice, timestamp: Date.now() });
                return solPrice;
            }
            return null;
        } catch (error_1) {
            console.error("Error fetching price from Birdeye for " + mint + ":", error_1);
            return null;
        }
    };
    /**
     * Get token price - tries Birdeye first, then falls back to reserves
     */
    TokenPriceService.prototype.getTokenPrice = function (mint, virtualSolReserves, virtualTokenReserves) {
        return __awaiter(this, void 0, void 0, function () {
            var birdeyePrice;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getTokenPriceFromBirdeye(mint)];
                    case 1:
                        birdeyePrice = _a.sent();
                        if (birdeyePrice !== null && birdeyePrice > 0) {
                            return [2 /*return*/, birdeyePrice];
                        }
                        if (!(virtualSolReserves !== undefined && virtualTokenReserves !== undefined)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.getTokenPriceFromReserves(virtualSolReserves, virtualTokenReserves)];
                    case 2: return [2 /*return*/, _a.sent()];
                    case 3: 
                    // If no reserves, return 0 (price unknown)
                    return [2 /*return*/, 0];
                }
            });
        });
    };
    return TokenPriceService;
}());
exports.TokenPriceService = TokenPriceService;
