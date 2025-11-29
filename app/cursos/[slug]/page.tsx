import React from "react"
import { getAllCourseSlugs, getCourseBySlug } from "@/constants/courses"
import type { Metadata } from "next"
import CoursePageClient from "@/components/front/courses/CoursePageClient"

// Dynamic course page. Uses in-memory demo data from constants/courses.ts
// To add a new course, add an entry in demoCourses and include its slug here via getAllCourseSlugs().

export async function generateStaticParams() {
  return getAllCourseSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const course = getCourseBySlug(params.slug)
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

export default function CoursePage({ params }: { params: { slug: string } }) {
  const course = getCourseBySlug(params.slug)
  if (!course) {
    return (
      <main className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Curso no encontrado</h1>
          <p className="mt-2 text-neutral-600 dark:text-neutral-300">Revisa el enlace o vuelve al catálogo.</p>
        </div>
      </main>
    )
  }
  return <CoursePageClient course={course} />
}
