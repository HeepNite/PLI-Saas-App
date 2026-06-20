import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { buildTodayTerminalClasses, resolveCurrentTerminalClass } from "@/lib/checkin/terminal-current-class"
import { findConsecutiveLinkBetween } from "@/lib/course-links"
import { reservePackageCreditForAttendanceTx } from "@/lib/packages"
import { ensureAttendancePackagePurchase } from "@/lib/purchase-attendance"
import { prisma } from "@/lib/prisma"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { authorizeStudentOperationalRequest } from "@/lib/security/staff-portal-auth"

export const runtime = "nodejs"

const DEFAULT_DROP_IN_CENTS = 2000
const SERIALIZABLE_RETRY_ATTEMPTS = 3

const toRecord = (value: unknown) => value && typeof value === "object" ? value as Record<string, unknown> : {}
const normalizeString = (value: unknown) => typeof value === "string" ? value.trim() : ""
const isOpenCashPurchase = (purchase: { status: string; amount: number }) => purchase.status !== "paid" ? purchase.amount : undefined
const isSerializableConflict = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034"

const runSerializableTransaction = async <T>(callback: (tx: Prisma.TransactionClient) => Promise<T>) => {
  for (let attempt = 1; attempt <= SERIALIZABLE_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(callback, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      })
    } catch (error) {
      if (!isSerializableConflict(error) || attempt === SERIALIZABLE_RETRY_ATTEMPTS) throw error
    }
  }
  throw new Error("Unable to complete transaction")
}

const parseBody = async (req: Request) => {
  try {
    return toRecord(await req.json())
  } catch {
    return null
  }
}

const findUsablePackage = async (userId: string, courseSlug: string, now: Date) => {
  const packages = await prisma.packagePurchase.findMany({
    where: {
      userId,
      status: "active",
      AND: [
        {
          OR: [
            { courseSlug },
            { packagePlan: { courseSlugs: { has: courseSlug } } },
            { courseSlug: null, packagePlanId: null },
          ],
        },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        { OR: [{ isUnlimited: true, remainingCredits: null }, { remainingCredits: { gt: 0 } }] },
      ],
    },
    select: {
      id: true,
      packageId: true,
      packageLabel: true,
      courseSlug: true,
      isUnlimited: true,
      remainingCredits: true,
      expiresAt: true,
      status: true,
      packagePlan: { select: { courseSlugs: true } },
    },
    orderBy: [{ expiresAt: "asc" }, { purchasedAt: "desc" }],
    take: 10,
  })
  return packages[0] || null
}

const resolveCurrentClass = async (now: Date) => {
  const activeCourses = await prisma.courseCatalog.findMany({
    where: { active: true },
    orderBy: [{ createdAt: "asc" }],
  })
  return resolveCurrentTerminalClass(buildTodayTerminalClasses(activeCourses, now), now)
}

const buildPromoOffer = async (input: {
  mode: "fast_pay" | "fast_sign_in"
  currentCourseSlug: string
  currentClassTime: string
  now: Date
}) => {
  const links = await prisma.courseLink.findMany({
    where: {
      active: true,
      OR: [{ courseSlugA: input.currentCourseSlug }, { courseSlugB: input.currentCourseSlug }],
    },
  })
  for (const link of links) {
    const linkedCourseSlug = link.courseSlugA === input.currentCourseSlug ? link.courseSlugB : link.courseSlugA
    const linkedCourse = await prisma.courseCatalog.findUnique({ where: { slug: linkedCourseSlug } })
    if (!linkedCourse) continue
    const today = buildTodayTerminalClasses([linkedCourse], input.now)[0]
    const linkedTime = today?.availableTimes.find((time) => time > input.currentClassTime)
    if (!today || !linkedTime) continue
    const priceCents = input.mode === "fast_sign_in" ? link.packageHolderConsecutiveCents : link.dropInConsecutiveCents
    if (!priceCents || priceCents <= 0) continue
    return { linkedCourseSlug, linkedCourseTitle: linkedCourse.title, priceCents, linkedFromCourseSlug: input.currentCourseSlug }
  }
  return null
}

