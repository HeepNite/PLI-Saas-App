// Course data types and catalog.
// All courses are now managed via the database (CourseCatalog table).
// This file only exports types and an empty array for backward compatibility.

export type CourseSchedule = {
  day: string
  time: string
  starts: string
  frequency?: string
  availableWeekdays?: number[] // 0=Mon ... 6=Sun
  availableTimes?: string[] // HH:MM in 24h
}

export type CourseInstructor = {
  name: string
  role?: string
  photo?: string
}

export type EnrollmentOption = {
  id: string
  label: string
  description?: string
  price?: number
  meta?: {
    cadence?: string
    totalClasses?: number
    makeUps?: number
  }
}

export type CourseData = {
  slug: string
  title: string
  description: string
  level: "Beginner" | "Intermediate" | "Advanced"
  duration: string
  requirements?: string[]
  benefits?: string[]
  syllabus?: string[]
  schedule: CourseSchedule
  location: {
    address: string
    mapUrl?: string
  }
  instructors: CourseInstructor[]
  heroMedia?: {
    image?: string
    video?: string
  }
  enrollment: {
    services: EnrollmentOption[]
    packages: EnrollmentOption[]
    addons?: EnrollmentOption[]
  }
}

/**
 * @deprecated Courses are now managed in the database via CourseCatalog.
 * Use the admin panel at /staff → School → Courses to create and edit courses.
 * This array is kept empty for backward compatibility with code that imports it.
 */
export const demoCourses: CourseData[] = []
