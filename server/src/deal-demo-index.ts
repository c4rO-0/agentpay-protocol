import { createServer } from "node:http";
import { URL } from "node:url";
import { randomUUID } from "node:crypto";
import { DealDemoError, DealDemoSettlementService } from "./deal-demo/service.js";

const service = new DealDemoSettlementService();
const port = Number.parseInt(process.env.DEAL_DEMO_PORT || "7788", 10);
const randomMcpBaseUrl = process.env.RANDOM_MCP_DEMO_BASE_URL || "http://127.0.0.1:7789";

type JobState = "Queued" | "Broadcasting" | "Confirmed" | "Failed";
type JobStatus = "Accepted" | "Serving" | "Settled" | "Failed";

interface DealExecutionJob {
  jobId: string;
  dealId: string;
  state: JobState;
  status: JobStatus;
  settlementStatus: "Pending" | "Settled" | "Failed";
  attempts: number;
  lastError: string | null;
  output: unknown;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

const executionJobs = new Map<string, DealExecutionJob>();

function nowIso(): string {
  return new Date().toISOString();
}

function makeJobId(): string {
  return `chainjob_${randomUUID().replace(/-/g, "")}`;
}

function json(res: import("node:http").ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function ok(res: import("node:http").ServerResponse, result: unknown, status = 200) {
  json(res, status, { ok: true, result });
}

async function readJson(req: import("node:http").IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

function requireNonNegativeBigIntString(body: any, fieldName: string): string {
  const value = String(body?.[fieldName] ?? "").trim();
  if (!value) throw new DealDemoError("INVALID_INPUT", `${fieldName} is required`);
  try {
    const parsed = BigInt(value);
    if (parsed < 0n) throw new Error("negative");
    return parsed.toString();
  } catch {
    throw new DealDemoError("INVALID_INPUT", `${fieldName} must be a non-negative integer string`);
  }
}

function toHttpError(err: unknown) {
  if (err instanceof DealDemoError) {
    return {
      status: err.code === "NOT_FOUND" ? 404 : err.code === "CONFLICT" ? 409 : 400,
      body: { ok: false, error: { code: err.code, message: err.message } }
    };
  }
  return {
    status: 500,
    body: { ok: false, error: { code: "INTERNAL_ERROR", message: err instanceof Error ? err.message : String(err) } }
  };
}

function serializeDeal(dealId: string) {
  return { deal: service.getDeal(dealId) };
}

function serializeJob(job: DealExecutionJob) {
  return {
    job: {
      jobId: job.jobId,
      dealId: job.dealId,
      state: job.state,
      attempts: job.attempts,
      updatedAt: job.updatedAt,
      createdAt: job.createdAt,
      startedAt: job.createdAt,
      completedAt: job.completedAt,
      availableAt: job.updatedAt,
      lastError: job.lastError,
      status: job.status,
      settlementStatus: job.settlementStatus,
      outputReady: Boolean(job.output),
      needsRecovery: job.state === "Failed",
      statusPath: `/settlement/jobs/${encodeURIComponent(job.jobId)}`,
      dealPath: `/settlement/deals/${encodeURIComponent(job.dealId)}`
    },
    output: job.output
      ? {
          ready: true,
          type: "mcp-execute-result",
          hash: typeof (job.output as any)?.outputHash === "string" ? (job.output as any).outputHash : null,
          payload: job.output
        }
      : {
          ready: false,
          type: null,
          hash: null,
          payload: null
        },
    deal: service.getDeal(job.dealId)
  };
}

async function runDealExecution(job: DealExecutionJob, input: any): Promise<void> {
  job.state = "Broadcasting";
  job.status = "Serving";
  job.attempts += 1;
  job.updatedAt = nowIso();

  const deal = service.getDeal(job.dealId);
  if (deal.status === "Created") {
    if (deal.authorizationMode === "settlement_preauthorized") {
      service.markReadyBySettlement(job.dealId);
    } else {
      service.bindUser(job.dealId, deal.userSafe, "demo-user-signature");
      service.bindMcp(job.dealId, deal.mcpSafe, "demo-mcp-signature");
    }
  }
  service.markFunded(job.dealId);

  const prompt =
    typeof input?.payload?.prompt === "string" && input.payload.prompt.trim()
      ? input.payload.prompt.trim()
      : typeof input?.prompt === "string" && input.prompt.trim()
        ? input.prompt.trim()
        : "Generate a random number.";
  const requestPath =
    typeof input?.requestPath === "string" && input.requestPath.trim() ? input.requestPath.trim() : "/run";
  const mcpResponse = await fetch(`${randomMcpBaseUrl}${requestPath}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      dealId: job.dealId,
      prompt,
      ...((input?.payload && typeof input.payload === "object") ? input.payload : {})
    })
  });
  if (!mcpResponse.ok) throw new Error(`random MCP demo returned ${mcpResponse.status}`);
  const payload = await mcpResponse.json();
  const mcpResult = payload?.result || payload;
  const randomNumber = Number(mcpResult?.randomNumber);
  const output = {
    serviceId: typeof input?.serviceId === "string" && input.serviceId.trim() ? input.serviceId.trim() : deal.serviceId || "default",
    serviceKind: "random",
    randomNumber: Number.isFinite(randomNumber) ? randomNumber : null,
    summary: typeof mcpResult?.summary === "string" ? mcpResult.summary : "Random service completed.",
    outputHash: typeof mcpResult?.outputHash === "string" ? mcpResult.outputHash : null
  };
  service.recordDelivery(job.dealId, output, output.outputHash || undefined);
  if (input?.autoRelease !== false) {
    service.releaseToMcp(job.dealId);
  }

  job.output = output;
  job.state = "Confirmed";
  job.status = "Settled";
  job.settlementStatus = "Settled";
  job.lastError = null;
  job.updatedAt = nowIso();
  job.completedAt = job.updatedAt;
}

function scheduleAsyncExecution(job: DealExecutionJob, input: any): void {
  setTimeout(async () => {
    try {
      await runDealExecution(job, input);
    } catch (err) {
      try {
        service.failDeal(job.dealId);
      } catch {
        // Keep the job failure visible even if the deal state cannot be updated.
      }
      job.state = "Failed";
      job.status = "Failed";
      job.settlementStatus = "Failed";
      job.lastError = err instanceof Error ? err.message : String(err);
      job.updatedAt = nowIso();
      job.completedAt = job.updatedAt;
    }
  }, 0);
}

async function handleExecute(res: import("node:http").ServerResponse, dealId: string, body: any, forceAsync = false) {
  const mode =
    forceAsync
      ? "async"
      : typeof body?.mode === "string" && body.mode.trim().toLowerCase() === "sync"
        ? "sync"
        : "async";
  const now = nowIso();
  const job: DealExecutionJob = {
    jobId: makeJobId(),
    dealId,
    state: "Queued",
    status: "Accepted",
    settlementStatus: "Pending",
    attempts: 0,
    lastError: null,
    output: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null
  };
  executionJobs.set(job.jobId, job);

  if (mode === "sync") {
    await runDealExecution(job, body);
    return ok(res, {
      accepted: true,
      mode: "sync",
      execution: serializeJob(job).job,
      output: serializeJob(job).output.payload,
      statusPath: `/settlement/jobs/${encodeURIComponent(job.jobId)}`,
      dealPath: `/settlement/deals/${encodeURIComponent(dealId)}`,
      ...serializeDeal(dealId)
    });
  }

  scheduleAsyncExecution(job, body);
  return ok(
    res,
    {
      accepted: true,
      mode: "async",
      execution: serializeJob(job).job,
      statusPath: `/settlement/jobs/${encodeURIComponent(job.jobId)}`,
      dealPath: `/settlement/deals/${encodeURIComponent(dealId)}`,
      ...serializeDeal(dealId)
    },
    202
  );
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
    const pathname = url.pathname;

    if (req.method === "GET" && pathname === "/health") {
      return ok(res, {
        name: "agentpay-deal-demo-settlement",
        status: "ok",
        mode: "open-reference",
        onchainEnabled: true,
        deals: service.listDeals().length,
        addresses: {
          settlementExecutorSignerMode: "eoa",
          dealManager: process.env.DEAL_MANAGER_ADDRESS || "demo-deal-manager",
          settlementToken: process.env.TOKEN_ADDRESS || "demo-token"
        }
      });
    }

    if (req.method === "GET" && pathname === "/settlement/deals") {
      return ok(res, { deals: service.listDeals().map((deal) => ({ deal })) });
    }

    if (req.method === "GET" && (pathname.startsWith("/settlement/jobs/") || pathname.startsWith("/jobs/"))) {
      const prefix = pathname.startsWith("/settlement/jobs/") ? "/settlement/jobs/" : "/jobs/";
      const jobId = decodeURIComponent(pathname.slice(prefix.length)).split("/")[0];
      const job = executionJobs.get(jobId);
      if (!job) return json(res, 404, { ok: false, error: { code: "NOT_FOUND", message: "job not found" } });
      return ok(res, serializeJob(job));
    }

    if (req.method === "POST" && pathname === "/settlement/deals") {
      const body = await readJson(req);
      const deal = service.createDeal({
        dealId: typeof body?.dealId === "string" ? body.dealId : undefined,
        onchainDealId: typeof body?.onchainDealId === "string" ? body.onchainDealId : undefined,
        serviceId: typeof body?.serviceId === "string" ? body.serviceId : null,
        userSafe: String(body?.userSafe || ""),
        mcpSafe: String(body?.mcpSafe || ""),
        settlement: String(body?.settlement || process.env.SETTLEMENT_EXECUTOR_ADDRESS || "0x0000000000000000000000000000000000000001"),
        token: String(body?.token || process.env.TOKEN_ADDRESS || "0x0000000000000000000000000000000000000002"),
        amount: typeof body?.amount === "string" ? body.amount : undefined,
        baseAmount: String(body?.baseAmount ?? "0"),
        unitPrice: body?.unitPrice == null ? undefined : requireNonNegativeBigIntString(body, "unitPrice"),
        usageUnits:
          typeof body?.usageUnits === "string"
            ? body.usageUnits
            : typeof body?.userReportedUnits === "string"
              ? body.userReportedUnits
              : "1",
        authorizationMode:
          body?.authorizationMode === "settlement_preauthorized" || body?.autoReadyBySettlement === true
            ? "settlement_preauthorized"
            : "signature"
      });
      if (deal.authorizationMode === "settlement_preauthorized") service.markReadyBySettlement(deal.dealId);
      return ok(res, serializeDeal(deal.dealId));
    }

    const settlementMatch = pathname.match(/^\/settlement\/deals\/([^/]+)(?:\/([^/]+))?$/);
    if (settlementMatch) {
      const dealId = decodeURIComponent(settlementMatch[1] || "");
      const action = settlementMatch[2] || "";
      if (req.method === "GET" && !action) return ok(res, serializeDeal(dealId));
      const body = await readJson(req);
      if (req.method === "POST" && action === "bind-user") {
        return ok(res, serializeDeal(service.bindUser(dealId, String(body?.signer || ""), String(body?.signature || "")).dealId));
      }
      if (req.method === "POST" && action === "bind-mcp") {
        return ok(res, serializeDeal(service.bindMcp(dealId, String(body?.signer || ""), String(body?.signature || "")).dealId));
      }
      if (req.method === "POST" && action === "fund") {
        return ok(res, serializeDeal(service.markFunded(dealId, typeof body?.fundedAmount === "string" ? body.fundedAmount : undefined).dealId));
      }
      if (req.method === "POST" && action === "record-delivery") {
        const payload = body?.payload && typeof body.payload === "object" ? body.payload : {};
        return ok(res, serializeDeal(service.recordDelivery(dealId, payload, typeof body?.outputHash === "string" ? body.outputHash : undefined).dealId));
      }
      if (req.method === "POST" && action === "release") {
        return ok(res, serializeDeal(service.releaseToMcp(dealId, typeof body?.amount === "string" ? body.amount : undefined).dealId));
      }
      if (req.method === "POST" && action === "cancel") {
        return ok(res, serializeDeal(service.cancelDeal(dealId).dealId));
      }
      if (req.method === "POST" && action === "execute") return await handleExecute(res, dealId, body, false);
      if (req.method === "POST" && action === "execute-async") return await handleExecute(res, dealId, body, true);
    }

    return json(res, 404, { ok: false, error: { code: "NOT_FOUND", message: "route not found" } });
  } catch (err) {
    const mapped = toHttpError(err);
    json(res, mapped.status, mapped.body);
  }
}).listen(port, () => {
  process.stdout.write(`[deal-demo-settlement] listening on :${port}\n`);
});
