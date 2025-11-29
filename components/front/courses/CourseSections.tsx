'use client'
import React from "react"
import type { CourseData } from "@/constants/courses"
import GlassyCard from "./GlassyCard"

// CourseSections: middle column content with its own scroll. Max 4 compact sections.
// The parent container should define a fixed height and `overflow-y-auto` so only this
// column scrolls while left/right asides remain sticky.
export default function CourseSections({ course }: { course: CourseData }) {
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

      {/* Section 2: Programa / Syllabus */}
      {!!course.syllabus?.length && (
        <GlassyCard className="p-5">
          <h2 className="text-lg font-semibold">Programa</h2>
          <ol className="mt-2 space-y-2 text-sm list-decimal pl-5">
            {course.syllabus.map((item, idx) => (
              <li key={idx} className="leading-relaxed">{item}</li>
            ))}
          </ol>
        </GlassyCard>
      )}

      {/* Section 3: Horarios & Ubicación */}
      <GlassyCard className="p-5">
        <h2 className="text-lg font-semibold">Horarios & Ubicación</h2>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <p><span className="font-medium">Días:</span> {course.schedule.day}</p>
            <p><span className="font-medium">Hora:</span> {course.schedule.time}</p>
            <p><span className="font-medium">Inicio:</span> {course.schedule.starts}</p>
            {course.schedule.frequency && <p><span className="font-medium">Frecuencia:</span> {course.schedule.frequency}</p>}
          </div>
          <div>
            <p className="font-medium">Dirección</p>
            {course.location.mapUrl ? (
              <a className="underline underline-offset-4 decoration-[var(--brand,#f97316)]" href={course.location.mapUrl} target="_blank">{course.location.address}</a>
            ) : (
              <p>{course.location.address}</p>
            )}
          </div>
        </div>
      </GlassyCard>

      {/* Section 4: Inscripción (duplicamos CTA aquí por conveniencia) */}
      <GlassyCard className="p-5">
        <h2 className="text-lg font-semibold">Inscripción</h2>
        <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">Reserva tu lugar seleccionando fecha, hora y opciones. Las inscripciones son presenciales, este flujo es de demostración.</p>
        <div className="mt-3">
          <a href="#enroll-cta" className="inline-flex items-center gap-2 rounded-md bg-[var(--brand,#111)] text-white px-4 py-2 text-sm">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 5v4h3v2h-5V7h2z"/></svg>
            Abrir formulario
          </a>
        </div>
      </GlassyCard>
    </div>
  )
}
