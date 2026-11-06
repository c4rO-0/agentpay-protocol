export interface DealTerms {
  serviceId: string;
  userSafe: string;
  mcpSafe: string;
  settlement: string;
  amount: string;
  fee: string;
  token: string;
  deadline: string;
}

export interface DealRecord extends DealTerms {
  dealId: string;
  status:
    | "Created"
    | "Ready"
    | "Funded"
    | "Delivered"
    | "Released"
    | "Refunded"
    | "Disputed"
    | "Failed";
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionTicket {
  ticketId: string;
  dealId: string;
  serviceId: string;
  requestHash: string;
  expiresAt: string;
  signature: string;
}

export type ChainJobStatus = "Accepted" | "Serving" | "Settled" | "Failed";
