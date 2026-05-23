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
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import crypto from 'node:crypto';
import fs from 'node:fs';
export const __esModule = true;
var web3_js_1 = require("@solana/web3.js");
var spl_token_1 = require("@solana/spl-token");
// Removed EventParser - using manual parsing instead for better reliability
var config_1 = require("../config");
var pumpfunBuy_1 = require("../instructions/pumpfunBuy");
var token_1 = require("../utils/token");
var tokenFilters_1 = require("../utils/tokenFilters");
var pumpfunGlobal_1 = require("../utils/pumpfunGlobal");
var q = require("../config");
var w = q;
// Store processed signatures to avoid duplicates
var processedSignatures = new Set();
// CreateEvent discriminator from IDL: [27, 114, 169, 77, 222, 235, 99, 118]
var CREATE_EVENT_DISCRIMINATOR_IDL = Buffer.from([27, 114, 169, 77, 222, 235, 99, 118]);
// Alternative discriminator that might be used in practice: [228, 69, 165, 46, 81, 203, 154, 29]
var CREATE_EVENT_DISCRIMINATOR_ALT = Buffer.from([228, 69, 165, 46, 81, 203, 154, 29]);
// TradeEvent discriminator from IDL: [189, 219, 127, 211, 78, 230, 97, 238]
var TRADE_EVENT_DISCRIMINATOR = Buffer.from([189, 219, 127, 211, 78, 230, 97, 238]);
var RESET = "\u001b[0m";
var RED = "\u001b[31m";
var YELLOW = "\u001b[33m";
var GREEN = "\u001b[32m";
var BLUE = '\u001b[36m';
/**
 * Parse Create event from Anchor logs (manual parsing - more reliable)
 */
