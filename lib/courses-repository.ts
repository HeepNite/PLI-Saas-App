import { demoCourses, type CourseData } from "@/constants/courses"

export type CourseRepository = {
  getCourseBySlug: (slug: string) => CourseData | undefined
  getAllCourseSlugs: () => string[]
}

const inMemoryCourseRepository: CourseRepository = {
  getCourseBySlug: (slug) => demoCourses.find((c) => c.slug === slug),
  getAllCourseSlugs: () => demoCourses.map((c) => c.slug),
}

export const courseRepository: CourseRepository = inMemoryCourseRepository
