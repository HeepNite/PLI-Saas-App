"use client"

import Image from "next/image"
import React from "react"
import { Button } from "@/components/ui/button"

// Banner placed below courses showing special salsa events (classes & practice nights)
// Uses images from /public/images/carousel and keeps 200px spacing above and below.
// Light theme gets a subtle glass look; dark theme keeps current aesthetic.

const bannerImages = [
  "/images/carousel/_DSC1079.JPG",
  "/images/carousel/_DSC1087.JPG",
  "/images/carousel/_DSC1076.JPG",
]

export default function SalsaEventsBanner() {
  return (
    <section className="w-full  mt-[200px] mb-[200px]">
      <div className="mx-auto w-full max-w-screen-xl 2xl:max-w-[2500px] px-4 sm:px-6 lg:px-8 overflow-x-clip">
        {/* Heading similar to the reference (two lines) */}
        <header className="text-center mb-6 sm:mb-8">
          <p className="text-3xl sm:text-4xl font-extrabold leading-tight">Experience the best of salsa.</p>
          <p className="text-3xl sm:text-4xl font-extrabold leading-tight">New classes and practice nights every week.</p>
        </header>

        {/* Hero card with image and right-aligned content */}
        <div className="relative overflow-hidden rounded-xl dark:rounded-none border bg-white/30 backdrop-blur-md backdrop-saturate-150 border-white/15 shadow-sm dark:bg-transparent dark:border-transparent dark:backdrop-blur-0">
          {/* Background image */}
          <figure className="relative w-full h-100 aspect-[21/9] md:aspect-[16/6] lg:aspect-[16/6]">
            <Image
              src={bannerImages[0]}
              alt="Salsa event"
              fill
              priority
              sizes="(max-width: 768px) 100vw, 100vw"
              className="object-cover"
            />
              <div className="absolute inset-y-0 right-0 w-full md:w-[48%] lg:w-[42%] xl:w-[40%] flex items-center z-20">
                  <div className="ml-auto flex w-full md:w-auto max-md:p-6 md:p-8 lg:p-10">
                      <div className="ml-auto max-w-md text-right text-white space-y-4">
                          <div className="inline-flex items-center gap-2 self-end">
                              <span className="inline-flex items-center rounded-full bg-primary text-white text-[16px] px-3 py-2 dark:bg-destructive">New</span>
                          </div>

                          <div className="space-y-2">
                              <h3 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">Salsa Practice Night</h3>
                              <p className="text-sm sm:text-base text-white/90">Every Friday · 8:00 PM – 11:00 PM · Open level</p>
                          </div>

                          <hr className=" border-2 border-destructive" />

                          <div className="space-y-1">
                              <p className="text-lg sm:text-xl font-semibold">Special Salsa Workshops</p>
                              <p className="text-sm sm:text-base text-white/90">Intensive On2 & Body Movement · Saturdays 2:00 PM</p>
                          </div>

                          <div className="pt-2">
                              <Button className="group inline-flex items-center gap-2 rounded-lg bg-white text-black hover:bg-primary dark:hover:bg-destructive hover:text-white transition-colors">
                                  <svg aria-hidden className="size-4 text-[var(--brand)] group-hover:text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5z"/></svg>
                                  View schedule
                              </Button>
                          </div>
                      </div>
                  </div>
              </div>
            {/* Base tint for readability */}
            <div className="absolute inset-0 bg-black/35 md:bg-black/30" />

            {/* Right-side faded shadow + blur overlay (over image, under text) */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 w-full md:w-[60%] lg:w-[50%] xl:w-[45%] z-10 bg-gradient-to-l from-black/70 via-black/40 to-transparent md:backdrop-blur-md backdrop-saturate-150 dark:from-black/70 dark:via-black/20 dark:to-transparent"
            />

            {/* Right-side content */}

          </figure>
        </div>
      </div>
    </section>
  )
}
