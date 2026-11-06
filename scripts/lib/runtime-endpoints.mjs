import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readDotEnvFile(filePath) {
  try {
    const raw = readFileSync(filePath, "utf8");
    const out = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx <= 0) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim();
      out[key] = value.replace(/^["']|["']$/g, "");
    }
    return out;
  } catch {
    return {};
  }
}

function normalizeUrl(url) {
  return String(url || "").replace(/\/+$/, "");
}

export function resolveRuntimeEndpoints({
  cwd = process.cwd(),
  env = process.env,
  defaults = { mcpPort: "6471", settlementPort: "6472" }
} = {}) {
  const envFile = readDotEnvFile(resolve(cwd, ".env"));
  const mcpPort = env.SERVER_PORT || envFile.SERVER_PORT || defaults.mcpPort;
  const settlementPort = env.SETTLEMENT_PORT || envFile.SETTLEMENT_PORT || defaults.settlementPort;

  const mcp = normalizeUrl(env.MCP_SERVER_URL || `http://127.0.0.1:${mcpPort}`);
  const settlement = normalizeUrl(env.SETTLEMENT_SERVER_URL || `http://127.0.0.1:${settlementPort}`);
  return { mcp, settlement, mcpPort, settlementPort };
}

