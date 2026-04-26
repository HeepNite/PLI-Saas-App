import "server-only"

import type { PackagePlan, CourseCatalog } from "@prisma/client"
import type { CourseData, EnrollmentOption } from "@/constants/courses"
import { demoCourses } from "@/constants/courses"
import { homeCourseCategories as staticHomeCourseCategories, homeCourses as staticHomeCourses } from "@/constants/home-content"
import { prisma } from "@/lib/prisma"
import type { HomeCourse } from "@/types/home"

const DEFAULT_LOCATION = "54 Coles St, Jersey City, NJ"
const FALLBACK_IMAGE = "/images/carousel/_DSC1076.JPG"
const WEEKDAY_LABELS_MON = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const
const TIME_24_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/

const toMonBasedWeekday = (sunBasedWeekday: number) => (sunBasedWeekday + 6) % 7

const normalizeWeekdaysFromDb = (value: number[]) =>
  [...new Set(value.filter((item) => Number.isInteger(item) && item >= 0 && item <= 6))]
    .sort((a, b) => a - b)
    .map(toMonBasedWeekday)

const normalizeTimes = (value: string[]) =>
  [...new Set(value.map((item) => item.trim()).filter((item) => TIME_24_REGEX.test(item)))].sort()

const formatScheduleDayLabel = (weekdaysMon: number[], fallback = "See schedule") => {
  if (!weekdaysMon.length) return fallback
  return weekdaysMon
    .map((weekday) => WEEKDAY_LABELS_MON[weekday] || "")
    .filter(Boolean)
    .join("/")
}

const formatScheduleTimeLabel = (times: string[], fallback = "See schedule") => {
  if (!times.length) return fallback
  return times.join(" / ")
}

const toLevel = (value: string | null | undefined, fallback: CourseData["level"] = "Beginner"): CourseData["level"] => {
  const normalized = (value || "").trim().toLowerCase()
  if (normalized === "advanced") return "Advanced"
  if (normalized === "intermediate") return "Intermediate"
  if (normalized === "beginner") return "Beginner"
  return fallback
}

const centsToUsd = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) / 100 : null

const buildDefaultServices = (dropIn: number | null, firstClass: number | null): EnrollmentOption[] => {
  const items: EnrollmentOption[] = []
  const dropInPrice = dropIn ?? 20
  items.push({ id: "dropin", label: "Single class", price: dropInPrice })
  if (typeof firstClass === "number" && firstClass > 0) {
    items.push({ id: "new-student", label: "New students", price: firstClass })
  }
  return items
}

const applyCourseServicePricing = (
  baseServices: EnrollmentOption[] | undefined,
  dropIn: number | null,
  firstClass: number | null
): EnrollmentOption[] => {
  if (!baseServices?.length) return buildDefaultServices(dropIn, firstClass)

  let hasDropIn = false
  let hasNewStudent = false
  const mapped = baseServices.map((service) => {
    if (service.id === "dropin") {
      hasDropIn = true
      return { ...service, price: dropIn ?? service.price }
    }
    if (service.id === "new-student") {
      hasNewStudent = true
      if (typeof firstClass === "number" && firstClass > 0) {
        return { ...service, price: firstClass }
      }
      return service
    }
    return service
  })

  if (!hasDropIn) {
    mapped.unshift({ id: "dropin", label: "Single class", price: dropIn ?? 20 })
  }
  if (!hasNewStudent && typeof firstClass === "number" && firstClass > 0) {
    mapped.push({ id: "new-student", label: "New students", price: firstClass })
  }

  return mapped
}

const toMapUrl = (address: string, fallback?: string) =>
  fallback || `https://maps.google.com/?q=${encodeURIComponent(address)}`

const isPackagePlanPubliclyAvailable = (plan: PackagePlan, now = new Date()) => {
  if (!plan.active) return false
  if (plan.status === "DELETED") return false
  if (plan.status === "SUSPENDED") return false
  if (plan.status === "SCHEDULED") {
    return Boolean(plan.launchAt && plan.launchAt.getTime() <= now.getTime())
  }
  return true
}

