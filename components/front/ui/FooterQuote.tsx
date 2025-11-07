"use client"

import React from "react"

// Footer inspired by the provided reference image.
// - Big centered quote in a warm cream tone over deep black.
// - Signature in brand color below the quote.
// - Bottom row with left-aligned links (with small brand underlines) and right-aligned copyright.
// - Uses Tailwind and existing CSS variable `var(--brand)` for accents.

const footerLinks: { label: string; href: string }[] = [
  { label: "Classes", href: "#classes" },
  { label: "Schedule", href: "#schedule" },
  { label: "Instructors", href: "#instructors" },
  { label: "Contact", href: "#contact" },
]

export default function FooterQuote() {
  const year = new Date().getFullYear()
  return (
    <footer aria-label="Site footer" className="w-full mt-[180px] bg-black text-white">
      {/* Top divider similar to the screenshot */}
      <div className="h-px w-full bg-white/10" />

      <div className="mx-auto w-full max-w-screen-xl 2xl:max-w-[2500px] px-4 sm:px-6 lg:px-8">
        {/* Quote block */}
        <div className="py-16 sm:py-20 lg:py-24">
          <blockquote className="text-center">
            <p className="text-[28px] sm:text-[36px] md:text-[44px] lg:text-[56px] leading-tight font-extrabold tracking-tight text-[#F5DEC9]">
              “Choreograph the experience — let rhythm lead and design follow.”
            </p>
            {/* Signature */}
            <figcaption className="mt-10">
              <span className="inline-block text-[var(--brand)] text-xl md:text-2xl font-semibold italic tracking-wide">
                Palladium Latin Institute
              </span>
            </figcaption>
          </blockquote>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10" />
        <div className="py-6 sm:py-8 flex flex-col md:flex-row md:items-center gap-6 md:gap-8">
          {/* Links */}
          <nav aria-label="Footer navigation" className="md:flex-1">
            <ul className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 max-md:max-w-lg">
              {footerLinks.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    className="group inline-flex items-center gap-1.5 text-[var(--brand)] font-medium"
                  >
                    {l.label}
                    <svg
                      aria-hidden
                      className="size-4 text-[var(--brand)]"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M8 5v14l11-7L8 5z" />
                    </svg>
                    <span className="block w-full" />
                  </a>
                  <div className="mt-1 h-[2px] w-12 bg-[var(--brand)] group-hover:w-16 transition-[width] duration-200" />
                </li>
              ))}
            </ul>
          </nav>

          {/* Copyright */}
          <div className="md:ml-auto text-sm text-neutral-400">
            <p>
              Copyright ©{year}. All rights reserved. Stealing is bad karma.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
