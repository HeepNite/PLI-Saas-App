"use client"

import React from "react"
import type { CourseData } from "@/constants/courses"
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion"
import Link from "next/link"
import Image from "next/image"
import { Sparkles, PlayCircle, Users, Clock, CheckCircle2 } from "lucide-react"

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.08 * i, duration: 0.35, ease: "easeOut" },
  }),
}

export default function CourseServicesSection({ course }: { course: CourseData }) {
  const sectionRef = React.useRef<HTMLDivElement | null>(null)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  })
  const titleY = useTransform(scrollYProgress, [0, 1], [0, -40])
  const subtitleY = useTransform(scrollYProgress, [0, 1], [16, -8])
  const subtitleOpacity = useTransform(scrollYProgress, [0, 1], [0.8, 1])

  const services = [
    {
      title: "Live coaching",
      desc: "Guided sessions with real-time feedback and tailored corrections.",
      icon: PlayCircle,
    },
    {
      title: "Video recap",
      desc: "Short clips after class so you can practice timing, styling, and drills.",
      icon: Sparkles,
    },
    {
      title: "Community practice",
      desc: "Small group practice to build confidence and stay consistent.",
      icon: Users,
    },
  ]

  const timeline = [
    { title: "Pick your slot", desc: "Choose the best time/date that fits your week.", icon: Clock },
    { title: "Arrive and warm up", desc: "10 min to settle, stretch, and set your goal.", icon: Sparkles },
    { title: "Guided class", desc: "Technique, flow, and music work tailored to your level.", icon: PlayCircle },
    { title: "Wrap-up + recap", desc: "Record key drills and get the next steps to practice.", icon: CheckCircle2 },
  ]

  const highlights = [
    "Stay consistent with 55-minute sessions and quick wins.",
    "Video recaps help you practice timing, styling, and drills at home.",
    "Small groups keep feedback personal and momentum high.",
    "Book drop-ins or recurring slots—your choice.",
  ]

  const [activeHighlight, setActiveHighlight] = React.useState(0)
  React.useEffect(() => {
    const id = window.setInterval(() => {
      setActiveHighlight((prev) => (prev + 1) % highlights.length)
    }, 3200)
    return () => window.clearInterval(id)
  }, [highlights.length])

  const heroMedia = course.heroMedia?.image ?? course.heroMedia?.video

  return (
    <section
      ref={sectionRef}
      className="mb-12 relative overflow-hidden rounded-3xl border bg-gradient-to-br from-[#0f172a] via-[#0b1120] to-[#0f172a] text-white shadow-xl"
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-[var(--brand,#f97316)]/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-cyan-400/20 blur-3xl" />
      </div>
      <div className="relative grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="p-6 sm:p-10 space-y-6">
          <motion.p className="text-xs uppercase tracking-[0.25em] text-white/70" style={{ y: subtitleY, opacity: subtitleOpacity }} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
            Services
          </motion.p>
          <motion.h2 className="text-3xl sm:text-4xl font-bold leading-tight" style={{ y: titleY }} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} custom={1}>
            What you’ll experience in {course.title}
          </motion.h2>
          <motion.p className="text-sm text-white/80 max-w-2xl" style={{ y: subtitleY, opacity: subtitleOpacity }} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} custom={2}>
            Short, focused sessions to build confidence, rhythm, and flow. Perfect if you want a quick win without long commitments.
          </motion.p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {services.map((svc, idx) => {
              const Icon = svc.icon
              return (
                <motion.div
                  key={svc.title}
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true }}
                  custom={idx + 3}
                  className="rounded-xl border border-white/10 bg-white/5 p-4 shadow-sm hover:border-white/20 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white">
                      <Icon className="h-4 w-4" />
                    </span>
                    <p className="text-sm font-semibold">{svc.title}</p>
                  </div>
                  <p className="text-xs text-white/75 mt-2 leading-relaxed">{svc.desc}</p>
                </motion.div>
              )
            })}
          </div>

          <motion.div
            className="pt-4 flex flex-wrap gap-3 items-center"
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            custom={6}
          >
            <Link
              href="#enroll-cta"
              className="inline-flex items-center gap-2 rounded-md bg-white text-black px-4 py-2 text-sm font-semibold shadow-lg shadow-black/30"
            >
              Book this class
            </Link>
            <span className="text-xs text-white/70">Scroll to see how each class flows.</span>
          </motion.div>

          <motion.div
            className="pt-2 rounded-xl border border-white/10 bg-white/5 p-4"
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            custom={7}
          >
            <p className="text-xs uppercase tracking-[0.2em] text-white/60 mb-2">Highlights</p>
            <AnimatePresence mode="wait">
              <motion.p
                key={activeHighlight}
                className="text-sm text-white/85"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                {highlights[activeHighlight]}
              </motion.p>
            </AnimatePresence>
          </motion.div>
        </div>

        <div className="relative min-h-[260px] lg:min-h-full bg-white/5">
          {heroMedia ? (
            <Image
              src={heroMedia}
              alt={course.title}
              fill
              sizes="(max-width: 1024px) 100vw, 40vw"
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-sm text-white/70">Preview</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
        </div>
      </div>

      <div className="relative p-6 sm:p-10 bg-white/5 border-t border-white/10">
        <div className="flex items-center gap-2 mb-4">
          <span className="h-2 w-2 rounded-full bg-[var(--brand,#f97316)]" />
          <p className="text-sm font-semibold">Class timeline</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {timeline.map((item, idx) => {
            const Icon = item.icon
            return (
              <motion.div
                key={item.title}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                custom={idx + 1}
                className="relative rounded-lg border border-white/10 bg-white/5 p-4 flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-xs text-white/60">Step {idx + 1}</p>
                    <p className="text-sm font-semibold leading-snug">{item.title}</p>
                  </div>
                </div>
                <p className="text-xs text-white/70">{item.desc}</p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
