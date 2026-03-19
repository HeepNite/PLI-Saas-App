import React from "react"
import HomePageClient from "@/components/front/ui/HomePageClient"
import { homeReviewSlides } from "@/constants/home-content"
import { getCatalogFrontData } from "@/lib/catalog-courses"

export const dynamic = "force-dynamic"

export default async function Page() {
  const { courses, homeCourses, homeCourseCategories } = await getCatalogFrontData()

  return (
    <HomePageClient
      homeCourses={homeCourses}
      homeCourseCategories={homeCourseCategories}
      homeReviewSlides={homeReviewSlides}
      enrollCourses={courses}
    />
  )
}
