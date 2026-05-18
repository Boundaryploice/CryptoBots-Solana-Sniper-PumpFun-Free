"use strict";
/**
 * CPMM swap quote calculation utilities
 * Based on Raydium CPMM constant product formula with fees
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cpmmSwapBaseInput = cpmmSwapBaseInput;
var FEE_RATE_DENOMINATOR_VALUE = BigInt(1000000);
var TRADE_FEE_RATE = BigInt(2500);
var FEE_RATE = BigInt(10000);
/**
 * Get trade fee rate for a specific AMM config
 */
function getTradeFee(ammConfig) {
    var feeMap = {
        "B5u5x9S5pyaJdonf7bXUiEnBfEXsJWhNxXfLGAbRFtg2": BigInt(15000),
        "C7Cx2pMLtjybS3mDKSfsBj4zQ3PRZGkKt7RCYTTbCSx2": BigInt(40000),
        "BgxH5ifebqHDuiADWKhLjXGP5hWZeZLoCdmeWJLkRqLP": BigInt(3000),
        "BhH6HphjBKXu2PkUc2aw3xEMdUvK14NXxE5LbNWZNZAA": BigInt(5000),
        "G95xxie3XbkCqtE39GgQ9Ggc7xBC8Uceve7HFDEFApkc": BigInt(10000),
        "D4FPEruKEHrG5TenZ2mpDGEfu1iUvTiqBxvpU8HLBvC2": BigInt(2500),
        "2fGXL8uhqxJ4tpgtosHZXT4zcQap6j62z3bMDxdkMvy5": BigInt(20000),
    };
    return feeMap[ammConfig] || BigInt(0);
}
/**
 * Ceil division: (a * b + c - 1) / c
 */
function ceilDiv(a, b, c) {
    return (a * b + c - BigInt(1)) / c;
}
/**
 * Swap base input without fees
 * Formula: (source_amount * destination_reserve) / (source_reserve + source_amount)
 */
function swapBaseInputWithoutFees(sourceAmount, swapSourceAmount, swapDestinationAmount) {
    var numerator = sourceAmount * swapDestinationAmount;
    var denominator = swapSourceAmount + sourceAmount;
    return numerator / denominator;
}
/**
 * CPMM swap base input with fees
 * Calculates output amount for a given input amount
 */
function cpmmSwapBaseInput(sourceAmount, swapSourceAmount, swapDestinationAmount, ammConfig) {
    var tradeFeeRate = getTradeFee(ammConfig);
    var totalFeeRate = TRADE_FEE_RATE + FEE_RATE + tradeFeeRate;
    // Calculate fee
    var tradeFee = ceilDiv(sourceAmount, totalFeeRate, FEE_RATE_DENOMINATOR_VALUE);
    // Amount after fees
    var sourceAmountLessFees = sourceAmount - tradeFee;
    // Calculate output
    return swapBaseInputWithoutFees(sourceAmountLessFees, swapSourceAmount, swapDestinationAmount);
}
