'use client'
import React from "react"
import type { CourseData } from "@/constants/courses"
import GlassyCard from "./GlassyCard"

// Left sticky aside with course key facts and small hero visual.
// Keep content compact to avoid vertical overflow. Intended to be sticky on desktop.
export default function CourseAsideLeft({ course }: { course: CourseData }) {
  return (
    <div className="space-y-4">
      {/* Hero card: image with faint overlay and title */}
      <GlassyCard img={course.heroMedia?.image} className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-black/60 dark:bg-white/10 flex items-center justify-center text-white">
            {/* simple music/dance icon */}
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
              <path d="M12 3v10.55A4 4 0 1 1 10 17V7h9V3h-7z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold leading-tight">{course.title}</h1>
            <p className="text-xs text-neutral-600 dark:text-neutral-300">{course.level} • {course.duration}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">{course.description}</p>
      </GlassyCard>

      {/* Key facts */}
      <GlassyCard className="p-4">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-neutral-500">Días</dt>
            <dd className="font-medium">{course.schedule.day}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Horario</dt>
            <dd className="font-medium">{course.schedule.time}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Inicio</dt>
            <dd className="font-medium">{course.schedule.starts}</dd>
          </div>
          {course.schedule.frequency && (
            <div>
              <dt className="text-neutral-500">Frecuencia</dt>
              <dd className="font-medium">{course.schedule.frequency}</dd>
            </div>
          )}
          <div className="col-span-2">
            <dt className="text-neutral-500">Ubicación</dt>
            <dd className="font-medium">
              {course.location.mapUrl ? (
                <a href={course.location.mapUrl} target="_blank" className="underline decoration-[var(--brand,#f97316)] decoration-2 underline-offset-4">{course.location.address}</a>
              ) : (
                course.location.address
              )}
            </dd>
          </div>
        </dl>
      </GlassyCard>

      {/* Benefits */}
      {!!course.benefits?.length && (
        <GlassyCard className="p-4">
          <h3 className="text-sm font-semibold">Qué te llevas</h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            {course.benefits!.map((b, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[var(--brand,#111)]" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </GlassyCard>
      )}

      {/* Instructors */}
      {!!course.instructors?.length && (
        <GlassyCard className="p-4">
          <h3 className="text-sm font-semibold">Instructores</h3>
          <ul className="mt-3 space-y-2">
            {course.instructors.map((ins, idx) => (
              <li key={idx} className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ins.photo || "/images/instructors/placeholder.jpg"}
                  alt={ins.name}
                  className="h-10 w-10 rounded-full object-cover"
                />
                <div>
                  <p className="text-sm font-medium leading-tight">{ins.name}</p>
                  {ins.role && <p className="text-xs text-neutral-500">{ins.role}</p>}
                </div>
              </li>
            ))}
          </ul>
        </GlassyCard>
      )}
    </div>
  )
}
