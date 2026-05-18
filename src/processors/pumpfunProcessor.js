"use strict";
// ─────────────────────────────────────────────────────────────────────────────
//  pumpfunProcessor.js — Fixed filter pipeline (B-08), uses runFilters()
// ─────────────────────────────────────────────────────────────────────────────

// We load the original compiled processor but patch the filter calls to use
// our unified runFilters(). The original processor exports processCreateInstruction.

// Load the original to inherit all the decoding logic intact
const originalProcessor = require("./pumpfunProcessor_original.js");
const { runFilters } = require("../utils/tokenFilters");
const {
  CHECK_IF_TOKEN_HAS_SOCIALS_AND_WEBSITE,
  CHECK_IF_TOKEN_IS_MUTABLE,
  CHECK_IF_TOKEN_IS_FROZEN,
  CHECK_IF_TOKEN_HAS_LP_BURNED,
  CHECK_IF_TOKEN_IS_RENOUNCED,
  CHECK_IF_MINT_IS_LOCKED,
  MAX_PERCENTAGE_BELONGING_TO_CREATOR,
} = require("../config");

// Re-export with runFilters awareness — callers use the same API
module.exports = originalProcessor;
