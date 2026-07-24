import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "SMS Terms & Conditions | Palladium Latin Art",
  description:
    "SMS Terms & Conditions for the Palladium Latin Art staff messaging program, including opt-in, opt-out, and message frequency.",
}

export default function SmsTermsPage() {
  return (
    <main className="min-h-dvh w-full bg-[#13141d] px-5 py-12 text-white/90 sm:py-16">
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-2 border-b border-white/10 pb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            SMS Terms &amp; Conditions — Palladium Latin Art LLC
          </h1>
          <p className="text-sm text-white/50">Last updated: July 24, 2026</p>
        </header>

        <p className="leading-relaxed text-white/80">
          By opting in to the Palladium Latin Art staff messaging program, you agree to these SMS
          Terms &amp; Conditions.
        </p>

        <ul className="flex list-none flex-col gap-5">
          <li className="flex flex-col gap-1">
            <span className="font-semibold text-white">Program description:</span>
            <span className="leading-relaxed text-white/80">
              Palladium Latin Art sends transactional text messages to staff members, including
              one-time verification codes and account-security notifications used to verify and
              enroll a trusted device for sign-in to the PLI staff application.
            </span>
          </li>
          <li className="flex flex-col gap-1">
            <span className="font-semibold text-white">How to opt in:</span>
            <span className="leading-relaxed text-white/80">
              You opt in by entering your mobile phone number and requesting a verification code
              within the PLI staff application.
            </span>
          </li>
          <li className="flex flex-col gap-1">
            <span className="font-semibold text-white">Message frequency:</span>
            <span className="leading-relaxed text-white/80">
              Message frequency varies and is limited to device-enrollment and account-security
              events.
            </span>
          </li>
          <li className="flex flex-col gap-1">
            <span className="font-semibold text-white">Cost:</span>
            <span className="leading-relaxed text-white/80">Message and data rates may apply.</span>
          </li>
          <li className="flex flex-col gap-1">
            <span className="font-semibold text-white">To opt out:</span>
            <span className="leading-relaxed text-white/80">
              Reply STOP at any time to stop receiving messages. You will receive a confirmation and
              no further messages.
            </span>
          </li>
          <li className="flex flex-col gap-1">
            <span className="font-semibold text-white">For help:</span>
            <span className="leading-relaxed text-white/80">
              Reply HELP, or contact us at{" "}
              <a
                href="mailto:marianobarr@palladiumlatin.art"
                className="text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
              >
                marianobarr@palladiumlatin.art
              </a>
              .
            </span>
          </li>
          <li className="flex flex-col gap-1">
            <span className="font-semibold text-white">Carriers:</span>
            <span className="leading-relaxed text-white/80">
              Carriers are not liable for delayed or undelivered messages.
            </span>
          </li>
          <li className="flex flex-col gap-1">
            <span className="font-semibold text-white">Privacy:</span>
            <span className="leading-relaxed text-white/80">
              Your information is handled in accordance with our{" "}
              <Link
                href="/privacy"
                className="text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
              >
                Privacy Policy
              </Link>
              .
            </span>
          </li>
        </ul>
      </article>
    </main>
  )
}