const createPromoCash = async (input: { userId: string; linkedCourseSlug: string; linkedFromCourseSlug: string; priceCents: number; now: Date }) => {
  const link = await findConsecutiveLinkBetween(input.linkedFromCourseSlug, input.linkedCourseSlug)
  if (!link) return { error: "No active consecutive link found for this course pair", status: 400 as const }

  const course = await prisma.courseCatalog.findUnique({ where: { slug: input.linkedCourseSlug } })
  if (!course) return { error: "Linked course not found", status: 404 as const }
  const linkedToday = buildTodayTerminalClasses([course], input.now)[0]
  const time = linkedToday?.availableTimes[0]
  if (!linkedToday || !time) return { error: "Linked class is not available today", status: 409 as const }
  const linkedClass = resolveCurrentTerminalClass([{ ...linkedToday, availableTimes: [time] }], input.now)
  if (!linkedClass) return { error: "Unable to resolve linked class", status: 409 as const }

  const result = await runSerializableTransaction(async (tx) => {
    const session = await tx.classSession.upsert({
      where: { courseSlug_startsAt: { courseSlug: linkedClass.slug, startsAt: linkedClass.startsAt } },
      update: { title: linkedClass.title, durationMinutes: linkedClass.durationMinutes ?? 60 },
      create: { courseSlug: linkedClass.slug, title: linkedClass.title, startsAt: linkedClass.startsAt, durationMinutes: linkedClass.durationMinutes ?? 60 },
    })
    const existingAttendance = await tx.attendance.findUnique({ where: { userId_sessionId: { userId: input.userId, sessionId: session.id } } })
    const attendance = existingAttendance || await tx.attendance.create({
      data: {
        userId: input.userId,
        sessionId: session.id,
        status: "checked_in_no_package",
        checkedInAt: input.now,
        metadata: { source: "staff_fast_action_promo", linkedFromCourseSlug: input.linkedFromCourseSlug, qrDate: linkedClass.date, qrTime: linkedClass.time },
      },
    })
    const existingPurchase = await tx.purchase.findFirst({
      where: {
        userId: input.userId,
        courseSlug: linkedClass.slug,
        AND: [{ metadata: { path: ["attendanceId"], equals: attendance.id } }, { metadata: { path: ["paymentChannel"], equals: "cash" } }],
      },
      orderBy: { createdAt: "asc" },
    })
    const purchase = existingPurchase || await tx.purchase.create({
      data: {
        userId: input.userId,
        courseSlug: linkedClass.slug,
        courseTitle: linkedClass.title,
        amount: input.priceCents,
        currency: "usd",
        status: "pending",
        participants: 1,
        metadata: { paymentChannel: "cash", settlementStatus: "pending", purchaseSource: "kiosk", source: "staff_fast_action_promo", date: linkedClass.date, time: linkedClass.time, attendanceId: attendance.id, linkedFromCourseSlug: input.linkedFromCourseSlug },
      },
    })
    return { attendance, purchase }
  })
  return { mode: "promo_cash" as const, attendanceId: result.attendance.id, purchaseId: result.purchase.id, outstandingBalanceAddedCents: isOpenCashPurchase(result.purchase) }
}

