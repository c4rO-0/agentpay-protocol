import { assertUnixMilliseconds } from "./time.js";
import type { Bytes32 } from "./x402-escrow.js";
/** Participant facts only: durations and commercial rulings belong to Settlement. */
export const AGENTPAY_DISPUTE_CASE_VERSION =
  "agentpay.dispute-case.v1" as const;
export type DisputeCaseState =
  | "not_open"
  | "collecting"
  | "reviewing"
  | "human"
  | "human_overdue"
  | "withdrawn"
  | "resolved"
  | "settled";
export interface DisputeSchedule {
  submissionAtMs: number;
  evidenceAtMs: number;
  humanAtMs: number;
  decisionAtMs: number;
  releaseAtMs: number;
  refundAvailableAtMs?: number;
}
export interface DisputeEvidence {
  id: Bytes32;
  role: "buyer" | "provider";
  atMs: number;
  text: string;
  links: string[];
  attachments: Array<{
    name: string;
    mimeType: "image/png" | "image/jpeg" | "image/webp";
    dataBase64: string;
  }>;
}
export interface DisputeCase {
  version: typeof AGENTPAY_DISPUTE_CASE_VERSION;
  orderId: Bytes32;
  state: DisputeCaseState;
  financialState: string;
  confirmed: boolean;
  revision: number;
  schedule: DisputeSchedule;
  reason: string | null;
  verdict: {
    outcome: "release" | "refund";
    reason: string;
    atMs: number;
    actor: string;
  } | null;
  review: { outcome: "release" | "refund" | "manual"; reason: string } | null;
  evidence: DisputeEvidence[];
  events: Array<{
    type: string;
    atMs: number;
    actor: string;
    outcome?: string;
    evidenceId?: Bytes32;
  }>;
  canOpen: boolean;
  canWithdraw: boolean;
  canSubmitEvidence: boolean;
}
/** Validate participant-visible facts; capability flags never replace server authorization.
 * All schedule instants are Unix milliseconds, separate from canonical chain seconds.
 */
