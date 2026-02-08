"use client"
import React from "react"
import type { CourseData } from "@/constants/courses"
import CourseAsideLeft from "./CourseAsideLeft"
import CourseAsideRight from "./CourseAsideRight"
import CourseSections from "./CourseSections"

// CoursePageClient: 3-column layout wrapper.
// - Left and right columns are sticky on desktop.
// - The center column is the only scrollable area to keep the page short.
// - On mobile/tablet, the layout stacks and page scrolls normally for better UX.
// Tweak the `stickyTop` and `containerPadding` if your header/notification bar heights change.
export default function CoursePageClient({ course }: { course: CourseData }) {
  // Offset for sticky to account for Header + NotificationBar approx height
  const stickyTop = 96 // px (~ top-24)

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-screen-xl 2xl:max-w-[2500px] px-4 sm:px-6 lg:px-8 py-8">
        {/* Grid shell */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left sticky */}
          <aside className="lg:col-span-3">
            <div className="lg:sticky" style={{ top: stickyTop }}>
              <CourseAsideLeft course={course} />
            </div>
          </aside>

          {/* Center scrollable container */}
          <section className="lg:col-span-6">
            {/* Fixed-height container so only this area scrolls on desktop */}
            <div
              className="lg:h-[calc(100vh-180px)] lg:overflow-y-auto lg:scroll-smooth pr-1"
              // Explanation: 180px roughly equals header + paddings; adjust to your header height.
            >
              <CourseSections course={course} />
            </div>
          </section>

          {/* Right sticky */}
          <aside className="lg:col-span-3" id="enroll-cta">
            <div className="lg:sticky" style={{ top: stickyTop }}>
              <CourseAsideRight course={course} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
