"use strict";
// ─────────────────────────────────────────────────────────────────────────────
//  dashboard/server.js — HTTP + WebSocket server
//  Handles: sell_all, sell_half, sell_percent (per-mint), save_config,
//           save_filters, disconnect
// ─────────────────────────────────────────────────────────────────────────────
const http = require("http");
const fs   = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");

let clients = new Set();

function broadcast(event, data) {
  const msg = JSON.stringify({ event, data, ts: Date.now() });
  for (const client of clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

function readVarsSafe(varsPath) {
  try { return JSON.parse(fs.readFileSync(varsPath, "utf8")); }
  catch { return {}; }
}

function buildConfigSnapshot(varsPath) {
  const v = readVarsSafe(varsPath);
  // Send only the keys the dashboard cares about so we don't leak the private key.
  const keys = [
    "JITO_ENABLED", "JITO_TIP_LAMPORTS", "JITO_BLOCK_ENGINE", "JITO_FALLBACK_TO_RPC",
    "USE_GRPC", "RPC_LOGS_COMMITMENT",
    "TRAILING_STOP_ENABLED", "TRAILING_STOP_ACTIVATION_PCT", "TRAILING_STOP_DISTANCE_PCT",
    "AUTO_SELL_ENABLED", "AUTO_SELL_LIFETIME_SECONDS", "PRICE_CHECK_INTERVAL_SECONDS",
    "STOP_LOSS_PERCENTAGE",
    "TAKE_PROFIT_LEVEL_1", "TAKE_PROFIT_LEVEL_2", "TAKE_PROFIT_LEVEL_3",
    "PERCENTAGE_OF_TOKENS_TO_SELL_AT_LEVEL_1", "PERCENTAGE_OF_TOKENS_TO_SELL_AT_LEVEL_2",
    "BUY_SOL_AMOUNT", "SLIPPAGE", "PRIORITY_FEE_CU", "PRIORITY_FEE_MICRO_LAMPORTS",
    "MIN_DEV_BUY_AMOUNT",
    "ENABLE_PUMPFUN_SNIPER", "ENABLE_RAYDIUM_CPMM_SNIPER",
    "SNIPE_ONE_TOKEN_AT_A_TIME", "MANUAL_SNIPING_MODE",
    "MINIMUM_POOL_SIZE_IN_SOL", "MAXIMUM_POOL_SIZE_IN_SOL",
    "MAX_PERCENTAGE_BELONGING_TO_CREATOR",
    "CHECK_IF_TOKEN_HAS_SOCIALS_AND_WEBSITE", "CHECK_IF_TOKEN_IS_MUTABLE",
    "CHECK_IF_TOKEN_IS_FREEZABLE", "CHECK_IF_TOKEN_HAS_LP_BURNED",
    "CHECK_IF_TOKEN_IS_RENOUNCED", "CHECK_IF_TOKEN_HAS_LP_LOCKED",
  ];
  const out = {};
  for (const k of keys) if (k in v) out[k] = v[k];
  return out;
}

async function startDashboard(port, autoSellManager) {
  const publicDir = path.join(__dirname, "../../public");
  const varsPath = path.join(__dirname, "../../variables.json");

  const server = http.createServer((req, res) => {
    const url = req.url.split("?")[0];

    if (url === "/api/positions") {
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify(autoSellManager.getSnapshot()));
      return;
    }

    if (url === "/api/config") {
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify(buildConfigSnapshot(varsPath)));
      return;
    }

    const filePath = (url === "/" || url === "/index.html")
      ? path.join(publicDir, "index.html")
      : path.join(publicDir, url);

    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end("Not found"); return; }
      const ext  = path.extname(filePath);
      const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json" }[ext] || "text/plain";
      res.writeHead(200, { "Content-Type": mime });
      res.end(data);
    });
  });

  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    clients.add(ws);

    // Send current state immediately on connect
    ws.send(JSON.stringify({
      event: "snapshot",
      data: autoSellManager.getSnapshot(),
      ts: Date.now(),
    }));

    // Push the live config so the UI can show real Jito/USE_GRPC/etc state
    ws.send(JSON.stringify({
      event: "config_snapshot",
      data: buildConfigSnapshot(varsPath),
      ts: Date.now(),
    }));

    ws.on("close", () => clients.delete(ws));

    ws.on("message", async (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }
      const { action, mint, percent, config } = msg;

      try {
        switch (action) {
          case "sell_all":
            await autoSellManager.sellAll(100);
            broadcast("action_ack", { action: "sell_all" });
            break;

          case "sell_half":
            await autoSellManager.sellAll(50);
            broadcast("action_ack", { action: "sell_half" });
            break;

          case "sell_percent":
            // Individual token sell from the positions table
            if (mint) {
              const monitor = autoSellManager.monitors?.get(mint);
              if (monitor && monitor.isActive) {
                const pct = Math.min(Math.max(percent || 100, 1), 100);
                const toSell = (monitor.remainingTokenAmount * BigInt(Math.floor(pct * 100))) / 10000n;
                if (toSell > 0n) {
                  const isFinal = pct === 100;
                  const sold = await autoSellManager.executeSell(monitor, toSell, isFinal);
                  if (sold) {
                    monitor.remainingTokenAmount -= toSell;
                    if (isFinal) { monitor.isActive = false; autoSellManager.monitors.delete(mint); }
                  }
                  broadcast("action_ack", { action: "sell_percent", mint, sold });
                }
              }
            } else {
              await autoSellManager.sellAll(percent || 100);
              broadcast("action_ack", { action: "sell_percent", percent });
            }
            break;

          case "save_config":
            // Write updated values to variables.json so they persist across restarts.
            // Note: jito.js re-reads variables.json on every submit, so JITO_ENABLED
            // and JITO_TIP_LAMPORTS take effect for the next buy without a restart.
            if (config && typeof config === "object") {
              try {
                const existing = JSON.parse(fs.readFileSync(varsPath, "utf8"));
                const merged   = { ...existing, ...config };
                fs.writeFileSync(varsPath, JSON.stringify(merged, null, 4));
                broadcast("action_ack", { action: "save_config", success: true });
                broadcast("config_snapshot", buildConfigSnapshot(varsPath));
                console.log("[Dashboard] Config saved to variables.json");
              } catch (e) {
                broadcast("action_ack", { action: "save_config", success: false, error: e.message });
              }
            }
            break;

          case "save_filters":
            broadcast("action_ack", { action: "save_filters", success: true });
            break;

          case "disconnect":
            broadcast("action_ack", { action: "disconnect" });
            process.exit(0);

          default:
            break;
        }
      } catch (e) {
        console.error("[Dashboard] Action error:", e.message);
      }
    });
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`[Dashboard] Port ${port} is already in use.`);
      console.error(`[Dashboard] Change DASHBOARD_PORT in variables.json to a free port (e.g. 3001) and restart.`);
    } else {
      console.error("[Dashboard] Server error:", err.message);
    }
  });

  server.listen(port);

  return broadcast;
}

module.exports = { startDashboard };
