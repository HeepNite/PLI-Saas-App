import { prisma } from "@/lib/prisma"

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
      status: "paid",
      AND: [
        { metadata: { path: ["attendanceId"], equals: input.attendanceId } },
        { metadata: { path: ["paymentChannel"], equals: "package_credit" } },
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
      status: "paid",
      email: input.email,
      name: input.name,
      phone: input.phone,
      participants: 1,
      packageId: input.packageId,
      metadata: {
        paymentChannel: "package_credit",
        settlementStatus: "paid",
        date: input.date,
        time: input.time,
        source: input.source,
        attendanceId: input.attendanceId,
        packagePurchaseId: input.packagePurchaseId,
      },
    },
  })
}
