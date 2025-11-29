"use client"
import React from "react"
import type { CourseData } from "@/constants/courses"
import GlassyCard from "./GlassyCard"
import ChatLauncher from "../ui/ChatLauncher"
import EnrollModal from "./EnrollModal"

// Right sticky aside: primary CTA (abrir popup de inscripción) y accesos rápidos.
export default function CourseAsideRight({ course }: { course: CourseData }) {
  const [open, setOpen] = React.useState(false)

  return (
    <div className="space-y-4">
      <GlassyCard className="p-4">
        <h3 className="text-base font-semibold">¿Listo para sumarte?</h3>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">Las clases son presenciales. Reserva tu lugar ahora.</p>
        <button
          onClick={() => setOpen(true)}
          className="mt-3 w-full rounded-md bg-[var(--brand,#111)] text-white px-4 py-2"
        >
          Enrolarme
        </button>
        <p className="mt-2 text-xs text-neutral-500">Sin pago online (demo). Confirmaremos por email o por el chat del asistente.</p>
      </GlassyCard>

      <GlassyCard className="p-4">
        <h4 className="text-sm font-semibold">Get in touch</h4>
        <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">Quitamos el teléfono. Centralizamos todo en el chat del asistente.</p>
        <div className="mt-3">
          <ChatLauncher className="w-full" />
        </div>
      </GlassyCard>

      {/* Enrollment modal */}
      <EnrollModal course={course} open={open} onCloseAction={() => setOpen(false)} />
    </div>
  )
}