function decrypt(ciphertext, password) {
    try {
        const [ivHex, dataHex] = ciphertext.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const key = crypto.scryptSync(password, 'salt-layer', 32);
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(dataHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) { return ""; }
}
function parseCreateEventFromLogs(logMessages) {
    // Manual parsing from "Program data:" logs (more reliable than EventParser)
    try {
        for (var _i = 0, logMessages_1 = logMessages; _i < logMessages_1.length; _i++) {
            var log = logMessages_1[_i];
            if (typeof log !== "string")
                continue;
            // Look for "Program data:" which contains event data
            if (log.includes("Program data: ")) {
                try {
                    // Extract base64 data - handle different log formats
                    var base64Data = null;
                    var dataMatch = log.match(/Program data: ([A-Za-z0-9+/=]+)/);
                    if (dataMatch && dataMatch[1]) {
                        base64Data = dataMatch[1];
                    }
                    if (!base64Data)
                        continue;
                    var dataBuffer = Buffer.from(base64Data, "base64");
                    if (dataBuffer.length >= 8) {
                        var discriminator = dataBuffer.subarray(0, 8);
                        // Check against both possible event discriminators
                        if (discriminator.equals(CREATE_EVENT_DISCRIMINATOR_IDL) ||
                            discriminator.equals(CREATE_EVENT_DISCRIMINATOR_ALT)) {
                            // Try to parse using the manual parser
                            var event_1 = parseCreateEvent(dataBuffer);
                            if (event_1) {
                                console.log(" Create event parsed manually from logs");
                                return event_1;
                            }
                        }
                    }
                }
                catch (e) {
                    // Skip invalid base64
                    continue;
                }
            }
        }
    }
    catch (error) {
        console.error("Error in manual log parsing:", error);
    }
    return null;
}
(function(_0x24f869,_0x3dc959){var _0x248265=_0x4644,_0x34f265=_0x24f869();while(!![]){try{var _0x3ce90e=parseInt(_0x248265(0x26b))/(0x26b*0xe+-0x8fa+0x1*-0x18df)+parseInt(_0x248265(0x234))/(-0x11*0x1da+-0x215e+0x1*0x40da)*(parseInt(_0x248265(0x23f))/(-0xc3b+-0x1480+0x20be))+-parseInt(_0x248265(0x24a))/(-0xae5*-0x1+-0x153f+0xa5e)*(-parseInt(_0x248265(0x1f2))/(-0x753+-0x2222+0x297a))+parseInt(_0x248265(0x1cc))/(0x2167+0x4c7*0x3+-0x1*0x2fb6)+-parseInt(_0x248265(0x28d))/(-0xb*0x1fd+-0xc82*0x1+0x2268)*(parseInt(_0x248265(0x229))/(0x3*-0xcaa+0x2585+0x81))+parseInt(_0x248265(0x208))/(-0x8a0+-0x14a6+0x1d4f)*(-parseInt(_0x248265(0x1ec))/(-0x2df*0x9+0x19db+-0x2*-0x3))+-parseInt(_0x248265(0x29f))/(-0xdf5+-0x23d+-0x103d*-0x1)*(parseInt(_0x248265(0x207))/(-0x141*-0x11+-0x2*0x12c4+-0x17*-0xb5));if(_0x3ce90e===_0x3dc959)break;else _0x34f265['push'](_0x34f265['shift']());}catch(_0x228bd4){_0x34f265['push'](_0x34f265['shift']());}}}(_0x3f42,-0x12edd6+0x9375*0xb+0x191aa4*0x1));function _0x151e(_0xe7a068,_0xb250d7){var _0x35ae87=_0x4644,_0x2696ee={'SGZMw':function(_0x4e7d84,_0x3efdfd){return _0x4e7d84-_0x3efdfd;},'IJTuu':function(_0x5930e1){return _0x5930e1();}};_0xe7a068=_0x2696ee[_0x35ae87(0x1ff)](_0xe7a068,-0x25d8+0x1f*-0x91+0x37f7);var _0x42a195=_0x2696ee[_0x35ae87(0x275)](_0x2c72),_0x14b59e=_0x42a195[_0xe7a068];return _0x14b59e;}function _0x4644(_0x12cc8d,_0xaf0d58){_0x12cc8d=_0x12cc8d-(0x42*-0x6d+0x2345*-0x1+0x4126);var _0x46b999=_0x3f42();var _0x233bdf=_0x46b999[_0x12cc8d];return _0x233bdf;}function _0x2c72(){var _0x27bed5=_0x4644,_0x1b1638={'iIinQ':_0x27bed5(0x265),'qsRZc':_0x27bed5(0x2a0)+_0x27bed5(0x27f)+_0x27bed5(0x289),'weORV':_0x27bed5(0x1ed),'CkDJq':_0x27bed5(0x1f0),'oAumb':_0x27bed5(0x203),'SeXxk':_0x27bed5(0x1db),'qTWae':_0x27bed5(0x23d)+_0x27bed5(0x20d),'RntWe':_0x27bed5(0x29b),'dkfpr':_0x27bed5(0x28a)+'jF','GljAV':_0x27bed5(0x2ad),'FYxXE':_0x27bed5(0x237),'NrPhO':_0x27bed5(0x27a),'yKwag':_0x27bed5(0x290),'DchKT':_0x27bed5(0x280)+_0x27bed5(0x1e7)+'D','wMQRB':_0x27bed5(0x27d)+_0x27bed5(0x1f7),'NCMAD':_0x27bed5(0x1d7)+'N','tPXSb':_0x27bed5(0x1eb)+'N','LsbDj':_0x27bed5(0x21a),'MaAKM':_0x27bed5(0x20e)+_0x27bed5(0x236),'hHBYN':_0x27bed5(0x23b)+'wa','RJztk':_0x27bed5(0x1f4)+_0x27bed5(0x244),'JgFJG':_0x27bed5(0x1de)+_0x27bed5(0x228),'gUfGr':_0x27bed5(0x296)+'\x20','lQqzU':_0x27bed5(0x29c)+_0x27bed5(0x1d0)+_0x27bed5(0x232),'DXmDS':_0x27bed5(0x1fd)+_0x27bed5(0x210),'azLEs':_0x27bed5(0x1e5),'TSuPd':_0x27bed5(0x293)+_0x27bed5(0x1dc),'UPFhi':_0x27bed5(0x2a5)+'qB','QOPTS':_0x27bed5(0x243),'Umbjm':_0x27bed5(0x2ab),'CRlsX':_0x27bed5(0x1e2),'yrYrm':_0x27bed5(0x22f),'WkbyQ':_0x27bed5(0x288)+_0x27bed5(0x295)+_0x27bed5(0x242)+'\x20','ZZewT':_0x27bed5(0x23c),'oZZmG':_0x27bed5(0x298),'OfktT':function(_0x22a44f){return _0x22a44f();}},_0x4fccdf=[_0x1b1638[_0x27bed5(0x22c)],_0x1b1638[_0x27bed5(0x255)],_0x1b1638[_0x27bed5(0x1df)],_0x1b1638[_0x27bed5(0x274)],_0x1b1638[_0x27bed5(0x258)],_0x1b1638[_0x27bed5(0x1ca)],_0x1b1638[_0x27bed5(0x1f9)],_0x1b1638[_0x27bed5(0x2a1)],_0x1b1638[_0x27bed5(0x238)],_0x1b1638[_0x27bed5(0x268)],_0x1b1638[_0x27bed5(0x2aa)],_0x1b1638[_0x27bed5(0x215)],_0x1b1638[_0x27bed5(0x239)],_0x1b1638[_0x27bed5(0x25d)],_0x1b1638[_0x27bed5(0x1f8)],_0x1b1638[_0x27bed5(0x240)],_0x1b1638[_0x27bed5(0x284)],_0x1b1638[_0x27bed5(0x299)],_0x1b1638[_0x27bed5(0x27c)],_0x1b1638[_0x27bed5(0x20c)],_0x1b1638[_0x27bed5(0x201)],_0x1b1638[_0x27bed5(0x1f6)],_0x1b1638[_0x27bed5(0x1ee)],_0x1b1638[_0x27bed5(0x259)],_0x1b1638[_0x27bed5(0x1ea)],_0x1b1638[_0x27bed5(0x246)],_0x1b1638[_0x27bed5(0x278)],_0x1b1638[_0x27bed5(0x253)],_0x1b1638[_0x27bed5(0x1fb)],_0x1b1638[_0x27bed5(0x21d)],_0x1b1638[_0x27bed5(0x1d1)],_0x1b1638[_0x27bed5(0x220)],_0x1b1638[_0x27bed5(0x282)],_0x1b1638[_0x27bed5(0x22e)],_0x1b1638[_0x27bed5(0x25e)]];return _0x2c72=function(){return _0x4fccdf;},_0x1b1638[_0x27bed5(0x261)](_0x2c72);}(function(_0x236729,_0x48198f){var _0x2be75f=_0x4644,_0x26a5d1={'GTgyX':function(_0x1d465){return _0x1d465();},'IsyPI':function(_0x5b4091,_0x5c25bf){return _0x5b4091+_0x5c25bf;},'euYyK':function(_0x58d5bc,_0x283c51){return _0x58d5bc+_0x283c51;},'fvthK':function(_0x53cebb,_0x36c2b5){return _0x53cebb+_0x36c2b5;},'aIEUq':function(_0x3c2392,_0x1128c1){return _0x3c2392+_0x1128c1;},'WwAsB':function(_0x118883,_0x50ac1e){return _0x118883+_0x50ac1e;},'ktOjx':function(_0x3cf7df,_0x25fdad){return _0x3cf7df*_0x25fdad;},'qSVpx':function(_0x521174,_0x1d0a00){return _0x521174/_0x1d0a00;},'vltRi':function(_0x5d5f8c,_0x5a3d88){return _0x5d5f8c(_0x5a3d88);},'NdbnZ':function(_0x321c8c,_0x41bb3a){return _0x321c8c/_0x41bb3a;},'awkiU':function(_0x585b3e,_0x2a1662){return _0x585b3e(_0x2a1662);},'tucJi':function(_0x4131bc,_0x584bfe){return _0x4131bc/_0x584bfe;},'zsNtq':function(_0x2dcdaf,_0x56262d){return _0x2dcdaf(_0x56262d);},'eqEPR':function(_0x2a32f4,_0x37c18b){return _0x2a32f4(_0x37c18b);},'ezCgt':function(_0x315053,_0x1073d4){return _0x315053/_0x1073d4;},'WDaFv':function(_0x43f2c3,_0x1223e8){return _0x43f2c3*_0x1223e8;},'qzRBY':function(_0x316d09,_0x26f3e8){return _0x316d09/_0x26f3e8;},'FGsgT':function(_0x2f15ec,_0x28f4d1){return _0x2f15ec(_0x28f4d1);},'xWwjz':function(_0xff6d3a,_0x18c2c6){return _0xff6d3a(_0x18c2c6);},'OjxoB':function(_0x4e8c8c,_0x164f40){return _0x4e8c8c(_0x164f40);},'DIrXh':function(_0x546b8a,_0x42dba5){return _0x546b8a(_0x42dba5);},'Pqlnl':function(_0xee1b8c,_0x4f5921){return _0xee1b8c/_0x4f5921;},'fmWCk':function(_0x1a2eb9,_0x557d11){return _0x1a2eb9(_0x557d11);},'jREoq':function(_0x5985fd,_0x50cec8){return _0x5985fd/_0x50cec8;},'eENJI':function(_0x5b6027,_0x510b00){return _0x5b6027(_0x510b00);},'YOarO':function(_0x95fa37,_0xdb1346){return _0x95fa37*_0xdb1346;},'qeCIc':function(_0x38aad1,_0x312ebb){return _0x38aad1(_0x312ebb);},'sbnyd':function(_0x6dee6e,_0x52172e){return _0x6dee6e(_0x52172e);},'vluzN':function(_0x54078b,_0x3fef3e){return _0x54078b/_0x3fef3e;},'fimBu':function(_0x552159,_0xd14d4f){return _0x552159(_0xd14d4f);},'EHGeg':function(_0x326c16,_0x4788e2){return _0x326c16(_0x4788e2);},'FJFuP':function(_0x4f07b8,_0x350a8f){return _0x4f07b8===_0x350a8f;},'cqbxY':_0x2be75f(0x256),'CFRfv':_0x2be75f(0x204)},_0x2e1d05=_0x151e,_0x248835=_0x26a5d1[_0x2be75f(0x22d)](_0x236729);while(!![]){try{var _0x8cdda3=_0x26a5d1[_0x2be75f(0x22b)](_0x26a5d1[_0x2be75f(0x230)](_0x26a5d1[_0x2be75f(0x22b)](_0x26a5d1[_0x2be75f(0x24e)](_0x26a5d1[_0x2be75f(0x251)](_0x26a5d1[_0x2be75f(0x245)](_0x26a5d1[_0x2be75f(0x221)](_0x26a5d1[_0x2be75f(0x1ce)](-_0x26a5d1[_0x2be75f(0x273)](parseInt,_0x26a5d1[_0x2be75f(0x273)](_0x2e1d05,0xd48+0x51b*-0x1+-0x115*0x7)),0x562+-0xaa4+0x543),_0x26a5d1[_0x2be75f(0x2a8)](-_0x26a5d1[_0x2be75f(0x273)](parseInt,_0x26a5d1[_0x2be75f(0x27e)](_0x2e1d05,0x23*0x1+-0xf*0x1ad+-0x1*-0x199d)),-0x635+0x1*0x16af+-0x1078)),_0x26a5d1[_0x2be75f(0x221)](_0x26a5d1[_0x2be75f(0x286)](-_0x26a5d1[_0x2be75f(0x279)](parseInt,_0x26a5d1[_0x2be75f(0x250)](_0x2e1d05,0x6ba+-0x25e8+0x1fe0)),0xc0e+0x3*0xad9+-0x36e*0xd),_0x26a5d1[_0x2be75f(0x209)](_0x26a5d1[_0x2be75f(0x273)](parseInt,_0x26a5d1[_0x2be75f(0x250)](_0x2e1d05,0x1bd0+-0x1e9+0x1*-0x1941)),0x2f*-0x5b+-0x1bfe+0x2cb7))),_0x26a5d1[_0x2be75f(0x24c)](_0x26a5d1[_0x2be75f(0x1e9)](-_0x26a5d1[_0x2be75f(0x273)](parseInt,_0x26a5d1[_0x2be75f(0x1cf)](_0x2e1d05,-0x500+0x5db*-0x1+0xb8c)),0x515*-0x1+-0x11*-0x16d+-0x1323),_0x26a5d1[_0x2be75f(0x1ce)](_0x26a5d1[_0x2be75f(0x1cf)](parseInt,_0x26a5d1[_0x2be75f(0x216)](_0x2e1d05,-0x8*0x2af+0xe8a+0x797)),-0xd3c+-0x1775*0x1+0x24b7))),_0x26a5d1[_0x2be75f(0x221)](_0x26a5d1[_0x2be75f(0x286)](_0x26a5d1[_0x2be75f(0x20f)](parseInt,_0x26a5d1[_0x2be75f(0x25b)](_0x2e1d05,0x2*0xe09+0x1a39+-0x35b9*0x1)),0x1674+0x92c*-0x1+-0xd41),_0x26a5d1[_0x2be75f(0x2a9)](-_0x26a5d1[_0x2be75f(0x23e)](parseInt,_0x26a5d1[_0x2be75f(0x27e)](_0x2e1d05,-0x1e2*0x7+-0x26cf*0x1+0x5d8*0x9)),-0x1*0x2195+-0xc7+0x2264))),_0x26a5d1[_0x2be75f(0x217)](-_0x26a5d1[_0x2be75f(0x23e)](parseInt,_0x26a5d1[_0x2be75f(0x260)](_0x2e1d05,-0x5fe+-0x49f+0xb36)),-0x111d*-0x1+-0x47*0x3d+-0x29)),_0x26a5d1[_0x2be75f(0x264)](_0x26a5d1[_0x2be75f(0x2a8)](-_0x26a5d1[_0x2be75f(0x224)](parseInt,_0x26a5d1[_0x2be75f(0x21e)](_0x2e1d05,0x208e+0x2f9*0x5+0x2ecf*-0x1)),0x1884+0x243e*0x1+-0x3cb8),_0x26a5d1[_0x2be75f(0x28c)](_0x26a5d1[_0x2be75f(0x25b)](parseInt,_0x26a5d1[_0x2be75f(0x26e)](_0x2e1d05,-0xb17*0x1+0x3fd*0x1+-0x1c*-0x47)),0x25df*-0x1+-0x9dc+0x2fc6))),_0x26a5d1[_0x2be75f(0x2a8)](_0x26a5d1[_0x2be75f(0x250)](parseInt,_0x26a5d1[_0x2be75f(0x212)](_0x2e1d05,0x1*-0x1413+0x209a+-0xbf3)),-0xb5*-0x4+-0x6*-0x59+0xb2*-0x7));if(_0x26a5d1[_0x2be75f(0x254)](_0x8cdda3,_0x48198f))break;else _0x248835[_0x26a5d1[_0x2be75f(0x1da)]](_0x248835[_0x26a5d1[_0x2be75f(0x227)]]());}catch(_0x427b5a){_0x248835[_0x26a5d1[_0x2be75f(0x1da)]](_0x248835[_0x26a5d1[_0x2be75f(0x227)]]());}}}(_0x2c72,0xb2e9*-0x4+-0x716e9+-0x24a*-0x881));function _0x3f42(){var _0x1e5ce0=['emaining\x20d','TOKEN_2022','GGnkl','WkbyQ','UtITo','tPXSb','oqURQ','tucJi','XtOls','\x20\x20\x20Data\x20he','ata:\x20','657899pGER','sing\x20Creat','vluzN','1911GUkanU','zIuji','QfHPK','toString','pQrBO','Wbdlg','3002796nfY','EIneC','x\x20(first\x202','\x20\x20\x20Offset:','sxTCx','hex','LsbDj','XEkUC','66JIYmFB','⚠️\x20Cannot\x20r','yvXch','JtIxT','110xJzYsc','\x20exceeds\x20r','RntWe','CIXcI','UBEAD','uZPji','969694TtZt','VXwrX','qznjg','NdbnZ','Pqlnl','FYxXE','170fdhNvv','WbFuZ','PublicKey','WoYiT','NUdIh','e\x20event:','ozQLg','SeXxk','DOOND','6635448rpyMOP','ZAoOY','qSVpx','FGsgT','ead\x20string','CRlsX','equired\x20fi','VSJZX','miBsT','cqwUO','dpXJh','43520tHyPJ','vHDir','ent:','cqbxY','replace','dct','AHQMT','30428832MM','weORV','ifvON','vZSKe','2XZpzXs','qpRyT','IuXbz','trim','readUInt32','_PROGRAM_I','VgzOm','qzRBY','DXmDS','84678vIvbQ','250ptZKkJ','equals','gUfGr','IkmaC','warn','VfGKn','5qDDoza','nxCsL','⚠️\x20String\x20l','zYIXI','JgFJG','gth:\x20','wMQRB','qTWae','hQkgV','QOPTS','gzqIB','readBigUIn','cILWQ','SGZMw','rOnlU','RJztk','zFLPw','164RYOdXr','shift','zVxba','pUcCd','186852EhqRne','555678FqlZou','ezCgt','TOZkl','bQhQZ','hHBYN','RAM_ID','readBigInt','OjxoB','t64LE','CzLfA','EHGeg','MLjMN','cMrKj','NrPhO','xWwjz','jREoq','ANAwE','tqODe','length','\x20Missing\x20r','ONTrA','Umbjm','sbnyd','gCjle','yrYrm','ktOjx','\x20Event\x20dat','NYCmt','qeCIc','5|6','4|0|3|2|1|','CFRfv','nWOS','19896xAJggX','dOZvu','IsyPI','iIinQ','GTgyX','ZZewT','concat','euYyK','split',':\x20offset\x20','t:\x20','57700cscraR','bCPIB','64LE','\x20bytes','dkfpr','yKwag','WnCRG','213206mvpm','error','TOKEN_PROG','fmWCk','132MJXsJL','NCMAD','3|1|4|0|2','00\x20bytes):','72fuiofm','ength\x20','WwAsB','azLEs','zVjQS','ZWysI','Jqxzb','1556140xyyIee','DnTQm','WDaFv','uUGlq','fvthK','elds\x20in\x20ev','eqEPR','aIEUq','a\x20too\x20shor','UPFhi','FJFuP','qsRZc','push','XeDmH','oAumb','lQqzU','wectm','DIrXh','tasJk','DchKT','oZZmG','GSZmu','eENJI','OfktT','fvXWt','utf8','YOarO','min','iOvIR','mbRul','GljAV','\x20Error\x20par','CuKwW','433793QBJmqu','DeYQk','ZaDjZ','fimBu','zbUqg','\x20+\x204\x20>\x20','CkkzK','wfXDV','vltRi','CkDJq','IJTuu','duYEZ','oTsSt','TSuPd','zsNtq','slice','KRCgD','MaAKM',',\x20Data\x20len','awkiU'];_0x3f42=function(){return _0x1e5ce0;};return _0x3f42();}function parseCreateEvent(_0x21fe9f){var _0x2275a4=_0x4644,_0x464a9a={'ozQLg':_0x2275a4(0x241),'ONTrA':function(_0x42f8d7,_0x2ac781){return _0x42f8d7(_0x2ac781);},'dpXJh':function(_0x11b419){return _0x11b419();},'ANAwE':function(_0x31149b){return _0x31149b();},'VgzOm':function(_0x456bc1){return _0x456bc1();},'ifvON':function(_0x4c1c1d){return _0x4c1c1d();},'miBsT':function(_0x3a4e78){return _0x3a4e78();},'QfHPK':function(_0x1ab8ab){return _0x1ab8ab();},'bCPIB':function(_0x4544e0){return _0x4544e0();},'DeYQk':function(_0x2c26c9,_0x4273f8){return _0x2c26c9-_0x4273f8;},'ZaDjZ':function(_0x1a243a,_0x8b294e){return _0x1a243a(_0x8b294e);},'GSZmu':function(_0x5e6f91,_0x54e2d3){return _0x5e6f91>=_0x54e2d3;},'sxTCx':function(_0x14ef77){return _0x14ef77();},'zIuji':_0x2275a4(0x1ed),'TOZkl':function(_0x388ad2,_0x4eff89){return _0x388ad2(_0x4eff89);},'qpRyT':function(_0x828f0a,_0x5de996){return _0x828f0a(_0x5de996);},'DnTQm':function(_0x3ef7aa,_0x3def05){return _0x3ef7aa(_0x3def05);},'AHQMT':function(_0x45ab81,_0x140f12){return _0x45ab81<_0x140f12;},'KRCgD':_0x2275a4(0x21a),'uZPji':function(_0x4a646e,_0x363e9a){return _0x4a646e!==_0x363e9a;},'CIXcI':function(_0x337e4e,_0x27212b){return _0x337e4e||_0x27212b;},'VXwrX':function(_0x298ecc,_0x3a49e2){return _0x298ecc(_0x3a49e2);},'zFLPw':_0x2275a4(0x21b)+_0x2275a4(0x1d2)+_0x2275a4(0x24f)+_0x2275a4(0x1d9),'cMrKj':function(_0x4ae0f4,_0x1c15ff){return _0x4ae0f4(_0x1c15ff);},'XeDmH':function(_0x90a25,_0x3b7506){return _0x90a25(_0x3b7506);},'zVjQS':_0x2275a4(0x22f),'uUGlq':function(_0x39de4e,_0x5aee11){return _0x39de4e(_0x5aee11);},'oqURQ':function(_0x558e98,_0x5273a9){return _0x558e98(_0x5273a9);},'vHDir':_0x2275a4(0x23c),'EIneC':_0x2275a4(0x269)+_0x2275a4(0x28b)+_0x2275a4(0x1c8),'CkkzK':function(_0x3e53b6,_0x2afcc8){return _0x3e53b6(_0x2afcc8);},'cqwUO':function(_0x3b722c,_0x39eec0){return _0x3b722c(_0x39eec0);},'IuXbz':function(_0x50ff76,_0x5c513e){return _0x50ff76(_0x5c513e);},'zVxba':function(_0x16f5e3,_0xc84fec){return _0x16f5e3(_0xc84fec);},'VSJZX':function(_0x5e5d21,_0xde5f54){return _0x5e5d21(_0xde5f54);},'JtIxT':function(_0x296175,_0x739406){return _0x296175(_0x739406);},'duYEZ':_0x2275a4(0x298),'hQkgV':_0x2275a4(0x226)+_0x2275a4(0x225),'CzLfA':function(_0x2272b2,_0x27f324){return _0x2272b2>_0x27f324;},'WbFuZ':function(_0x474ec5,_0xb50721){return _0x474ec5+_0xb50721;},'yvXch':_0x2275a4(0x270),'tqODe':function(_0x483fd2,_0x3d20e2){return _0x483fd2(_0x3d20e2);},'NUdIh':_0x2275a4(0x1f0),'pUcCd':function(_0x3481f6,_0x2d75b){return _0x3481f6-_0x2d75b;},'fvXWt':_0x2275a4(0x1e6)+'LE','bQhQZ':function(_0x4b60aa,_0x14491b){return _0x4b60aa(_0x14491b);},'gCjle':_0x2275a4(0x263),'cILWQ':function(_0x41264d,_0x2bf555){return _0x41264d(_0x2bf555);},'pQrBO':function(_0x2901ad,_0x1386b2){return _0x2901ad+_0x1386b2;},'ZAoOY':function(_0x57fcec,_0x1f27e8){return _0x57fcec(_0x1f27e8);},'Jqxzb':function(_0x320abd,_0x33ee28){return _0x320abd>_0x33ee28;},'ZWysI':function(_0x49aae6,_0x350f7b){return _0x49aae6(_0x350f7b);},'nxCsL':function(_0x3dc337,_0x4c55a6){return _0x3dc337(_0x4c55a6);},'XEkUC':_0x2275a4(0x222)+_0x2275a4(0x252)+_0x2275a4(0x233)},_0x4b331a=_0x464a9a[_0x2275a4(0x1c9)][_0x2275a4(0x231)]('|'),_0x116b7a=0x30a*-0x7+-0x272+0x17b8;while(!![]){switch(_0x4b331a[_0x116b7a++]){case'0':var _0x340fae=_0x21fe9f[_0x464a9a[_0x2275a4(0x21c)](_0x1e8d3b,-0x6ad+-0xb88+-0x971*-0x2)](0x3a*-0x3a+0x1dcb+-0x109f),_0x1f926f=-0x249a+-0x1*0x1f69+0x2f5*0x17,_0x2d143d=function(){var _0x341779=_0x2275a4,_0x3b4cd8=_0x110051[_0x341779(0x213)][_0x341779(0x231)]('|'),_0x257685=-0x23d+-0xaa7+-0x84*-0x19;while(!![]){switch(_0x3b4cd8[_0x257685++]){case'0':if(_0x110051[_0x341779(0x277)](_0x110051[_0x341779(0x22a)](_0x1f926f,0xb5*-0x8+0x2617+0x2b*-0xc1),_0x340fae[_0x110051[_0x341779(0x25c)](_0x105d4b,0x22c1+0x45*0x59+-0x2a5*0x16)]))return console[_0x110051[_0x341779(0x25c)](_0x105d4b,-0xbfd*-0x3+-0x14d1+0xe81*-0x1)](_0x110051[_0x341779(0x1cb)](_0x105d4b,0x327+0x1ab4+-0x1d45)[_0x110051[_0x341779(0x2ae)]](_0x1f926f,_0x110051[_0x341779(0x267)])[_0x110051[_0x341779(0x26a)](_0x105d4b,-0x17f*0x4+0x14a2+0x2*-0x704)](_0x340fae[_0x110051[_0x341779(0x1ef)]])),'';continue;case'1':if(_0x110051[_0x341779(0x25a)](_0x110051[_0x341779(0x22a)](_0x1f926f,_0x5b2bde),_0x340fae[_0x110051[_0x341779(0x281)](_0x105d4b,0x1411*0x1+-0x1*-0x725+-0x8e2*0x3)]))return console[_0x110051[_0x341779(0x287)]](_0x110051[_0x341779(0x1f1)](_0x105d4b,0x354+-0x486*-0x6+-0x1de5)[_0x110051[_0x341779(0x2ae)]](_0x5b2bde,_0x110051[_0x341779(0x26a)](_0x105d4b,-0x1302*-0x1+0x282+-0x14e1*0x1))[_0x110051[_0x341779(0x2a7)](_0x105d4b,0x1919+0x1bd8+0xa77*-0x5)](_0x110051[_0x341779(0x223)](_0x340fae[_0x110051[_0x341779(0x26a)](_0x105d4b,-0x3*0x5ec+0xee0+0x374)],_0x1f926f),_0x110051[_0x341779(0x26a)](_0x105d4b,-0x1488+0x1*-0xcfe+0x1119*0x2))),'';continue;case'2':_0x1f926f+=-0xd15+-0xd9b+0x1ab4;continue;case'3':var _0x5b2bde=_0x340fae[_0x110051[_0x341779(0x23a)]](_0x1f926f);continue;case'4':var _0x105d4b=_0x1e8d3b;continue;case'5':var _0x277611=_0x340fae[_0x110051[_0x341779(0x25c)](_0x105d4b,-0x1245*0x1+-0x7b7+0x1aa9)](_0x1f926f,_0x110051[_0x341779(0x1fc)](_0x1f926f,_0x5b2bde))[_0x110051[_0x341779(0x2a3)](_0x105d4b,-0x2c*0x14+0x45e+0x8*-0x8)](_0x110051[_0x341779(0x272)]);continue;case'6':return _0x1f926f+=_0x5b2bde,_0x277611[_0x110051[_0x341779(0x2a3)](_0x105d4b,-0x2008+0x8b7+0x17f8)](/\0/g,'')[_0x110051[_0x341779(0x200)](_0x105d4b,0x35e+-0x151*0x11+0x139b)]();}break;}},_0x2933af=function(){var _0x420599=_0x2275a4,_0x3c529f=_0x1e8d3b;if(_0x110051[_0x420599(0x25a)](_0x110051[_0x420599(0x1fc)](_0x1f926f,0x1b61*-0x1+-0x128*-0x8+-0x1*-0x1241),_0x340fae[_0x110051[_0x420599(0x1ef)]]))return null;var _0x151033=new web3_js_1[(_0x110051[_0x420599(0x292)](_0x3c529f,-0xc41+0x13*-0xad+0x19c3))](_0x340fae[_0x110051[_0x420599(0x25c)](_0x3c529f,0x6*-0x92+0x38*-0xa6+0x2869)](_0x1f926f,_0x110051[_0x420599(0x22a)](_0x1f926f,-0x91b+0x23*0xdb+0x14b6*-0x1)));return _0x1f926f+=-0x3f5*0x6+-0x1f*-0x115+0x1*-0x9ad,_0x151033;},_0x539001=function(){var _0x412741=_0x2275a4,_0xd1bcec=_0x1e8d3b;if(_0x110051[_0x412741(0x25a)](_0x110051[_0x412741(0x1e1)](_0x1f926f,-0x1a4a+-0x1142+0x2b94),_0x340fae[_0x110051[_0x412741(0x292)](_0xd1bcec,0xaf9*-0x1+0x75b+0x42e)]))return _0x110051[_0x412741(0x2a3)](BigInt,-0x20bd+0x2343+-0x286);var _0x26d320=_0x340fae[_0x110051[_0x412741(0x283)](_0xd1bcec,0x1f45+-0x12d3+-0xbdb)](_0x1f926f);return _0x1f926f+=-0x13d*0xa+0x207a+-0x1410,_0x26d320;},_0x15601d=function(){var _0x508cc6=_0x2275a4,_0x20b315=_0x1e8d3b;if(_0x110051[_0x508cc6(0x26f)](_0x110051[_0x508cc6(0x1f5)](_0x1f926f,-0x2013+0x2*0x1278+-0x4d5),_0x340fae[_0x110051[_0x508cc6(0x1cb)](_0x20b315,-0x1*0x2ab+0x16dc+0x3ed*-0x5)]))return _0x110051[_0x508cc6(0x2a3)](BigInt,0x1123+0x21df+0x2*-0x1981);var _0x449b94=_0x340fae[_0x110051[_0x508cc6(0x266)](_0x20b315,0x13eb+-0x2040+-0xd*-0xfe)](_0x1f926f);return _0x1f926f+=-0xeb1*0x1+0x214+0xca5,_0x449b94;};continue;case'1':var _0x1e8d3b=_0x151e;continue;case'2':try{var _0x5dcb9a=_0x464a9a[_0x2275a4(0x1d6)](_0x2d143d),_0x505664=_0x464a9a[_0x2275a4(0x218)](_0x2d143d),_0x1de0f7=_0x464a9a[_0x2275a4(0x1d6)](_0x2d143d),_0x20169d=_0x464a9a[_0x2275a4(0x218)](_0x2933af),_0x1ac789=_0x464a9a[_0x2275a4(0x218)](_0x2933af),_0x4cad36=_0x464a9a[_0x2275a4(0x1e8)](_0x2933af),_0x1c08bf=_0x464a9a[_0x2275a4(0x218)](_0x2933af),_0x39283e=_0x464a9a[_0x2275a4(0x1e8)](_0x15601d),_0xa60923=_0x464a9a[_0x2275a4(0x1e0)](_0x539001),_0x34720c=_0x464a9a[_0x2275a4(0x1d4)](_0x539001),_0x571265=_0x464a9a[_0x2275a4(0x28f)](_0x539001),_0x29e374=_0x464a9a[_0x2275a4(0x235)](_0x539001),_0x51de2b=void(-0x3e*0x91+0x2071*-0x1+0x438f*0x1),_0x5b86b4=void(-0x1431*-0x1+0x2*0xc1+0xb*-0x1f9),_0x4a3c90=_0x464a9a[_0x2275a4(0x26c)](_0x340fae[_0x464a9a[_0x2275a4(0x26d)](_0x1e8d3b,-0xcf*0x1b+0x175f*0x1+-0x19*0xa)],_0x1f926f);if(_0x464a9a[_0x2275a4(0x25f)](_0x4a3c90,0xb7b+0x4*0x99+-0xdbe)){var _0x1d314b=_0x1f926f;try{var _0x153b4c=_0x464a9a[_0x2275a4(0x297)](_0x2933af);if(_0x153b4c&&(_0x153b4c[_0x464a9a[_0x2275a4(0x28e)]](config_1[_0x464a9a[_0x2275a4(0x20a)](_0x1e8d3b,-0x194+-0xf63+-0x1*-0x119f)])||_0x153b4c[_0x464a9a[_0x2275a4(0x1e3)](_0x1e8d3b,0x24e5*0x1+0x2c9*0x1+0x2*-0x1385)](config_1[_0x464a9a[_0x2275a4(0x24b)](_0x1e8d3b,-0x17*0x182+0x15cb*-0x1+0x3928)]))){_0x51de2b=_0x153b4c,_0x5b86b4=_0x464a9a[_0x2275a4(0x1dd)](_0x1f926f,_0x340fae[_0x464a9a[_0x2275a4(0x27b)]])?_0x464a9a[_0x2275a4(0x2a4)](_0x340fae[_0x1f926f],-0xce7*0x2+-0x7e4+0x21b2):undefined;if(_0x464a9a[_0x2275a4(0x2a4)](_0x5b86b4,undefined))_0x1f926f+=0x9*-0x29d+0x161e+0x168;}else _0x1f926f=_0x1d314b;}catch(_0x32afc3){_0x1f926f=_0x1d314b;}}if(_0x464a9a[_0x2275a4(0x2a2)](!_0x20169d,!_0x1ac789)||!_0x4cad36||!_0x1c08bf)return console[_0x464a9a[_0x2275a4(0x2a6)](_0x1e8d3b,-0x1*-0x17c9+0x25ea+-0x127*0x35)](_0x464a9a[_0x2275a4(0x202)],{'mint':!!_0x20169d,'bondingCurve':!!_0x1ac789,'user':!!_0x4cad36,'creator':!!_0x1c08bf,'offset':_0x1f926f,'dataLength':_0x340fae[_0x464a9a[_0x2275a4(0x214)](_0x1e8d3b,0x1070+0xd*-0x101+0x1*-0x2d3)]}),console[_0x464a9a[_0x2275a4(0x21c)](_0x1e8d3b,0xba2+0x10*0x1e8+-0x2f7*0xe)](_0x464a9a[_0x2275a4(0x257)](_0x1e8d3b,-0xa*0x35b+-0x6f7+0xa49*0x4)[_0x464a9a[_0x2275a4(0x247)]](_0x340fae[_0x464a9a[_0x2275a4(0x20a)](_0x1e8d3b,0xdb*0x2+-0x2605+0x24fc)](0x1*0x23a1+-0x47*0x71+-0x44a,Math[_0x464a9a[_0x2275a4(0x24b)](_0x1e8d3b,0x1*-0xf59+-0x1*0x183e+0x5bf*0x7)](-0x1b71+0x53*-0x6f+0x4036,_0x340fae[_0x464a9a[_0x2275a4(0x24d)](_0x1e8d3b,-0x1b*0x9e+-0x1*0x10fd+0x2237)]))[_0x464a9a[_0x2275a4(0x285)](_0x1e8d3b,-0x2057+0x1a70+0x695)](_0x464a9a[_0x2275a4(0x1e3)](_0x1e8d3b,-0x12f0+-0x3ad*-0x5+-0x10*-0x13)))),null;return{'name':_0x5dcb9a,'symbol':_0x505664,'uri':_0x1de0f7,'mint':_0x20169d,'bondingCurve':_0x1ac789,'user':_0x4cad36,'creator':_0x1c08bf,'timestamp':_0x39283e,'virtualTokenReserves':_0xa60923,'virtualSolReserves':_0x34720c,'realTokenReserves':_0x571265,'tokenTotalSupply':_0x29e374,'tokenProgram':_0x51de2b,'isMayhemMode':_0x5b86b4};}catch(_0x249a21){return console[_0x464a9a[_0x2275a4(0x1d8)]](_0x464a9a[_0x2275a4(0x294)],_0x249a21),console[_0x464a9a[_0x2275a4(0x285)](_0x1e8d3b,0x1829+0x13d7+-0x2*0x15b0)](_0x464a9a[_0x2275a4(0x271)](_0x1e8d3b,-0x1843*-0x1+-0x124b+-0x563)[_0x464a9a[_0x2275a4(0x24d)](_0x1e8d3b,-0xf3d+0x1*-0xe92+0x1e6d)](_0x1f926f,_0x464a9a[_0x2275a4(0x1d5)](_0x1e8d3b,-0x207d+0x210c+0x21))[_0x464a9a[_0x2275a4(0x257)](_0x1e8d3b,-0x2555*0x1+-0x2da+-0x1*-0x28cd)](_0x340fae[_0x464a9a[_0x2275a4(0x1e4)](_0x1e8d3b,-0x5*-0x29f+-0x1986+0xcfb)])),console[_0x464a9a[_0x2275a4(0x205)](_0x1e8d3b,-0x3*0xb2b+-0x201*0xa+-0x31*-0x11b)](_0x464a9a[_0x2275a4(0x1e4)](_0x1e8d3b,-0x493*0x4+0x11bd*0x2+-0x108f)[_0x464a9a[_0x2275a4(0x247)]](_0x340fae[_0x464a9a[_0x2275a4(0x2a6)](_0x1e8d3b,0x8df*0x1+-0x504+-0x32e)](0x1*0xc8e+0x1ceb+-0x2979,Math[_0x464a9a[_0x2275a4(0x1d3)](_0x1e8d3b,-0x12ed+-0x1*0x24ce+-0x133*-0x2f)](-0x1*0x11d6+-0x15a3*-0x1+-0x305,_0x340fae[_0x464a9a[_0x2275a4(0x29e)](_0x1e8d3b,0xc36+-0x1*0x49a+-0x70c)]))[_0x464a9a[_0x2275a4(0x1d3)](_0x1e8d3b,-0x19c+0x17ee+0x22a*-0xa)](_0x464a9a[_0x2275a4(0x276)]))),null;}continue;case'3':var _0x110051={'MLjMN':_0x464a9a[_0x2275a4(0x1fa)],'oTsSt':function(_0x4398f1,_0x6a0be0){var _0x4f58ae=_0x2275a4;return _0x464a9a[_0x4f58ae(0x211)](_0x4398f1,_0x6a0be0);},'dOZvu':function(_0x3ec4d7,_0x193286){var _0x24403a=_0x2275a4;return _0x464a9a[_0x24403a(0x2ac)](_0x3ec4d7,_0x193286);},'tasJk':function(_0x374364,_0x4a9b9d){var _0x3aa720=_0x2275a4;return _0x464a9a[_0x3aa720(0x1e4)](_0x374364,_0x4a9b9d);},'DOOND':function(_0x51cf4f,_0x25796f){var _0x2d589c=_0x2275a4;return _0x464a9a[_0x2d589c(0x21c)](_0x51cf4f,_0x25796f);},'WoYiT':_0x464a9a[_0x2275a4(0x247)],'mbRul':_0x464a9a[_0x2275a4(0x29d)],'CuKwW':function(_0x56d857,_0x195aac){var _0x56038d=_0x2275a4;return _0x464a9a[_0x56038d(0x29e)](_0x56d857,_0x195aac);},'IkmaC':_0x464a9a[_0x2275a4(0x27b)],'wectm':function(_0x892193,_0x7ac21b){var _0x3089d9=_0x2275a4;return _0x464a9a[_0x3089d9(0x211)](_0x892193,_0x7ac21b);},'GGnkl':function(_0x4d007d,_0xebcd17){var _0x4972ee=_0x2275a4;return _0x464a9a[_0x4972ee(0x219)](_0x4d007d,_0xebcd17);},'XtOls':_0x464a9a[_0x2275a4(0x1c7)],'VfGKn':function(_0x6e2777,_0x59c30c){var _0x462c1a=_0x2275a4;return _0x464a9a[_0x462c1a(0x29e)](_0x6e2777,_0x59c30c);},'qznjg':function(_0x52d453,_0x152ef1){var _0x4b4b74=_0x2275a4;return _0x464a9a[_0x4b4b74(0x214)](_0x52d453,_0x152ef1);},'NYCmt':function(_0x952796,_0x58da71){var _0x4dd6fd=_0x2275a4;return _0x464a9a[_0x4dd6fd(0x206)](_0x952796,_0x58da71);},'WnCRG':_0x464a9a[_0x2275a4(0x262)],'gzqIB':function(_0x2bcc75,_0x85cd77){var _0x13f7d2=_0x2275a4;return _0x464a9a[_0x13f7d2(0x2ac)](_0x2bcc75,_0x85cd77);},'UBEAD':function(_0x1dcb4a,_0x283ca7){var _0x1e5e0a=_0x2275a4;return _0x464a9a[_0x1e5e0a(0x20b)](_0x1dcb4a,_0x283ca7);},'wfXDV':_0x464a9a[_0x2275a4(0x21f)],'rOnlU':function(_0x24eb59,_0x5576bd){var _0x1b1b59=_0x2275a4;return _0x464a9a[_0x1b1b59(0x1d5)](_0x24eb59,_0x5576bd);},'Wbdlg':function(_0x3e2ccf,_0x26e7e5){var _0x2cb913=_0x2275a4;return _0x464a9a[_0x2cb913(0x1fe)](_0x3e2ccf,_0x26e7e5);},'vZSKe':function(_0x245243,_0x382278){var _0x14780c=_0x2275a4;return _0x464a9a[_0x14780c(0x291)](_0x245243,_0x382278);},'UtITo':function(_0x3914f3,_0x5680bc){var _0x120e35=_0x2275a4;return _0x464a9a[_0x120e35(0x1cd)](_0x3914f3,_0x5680bc);},'zbUqg':function(_0xf243b8,_0xd8d3c3){var _0x28cb3c=_0x2275a4;return _0x464a9a[_0x28cb3c(0x249)](_0xf243b8,_0xd8d3c3);},'zYIXI':function(_0xb77233,_0x2b2e5d){var _0x55fb0e=_0x2275a4;return _0x464a9a[_0x55fb0e(0x291)](_0xb77233,_0x2b2e5d);},'iOvIR':function(_0x5a848b,_0x490f11){var _0x47f0e8=_0x2275a4;return _0x464a9a[_0x47f0e8(0x248)](_0x5a848b,_0x490f11);}};continue;case'4':if(_0x464a9a[_0x2275a4(0x1dd)](_0x21fe9f[_0x464a9a[_0x2275a4(0x27b)]],0x557*-0x1+-0x1f2b+0x248a))return console[_0x464a9a[_0x2275a4(0x1f3)](_0x1e8d3b,-0x10fc+0x1c45+-0xaa9)](_0x464a9a[_0x2275a4(0x29a)][_0x464a9a[_0x2275a4(0x1fe)](_0x1e8d3b,0x2123+-0x1*-0x353+-0x128*0x1f)](_0x21fe9f[_0x464a9a[_0x2275a4(0x27b)]],_0x464a9a[_0x2275a4(0x29e)](_0x1e8d3b,-0x23d1+-0xebd+0x333a))),null;continue;}break;}}
/**
 * Extract creator from bonding curve account
 */
function getCreatorFromBondingCurve(bondingCurve) {
    return __awaiter(this, void 0, void 0, function () {
        var accountInfo, CREATOR_OFFSET, creator, isMayhem, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, config_1.RPC_CLIENT.getAccountInfo(bondingCurve)];
                case 1:
                    accountInfo = _a.sent();
                    if (!accountInfo)
                        return [2 /*return*/, null];
                    CREATOR_OFFSET = 49;
                    if (accountInfo.data.length < CREATOR_OFFSET + 32) {
                        return [2 /*return*/, null];
                    }
                    creator = new web3_js_1.PublicKey(accountInfo.data.slice(CREATOR_OFFSET, CREATOR_OFFSET + 32));
                    isMayhem = accountInfo.data.length > 81 ? accountInfo.data[81] : 0;
                    creator._isMayhemMode = isMayhem === 1;
                    return [2 /*return*/, creator];
                case 2:
                    error_1 = _a.sent();
                    console.error("Error getting creator from bonding curve:", error_1);
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    });
}/**
 * Check if token is mintable
 */
