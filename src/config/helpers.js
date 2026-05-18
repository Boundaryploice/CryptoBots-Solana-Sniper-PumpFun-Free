"use strict";
// Pure config helpers. Extracted so they can be unit-tested without
// importing config/index.js (which has hard runtime deps on PHANTOM_PRIVATE_KEY).

function retrieveBool(vars, key, defaultVal = false) {
  const v = vars ? vars[key] : undefined;
  if (v === undefined || v === null || v === "") return defaultVal;
  return String(v).toLowerCase() === "true";
}

function retrieveNumber(vars, key, defaultVal = 0) {
  const v = vars ? vars[key] : undefined;
  if (v === undefined || v === null || v === "") return defaultVal;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : defaultVal;
}

function retrieveInt(vars, key, defaultVal = 0) {
  const v = vars ? vars[key] : undefined;
  if (v === undefined || v === null || v === "") return defaultVal;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : defaultVal;
}

function retrieveString(vars, key) {
  const v = vars ? vars[key] : undefined;
  if (v === undefined || v === null || v === "") return undefined;
  return String(v);
}

module.exports = { retrieveBool, retrieveNumber, retrieveInt, retrieveString };
