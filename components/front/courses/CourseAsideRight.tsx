"use client"
import React from "react"
import { useSearchParams } from "next/navigation"
import GlassyCard from "./GlassyCard"
import ChatLauncher from "../ui/ChatLauncher"
import EnrollModal from "./EnrollModal"
import type { CourseEnrollmentData } from "./types"

// Right sticky aside: primary CTA (abrir popup de inscripción) y accesos rápidos.
export default function CourseAsideRight({ course }: { course: CourseEnrollmentData }) {
  const [open, setOpen] = React.useState(false)
  const searchParams = useSearchParams()
  const hasAutoOpened = React.useRef(false)
  const enrollParam = searchParams.get("enroll")
  const stepParam = searchParams.get("step")
  const parsedStep = stepParam ? Number(stepParam) : undefined
  const initialStep = typeof parsedStep === "number" && Number.isFinite(parsedStep) ? parsedStep : undefined

  React.useEffect(() => {
    if (!hasAutoOpened.current && enrollParam === "1") {
      setOpen(true)
      hasAutoOpened.current = true
    }
  }, [enrollParam])

  return (
    <div className="space-y-4">
      <GlassyCard className="p-4">
        <h3 className="text-base font-semibold">Ready to join?</h3>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">Classes are in-person. Reserve your spot now.</p>
        <button
          onClick={() => setOpen(true)}
          className="mt-3 w-full rounded-md bg-[var(--brand,#111)] text-white px-4 py-2"
        >
          Enroll now
        </button>
        <p className="mt-2 text-xs text-neutral-500">No online payment (demo). We will confirm via email or assistant chat.</p>
      </GlassyCard>

      <GlassyCard className="p-4">
        <h4 className="text-sm font-semibold">Get in touch</h4>
        <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">We removed phone calls. Everything is centralized in the assistant chat.</p>
        <div className="mt-3">
          <ChatLauncher className="w-full" />
        </div>
      </GlassyCard>

      {/* Enrollment modal */}
      <EnrollModal course={course} open={open} onCloseAction={() => setOpen(false)} initialStep={initialStep} />
    </div>
  )
}