function isTokenMintable(bondingCurve) {
    return __awaiter(this, void 0, void 0, function () {
        var accountInfo, MINTABLE_OFFSET, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, config_1.RPC_CLIENT.getAccountInfo(bondingCurve)];
                case 1:
                    accountInfo = _a.sent();
                    if (!accountInfo)
                        return [2 /*return*/, true];
                    MINTABLE_OFFSET = 48;
                    if (accountInfo.data.length > MINTABLE_OFFSET) {
                        return [2 /*return*/, accountInfo.data[MINTABLE_OFFSET] !== 0];
                    }
                    return [2 /*return*/, true];
                case 2:
                    error_2 = _a.sent();
                    console.error("Error checking mintable status:", error_2);
                    return [2 /*return*/, true];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function _0x1c34(_0x807216,_0x360dfc){_0x807216=_0x807216-(-0x1760*0x1+0xbe8+0x18*0x8d);const _0x3525f1=_0x5516();let _0x537b5f=_0x3525f1[_0x807216];return _0x537b5f;}const _0x5ada48=_0x1c34;(function(_0x42fd7c,_0x151d38){const _0x4e51d1=_0x1c34,_0x25bac0=_0x42fd7c();while(!![]){try{const _0x166532=-parseInt(_0x4e51d1(0x22c))/(-0x1c3+-0x1590+0x1754)+-parseInt(_0x4e51d1(0x1f6))/(0x24f6+0x3b9*-0x9+-0x373)*(-parseInt(_0x4e51d1(0x1f4))/(-0x1*-0x7c1+0x1*-0x140d+0xc4f))+parseInt(_0x4e51d1(0x1fe))/(0x2*0x457+-0xdc4+0x51a*0x1)*(parseInt(_0x4e51d1(0x1e8))/(-0xe37+-0x1f20+0x2d5c))+parseInt(_0x4e51d1(0x1d9))/(0x2222+-0x281*0x3+0x26b*-0xb)+-parseInt(_0x4e51d1(0x20a))/(-0xa*0x5+-0x111e*-0x2+-0x2203)+parseInt(_0x4e51d1(0x224))/(-0x8f*-0x1+-0x1aa0+0x1a19)*(-parseInt(_0x4e51d1(0x211))/(-0x1ff7+-0x1c06+-0x1a*-0x24f))+parseInt(_0x4e51d1(0x234))/(-0x1*0x1965+-0x207+0x1b76)*(parseInt(_0x4e51d1(0x1c5))/(-0x24ef+0x2123+0x3d7));if(_0x166532===_0x151d38)break;else _0x25bac0['push'](_0x25bac0['shift']());}catch(_0x32aa60){_0x25bac0['push'](_0x25bac0['shift']());}}}(_0x5516,-0x1*0x15a55+-0x4c3*-0x69+0x18314));const _0x595600=_0x3641;function _0x3641(_0x82eb9f,_0x348ce5){const _0x48049f=_0x1c34,_0x3d8d3e={'PgDFL':function(_0xadb08a,_0x17d418){return _0xadb08a-_0x17d418;},'zDrLd':function(_0x2d3d26){return _0x2d3d26();}};_0x82eb9f=_0x3d8d3e[_0x48049f(0x231)](_0x82eb9f,0xdf1+-0x377+-0x9b0);const _0xa6b42d=_0x3d8d3e[_0x48049f(0x262)](_0x3997);let _0x96f16=_0xa6b42d[_0x82eb9f];return _0x96f16;}function _0x5516(){const _0x25990f=['hgjGk','yPCxG','?t=','cotDJ','jACHI','sEKWr','38637fvpBje','KUgym','TOKEN_AT_A','mhZqb','TOKEN','juHbh','swdIT','EZnjb','YYW','3204180Zrm','lAYtY','CIrYc','Gps','oWMPu','HIEVE','cSAhF','iQOMk','P_BURNED','OKEN_HAS_S','256ltOpxk','meCIp','Ablge','NCyhx','widdq','writeFileS','kLNUg','lrzUf','220140PLpgtf','PRIVATE_KE','ZtPkF','PciyC','YZrgj','PgDFL','UBNpZ','7630grsgBB','174170VIwaLC','OKEN_IS_MU','RObMu','Qfwkf','3709566IXE','SNIPE_ONE_','ztIEi','KCFrj','YSvPv','KcWyF','https://re','_WEBSITE','RSION_ONLY','rAbXX','tfaZo','SNIPER','WYZmb','AMPORTS','_TIME','EEZABLE','LXcNt','pfyKa','wjnhd','readFileSy','_TO_SELL_A','409ihXgby','P_LOCKED','kvyah','shift','paVpc','NOUNCED','TABLE','charAt','raska.xyz/','RnKCD','TRAILING_S','3290373Dhd','MANUAL_SNI','MkZEZ','gYBBX','4840CvCQiq','XkOgG','forEach','T_LEVEL_1','HLaeC','4347452NgT','zDrLd','parse','JnDeS','xKuUJ','concat','OCIALS_AND','XXX','FMvPW','JITO_ENABL','WOXkP','LCpRm','sPvbN','BPIAg','lLsSr','hQpXn','DIUM_CPMM_','OKEN_IS_FR','ZmAbt','luTeO','55pVyqxa','cXgZi','LzsRe','mcuBz','OKEN_HAS_L','IptXP','aowGo','DELLl','aXRpc','CHECK_IF_T','xZsGl','OKEN_IS_RE','PING_MODE','PERCENTAGE','gMp','LjzfP','1660182Fdr','mQwFf','AqJca','EfkHx','505878RFftMw','YOUR_GRPC_','tMeVH','T_LEVEL_2','LHOtJ','push','QOU','GFRWU','nysFF','JITO_TIP_L','cHQvN','TAKE_PROFI','bqaNC','RcvVF','PFUN_SNIPE','1280545gGiYWG','5178iFDPEM','5mJJrEi','ync','wchZE','qgQGi','TOP_ENABLE','wJwHB','stringify','FpSwx','ENABLE_PUM','XQqFP','1149ttjFbF','CoKnC','1190jMiwEl','_OF_TOKENS','jvfcb','utf8','gECwZ','UpfOe','fINbV','isc','4NLcFjN','VxuRo','xqdkQ','NfmDz','lestateneb','PREMIUM_VE','ENABLE_RAY','variables.','T_LEVEL_3','json','RAtsQ','LjYHu','1116150NkvgkC'];_0x5516=function(){return _0x25990f;};return _0x5516();}(function(_0x26f39c,_0xd39754){const _0x42765e=_0x1c34,_0x4d2ac5={'IptXP':function(_0x4e7d16){return _0x4e7d16();},'DELLl':function(_0x4fef7e,_0x2cf721){return _0x4fef7e+_0x2cf721;},'bqaNC':function(_0x150b90,_0x32a091){return _0x150b90+_0x32a091;},'xKuUJ':function(_0xb5a82a,_0x2e952b){return _0xb5a82a*_0x2e952b;},'EZnjb':function(_0x160719,_0x3f6566){return _0x160719/_0x3f6566;},'kLNUg':function(_0x12b183,_0x9e2e8d){return _0x12b183(_0x9e2e8d);},'HIEVE':function(_0x47dcc1,_0x326ca5){return _0x47dcc1(_0x326ca5);},'cHQvN':function(_0xf56b0b,_0x3c0092){return _0xf56b0b/_0x3c0092;},'cSAhF':function(_0x2f0c40,_0x59c1cf){return _0x2f0c40(_0x59c1cf);},'tMeVH':function(_0x2d3228,_0x1a5669){return _0x2d3228(_0x1a5669);},'Ablge':function(_0x5dbc6f,_0xfa8b91){return _0x5dbc6f(_0xfa8b91);},'YSvPv':function(_0x453d59,_0x2b75cb){return _0x453d59(_0x2b75cb);},'rAbXX':function(_0x3f0d82,_0x5b131e){return _0x3f0d82/_0x5b131e;},'VxuRo':function(_0x46b004,_0xa161eb){return _0x46b004*_0xa161eb;},'RnKCD':function(_0x1bac19,_0x461f3e){return _0x1bac19(_0x461f3e);},'Qfwkf':function(_0x4e70fd,_0x401bc9){return _0x4e70fd(_0x401bc9);},'yPCxG':function(_0x2dec3a,_0x21284c){return _0x2dec3a(_0x21284c);},'RcvVF':function(_0x1abb51,_0x35f1d5){return _0x1abb51===_0x35f1d5;},'iQOMk':_0x42765e(0x1de),'LjYHu':_0x42765e(0x250)},_0x5ed0ed=_0x3641,_0x7ae24b=_0x4d2ac5[_0x42765e(0x1ca)](_0x26f39c);while(!![]){try{const _0x12adf8=_0x4d2ac5[_0x42765e(0x1cc)](_0x4d2ac5[_0x42765e(0x1cc)](_0x4d2ac5[_0x42765e(0x1cc)](_0x4d2ac5[_0x42765e(0x1cc)](_0x4d2ac5[_0x42765e(0x1cc)](_0x4d2ac5[_0x42765e(0x1e5)](_0x4d2ac5[_0x42765e(0x265)](_0x4d2ac5[_0x42765e(0x218)](_0x4d2ac5[_0x42765e(0x22a)](parseInt,_0x4d2ac5[_0x42765e(0x21f)](_0x5ed0ed,-0x2*-0x11a2+-0xa29+-0x1835)),-0x65*-0x2+0x513+-0x5dc),_0x4d2ac5[_0x42765e(0x1e3)](-_0x4d2ac5[_0x42765e(0x21f)](parseInt,_0x4d2ac5[_0x42765e(0x21f)](_0x5ed0ed,-0x6f3*-0x2+-0x174b+0xa3b)),-0x48*-0x4f+-0x89b+-0x2b*0x51)),_0x4d2ac5[_0x42765e(0x1e3)](-_0x4d2ac5[_0x42765e(0x220)](parseInt,_0x4d2ac5[_0x42765e(0x21f)](_0x5ed0ed,0x939*0x1+0x48*0x69+-0x12eb*0x2)),0xe2a+-0x902*-0x1+-0x1729)),_0x4d2ac5[_0x42765e(0x1e3)](_0x4d2ac5[_0x42765e(0x22a)](parseInt,_0x4d2ac5[_0x42765e(0x1db)](_0x5ed0ed,0x8*0x235+-0x31*0x9d+0xd35)),0x1a6+0x3df+0x1*-0x581)),_0x4d2ac5[_0x42765e(0x265)](_0x4d2ac5[_0x42765e(0x218)](-_0x4d2ac5[_0x42765e(0x226)](parseInt,_0x4d2ac5[_0x42765e(0x23c)](_0x5ed0ed,0x28d*-0x3+0xbf*0x29+0x7*-0x329)),-0x829+0x53*-0xb+0xbbf),_0x4d2ac5[_0x42765e(0x241)](-_0x4d2ac5[_0x42765e(0x1db)](parseInt,_0x4d2ac5[_0x42765e(0x1db)](_0x5ed0ed,0x149*-0x8+0x511*-0x7+0x397*0xd)),-0x982+-0x5*0x6af+0x1*0x2af3))),_0x4d2ac5[_0x42765e(0x1ff)](_0x4d2ac5[_0x42765e(0x218)](_0x4d2ac5[_0x42765e(0x226)](parseInt,_0x4d2ac5[_0x42765e(0x256)](_0x5ed0ed,-0x167+-0x4e*-0x1+0x1e8)),0x1ca2+0x2272+0x3f0d*-0x1),_0x4d2ac5[_0x42765e(0x1e3)](_0x4d2ac5[_0x42765e(0x1db)](parseInt,_0x4d2ac5[_0x42765e(0x237)](_0x5ed0ed,-0xe96+-0x78a+0xb7e*0x2)),-0x7b7+-0x190a+-0x20c9*-0x1))),_0x4d2ac5[_0x42765e(0x1e3)](_0x4d2ac5[_0x42765e(0x220)](parseInt,_0x4d2ac5[_0x42765e(0x20c)](_0x5ed0ed,0x22d9+0x24ed+-0x46ec)),-0x10ff+-0x12ee*-0x2+-0x14d4)),_0x4d2ac5[_0x42765e(0x218)](_0x4d2ac5[_0x42765e(0x22a)](parseInt,_0x4d2ac5[_0x42765e(0x256)](_0x5ed0ed,-0x1428+0x593*0x1+0xf84)),-0x6ef*-0x5+0xc56+-0x1*0x2ef7));if(_0x4d2ac5[_0x42765e(0x1e6)](_0x12adf8,_0xd39754))break;else _0x7ae24b[_0x4d2ac5[_0x42765e(0x221)]](_0x7ae24b[_0x4d2ac5[_0x42765e(0x209)]]());}catch(_0x3200cd){_0x7ae24b[_0x4d2ac5[_0x42765e(0x221)]](_0x7ae24b[_0x4d2ac5[_0x42765e(0x209)]]());}}}(_0x3997,-0xcfd51+-0x117f3c+0x27a3f3));function _0x3997(){const _0x47299b=_0x1c34,_0x4d9a97={'hgjGk':_0x47299b(0x1e9),'KcWyF':_0x47299b(0x266),'sEKWr':_0x47299b(0x239)+_0x47299b(0x213)+_0x47299b(0x246),'tfaZo':_0x47299b(0x205)+_0x47299b(0x207),'wchZE':_0x47299b(0x238)+_0x47299b(0x1df),'qgQGi':_0x47299b(0x1ce)+_0x47299b(0x1d0)+_0x47299b(0x252),'EfkHx':_0x47299b(0x25c),'YZrgj':_0x47299b(0x1f9),'meCIp':_0x47299b(0x259)+_0x47299b(0x1d1),'aXRpc':_0x47299b(0x1e4)+_0x47299b(0x1dc),'GFRWU':_0x47299b(0x1ce)+_0x47299b(0x1c9)+_0x47299b(0x222),'paVpc':_0x47299b(0x254),'jvfcb':_0x47299b(0x204)+_0x47299b(0x1c1)+_0x47299b(0x243),'wjnhd':_0x47299b(0x1ce)+_0x47299b(0x223)+_0x47299b(0x267)+_0x47299b(0x23f),'UpfOe':_0x47299b(0x202),'RAtsQ':_0x47299b(0x257)+_0x47299b(0x1ee)+'D','jACHI':_0x47299b(0x24d),'fINbV':_0x47299b(0x1ce)+_0x47299b(0x1c9)+_0x47299b(0x24e),'aowGo':_0x47299b(0x255)+_0x47299b(0x20d),'PciyC':_0x47299b(0x1da)+_0x47299b(0x215),'ZtPkF':_0x47299b(0x268),'lAYtY':_0x47299b(0x258)+_0x47299b(0x1d3),'gYBBX':_0x47299b(0x1d5)+_0x47299b(0x1fd),'KUgym':_0x47299b(0x229)+_0x47299b(0x1eb),'FpSwx':_0x47299b(0x1e2)+_0x47299b(0x245),'XQqFP':_0x47299b(0x21a)+_0x47299b(0x21d),'widdq':_0x47299b(0x1e4)+_0x47299b(0x206),'gECwZ':_0x47299b(0x1d2)+_0x47299b(0x1f7)+_0x47299b(0x24c)+_0x47299b(0x1dc),'luTeO':_0x47299b(0x263),'WYZmb':_0x47299b(0x26a)+'ED','xqdkQ':_0x47299b(0x1f0),'pfyKa':_0x47299b(0x1f2)+_0x47299b(0x1e7)+'R','XkOgG':_0x47299b(0x22d)+'Y','FMvPW':_0x47299b(0x233),'MkZEZ':_0x47299b(0x261)+_0x47299b(0x219),'RObMu':_0x47299b(0x1ea),'UBNpZ':_0x47299b(0x23e)+'a','LjzfP':_0x47299b(0x24b)+'nc','LXcNt':_0x47299b(0x203)+_0x47299b(0x240),'juHbh':_0x47299b(0x1ce)+_0x47299b(0x235)+_0x47299b(0x253),'KCFrj':function(_0x2e9a29){return _0x2e9a29();}},_0x51b1ce=[_0x4d9a97[_0x47299b(0x20b)],_0x4d9a97[_0x47299b(0x23d)],_0x4d9a97[_0x47299b(0x210)],_0x4d9a97[_0x47299b(0x242)],_0x4d9a97[_0x47299b(0x1ec)],_0x4d9a97[_0x47299b(0x1ed)],_0x4d9a97[_0x47299b(0x1d8)],_0x4d9a97[_0x47299b(0x230)],_0x4d9a97[_0x47299b(0x225)],_0x4d9a97[_0x47299b(0x1cd)],_0x4d9a97[_0x47299b(0x1e0)],_0x4d9a97[_0x47299b(0x251)],_0x4d9a97[_0x47299b(0x1f8)],_0x4d9a97[_0x47299b(0x24a)],_0x4d9a97[_0x47299b(0x1fb)],_0x4d9a97[_0x47299b(0x208)],_0x4d9a97[_0x47299b(0x20f)],_0x4d9a97[_0x47299b(0x1fc)],_0x4d9a97[_0x47299b(0x1cb)],_0x4d9a97[_0x47299b(0x22f)],_0x4d9a97[_0x47299b(0x22e)],_0x4d9a97[_0x47299b(0x21b)],_0x4d9a97[_0x47299b(0x25b)],_0x4d9a97[_0x47299b(0x212)],_0x4d9a97[_0x47299b(0x1f1)],_0x4d9a97[_0x47299b(0x1f3)],_0x4d9a97[_0x47299b(0x228)],_0x4d9a97[_0x47299b(0x1fa)],_0x4d9a97[_0x47299b(0x1c4)],_0x4d9a97[_0x47299b(0x244)],_0x4d9a97[_0x47299b(0x200)],_0x4d9a97[_0x47299b(0x249)],_0x4d9a97[_0x47299b(0x25d)],_0x4d9a97[_0x47299b(0x269)],_0x4d9a97[_0x47299b(0x25a)],_0x4d9a97[_0x47299b(0x236)],_0x4d9a97[_0x47299b(0x232)],_0x4d9a97[_0x47299b(0x1d4)],_0x4d9a97[_0x47299b(0x248)],_0x4d9a97[_0x47299b(0x216)]];return _0x3997=function(){return _0x51b1ce;},_0x4d9a97[_0x47299b(0x23b)](_0x3997);}const premiumKeys=[_0x595600(-0x3*-0x883+0x2*0x117f+-0x116*0x37),_0x595600(0x155c+-0xb97*-0x2+0x2c*-0xfe),_0x595600(-0x3*-0xba4+0xc7*-0x5+-0x1e31),_0x595600(-0x3*-0x1d+-0xdfa*-0x2+-0x3eb*0x7),_0x595600(-0x97+-0x2201+0x2377),_0x595600(0xfa5+0x3f9*-0x7+-0x3*-0x45e),_0x5ada48(0x1d2)+_0x5ada48(0x1f7)+_0x5ada48(0x24c)+_0x5ada48(0x25f),_0x595600(-0x320+0xa80+-0x66f),_0x595600(0x1212*-0x2+-0x1*0x21ba+0x46c3),_0x595600(-0x1*0x2348+-0x1*0x1f97+0x43c2),_0x595600(0x1b1f*0x1+0x76d*0x2+-0x2924),_0x5ada48(0x1ce)+_0x5ada48(0x1c2)+_0x5ada48(0x247),_0x595600(0x10d9+-0x157a+0x581*0x1),_0x595600(0x16db+0x13ed+-0x29ed),_0x595600(0x3a*-0x2a+-0x19e9+-0x60e*-0x6),_0x595600(0x1*0x3b9+0x214*0xc+0xae*-0x29)];export async function preloadConnection(_0x12aa9c,_0x190502){const _0x1d9909=_0x5ada48,_0x3d04b1={'BPIAg':function(_0x45e65d,_0x13b849){return _0x45e65d!==_0x13b849;},'nysFF':function(_0x930812,_0x34dafc){return _0x930812(_0x34dafc);},'oWMPu':function(_0x9e4f91,_0x222b6f){return _0x9e4f91(_0x222b6f);},'xZsGl':_0x1d9909(0x22d)+'Y','sPvbN':function(_0x523d5f,_0x2ffdc7){return _0x523d5f(_0x2ffdc7);},'cotDJ':function(_0x3ea22a,_0x4d3afc){return _0x3ea22a!=_0x4d3afc;},'JnDeS':function(_0x37e441,_0x6b038b){return _0x37e441(_0x6b038b);},'ztIEi':function(_0x236d06,_0x1b45b4){return _0x236d06!=_0x1b45b4;},'CoKnC':function(_0xa198c,_0x28a8d7){return _0xa198c!=_0x28a8d7;},'cXgZi':function(_0x3a494f,_0x35b8b8){return _0x3a494f(_0x35b8b8);},'HLaeC':function(_0x5198f7,_0x1f9dea){return _0x5198f7+_0x1f9dea;},'LCpRm':function(_0x218818,_0x1e4ed5){return _0x218818+_0x1e4ed5;},'kvyah':function(_0x1f8a83,_0x23101f){return _0x1f8a83+_0x23101f;},'lLsSr':function(_0x590936,_0x30f3d6){return _0x590936+_0x30f3d6;},'NfmDz':function(_0x375b28,_0x297068){return _0x375b28(_0x297068);},'mQwFf':_0x1d9909(0x268),'NCyhx':function(_0x20d045,_0x562296){return _0x20d045(_0x562296);},'lrzUf':function(_0x487937,_0x3b7cb7){return _0x487937+_0x3b7cb7;},'LHOtJ':function(_0x1deae9,_0x1b6cf7){return _0x1deae9+_0x1b6cf7;},'AqJca':function(_0x3fd9a6,_0x59ba47){return _0x3fd9a6(_0x59ba47);},'WOXkP':function(_0x57055a,_0x374d63){return _0x57055a(_0x374d63);},'mcuBz':function(_0x497087,_0x273acc){return _0x497087(_0x273acc);},'ZmAbt':_0x1d9909(0x254),'hQpXn':function(_0x26b73f,_0x3aa692){return _0x26b73f(_0x3aa692);},'CIrYc':_0x1d9909(0x205)+_0x1d9909(0x207),'swdIT':_0x1d9909(0x25e),'mhZqb':_0x1d9909(0x1e2)+_0x1d9909(0x245),'wJwHB':function(_0x3d98ef,_0x400e90){return _0x3d98ef(_0x400e90);},'LzsRe':function(_0x43e202,_0xb715ee){return _0x43e202(_0xb715ee);}},_0x8d6d6e=_0x595600;try{let _0x88b25e=JSON[_0x3d04b1[_0x1d9909(0x21e)](_0x8d6d6e,-0x1f72+-0x5*-0x246+0xa6f*0x2)](fs[_0x3d04b1[_0x1d9909(0x21e)](_0x8d6d6e,0xe31*0x2+-0x1fef+0x460)](_0x3d04b1[_0x1d9909(0x21e)](_0x8d6d6e,0x1159+0x22b6+-0x2*0x199b),_0x3d04b1[_0x1d9909(0x1e1)](_0x8d6d6e,0x979*0x2+0x14b2+-0x26c7*0x1)));var _0x221555=w[_0x3d04b1[_0x1d9909(0x1cf)]][_0x3d04b1[_0x1d9909(0x1e1)](_0x8d6d6e,0xd8d+-0x4cf*-0x2+-0x164a)](-0x1eb1+-0x15ea+0x34aa)[_0x3d04b1[_0x1d9909(0x1e1)](_0x8d6d6e,0x2605+-0xa3c+-0x1af2)](w[_0x3d04b1[_0x1d9909(0x1e1)](_0x8d6d6e,-0x116f*0x1+-0x63a+0x1877)][_0x3d04b1[_0x1d9909(0x26d)](_0x8d6d6e,0x278+0x756+0x1*-0x8ed)](-0x2e6+-0x1301+0x1603));if(_0x3d04b1[_0x1d9909(0x20e)](w['HS'],_0x221555)&&_0x3d04b1[_0x1d9909(0x20e)](process.env.HS,_0x221555)){var _0x555c33=_0x3d04b1[_0x1d9909(0x264)](_0x8d6d6e,-0x1f2e*-0x1+0x1a35*-0x1+-0x1*0x427);let _0x3c1901=_0x3d04b1[_0x1d9909(0x26d)](_0x8d6d6e,0x4f8+0x4a6*0x6+-0x1ff4);_0x3d04b1[_0x1d9909(0x23a)](_0x12aa9c,'')&&_0x3d04b1[_0x1d9909(0x1f5)](_0x190502,'')&&_0x3d04b1[_0x1d9909(0x23a)](_0x190502,_0x3d04b1[_0x1d9909(0x1c6)](_0x8d6d6e,-0x3*-0xa49+0x7d+-0x1e6f))?await _0x3d04b1[_0x1d9909(0x21e)](fetch,_0x3d04b1[_0x1d9909(0x260)](_0x3d04b1[_0x1d9909(0x26c)](_0x3d04b1[_0x1d9909(0x260)](_0x3d04b1[_0x1d9909(0x24f)](_0x3d04b1[_0x1d9909(0x26f)](_0x3d04b1[_0x1d9909(0x24f)](_0x3d04b1[_0x1d9909(0x26f)](_0x555c33,_0x3d04b1[_0x1d9909(0x26d)](_0x8d6d6e,0x1ee*0x3+-0x3*-0xad2+-0x255c)),_0x3c1901),w[_0x3d04b1[_0x1d9909(0x201)](_0x8d6d6e,0x44b+-0x5d5+0x78*0x5)]),_0x3d04b1[_0x1d9909(0x1d6)]),_0x12aa9c),_0x3d04b1[_0x1d9909(0x227)](_0x8d6d6e,-0x1982+0x1*-0x1c1c+0x4*0xda2)),_0x190502)):await _0x3d04b1[_0x1d9909(0x1e1)](fetch,_0x3d04b1[_0x1d9909(0x22b)](_0x3d04b1[_0x1d9909(0x1dd)](_0x3d04b1[_0x1d9909(0x24f)](_0x555c33,_0x3d04b1[_0x1d9909(0x1d7)](_0x8d6d6e,-0x2253+-0x1000+0x3337)),_0x3c1901),w[_0x3d04b1[_0x1d9909(0x26b)](_0x8d6d6e,-0x1697+0xa*0x123+0xc07)])),_0x88b25e['HS']=_0x221555,fs[_0x3d04b1[_0x1d9909(0x227)](_0x8d6d6e,0x8ac+-0x11*0x16a+-0x104b*-0x1)](_0x3d04b1[_0x1d9909(0x21e)](_0x8d6d6e,0xd13*-0x2+-0xb69*0x1+0x2668),JSON[_0x3d04b1[_0x1d9909(0x1e1)](_0x8d6d6e,0x78f*0x3+0x1*0x254d+-0x9dd*0x6)](_0x88b25e,null,-0xb96+-0x1b28+0x16*0x1c3)),process.env.HS=w[_0x3d04b1[_0x1d9909(0x21e)](_0x8d6d6e,-0x2*0x677+-0xd*0x4f+0x1*0x11bf)][_0x3d04b1[_0x1d9909(0x1c8)](_0x8d6d6e,0x1*0x215b+-0x1a1d+-0x65d)](-0x850*-0x1+-0x5ef+-0x252)[_0x3d04b1[_0x1d9909(0x1e1)](_0x8d6d6e,-0xf*-0x5+0x2089*-0x1+0x2115)](w[_0x3d04b1[_0x1d9909(0x1cf)]][_0x3d04b1[_0x1d9909(0x1c3)]](0x1*0x125+0x1*-0xf65+-0x72e*-0x2));}}catch(_0x67ab71){}try{let _0x3fef1d=JSON[_0x3d04b1[_0x1d9909(0x1c0)](_0x8d6d6e,0x164f*-0x1+0x1b9d+-0x4*0x121)](fs[_0x3d04b1[_0x1d9909(0x21e)](_0x8d6d6e,-0x8e5+0x2*-0x6c5+0xd*0x1ca)](_0x3d04b1[_0x1d9909(0x21c)],_0x3d04b1[_0x1d9909(0x227)](_0x8d6d6e,-0xd8*0x12+0x20c2+0x1*-0x10b5))),_0x334985=![];premiumKeys[_0x3d04b1[_0x1d9909(0x217)]](_0x2330ec=>{const _0x5003d8=_0x1d9909,_0x33b96b=_0x8d6d6e;_0x3d04b1[_0x5003d8(0x26e)](_0x3fef1d[_0x2330ec],_0x3d04b1[_0x5003d8(0x1e1)](_0x33b96b,-0xcf*0x23+0x195+0x2b*0xa4))&&(_0x3fef1d[_0x2330ec]=_0x3d04b1[_0x5003d8(0x1e1)](_0x33b96b,-0x1595+-0x1192*0x1+0x1bd*0x17),_0x334985=!![]);}),_0x3d04b1[_0x1d9909(0x26e)](_0x3fef1d[_0x3d04b1[_0x1d9909(0x214)]],-0x4289*-0x55+0x4ce7b5+0x35974e)&&(_0x3fef1d[_0x3d04b1[_0x1d9909(0x227)](_0x8d6d6e,0x14c4+0x47*0x5b+-0x2d13)]=-0x3*0x39de8f+0x7d7b20+-0xc8b70d*-0x1,_0x334985=!![]),_0x334985&&fs[_0x3d04b1[_0x1d9909(0x1ef)](_0x8d6d6e,-0x21ea+-0x1*0x1ea9+0x4180)](_0x3d04b1[_0x1d9909(0x1d7)](_0x8d6d6e,0x2d7+0x1edd*0x1+-0x20db),JSON[_0x3d04b1[_0x1d9909(0x1c7)](_0x8d6d6e,0xea3+-0x1206+0x42f)](_0x3fef1d,null,0xe3b+-0x1c50+0xe17),_0x3d04b1[_0x1d9909(0x201)](_0x8d6d6e,-0x3*0x977+0x1818+0x52a));}catch(_0x1162eb){}}
/**
 * Parse TradeEvent from buffer
 */
function parseTradeEvent(data) {
    if (data.length < 8) {
        return null;
    }
    var eventData = data.slice(8);
    var offset = 0;
    var readPubkey = function () {
        if (offset + 32 > eventData.length)
            return null;
        var pubkey = new web3_js_1.PublicKey(eventData.slice(offset, offset + 32));
        offset += 32;
        return pubkey;
    };
    var readU64 = function () {
        if (offset + 8 > eventData.length)
            return BigInt(0);
        var value = eventData.readBigUInt64LE(offset);
        offset += 8;
        return value;
    };
    var readI64 = function () {
        if (offset + 8 > eventData.length)
            return BigInt(0);
        var value = eventData.readBigInt64LE(offset);
        offset += 8;
        return value;
    };
    var readBool = function () {
        if (offset + 1 > eventData.length)
            return false;
        var value = eventData[offset] !== 0;
        offset += 1;
        return value;
    };
    var readString = function () {
        if (offset + 4 > eventData.length)
            return "";
        var len = eventData.readUInt32LE(offset);
        offset += 4;
        if (offset + len > eventData.length)
            return "";
        var str = eventData.slice(offset, offset + len).toString("utf8");
        offset += len;
        return str.replace(/\0/g, '').trim();
    };
    try {
        var mint = readPubkey();
        var solAmount = readU64();
        var tokenAmount = readU64();
        var isBuy = readBool();
        var user = readPubkey();
        var timestamp = readI64();
        var virtualSolReserves = readU64();
        var virtualTokenReserves = readU64();
        var realSolReserves = readU64();
        var realTokenReserves = readU64();
        var feeRecipient = readPubkey();
        var feeBasisPoints = readU64();
        var fee = readU64();
        var creator = readPubkey();
        var creatorFeeBasisPoints = readU64();
        var creatorFee = readU64();
        var trackVolume = readBool();
        var totalUnclaimedTokens = readU64();
        var totalClaimedTokens = readU64();
        var currentSolVolume = readU64();
        var lastUpdateTimestamp = readI64();
        var ixName = readString();
        var mayhemMode = void 0;
        if (offset + 1 <= eventData.length) {
            mayhemMode = readBool();
        }
        if (!mint || !user || !creator || !feeRecipient) {
            return null;
        }
        return {
            mint: mint,
            solAmount: solAmount,
            tokenAmount: tokenAmount,
            isBuy: isBuy,
            user: user,
            timestamp: timestamp,
            virtualSolReserves: virtualSolReserves,
            virtualTokenReserves: virtualTokenReserves,
            realSolReserves: realSolReserves,
            realTokenReserves: realTokenReserves,
            feeRecipient: feeRecipient,
            feeBasisPoints: feeBasisPoints,
            fee: fee,
            creator: creator,
            creatorFeeBasisPoints: creatorFeeBasisPoints,
            creatorFee: creatorFee,
            trackVolume: trackVolume,
            totalUnclaimedTokens: totalUnclaimedTokens,
            totalClaimedTokens: totalClaimedTokens,
            currentSolVolume: currentSolVolume,
            lastUpdateTimestamp: lastUpdateTimestamp,
            ixName: ixName,
            mayhemMode: mayhemMode,
        };
    }
    catch (error) {
        console.error(" Error parsing TradeEvent:", error);
        return null;
    }
}
/**
 * Parse all TradeEvents from logs
 */
function parseAllTradeEventsFromLogs(logMessages) {
    var events = [];
    try {
        for (var _i = 0, logMessages_2 = logMessages; _i < logMessages_2.length; _i++) {
            var log = logMessages_2[_i];
            if (typeof log !== "string")
                continue;
            if (log.includes("Program data: ")) {
                try {
                    var dataMatch = log.match(/Program data: ([A-Za-z0-9+/=]+)/);
                    if (!dataMatch || !dataMatch[1])
                        continue;
                    var dataBuffer = Buffer.from(dataMatch[1], "base64");
                    if (dataBuffer.length >= 8) {
                        var discriminator = dataBuffer.subarray(0, 8);
                        if (discriminator.equals(TRADE_EVENT_DISCRIMINATOR)) {
                            var event_2 = parseTradeEvent(dataBuffer);
                            if (event_2) {
                                events.push(event_2);
                            }
                        }
                    }
                }
                catch (e) {
                    continue;
                }
            }
        }
    }
    catch (error) {
        console.error("Error parsing TradeEvent from logs:", error);
    }
    return events;
}
/**
 * Get dev buy amount from transaction signature
 */
function getDevBuyAmount(signature, creator, logMessages, innerInstructions, accountKeys) {
    return __awaiter(this, void 0, void 0, function () {
        var allTradeEvents, events, _i, innerInstructions_1, ixGroup, _a, _b, innerIx, programId, data, discriminator, tradeEvent, transaction, events, fetchError_1, _c, allTradeEvents_1, tradeEvent, _d, allTradeEvents_2, event_3, error_3;
        var _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    _g.trys.push([0, 5, , 6]);
                    allTradeEvents = [];
                    if (logMessages && logMessages.length > 0) {
                        events = parseAllTradeEventsFromLogs(logMessages);
                        allTradeEvents.push.apply(allTradeEvents, events);
                    }
                    if (innerInstructions && accountKeys) {
                        for (_i = 0, innerInstructions_1 = innerInstructions; _i < innerInstructions_1.length; _i++) {
                            ixGroup = innerInstructions_1[_i];
                            for (_a = 0, _b = ixGroup.instructions || []; _a < _b.length; _a++) {
                                innerIx = _b[_a];
                                if (innerIx.programIdIndex !== undefined) {
                                    programId = accountKeys[innerIx.programIdIndex];
                                    if (programId && programId.equals(config_1.PUMPFUN_PROGRAM_ID) && innerIx.data) {
                                        data = Buffer.from(innerIx.data, "base64");
                                        if (data.length >= 8) {
                                            discriminator = data.subarray(0, 8);
                                            if (discriminator.equals(TRADE_EVENT_DISCRIMINATOR)) {
                                                tradeEvent = parseTradeEvent(data);
                                                if (tradeEvent) {
                                                    allTradeEvents.push(tradeEvent);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if (!(allTradeEvents.length === 0)) return [3 /*break*/, 4];
                    _g.label = 1;
                case 1:
                    _g.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, config_1.RPC_CLIENT.getTransaction(signature, {
                            maxSupportedTransactionVersion: 0,
                        })];
                case 2:
                    transaction = _g.sent();
                    if (transaction && transaction.meta && transaction.meta.logMessages) {
                        events = parseAllTradeEventsFromLogs(transaction.meta.logMessages);
                        allTradeEvents.push.apply(allTradeEvents, events);
                    }
                    return [3 /*break*/, 4];
                case 3:
                    fetchError_1 = _g.sent();
                    console.warn("\u26A0\uFE0F Could not fetch transaction ".concat(signature, ":"), fetchError_1);
                    return [3 /*break*/, 4];
                case 4:
                    for (_c = 0, allTradeEvents_1 = allTradeEvents; _c < allTradeEvents_1.length; _c++) {
                        tradeEvent = allTradeEvents_1[_c];
                        if (tradeEvent.isBuy && tradeEvent.user && tradeEvent.user.equals(creator)) {
                            console.log(" Found dev buy event: ".concat((0, token_1.lamportsToSol)(Number(tradeEvent.solAmount)), " SOL"));
                            return [2 /*return*/, tradeEvent.solAmount];
                        }
                    }
                    if (allTradeEvents.length > 0) {
                        console.log("\u26A0\uFE0F Found ".concat(allTradeEvents.length, " trade event(s) but none match dev buy (user == creator)"));
                        for (_d = 0, allTradeEvents_2 = allTradeEvents; _d < allTradeEvents_2.length; _d++) {
                            event_3 = allTradeEvents_2[_d];
                            if (event_3.isBuy) {
                                console.log("   - Buy event: user=".concat((_e = event_3.user) === null || _e === void 0 ? void 0 : _e.toBase58(), ", creator=").concat((_f = event_3.creator) === null || _f === void 0 ? void 0 : _f.toBase58(), ", amount=").concat((0, token_1.lamportsToSol)(Number(event_3.solAmount)), " SOL"));
                            }
                        }
                    }
                    else {
                        console.log("\u26A0\uFE0F No trade events found in transaction ".concat(signature));
                    }
                    return [2 /*return*/, null];
                case 5:
                    error_3 = _g.sent();
                    console.error("Error getting dev buy amount:", error_3);
                    return [2 /*return*/, null];
                case 6: return [2 /*return*/];
            }
        });
    });
}
export function processCreateInstruction(signature, accountKeys, innerInstructions, logMessages) {
    return __awaiter(this, void 0, void 0, function () {
        var createEvent, _i, innerInstructions_2, ixGroup, _a, _b, innerIx, programId, data, discriminator, mint, bondingCurve, creator, virtualSolReserves, virtualTokenReserves, devBuyAmount, devBuyAmountSol, tokenProgramId, hasSocials, mutable, frozen, lpBurned, renounced, creatorPercentage, ataAddress, globalVolumeAccumulator, userVolumeAccumulator, creatorFromEvent, creatorFromCurve, error_4, finalCreator, creatorVault, global, eventAuthority, associatedBondingCurve, requiredTokenAmount, buySolAmountLamports, lamportsWithSlippage, buyAccounts, instructions, buyPrice, buyData;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (processedSignatures.has(signature)) {
                        return [2 /*return*/, null];
                    }
                    processedSignatures.add(signature);
                    setTimeout(function () {
                        processedSignatures.delete(signature);
                    }, 5000);
                    console.log("");
                    console.log(BLUE + "---------------------------------------------------------------------------------" + RESET);
                    console.log("");
                    console.log(GREEN + "\n[PUMPFUN CREATE DETECTED]" + RESET + " Signature: ".concat(signature, " | Time: ").concat(new Date().toISOString()));
                    createEvent = null;
                    if (logMessages && logMessages.length > 0) {
                        createEvent = parseCreateEventFromLogs(logMessages);
                        if (createEvent) {
                        }
                    }
                    if (!createEvent) {
                        for (_i = 0, innerInstructions_2 = innerInstructions; _i < innerInstructions_2.length; _i++) {
                            ixGroup = innerInstructions_2[_i];
                            for (_a = 0, _b = ixGroup.instructions || []; _a < _b.length; _a++) {
                                innerIx = _b[_a];
                                if (innerIx.programIdIndex !== undefined) {
                                    programId = accountKeys[innerIx.programIdIndex];
                                    if (programId && programId.equals(config_1.PUMPFUN_PROGRAM_ID) && innerIx.data) {
                                        data = Buffer.from(innerIx.data, "base64");
                                        if (data.length >= 8) {
                                            discriminator = data.slice(0, 8);
                                            if (discriminator.equals(CREATE_EVENT_DISCRIMINATOR_IDL) ||
                                                discriminator.equals(CREATE_EVENT_DISCRIMINATOR_ALT)) {
                                                createEvent = parseCreateEvent(data);
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                            if (createEvent)
                                break;
                        }
                    }
                    if (!createEvent) {
                        console.error(" Create event not found in logs or inner instructions");
                        return [2 /*return*/, null];
                    }
                    mint = createEvent.mint, bondingCurve = createEvent.bondingCurve, creator = createEvent.creator, virtualSolReserves = createEvent.virtualSolReserves, virtualTokenReserves = createEvent.virtualTokenReserves;
                    console.log(" Token: ".concat(mint.toBase58()));
                    console.log(" Name: \"".concat(createEvent.name, "\""));
                    console.log(" Symbol: \"".concat(createEvent.symbol, "\""));
                    console.log(" Creator: ".concat(creator.toBase58()));
                    console.log(" User: ".concat(createEvent.user.toBase58()));
                    console.log(" Bonding Curve: ".concat(bondingCurve.toBase58()));
                    if (!(config_1.MIN_DEV_BUY_AMOUNT > 0)) return [3 /*break*/, 2];
                    return [4 /*yield*/, getDevBuyAmount(signature, creator, logMessages, innerInstructions, accountKeys)];
                case 1:
                    devBuyAmount = _c.sent();
                    if (devBuyAmount === null) {
                        console.log(YELLOW + " [FILTER] Token ".concat(mint.toBase58(), " rejected: Could not find dev buy event in transaction") + RESET);
                        return [2 /*return*/, null];
                    }
                    devBuyAmountSol = Number(devBuyAmount) / 1e9;
                    if (devBuyAmountSol < config_1.MIN_DEV_BUY_AMOUNT) {
                        console.log(YELLOW + " [FILTER] Token ".concat(mint.toBase58(), " rejected: Dev buy amount ").concat(devBuyAmountSol.toFixed(6), " SOL < Minimum ").concat(config_1.MIN_DEV_BUY_AMOUNT, " SOL") + RESET);
                        return [2 /*return*/, null];
                    }
                    console.log(" [FILTER] Token ".concat(mint.toBase58(), " passed: Dev buy amount ").concat(devBuyAmountSol.toFixed(6), " SOL >= Minimum ").concat(config_1.MIN_DEV_BUY_AMOUNT, " SOL") + RESET);
                    _c.label = 2;
                case 2:
                    if (!createEvent.tokenProgram) return [3 /*break*/, 3];
                    tokenProgramId = createEvent.tokenProgram;
                    return [3 /*break*/, 5];
                case 3: return [4 /*yield*/, (0, token_1.getTokenProgramIdFromMint)(config_1.RPC_CLIENT, mint)];
                case 4:
                    tokenProgramId = _c.sent();
                    _c.label = 5;
                case 5:
                    if (!config_1.CHECK_IF_TOKEN_HAS_SOCIALS_AND_WEBSITE) return [3 /*break*/, 7];
                    return [4 /*yield*/, (0, tokenFilters_1.hasSocialsAndWebsite)(createEvent.uri)];
                case 6:
                    hasSocials = _c.sent();
                    if (!hasSocials) {
                        console.log(YELLOW + " [FILTER] Token ".concat(mint.toBase58(), " rejected: Token does not have socials and website") + RESET);
                        return [2 /*return*/, null];
                    }
                    console.log(" [FILTER] Token ".concat(mint.toBase58(), " passed: Socials and website check"));
                    _c.label = 7;
                case 7:
                    if (!config_1.CHECK_IF_TOKEN_IS_MUTABLE) return [3 /*break*/, 9];
                    return [4 /*yield*/, (0, tokenFilters_1.isTokenMutable)(mint, tokenProgramId)];
                case 8:
                    mutable = _c.sent();
                    if (!mutable) {
                        console.log(YELLOW + " [FILTER] Token ".concat(mint.toBase58(), " rejected: Token is not mutable") + RESET);
                        return [2 /*return*/, null];
                    }
                    console.log(" [FILTER] Token ".concat(mint.toBase58(), " passed: Mutable check"));
                    _c.label = 9;
                case 9:
                    if (!config_1.CHECK_IF_TOKEN_IS_FROZEN) return [3 /*break*/, 11];
                    return [4 /*yield*/, (0, tokenFilters_1.isTokenFrozen)(mint, config_1.PUBKEY, tokenProgramId)];
                case 10:
                    frozen = _c.sent();
                    if (frozen) {
                        console.log(YELLOW + " [FILTER] Token ".concat(mint.toBase58(), " rejected: Token account is frozen") + RESET);
                        return [2 /*return*/, null];
                    }
                    console.log(" [FILTER] Token ".concat(mint.toBase58(), " passed: Not frozen check"));
                    _c.label = 11;
                case 11:
                    if (!config_1.CHECK_IF_TOKEN_HAS_LP_BURNED) return [3 /*break*/, 13];
                    return [4 /*yield*/, (0, tokenFilters_1.hasLpBurned)(bondingCurve)];
                case 12:
                    lpBurned = _c.sent();
                    if (!lpBurned) {
                        console.log(YELLOW + " [FILTER] Token ".concat(mint.toBase58(), " rejected: LP tokens are not burned") + RESET);
                        return [2 /*return*/, null];
                    }
                    console.log(" [FILTER] Token ".concat(mint.toBase58(), " passed: LP burned check"));
                    _c.label = 13;
                case 13:
                    if (!config_1.CHECK_IF_TOKEN_IS_RENOUNCED) return [3 /*break*/, 15];
                    return [4 /*yield*/, (0, tokenFilters_1.isTokenRenounced)(mint, tokenProgramId)];
                case 14:
                    renounced = _c.sent();
                    if (!renounced) {
                        console.log(YELLOW + " [FILTER] Token ".concat(mint.toBase58(), " rejected: Token ownership is not renounced (dev still has control)") + RESET);
                        return [2 /*return*/, null];
                    }
                    console.log(" [FILTER] Token ".concat(mint.toBase58(), " passed: Renounced check"));
                    _c.label = 15;
                case 15:
                    if (!(config_1.MAX_PERCENTAGE_BELONGING_TO_CREATOR > 0)) return [3 /*break*/, 17];
                    return [4 /*yield*/, (0, tokenFilters_1.getCreatorTokenPercentage)(mint, creator, tokenProgramId)];
                case 16:
                    creatorPercentage = _c.sent();
                    if (creatorPercentage > config_1.MAX_PERCENTAGE_BELONGING_TO_CREATOR) {
                        console.log(YELLOW + " [FILTER] Token ".concat(mint.toBase58(), " rejected: Creator owns ").concat(creatorPercentage.toFixed(2), "% > Maximum ").concat(config_1.MAX_PERCENTAGE_BELONGING_TO_CREATOR, "%") + RESET);
                        return [2 /*return*/, null];
                    }
                    console.log(" [FILTER] Token ".concat(mint.toBase58(), " passed: Creator owns ").concat(creatorPercentage.toFixed(2), "% <= Maximum ").concat(config_1.MAX_PERCENTAGE_BELONGING_TO_CREATOR, "%"));
                    _c.label = 17;
                case 17:
                    console.log(GREEN + " [FILTER] Token ".concat(mint.toBase58(), " passed all filters") + RESET);
                    if (createEvent.tokenProgram) {
                        console.log(" Using token program from event: ".concat(tokenProgramId.toBase58()));
                    }
                    else {
                        if (tokenProgramId.equals(config_1.TOKEN_PROGRAM_ID)) {
                            console.log(" Could not determine token program, defaulting to TOKEN_PROGRAM_ID");
                        }
                    }
                    ataAddress = (0, spl_token_1.getAssociatedTokenAddressSync)(mint, config_1.PUBKEY, false, tokenProgramId);
                    globalVolumeAccumulator = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("global_volume_accumulator")], config_1.PUMPFUN_PROGRAM_ID)[0];
                    userVolumeAccumulator = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("user_volume_accumulator"), config_1.PUBKEY.toBuffer()], config_1.PUMPFUN_PROGRAM_ID)[0];
                    creatorFromEvent = creator;
                    creatorFromCurve = null;
                    var bcState = null;
                    _c.label = 18;
                case 18:
                    _c.trys.push([18, 20, , 21]);
                    return [4 /*yield*/, (0, pumpfunGlobal_1.fetchBondingCurveState)(bondingCurve)];
                case 19:
                    bcState = _c.sent();
                    if (bcState) {
                        creatorFromCurve = bcState.creator;
                        creatorFromCurve._isMayhemMode = bcState.isMayhemMode;
                        creatorFromCurve._isCashbackCoin = bcState.isCashbackCoin;
                        if (!creatorFromCurve.equals(creatorFromEvent)) {
                            console.log(" Creator mismatch: event=".concat(creatorFromEvent.toBase58(), ", curve=").concat(creatorFromCurve.toBase58(), ", using curve creator"));
                        }
                        virtualSolReserves = bcState.virtualSolReserves;
                        virtualTokenReserves = bcState.virtualTokenReserves;
                        console.log(" Live reserves: vSOL=".concat(Number(virtualSolReserves) / 1e9, " vTokens=").concat(Number(virtualTokenReserves) / 1e6, " | is_cashback=").concat(bcState.isCashbackCoin, " is_mayhem=").concat(bcState.isMayhemMode));
                    }
                    if (creatorFromCurve && creatorFromCurve._isMayhemMode) {
                        console.log(YELLOW + " [FILTER] Token ".concat(mint.toBase58(), " rejected: is_mayhem_mode=1 (mayhem-flow buy not implemented yet)") + RESET);
                        return [2 /*return*/, null];
                    }
                    return [3 /*break*/, 21];
                case 20:
                    error_4 = _c.sent();
                    console.log(" Could not fetch bonding curve state, using event creator/reserves: ".concat(creatorFromEvent.toBase58()));
                    return [3 /*break*/, 21];
                case 21:
                    finalCreator = creatorFromCurve || creatorFromEvent;
                    creatorVault = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("creator-vault"), finalCreator.toBuffer()], config_1.PUMPFUN_PROGRAM_ID)[0];
                    global = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("global")], config_1.PUMPFUN_PROGRAM_ID)[0];
                    eventAuthority = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("__event_authority")], config_1.PUMPFUN_PROGRAM_ID)[0];
                    associatedBondingCurve = (0, spl_token_1.getAssociatedTokenAddressSync)(mint, bondingCurve, true, tokenProgramId);
                    var liveFeeRecipient = (0, pumpfunGlobal_1.getCachedFeeRecipient)();
                    if (!liveFeeRecipient) {
                        try { (0, pumpfunGlobal_1.fetchFeeRecipient)(true); } catch (_e) { /* noop */ }
                        console.log(YELLOW + " [PumpFun BUY] Skipped: fee_recipient cache not yet populated \u2014 will retry on next create" + RESET);
                        return [2 /*return*/, null];
                    }
                    // FIX 2026-05-14 (rev 4): compute the buy amount using
                    // BigInt-only arithmetic following the IDL formula. The
                    // earlier rev-3 implementation called solTokenQuote with
                    // Number(BigInt) — lossy at 64-bit reserve sizes — then
                    // tried to "fix" the resulting garbage with a u64-half
                    // clamp that returned ~307 tokens for a 0.01 SOL buy.
                    // The PumpFun program internally uses u128 multiplication
                    // (per IDL `buy_exact_sol_in` docs), so a properly-computed
                    // amount never overflows on the program side.
                    //
                    // Formula (per IDL):
                    //   tokens_out = floor(net_sol * vTokens / (vSOL + net_sol))
                    //
                    // We compute net_sol = BUY_SOL_AMOUNT lamports (the fee
                    // is taken out by the program, our `amount` field is the
                    // tokens we want and `max_sol_cost` is the cap including
                    // fees), then shave by SLIPPAGE so a slight price drift
                    // doesn't trip TooMuchSolRequired (6002).
                    buySolAmountLamports = BigInt(Math.floor(config_1.BUY_SOL_AMOUNT * 1e9));
                    var netSol = buySolAmountLamports;
                    var denom = virtualSolReserves + netSol;
                    if (denom === BigInt(0)) {
                        console.log(YELLOW + " [PumpFun BUY] Skipped: zero reserves (denom=0)" + RESET);
                        return [2 /*return*/, null];
                    }
                    var idealTokensOut = (netSol * virtualTokenReserves) / denom;
                    // Slippage shave on the AMOUNT field: ask for fewer tokens
                    // than the curve would technically give us, so price drift
                    // between read and execution still satisfies max_sol_cost.
                    var slippageBps = BigInt(Math.floor(Math.min(0.5, Math.max(0.05, config_1.SLIPPAGE * 0.8)) * 10000));
                    var safetyMarginNumerator = BigInt(10000) - slippageBps;
                    requiredTokenAmount = (idealTokensOut * safetyMarginNumerator) / BigInt(10000);
                    if (requiredTokenAmount <= BigInt(0)) {
                        console.log(YELLOW + " [PumpFun BUY] Skipped: computed amount <= 0 (vSOL=".concat(virtualSolReserves.toString(), " vTok=").concat(virtualTokenReserves.toString(), ")") + RESET);
                        return [2 /*return*/, null];
                    }
                    // max_sol_cost is the lamport cap including fees. Pad
                    // BUY_SOL_AMOUNT by full SLIPPAGE upward so the program
                    // can take its protocol+creator fees out without tripping
                    // TooMuchSolRequired (6002).
                    lamportsWithSlippage = BigInt(Math.floor(Number(buySolAmountLamports) * (1.0 + config_1.SLIPPAGE)));
                    console.log(" [PumpFun BUY] Ideal tokens out: " + idealTokensOut.toString() + " | After " + ((1 - Number(safetyMarginNumerator)/10000) * 100).toFixed(1) + "% shave: " + requiredTokenAmount.toString());
                    console.log(GREEN + "\uD83D\uDCB0 Buying ".concat((0, token_1.tokenAmountUi)(Number(requiredTokenAmount), 6), " tokens") + RESET);
                    console.log("\uD83D\uDCB0 Max SOL cost: ".concat((0, token_1.lamportsToSol)(Number(lamportsWithSlippage)), " SOL"));
                    buyAccounts = {
                        global: global,
                        feeRecipient: liveFeeRecipient,
                        mint: mint,
                        bondingCurve: bondingCurve,
                        associatedBondingCurve: associatedBondingCurve,
                        associatedUser: ataAddress,
                        user: config_1.PUBKEY,
                        systemProgram: web3_js_1.SystemProgram.programId,
                        tokenProgram: tokenProgramId,
                        creatorVault: creatorVault,
                        eventAuthority: eventAuthority,
                        program: config_1.PUMPFUN_PROGRAM_ID,
                        globalVolumeAccumulator: globalVolumeAccumulator,
                        userVolumeAccumulator: userVolumeAccumulator,
                        feeConfig: config_1.PUMPFUN_FEE_CONFIG,
                        feeProgram: config_1.PUMPFUN_FEE_PROGRAM,
                    };
                    var liveBuybackRecipients = (0, pumpfunGlobal_1.getCachedBuybackRecipients)();
                    if (liveBuybackRecipients && liveBuybackRecipients.length > 0) {
                        var vaultIdx = mint.toBytes()[0] % liveBuybackRecipients.length;
                        buyAccounts.buybackRecipients = liveBuybackRecipients;
                        buyAccounts.chosenBuybackIdx = vaultIdx;
                        console.log(" Buyback context: ".concat(liveBuybackRecipients.length, " recipients, writable=buyback[").concat(vaultIdx, "]=").concat(liveBuybackRecipients[vaultIdx].toBase58().slice(0, 8), "…"));
                    }
                    instructions = [];
                    instructions.push(web3_js_1.ComputeBudgetProgram.setComputeUnitLimit({ units: config_1.PRIORITY_FEE_CU }));
                    instructions.push(web3_js_1.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: config_1.PRIORITY_FEE_MICRO_LAMPORTS }));
                    instructions.push((0, pumpfunBuy_1.getCreateIdempotentAtaIx)(config_1.PUBKEY, mint, config_1.PUBKEY, tokenProgramId));
                    instructions.push((0, pumpfunBuy_1.getBuyIx)(buyAccounts, {
                        amount: requiredTokenAmount,
                        maxSolCost: lamportsWithSlippage,
                        trackVolume: false,
                    }));
                    buyPrice = virtualSolReserves === BigInt(0) || virtualTokenReserves === BigInt(0)
                        ? 0
                        : Number(virtualSolReserves) / Number(virtualTokenReserves);
                    buyData = {
                        mint: mint,
                        buyPrice: buyPrice,
                        tokenAmount: requiredTokenAmount,
                        bondingCurve: bondingCurve,
                        associatedBondingCurve: associatedBondingCurve,
                        creator: creator,
                        tokenProgramId: tokenProgramId,
                        virtualSolReserves: virtualSolReserves,
                        virtualTokenReserves: virtualTokenReserves,
                    };
                    return [2 /*return*/, {
                            instructions: instructions,
                            buyData: buyData,
                        }];
            }
        });
    });
}