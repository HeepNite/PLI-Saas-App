import { prisma } from "@/lib/prisma"

type PaymentEvidence = {
  authority: string
  type: "payment_confirmed"
  paymentJobId: string
  providerPaymentId: string
}

type RefundEvidence = {
  authority: string
  type: "refund_confirmed"
  paymentJobId: string
  providerRefundId: string
  reason: string
  source: string
}

export type AnonymousFastTapEvidence = PaymentEvidence | RefundEvidence

type PaymentJob = {
  id: string
  classSessionId: string
  amountCents: number
  currency: string
  providerPaymentId: string | null
  status: string
  reviewReason: string | null
  classSession: { startsAt: Date }
}

type FinalizerTransaction = {
  nativePaymentJob: {
    findUnique(args: unknown): Promise<PaymentJob | null>
    updateMany(args: unknown): Promise<{ count: number }>
  }
  anonymousSale: {
    upsert(args: unknown): Promise<unknown>
    update(args: unknown): Promise<unknown>
  }
  anonymousAttendanceGrant: {
    upsert(args: unknown): Promise<unknown>
    deleteMany(args: unknown): Promise<{ count: number }>
  }
}

type FinalizerDatabase = {
  $transaction<T>(work: (tx: FinalizerTransaction) => Promise<T>): Promise<T>
}

type FinalizerOptions = {
  db?: FinalizerDatabase
  now?: () => Date
}

type RefundAudit = {
  providerRefundId: string
  requestedAt: string
  reconciledAt: string
  reason: string
  source: string
}

const REFUND_REVOCATION_WINDOW_MS = 30 * 60 * 1000
const MAX_AUDIT_TEXT_LENGTH = 200

const cleanAuditText = (value: string) => value.trim().slice(0, MAX_AUDIT_TEXT_LENGTH)

const parseRefundAudit = (value: string | null): RefundAudit | null => {
  if (!value) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== "object") return null
  const audit = parsed as Partial<RefundAudit>
  if (typeof audit.providerRefundId !== "string" || typeof audit.requestedAt !== "string") return null
  if (Number.isNaN(Date.parse(audit.requestedAt))) throw new Error("INVALID_REFUND_AUDIT")
  return audit as RefundAudit
}

const assertAuthoritative = (evidence: AnonymousFastTapEvidence) => {
  if (evidence.authority !== "server") throw new Error("AUTHORITATIVE_EVIDENCE_REQUIRED")
}

const buildRefundAudit = (previous: RefundAudit | null, evidence: RefundEvidence, reconciledAt: Date) => {
  const requestedAt = previous ? new Date(previous.requestedAt) : reconciledAt
  return {
    requestedAt,
    audit: {
      providerRefundId: evidence.providerRefundId,
      requestedAt: requestedAt.toISOString(),
      reconciledAt: reconciledAt.toISOString(),
      reason: cleanAuditText(evidence.reason),
      source: cleanAuditText(evidence.source),
    } satisfies RefundAudit,
  }
}

const finalizePayment = async (tx: FinalizerTransaction, job: PaymentJob, evidence: PaymentEvidence) => {
  if (job.providerPaymentId && job.providerPaymentId !== evidence.providerPaymentId) {
    throw new Error("CONFLICTING_PAYMENT_EVIDENCE")
  }
  if (job.status === "failed" || job.status === "refunded") {
    throw new Error("CONFLICTING_PAYMENT_STATE")
  }
  const claimed = await tx.nativePaymentJob.updateMany({
    where: {
      id: job.id,
      status: { in: ["created", "collecting", "client_succeeded", "unknown", "authoritative_succeeded", "finalized"] },
      OR: [{ providerPaymentId: null }, { providerPaymentId: evidence.providerPaymentId }],
    },
    data: { providerPaymentId: evidence.providerPaymentId, status: "finalized" },
  })
  if (claimed.count !== 1) throw new Error("CONFLICTING_PAYMENT_STATE")

  const sale = await tx.anonymousSale.upsert({
    where: { paymentJobId: job.id },
    update: {},
    create: {
      paymentJobId: job.id,
      amountCents: job.amountCents,
      currency: job.currency,
      status: "paid",
    },
  })
  const grant = await tx.anonymousAttendanceGrant.upsert({
    where: { paymentJobId: job.id },
    update: {},
    create: { paymentJobId: job.id, sessionId: job.classSessionId },
  })
  return { status: "finalized" as const, sale, grant, grantRevoked: false }
}

const finalizeRefund = async (
  tx: FinalizerTransaction,
  job: PaymentJob,
  evidence: RefundEvidence,
  reconciledAt: Date
) => {
  if (job.status !== "finalized" && job.status !== "refunded") throw new Error("PAYMENT_NOT_FINALIZED")
  const previousAudit = parseRefundAudit(job.reviewReason)
  if (previousAudit && previousAudit.providerRefundId !== evidence.providerRefundId) {
    throw new Error("CONFLICTING_REFUND_EVIDENCE")
  }

  const { requestedAt, audit } = buildRefundAudit(previousAudit, evidence, reconciledAt)
  const claimed = await tx.nativePaymentJob.updateMany({
    where: { id: job.id, status: { in: ["finalized", "refunded"] }, reviewReason: job.reviewReason },
    data: { status: "refunded", reviewReason: JSON.stringify(audit), lastReconciledAt: reconciledAt },
  })
  if (claimed.count !== 1) throw new Error("CONFLICTING_REFUND_STATE")
  const sale = await tx.anonymousSale.update({
    where: { paymentJobId: job.id },
    data: { status: "refunded", refundedAt: requestedAt },
  })
  const withinRevocationWindow = requestedAt.getTime() <= job.classSession.startsAt.getTime() + REFUND_REVOCATION_WINDOW_MS
  const revoked = withinRevocationWindow
    ? await tx.anonymousAttendanceGrant.deleteMany({ where: { paymentJobId: job.id } })
    : { count: 0 }
  return { status: "refunded" as const, sale, grant: null, grantRevoked: revoked.count > 0 }
}

export const finalizeAnonymousFastTap = async (
  evidence: AnonymousFastTapEvidence,
  options: FinalizerOptions = {}
) => {
  assertAuthoritative(evidence)
  const db = options.db ?? (prisma as unknown as FinalizerDatabase)
  const reconciledAt = (options.now ?? (() => new Date()))()

  return db.$transaction(async (tx) => {
    const job = await tx.nativePaymentJob.findUnique({
      where: { id: evidence.paymentJobId },
      include: { classSession: { select: { startsAt: true } } },
    })
    if (!job) throw new Error("PAYMENT_JOB_NOT_FOUND")
    if (evidence.type === "payment_confirmed") return finalizePayment(tx, job, evidence)
    return finalizeRefund(tx, job, evidence, reconciledAt)
  })
}
