'use client'
import React from "react"
import GlassyCard from "./GlassyCard"
import type { CourseSectionsData } from "./types"

// CourseSections: middle column content with its own scroll. Max 4 compact sections.
// The parent container should define a fixed height and `overflow-y-auto` so only this
// column scrolls while left/right asides remain sticky.
export default function CourseSections({ course }: { course: CourseSectionsData }) {
  return (
    <div className="space-y-4">
      {/* Section 1: Resumen / Overview */}
      <GlassyCard className="p-5">
        <h2 className="text-lg font-semibold">Resumen</h2>
        <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">{course.description}</p>
        {!!course.requirements?.length && (
          <div className="mt-3">
            <h3 className="text-sm font-medium">Requisitos</h3>
            <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {course.requirements.map((r, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand,#111)]" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </GlassyCard>

      {/* Section 2: Syllabus */}
      {!!course.syllabus?.length && (
        <GlassyCard className="p-5">
          <h2 className="text-lg font-semibold">Syllabus</h2>
          <ol className="mt-2 space-y-2 text-sm list-decimal pl-5">
            {course.syllabus.map((item, idx) => (
              <li key={idx} className="leading-relaxed">{item}</li>
            ))}
          </ol>
        </GlassyCard>
      )}

      {/* Section 3: Schedule & Location */}
      <GlassyCard className="p-5">
        <h2 className="text-lg font-semibold">Schedule & Location</h2>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <p><span className="font-medium">Days:</span> {course.schedule.day}</p>
            <p><span className="font-medium">Time:</span> {course.schedule.time}</p>
            <p><span className="font-medium">Starts:</span> {course.schedule.starts}</p>
            {course.schedule.frequency && <p><span className="font-medium">Frequency:</span> {course.schedule.frequency}</p>}
          </div>
          <div>
            <p className="font-medium">Address</p>
            {course.location.mapUrl ? (
              <a className="underline underline-offset-4 decoration-[var(--brand,#f97316)]" href={course.location.mapUrl} target="_blank">{course.location.address}</a>
            ) : (
              <p>{course.location.address}</p>
            )}
          </div>
        </div>
      </GlassyCard>

      {/* Section 4: Enrollment (duplicate CTA) */}
      <GlassyCard className="p-5">
        <h2 className="text-lg font-semibold">Enrollment</h2>
        <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">Reserve your spot by selecting date, time, and options. Enrollments are in-person; this flow is for demo purposes.</p>
        <div className="mt-3">
          <a href="#enroll-cta" className="inline-flex items-center gap-2 rounded-md bg-[var(--brand,#111)] text-white px-4 py-2 text-sm">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 5v4h3v2h-5V7h2z"/></svg>
            Open form
          </a>
        </div>
      </GlassyCard>
    </div>
  )
}
