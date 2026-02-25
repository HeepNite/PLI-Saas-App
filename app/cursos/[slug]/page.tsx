import React from "react"
import type { Metadata } from "next"
import CoursePageClient from "@/components/front/courses/CoursePageClient"
import { courseRepository } from "@/lib/courses-repository"

// Dynamic course page. Uses in-memory demo data from constants/courses.ts
// To add a new course, add an entry in demoCourses and include its slug here via getAllCourseSlugs().

export async function generateStaticParams() {
  return courseRepository.getAllCourseSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  if (!slug) return { title: "Curso no encontrado" }
  const course = courseRepository.getCourseBySlug(slug)
  if (!course) return { title: "Curso no encontrado" }
  return {
    title: `${course.title} — PLI`,
    description: course.description,
    openGraph: {
      title: `${course.title} — PLI`,
      description: course.description,
      images: course.heroMedia?.image ? [course.heroMedia.image] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${course.title} — PLI`,
      description: course.description,
      images: course.heroMedia?.image ? [course.heroMedia.image] : undefined,
    },
  }
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const course = courseRepository.getCourseBySlug(slug)
  if (!course) {
    return (
      <main className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Course not found</h1>
          <p className="mt-2 text-neutral-600 dark:text-neutral-300">Check the link or return to the catalog.</p>
        </div>
      </main>
    )
  }
  return <CoursePageClient course={course} />
}