export function normalizeDisputeCase(value: unknown): DisputeCase {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("DISPUTE_CASE_INVALID");
  const v = value as DisputeCase;
  const object = (x: unknown): x is Record<string, unknown> =>
    !!x && typeof x === "object" && !Array.isArray(x);
  const text = (x: unknown, max: number) =>
    typeof x === "string" && x.length <= max;
  const keys = (x: unknown, allowed: string[]) =>
    object(x) && Object.keys(x).every((k) => allowed.includes(k));
  if (
    !keys(v, [
      "version",
      "orderId",
      "state",
      "financialState",
      "confirmed",
      "revision",
      "schedule",
      "reason",
      "verdict",
      "review",
      "evidence",
      "events",
      "canOpen",
      "canWithdraw",
      "canSubmitEvidence",
    ]) ||
    ![
      "Uninitialized",
      "Created",
      "Funded",
      "Delivered",
      "Released",
      "Refunded",
      "Cancelled",
    ].includes(v.financialState) ||
    !(v.reason === null || text(v.reason, 8192))
  )
    throw Error("DISPUTE_CASE_INVALID");
  if (
    v.review !== null &&
    (!keys(v.review, ["outcome", "reason"]) ||
      !["release", "refund", "manual"].includes(v.review?.outcome) ||
      !text(v.review?.reason, 4096) ||
      !v.review.reason.trim())
  )
    throw Error("DISPUTE_REVIEW_INVALID");
  if (v.verdict !== null) {
    if (
      !keys(v.verdict, ["outcome", "reason", "atMs", "actor"]) ||
      !["release", "refund"].includes(v.verdict?.outcome) ||
      !text(v.verdict?.reason, 4096) ||
      !v.verdict.reason.trim() ||
      !text(v.verdict?.actor, 256) ||
      !v.verdict.actor.trim()
    )
      throw Error("DISPUTE_VERDICT_INVALID");
    assertUnixMilliseconds(v.verdict.atMs);
  }
  if (
    v.version !== AGENTPAY_DISPUTE_CASE_VERSION ||
    !/^0x[0-9a-f]{64}$/.test(v.orderId) ||
    ![
      "not_open",
      "collecting",
      "reviewing",
      "human",
      "human_overdue",
      "withdrawn",
      "resolved",
      "settled",
    ].includes(v.state) ||
    !Number.isSafeInteger(v.revision) ||
    v.revision < 0
  )
    throw Error("DISPUTE_CASE_INVALID");
  const times = [
    "submissionAtMs",
    "evidenceAtMs",
    "humanAtMs",
    "decisionAtMs",
    "releaseAtMs",
  ] as const;
  if (!keys(v.schedule, [...times, "refundAvailableAtMs"]))
    throw Error("DISPUTE_SCHEDULE_INVALID");
  let previous = 0;
  for (const field of times) {
    const ms = assertUnixMilliseconds(v.schedule?.[field]);
    if (ms <= previous) throw Error("DISPUTE_SCHEDULE_INVALID");
    previous = ms;
  }
  if (
    v.schedule.refundAvailableAtMs !== undefined &&
    assertUnixMilliseconds(v.schedule.refundAvailableAtMs) <=
      v.schedule.releaseAtMs
  )
    throw Error("DISPUTE_SCHEDULE_INVALID");
  if (
    typeof v.confirmed !== "boolean" ||
    !["canOpen", "canWithdraw", "canSubmitEvidence"].every(
      (k) => typeof (v as unknown as Record<string, unknown>)[k] === "boolean",
    ) ||
    !Array.isArray(v.evidence) ||
    v.evidence.length > 16 ||
    !Array.isArray(v.events) ||
    v.events.length > 512
  )
    throw Error("DISPUTE_CASE_INVALID");
  for (const e of v.evidence) {
    if (!keys(e, ["id", "role", "atMs", "text", "links", "attachments"]))
      throw Error("DISPUTE_EVIDENCE_INVALID");
    assertUnixMilliseconds(e.atMs);
    if (
      !/^0x[0-9a-f]{64}$/.test(e.id) ||
      !["buyer", "provider"].includes(e.role) ||
      typeof e.text !== "string" ||
      e.text.length > 32768 ||
      !Array.isArray(e.links) ||
      e.links.length > 8 ||
      !Array.isArray(e.attachments) ||
      e.attachments.length > 3
    )
      throw Error("DISPUTE_EVIDENCE_INVALID");
  }
  for (const e of v.evidence) {
    for (const link of e.links) {
      if (typeof link !== "string") throw Error("DISPUTE_EVIDENCE_INVALID");
      const u = new URL(link);
      if (
        u.protocol !== "https:" ||
        u.username ||
        u.password ||
        link.length > 2048
      )
        throw Error("DISPUTE_EVIDENCE_INVALID");
    }
    for (const a of e.attachments)
      if (
        !keys(a, ["name", "mimeType", "dataBase64"]) ||
        typeof a.name !== "string" ||
        a.name.length > 120 ||
        !["image/png", "image/jpeg", "image/webp"].includes(a.mimeType) ||
        typeof a.dataBase64 !== "string" ||
        a.dataBase64.length > 1398104 ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(a.dataBase64)
      )
        throw Error("DISPUTE_EVIDENCE_INVALID");
  }
  for (const e of v.events) {
    if (!keys(e, ["type", "atMs", "actor", "outcome", "evidenceId"]))
      throw Error("DISPUTE_CASE_INVALID");
    assertUnixMilliseconds(e.atMs);
    if (
      !text(e.type, 128) ||
      !e.type ||
      !text(e.actor, 256) ||
      !e.actor ||
      (e.outcome !== undefined &&
        !["release", "refund", "manual"].includes(e.outcome)) ||
      (e.evidenceId !== undefined && !/^0x[0-9a-f]{64}$/.test(e.evidenceId))
    )
      throw Error("DISPUTE_CASE_INVALID");
  }
  if (
    v.verdict &&
    (!["release", "refund"].includes(v.verdict.outcome) ||
      typeof v.verdict.reason !== "string")
  )
    throw Error("DISPUTE_VERDICT_INVALID");
  return v;
}
