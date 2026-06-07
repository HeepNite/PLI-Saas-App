import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

const ACTIVE_PIN_LOOKUP_STATUSES = ["active", "rotation_required"] as const

export const STUDENT_PIN_NAMESPACE_TOTAL = 10_000
export const STUDENT_PIN_SATURATION_WARNING_THRESHOLD = 0.7
export const STUDENT_PIN_SATURATION_CRITICAL_THRESHOLD = 0.9

type StudentPinDbClient = Prisma.TransactionClient | typeof prisma

export type StudentPinSaturationAlertLevel = "normal" | "warning" | "critical"

export type StudentPinSaturationReport = {
  activePinCount: number
  totalSpace: number
  availablePinCount: number
  saturationRatio: number
  saturationPct: number
  alertLevel: StudentPinSaturationAlertLevel
  thresholds: {
    warningPct: number
    criticalPct: number
  }
}

const toPercent = (ratio: number) => Number((ratio * 100).toFixed(1))

export const resolveStudentPinSaturationAlertLevel = (
  saturationRatio: number
): StudentPinSaturationAlertLevel => {
  if (saturationRatio >= STUDENT_PIN_SATURATION_CRITICAL_THRESHOLD) return "critical"
  if (saturationRatio >= STUDENT_PIN_SATURATION_WARNING_THRESHOLD) return "warning"
  return "normal"
}

export const getActiveStudentPinCount = async (db: StudentPinDbClient = prisma) => {
  const activePins = await db.studentPinCredential.findMany({
    where: {
      status: { in: [...ACTIVE_PIN_LOOKUP_STATUSES] },
    },
    distinct: ["pinLookupDigest"],
    select: {
      pinLookupDigest: true,
    },
  })

  return activePins.length
}

export const getStudentPinSaturationReport = async (
  db: StudentPinDbClient = prisma
): Promise<StudentPinSaturationReport> => {
  const activePinCount = await getActiveStudentPinCount(db)
  const saturationRatio = activePinCount / STUDENT_PIN_NAMESPACE_TOTAL

  return {
    activePinCount,
    totalSpace: STUDENT_PIN_NAMESPACE_TOTAL,
    availablePinCount: Math.max(0, STUDENT_PIN_NAMESPACE_TOTAL - activePinCount),
    saturationRatio,
    saturationPct: toPercent(saturationRatio),
    alertLevel: resolveStudentPinSaturationAlertLevel(saturationRatio),
    thresholds: {
      warningPct: toPercent(STUDENT_PIN_SATURATION_WARNING_THRESHOLD),
      criticalPct: toPercent(STUDENT_PIN_SATURATION_CRITICAL_THRESHOLD),
    },
  }
}
