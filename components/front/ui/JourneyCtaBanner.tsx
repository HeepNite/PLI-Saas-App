"use client"

import Image from "next/image"
import React from "react"
import {Button} from "@/components/ui/button"

// CTA banner placed right below the reviews carousel.
// Goal: mimic the provided reference with a strong centered dark radial shadow
// over a background image, big stacked headline, support copy and one CTA.
// Colors follow brand tokens; text remains in English.

const bgImage = "/images/carousel/_DSC1087.JPG"

export default function JourneyCtaBanner() {
    return (
        <section className="w-full mt-[140px] mb-[200px]" aria-label="Get started CTA">
            <div className="mx-auto w-full max-w-screen-xl 2xl:max-w-[2500px] px-4 sm:px-6 lg:px-8 overflow-x-clip">
                <div
                    className="relative overflow-hidden rounded-xl border bg-white/10 border-white/10 shadow-sm dark:bg-transparent dark:border-transparent">
                    {/* Background image */}
                    <div className="relative w-full aspect-[16/7] sm:aspect-[16/6] lg:aspect-[21/8]">
                        <Image
                            src={bgImage}
                            alt="Students enjoying salsa classes"
                            fill
                            priority
                            sizes="100vw"
                            className="object-cover"
                        />

                        {/* Base dim for legibility */}
                        <div className="absolute inset-0 bg-black/55"/>

                        {/* SHADOW/VIGNETTE LAYERS — start
                This block controls the center shadow and its feathering.
                Adjust these gradients to change the look of the shadow. */}
                        {/* Center vignette (less round, more diffused) */}
                        <div
                            aria-hidden
                            className="pointer-events-none absolute inset-0 z-[5] [mask-image:radial-gradient(ellipse_100%_200%_at_50%_50%,black_15%,transparent_40%)] bg-black/90"
                        />
                        {/* Soft bloom to smooth the falloff */}
                        <div
                            aria-hidden
                            className="pointer-events-none absolute inset-0 z-[6] bg-[radial-gradient(ellipse_160%_115%_at_50%_52%,rgba(0,0,0,0.45)_0%,rgba(0,0,0,0.28)_40%,rgba(0,0,0,0.12)_62%,rgba(0,0,0,0)_82%)]"
                        />
                        {/* Top and bottom feathered fades */}
                        <div aria-hidden
                             className="pointer-events-none absolute inset-x-0 top-0 h-[38%] z-[7] bg-gradient-to-b from-black/45 via-black/25 to-transparent"/>
                        <div aria-hidden
                             className="pointer-events-none absolute inset-x-0 bottom-0 h-[40%] z-[7] bg-gradient-to-t from-black/50 via-black/25 to-transparent"/>
                        {/* Side soft fades to avoid a perfect circle */}
                        <div aria-hidden
                             className="pointer-events-none absolute inset-y-0 left-0 w-[18%] z-[7] bg-gradient-to-r from-black/35 via-black/20 to-transparent"/>
                        <div aria-hidden
                             className="pointer-events-none absolute inset-y-0 right-0 w-[18%] z-[7] bg-gradient-to-l from-black/35 via-black/20 to-transparent"/>
                        {/* SHADOW/VIGNETTE LAYERS — end */}

                        {/* Content */}
                        <div className="absolute inset-0 z-10 flex items-center justify-center">
                            <div className="mx-auto max-w-3xl text-center text-white">
                                <h2 className="font-extrabold tracking-tight leading-[0.9] text-4xl sm:text-5xl md:text-6xl lg:text-5xl">
                                    START YOUR
                                </h2>a
                                <h2 className="font-extrabold tracking-tight leading-[0.9] text-4xl sm:text-5xl md:text-6xl lg:text-4xl mt-1">
                                    JOURNEY TODAY
                                </h2>
                                <div className=' w-2/4 mt-4 mx-auto h-1 bg-destructive'/>
                                <div className="mt-6 space-y-1 text-white/90 text-sm sm:text-base">
                                    <p>Choose from 3 plans ready for you.</p>
                                    <p>Starting at $80/month no yearly fee</p>
                                    <p>Enjoy all Cuban groove</p>
                                </div>

                                <div className="mt-7">
                                    <Button
                                        className="rounded-full bg-[var(--brand)] text-white hover:opacity-95 px-6 py-5 text-base sm:text-lg font-semibold">
                                        lern in PLI
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
