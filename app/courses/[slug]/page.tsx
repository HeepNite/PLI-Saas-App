import React from "react"
import type { Metadata } from "next"
import CoursePageClient from "@/components/front/courses/CoursePageClient"
import { getCatalogCourseBySlug } from "@/lib/catalog-courses"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  if (!slug) return { title: "Course not found" }
  const course = await getCatalogCourseBySlug(slug)
  if (!course) return { title: "Course not found" }
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

export default async function CoursePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params
  const resolvedSearchParams = await searchParams
  const isQrBooking = resolvedSearchParams.qrBooking === "1"
  const course = await getCatalogCourseBySlug(slug)
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
  return (
    <>
      {isQrBooking && (
        <div className="lg:hidden fixed inset-0 z-[9999] flex items-center justify-center bg-black" id="qr-booking-loader">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            <p className="text-sm text-white/70">Loading your booking…</p>
          </div>
        </div>
      )}
      <CoursePageClient course={course} isQrBooking={isQrBooking} />
    </>
  )
}
