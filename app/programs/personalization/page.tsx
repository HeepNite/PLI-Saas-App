"use client"

import React from "react"
import Link from "next/link"

export default function PersonalizationPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-screen-xl 2xl:max-w-[2500px] px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Custom programs</p>
          <h1 className="text-3xl sm:text-4xl font-bold">Design your personalized program</h1>
          <p className="text-muted-foreground">
            Tell us who your participants are (families, companies, nursing homes, care centers) and we build a plan with Salsa, Zumba or other adapted classes.
          </p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-xl border bg-card/60 p-5 space-y-3">
            <h2 className="text-lg font-semibold">What do you need?</h2>
            <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
              <li>Group type (seniors, care centers, companies, families).</li>
              <li>Location (your venue or PLI).</li>
              <li>Preferred frequency and schedule.</li>
              <li>Class type: Salsa, Zumba, baby music, or other.</li>
            </ul>
          </div>

          <div className="rounded-xl border bg-card/60 p-5 space-y-3">
            <h2 className="text-lg font-semibold">Steps to coordinate</h2>
            <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">
              <li>Send the form with your info and preferences.</li>
              <li>We set a short call to validate needs.</li>
              <li>We confirm schedule, instructors, and logistics.</li>
            </ol>
          </div>
        </section>

        <section className="rounded-xl border bg-card/70 p-5 space-y-4">
          <h2 className="text-lg font-semibold">Send your request</h2>
          <form className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Full name
              <input className="rounded-md border px-3 py-2 bg-background/80" name="name" placeholder="e.g., Ana Torres" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Email
              <input className="rounded-md border px-3 py-2 bg-background/80" name="email" type="email" placeholder="name@email.com" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Group type
              <select className="rounded-md border px-3 py-2 bg-background/80" name="groupType">
                <option>Nursing homes / seniors</option>
                <option>Care centers</option>
                <option>Companies</option>
                <option>Families / private groups</option>
                <option>Other</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Preferred class
              <select className="rounded-md border px-3 py-2 bg-background/80" name="classType">
                <option>Salsa</option>
                <option>Zumba</option>
                <option>Baby music stimulation</option>
                <option>Other</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              Notes and preferred schedule
              <textarea className="rounded-md border px-3 py-2 bg-background/80" name="notes" rows={4} placeholder="Tell us schedules, location and specific needs." />
            </label>
            <div className="md:col-span-2 flex gap-3">
              <button type="button" className="rounded-md bg-[var(--brand,#111)] text-white px-4 py-2 text-sm">
                Send request (demo)
              </button>
              <Link href="/" className="rounded-md border px-4 py-2 text-sm">
                Back to home
              </Link>
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}