export async function POST(req: Request) {
  const rateLimit = consumeRateLimit({ key: buildRateLimitKey("staff:students:fast-class-action", getClientIp(req)), limit: 60, windowMs: 60_000 })
  if (!rateLimit.ok) return NextResponse.json({ error: "Too many requests. Please try again in a moment." }, { status: 429 })

  const staffAuth = await authorizeStudentOperationalRequest()
  if (!staffAuth.ok) return NextResponse.json({ error: staffAuth.error }, { status: staffAuth.status })

  const body = await parseBody(req)
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  const userId = normalizeString(body.userId)
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 })

  const now = new Date()
  if (body.acceptConsecutive === true) {
    const promo = toRecord(body.promo)
    const result = await createPromoCash({
      userId,
      linkedCourseSlug: normalizeString(promo.linkedCourseSlug),
      linkedFromCourseSlug: normalizeString(promo.linkedFromCourseSlug),
      priceCents: Number(promo.priceCents),
      now,
    })
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json(result)
  }

  const [user, currentClass] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    resolveCurrentClass(now),
  ])
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
  if (!currentClass) return NextResponse.json({ error: "No current terminal class is available." }, { status: 409 })

  const selectedPackage = await findUsablePackage(user.id, currentClass.slug, now)
  const mode = selectedPackage ? "fast_sign_in" as const : "fast_pay" as const
  const promoOffer = await buildPromoOffer({ mode, currentCourseSlug: currentClass.slug, currentClassTime: currentClass.time, now })
  if (body.previewOnly === true) {
    return NextResponse.json({ mode, promoOffer, previewOnly: true })
  }

  const result = await runSerializableTransaction(async (tx) => {
    const session = await tx.classSession.upsert({
      where: { courseSlug_startsAt: { courseSlug: currentClass.slug, startsAt: currentClass.startsAt } },
      update: { title: currentClass.title, durationMinutes: currentClass.durationMinutes ?? 60 },
      create: { courseSlug: currentClass.slug, title: currentClass.title, startsAt: currentClass.startsAt, durationMinutes: currentClass.durationMinutes ?? 60 },
    })
    const existingAttendance = await tx.attendance.findUnique({ where: { userId_sessionId: { userId: user.id, sessionId: session.id } } })
    const attendance = existingAttendance
      ? await tx.attendance.update({ where: { id: existingAttendance.id }, data: { status: selectedPackage ? "checked_in" : "checked_in_no_package", checkedInAt: now } })
      : await tx.attendance.create({ data: { userId: user.id, sessionId: session.id, status: selectedPackage ? "checked_in" : "checked_in_no_package", checkedInAt: now, metadata: { source: "staff_fast_action", date: currentClass.date, time: currentClass.time } } })

    if (selectedPackage) {
      const reserveResult = await reservePackageCreditForAttendanceTx(tx, { packagePurchaseId: selectedPackage.id, userId: user.id, attendanceId: attendance.id, courseSlug: currentClass.slug, at: now, reason: "STAFF_FAST_SIGN_IN" })
      const packagePurchase = reserveResult.packagePurchase || selectedPackage
      await ensureAttendancePackagePurchase(tx, { attendanceId: attendance.id, userId: user.id, courseSlug: currentClass.slug, courseTitle: currentClass.title, email: user.email || null, name: user.name || null, phone: user.phone || null, packageId: packagePurchase.packageId, packagePurchaseId: packagePurchase.id, source: "staff_fast_sign_in", purchaseSource: "kiosk", date: currentClass.date, time: currentClass.time })
      return { attendance, packagePurchase }
    }

    const existingPurchase = await tx.purchase.findFirst({
      where: { userId: user.id, courseSlug: currentClass.slug, AND: [{ metadata: { path: ["attendanceId"], equals: attendance.id } }, { metadata: { path: ["paymentChannel"], equals: "cash" } }] },
      orderBy: { createdAt: "asc" },
    })
    const purchase = existingPurchase || await tx.purchase.create({
      data: { userId: user.id, courseSlug: currentClass.slug, courseTitle: currentClass.title, amount: currentClass.dropInPriceCents || DEFAULT_DROP_IN_CENTS, currency: "usd", status: "pending", email: user.email || null, name: user.name || null, phone: user.phone || null, participants: 1, metadata: { paymentChannel: "cash", settlementStatus: "pending", purchaseSource: "kiosk", source: "staff_fast_pay", date: currentClass.date, time: currentClass.time, attendanceId: attendance.id } },
    })
    return { attendance, purchase }
  })
  const promoResult = body.includeConsecutive === true && promoOffer
    ? await createPromoCash({
        userId: user.id,
        linkedCourseSlug: promoOffer.linkedCourseSlug,
        linkedFromCourseSlug: promoOffer.linkedFromCourseSlug,
        priceCents: promoOffer.priceCents,
        now,
      })
    : null
  if (promoResult && "error" in promoResult) return NextResponse.json({ error: promoResult.error }, { status: promoResult.status })
  const purchase = "purchase" in result ? result.purchase : null
  const packagePurchase = "packagePurchase" in result ? result.packagePurchase : null
  return NextResponse.json({
    mode,
    attendanceId: result.attendance.id,
    purchaseId: purchase?.id,
    packagePurchaseId: packagePurchase?.id,
    outstandingBalanceAddedCents: purchase ? isOpenCashPurchase(purchase) : undefined,
    promoOffer: body.includeConsecutive === true ? null : promoOffer,
    promoResult,
  })
}
