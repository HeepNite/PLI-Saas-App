import React from "react"
import Link from "next/link"
import GlassyCard from "@/components/front/courses/GlassyCard"

export const metadata = {
  title: "My Dashboard — PLI",
  description: "Manage your bookings, cancellations, and profile details.",
}

export default function PanelPage() {
  return (
    <main className="min-h-[70vh] bg-background">
      <div className="mx-auto w-full max-w-screen-xl 2xl:max-w-[2500px] px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">My Dashboard</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-300">Review your info, upcoming bookings, and cancellations.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-8 space-y-4">
            <GlassyCard className="p-4">
              <h2 className="text-base font-semibold">Upcoming bookings</h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-1">You don’t have bookings yet. Once we confirm one, it will show up here.</p>
            </GlassyCard>

            <GlassyCard className="p-4">
              <h2 className="text-base font-semibold">History and cancellations</h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-1">You’ll see past classes and manage cancellations once the account is enabled.</p>
            </GlassyCard>
          </section>

          <aside className="lg:col-span-4 space-y-4">
            <GlassyCard className="p-4">
              <h3 className="text-sm font-semibold">Your information</h3>
              <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1">You’ll soon be able to update your personal data from here.</p>
              <div className="mt-3 flex gap-2">
                <Link href="/" className="px-3 py-2 rounded-md border border-black/10 dark:border-white/10 text-sm">Back to home</Link>
                <Link href="/cursos/salsa-basico#enroll-cta" className="px-3 py-2 rounded-md bg-[var(--brand,#111)] text-white text-sm">Book a class</Link>
              </div>
            </GlassyCard>
          </aside>
        </div>
      </div>
    </main>
  )
}
