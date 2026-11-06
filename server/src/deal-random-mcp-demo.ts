import { createServer } from "node:http";
import { randomInt, createHash } from "node:crypto";

const port = Number.parseInt(process.env.RANDOM_MCP_DEMO_PORT || "7789", 10);
const serviceId = process.env.RANDOM_MCP_DEMO_SERVICE_ID || "service.agentpay.random-demo";
const provider = process.env.RANDOM_MCP_DEMO_PROVIDER || "provider.agentpay.demo";
const token = process.env.RANDOM_MCP_DEMO_TOKEN || "USDC";

function json(res: import("node:http").ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function readJson(req: import("node:http").IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);

  if (req.method === "GET" && url.pathname === "/health") {
    return json(res, 200, {
      ok: true,
      result: { name: "agentpay-random-mcp-demo", serviceId, provider, token }
    });
  }

  if (req.method === "GET" && url.pathname === "/service-profile") {
    return json(res, 200, {
      ok: true,
      result: {
        serviceId,
        provider,
        token,
        metadata: "Simple open-source random-number MCP demo for the DealManager flow."
      }
    });
  }

  if (req.method === "POST" && url.pathname === "/run") {
    const body = await readJson(req);
    const randomNumber = randomInt(0, 1_000_000);
    const payload = {
      dealId: typeof body.dealId === "string" ? body.dealId : "",
      prompt: typeof body.prompt === "string" ? body.prompt : "",
      randomNumber
    };
    const outputHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    return json(res, 200, {
      ok: true,
      result: {
        serviceId,
        deliveredAt: new Date().toISOString(),
        randomNumber,
        outputHash,
        prompt: payload.prompt
      }
    });
  }

  return json(res, 404, { ok: false, error: { code: "NOT_FOUND", message: "route not found" } });
}).listen(port, () => {
  process.stdout.write(`[random-mcp-demo] listening on :${port}\n`);
});
