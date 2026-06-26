import { prisma } from "@/lib/prisma"
import { PAYMENT_CHANNEL, PURCHASE_STATUS, SETTLEMENT_STATUS } from "@/lib/payment-constants"

type PurchaseWriteClient = Pick<typeof prisma, "$executeRaw" | "purchase">

type EnsureAttendancePackagePurchaseInput = {
  attendanceId: string
  userId: string
  courseSlug: string
  courseTitle: string
  email: string | null
  name: string | null
  phone: string | null
  packageId: string
  packagePurchaseId: string
  source: string
  purchaseSource?: string
  date: string
  time: string
}

export const ensureAttendancePackagePurchase = async (
  db: PurchaseWriteClient,
  input: EnsureAttendancePackagePurchaseInput
) => {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.attendanceId}))`

  const existingPurchase = await db.purchase.findFirst({
    where: {
      userId: input.userId,
      packageId: input.packageId,
      status: PURCHASE_STATUS.PAID,
      AND: [
        { metadata: { path: ["attendanceId"], equals: input.attendanceId } },
        { metadata: { path: ["paymentChannel"], equals: PAYMENT_CHANNEL.PACKAGE_CREDIT } },
      ],
    },
    orderBy: { createdAt: "asc" },
  })

  if (existingPurchase) {
    return existingPurchase
  }

  return db.purchase.create({
    data: {
      userId: input.userId,
      courseSlug: input.courseSlug,
      courseTitle: input.courseTitle,
      amount: 0,
      currency: "usd",
      status: PURCHASE_STATUS.PAID,
      email: input.email,
      name: input.name,
      phone: input.phone,
      participants: 1,
      packageId: input.packageId,
      metadata: {
        paymentChannel: PAYMENT_CHANNEL.PACKAGE_CREDIT,
        settlementStatus: SETTLEMENT_STATUS.PAID,
        date: input.date,
        time: input.time,
        source: input.source,
        ...(input.purchaseSource ? { purchaseSource: input.purchaseSource } : {}),
        attendanceId: input.attendanceId,
        packagePurchaseId: input.packagePurchaseId,
      },
    },
  })
}
