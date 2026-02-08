'use client'
import React from "react"
import GlassyCard from "./GlassyCard"
import {BookHeadphones} from "lucide-react";
import Image from "next/image";
import type { CourseOverviewData } from "./types"

// Left sticky aside with course key facts and small hero visual.
// Keep content compact to avoid vertical overflow. Intended to be sticky on desktop.
export default function CourseAsideLeft({course}: { course: CourseOverviewData }) {
    return (
        <div className="space-y-4">
            {/* Hero card: image with faint overlay and title */}
            <GlassyCard img={course.heroMedia?.image} className="p-4">
                <div className="flex items-center justify-between gap-3">
                    <div
                        className="h-12 w-12 rounded-xl bg-black/60 dark:bg-white/10 flex items-center justify-center text-white">
                        {/* simple music/dance icon */}
                        <BookHeadphones/>
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold leading-tight">{course.title}</h1>
                        <p className="text-xs text-neutral-600 dark:text-neutral-300">{course.level} </p>
                    </div>
                </div>

                {/* Image wrapper to ensure the rounding actually clips the image */}
                <div className="my-6 rounded-2xl overflow-hidden">
                    <Image
                        src="/images/carousel/_DSC1079.JPG"
                        alt="_DSC1079.JPG"
                        width={800}
                        height={600}
                        className="block h-52 w-full object-cover"
                    />
                </div>
                <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">{course.description}</p>

                {/* Key facts */}
                <br/>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                        <dt className="text-neutral-500">Days</dt>
                        <dd className="font-medium">{course.schedule.day}</dd>
                    </div>
                    <div>
                        <dt className="text-neutral-500">Time</dt>
                        <dd className="font-medium">{course.schedule.time}</dd>
                    </div>
                    <div>
                        <dt className="text-neutral-500">Starts</dt>
                        <dd className="font-medium">{course.schedule.starts}</dd>
                    </div>
                    {course.schedule.frequency && (
                        <div>
                            <dt className="text-neutral-500">Frequency</dt>
                            <dd className="font-medium">{course.schedule.frequency}</dd>
                        </div>
                    )}
                    <div className="col-span-2">
                        <dt className="text-neutral-500">Location</dt>
                        <dd className="font-medium">
                            {course.location.mapUrl ? (
                                <a href={course.location.mapUrl} target="_blank"
                                   className="underline decoration-[var(--brand,#f97316)] decoration-2 underline-offset-4">{course.location.address}</a>
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
                    <h3 className="text-sm font-semibold">What you get</h3>
                    <ul className="mt-2 space-y-1.5 text-sm">
                        {course.benefits!.map((b, i) => (
                            <li key={i} className="flex items-start gap-2">
                                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[var(--brand,#111)]"/>
                                <span>{b}</span>
                            </li>
                        ))}
                    </ul>
                </GlassyCard>
            )}

            {/* Instructors */}
            {!!course.instructors?.length && (
                <GlassyCard className="p-4">
                    <h3 className="text-sm font-semibold">Instructors</h3>
                    <ul className="mt-3 space-y-3">
                        {course.instructors.map((ins, idx) => (
                            <li key={idx} className="flex items-center gap-3">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={ins.photo || "/images/instructors/placeholder.jpg"}
                                    alt={ins.name}
                                    className="h-12 w-12 rounded-full object-cover"
                                    onError={(e) => {
                                        e.currentTarget.onerror = null
                                        e.currentTarget.src = "/images/instructors/placeholder.jpg"
                                    }}
                                />
                                <div>
                                    <p className="text-sm font-semibold leading-tight">{ins.name}</p>
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