const mapPackagePlanToOption = (plan: PackagePlan): EnrollmentOption => ({
  id: plan.key,
  label: plan.label,
  description: plan.description || undefined,
  price: centsToUsd(plan.priceCents) ?? undefined,
  meta: {
    cadence: plan.cadence || undefined,
    totalClasses: typeof plan.totalCredits === "number" ? plan.totalCredits : undefined,
    makeUps: plan.makeUps || undefined,
  },
})

const getPackageOptionsForCourse = (courseSlug: string, allPlans: PackagePlan[]) => {
  const scoped = allPlans
    .filter((plan) => isPackagePlanPubliclyAvailable(plan))
    .filter((plan) => !plan.courseSlug || plan.courseSlug === courseSlug)

  const deduped = new Map<string, EnrollmentOption>()
  for (const plan of scoped) {
    if (!deduped.has(plan.key)) {
      deduped.set(plan.key, mapPackagePlanToOption(plan))
    }
  }

  return [...deduped.values()]
}

const mapCatalogRowToCourseData = (
  row: CourseCatalog,
  packagePlans: PackagePlan[]
): CourseData => {
  const base = demoCourses.find((course) => course.slug === row.slug)
  const weekdaysMon = normalizeWeekdaysFromDb(row.availableWeekdays || [])
  const availableTimes = normalizeTimes(row.availableTimes || [])
  const dropIn = centsToUsd(row.dropInPriceCents)
  const firstClass = centsToUsd(row.firstClassPriceCents)
  const services = applyCourseServicePricing(base?.enrollment.services, dropIn, firstClass)
  const packageOptions = getPackageOptionsForCourse(row.slug, packagePlans)
  const address = row.location || base?.location.address || DEFAULT_LOCATION
  const durationValue = row.durationMinutes && row.durationMinutes > 0 ? `${row.durationMinutes} min` : base?.duration || "55 min"

  return {
    slug: row.slug,
    title: row.title || base?.title || "Course",
    description: row.description || base?.description || "Course details coming soon.",
    level: toLevel(row.level, base?.level || "Beginner"),
    duration: durationValue,
    requirements: base?.requirements || ["Comfortable clothes"],
    benefits: base?.benefits || ["Technique and guided practice"],
    syllabus: base?.syllabus || ["Warm-up", "Technique", "Practice"],
    schedule: {
      day: formatScheduleDayLabel(weekdaysMon, base?.schedule.day || "See schedule"),
      time: formatScheduleTimeLabel(availableTimes, base?.schedule.time || "See schedule"),
      starts: base?.schedule.starts || "Ongoing",
      frequency:
        weekdaysMon.length > 0
          ? `${weekdaysMon.length} times per week`
          : base?.schedule.frequency || undefined,
      availableWeekdays: weekdaysMon.length > 0 ? weekdaysMon : base?.schedule.availableWeekdays || [],
      availableTimes: availableTimes.length > 0 ? availableTimes : base?.schedule.availableTimes || [],
    },
    location: {
      address,
      mapUrl: toMapUrl(address, base?.location.mapUrl),
    },
    instructors: base?.instructors?.length
      ? base.instructors
      : [{ name: "PLI Team", role: "Instructor" }],
    heroMedia: {
      image: row.coverImageUrl || base?.heroMedia?.image || FALLBACK_IMAGE,
      video: row.previewVideoUrl || base?.heroMedia?.video,
    },
    enrollment: {
      services,
      packages: packageOptions.length > 0 ? packageOptions : base?.enrollment.packages || [],
      addons: base?.enrollment.addons || [],
    },
  }
}

const formatBadge = (course: CourseData, row?: CourseCatalog | null) => {
  const staticEntry = staticHomeCourses.find((item) => item.slug === course.slug)
  const dropIn = centsToUsd(row?.dropInPriceCents)
  const firstClass = centsToUsd(row?.firstClassPriceCents)
  if (typeof dropIn === "number" && typeof firstClass === "number" && firstClass > 0) {
    return `Drop-in $${dropIn} / $${firstClass} new`
  }
  if (typeof dropIn === "number") {
    return `Drop-in $${dropIn}`
  }
  return staticEntry?.badge || "Open enrollment"
}

