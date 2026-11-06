const settlementBaseUrl = process.env.DEAL_DEMO_SETTLEMENT_BASE_URL || "http://127.0.0.1:7788";

async function request(path, { method = "GET", body } = {}) {
  const response = await fetch(`${settlementBaseUrl}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = await response.json();
  if (!response.ok || payload?.ok === false) {
    throw new Error(
      `request failed for ${method} ${path}: ${response.status} ${JSON.stringify(payload)}`
    );
  }
  return payload.result;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const prompt = "Generate a random number for protocol verification.";
  const create = await request("/settlement/deals", {
    method: "POST",
    body: {
      userSafe: "0x1111111111111111111111111111111111111111",
      mcpSafe: "0x2222222222222222222222222222222222222222",
      settlement: "0x3333333333333333333333333333333333333333",
      token: "0x4444444444444444444444444444444444444444",
      amount: "1000000"
    }
  });

  const dealId = create.deal.dealId;

  await request(`/settlement/deals/${dealId}/bind-user`, {
    method: "POST",
    body: { signer: create.deal.userSafe, signature: "user-demo-signature" }
  });

  await request(`/settlement/deals/${dealId}/bind-mcp`, {
    method: "POST",
    body: { signer: create.deal.mcpSafe, signature: "mcp-demo-signature" }
  });

  await request(`/settlement/deals/${dealId}/fund`, {
    method: "POST",
    body: { fundedAmount: create.deal.amount }
  });

  const runResult = await request(`/settlement/deals/${dealId}/execute`, {
    method: "POST",
    body: { mode: "sync", prompt }
  });

  const finalState = await request(`/settlement/deals/${dealId}`);
  const finalDeal = finalState.deal;
  const mcpResult = runResult.output;

  assert(finalDeal.status === "Released", `expected Released, got ${finalDeal.status}`);
  assert(finalDeal.fundedAmount === create.deal.amount, "fundedAmount mismatch");
  assert(finalDeal.releasedAmount === create.deal.amount, `unexpected releasedAmount ${finalDeal.releasedAmount}`);
  assert(finalDeal.delivery?.payload?.randomNumber === mcpResult.randomNumber, "randomNumber mismatch");
  assert(finalDeal.delivery?.payload?.outputHash === mcpResult.outputHash, "outputHash mismatch");

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        settlementBaseUrl,
        dealId,
        status: finalDeal.status,
        releasedAmount: finalDeal.releasedAmount,
        randomNumber: mcpResult.randomNumber
      },
      null,
      2
    ) + "\n"
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