const mapCourseToHomeCourse = (course: CourseData, row?: CourseCatalog | null): HomeCourse => {
  const staticEntry = staticHomeCourses.find((item) => item.slug === course.slug)
  const teacher = course.instructors.map((item) => item.name).filter(Boolean).join(" / ") || staticEntry?.teacher || "PLI Team"
  return {
    id: course.slug,
    title: course.title,
    teacher,
    image: course.heroMedia?.image || staticEntry?.image || FALLBACK_IMAGE,
    students: staticEntry?.students || "Open group",
    duration: course.duration || staticEntry?.duration || "55 min",
    badge: formatBadge(course, row),
    category: row?.category || staticEntry?.category || "Featured",
    size: staticEntry?.size || "md",
    description: course.description || staticEntry?.description,
    slug: course.slug,
    previewVideo: course.heroMedia?.video || staticEntry?.previewVideo,
  }
}

const loadCatalogRows = async () => {
  const [catalogRows, packagePlans] = await Promise.all([
    prisma.courseCatalog.findMany({ orderBy: [{ createdAt: "desc" }] }),
    prisma.packagePlan.findMany({ where: { active: true, status: { in: ["ACTIVE", "SCHEDULED"] } }, orderBy: [{ createdAt: "desc" }] }),
  ])
  return { catalogRows, packagePlans }
}

const buildCatalogCoursesFromRows = (catalogRows: CourseCatalog[], packagePlans: PackagePlan[]) => {
  const rowBySlug = new Map(catalogRows.map((row) => [row.slug, row]))
  const activeRows = catalogRows.filter((row) => row.active)
  const dynamicCourses = activeRows.map((row) => mapCatalogRowToCourseData(row, packagePlans))
  const fallbackStatic = demoCourses.filter((course) => !rowBySlug.has(course.slug))
  const courses = [...dynamicCourses, ...fallbackStatic]

  return { courses, rowBySlug }
}

export const getCatalogCourseBySlug = async (slug: string): Promise<CourseData | null> => {
  const normalized = slug.trim().toLowerCase()
  if (!normalized) return null

  try {
    const [row, packagePlans] = await Promise.all([
      prisma.courseCatalog.findUnique({ where: { slug: normalized } }),
      prisma.packagePlan.findMany({
        where: {
          active: true,
          status: { in: ["ACTIVE", "SCHEDULED"] },
          OR: [{ courseSlug: normalized }, { courseSlug: null }],
        },
        orderBy: [{ createdAt: "desc" }],
      }),
    ])

    if (row) {
      if (!row.active) return null
      return mapCatalogRowToCourseData(row, packagePlans)
    }

    return demoCourses.find((course) => course.slug === normalized) || null
  } catch {
    return demoCourses.find((course) => course.slug === normalized) || null
  }
}

export const getCatalogCourseSlugs = async (): Promise<string[]> => {
  try {
    const rows = await prisma.courseCatalog.findMany({
      select: { slug: true, active: true },
      orderBy: [{ createdAt: "desc" }],
    })
    const rowBySlug = new Map(rows.map((row) => [row.slug, row.active]))
    const activeDynamic = rows.filter((row) => row.active).map((row) => row.slug)
    const fallbackStatic = demoCourses.filter((course) => !rowBySlug.has(course.slug)).map((course) => course.slug)
    return [...new Set([...activeDynamic, ...fallbackStatic])]
  } catch {
    return demoCourses.map((course) => course.slug)
  }
}

export const getCatalogFrontData = async (): Promise<{
  courses: CourseData[]
  homeCourses: HomeCourse[]
  homeCourseCategories: string[]
}> => {
  try {
    const { catalogRows, packagePlans } = await loadCatalogRows()
    const { courses, rowBySlug } = buildCatalogCoursesFromRows(catalogRows, packagePlans)
    const homeCourses = courses.map((course) => mapCourseToHomeCourse(course, rowBySlug.get(course.slug)))
    const dynamicCategories = homeCourses.map((item) => item.category).filter((item): item is string => Boolean(item))
    const homeCourseCategories = [...new Set(["Featured", ...dynamicCategories, ...staticHomeCourseCategories])]

    return {
      courses,
      homeCourses,
      homeCourseCategories,
    }
  } catch {
    return {
      courses: demoCourses,
      homeCourses: staticHomeCourses,
      homeCourseCategories: staticHomeCourseCategories,
    }
  }
}
