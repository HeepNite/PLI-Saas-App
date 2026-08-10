"use client"

import { useState } from "react"
import Link from "next/link"

export default function SmsOptInPage() {
  const [phone, setPhone] = useState("")
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const trimmed = phone.trim()
    if (trimmed.length < 7) {
      setError("Please enter a valid mobile phone number.")
      return
    }
    if (!consent) {
      setError("You must check the consent box to opt in.")
      return
    }

    setSubmitted(true)
  }

  return (
    <main className="min-h-dvh w-full bg-[#13141d] px-5 py-12 text-white/90 sm:py-16">
      <article className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <header className="flex flex-col gap-2 border-b border-white/10 pb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            SMS Opt-In — Palladium Latin Art LLC
          </h1>
          <p className="text-sm text-white/50">Staff device verification messaging program</p>
        </header>

        <section className="flex flex-col gap-3">
          <p className="leading-relaxed text-white/80">
            Palladium Latin Art LLC sends transactional SMS text messages to staff members —
            one-time verification codes and account-security notifications used to verify and enroll
            a trusted device for sign-in to the PLI staff application. Opt in below to receive these
            messages at your mobile number.
          </p>
          <ul className="flex list-disc flex-col gap-1 pl-6 text-sm leading-relaxed text-white/60">
            <li>Message frequency varies and is limited to device-enrollment and account-security events.</li>
            <li>Message and data rates may apply.</li>
            <li>Reply STOP to opt out at any time. Reply HELP for help.</li>
          </ul>
        </section>

        {submitted ? (
          <div
            className="flex flex-col gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-5"
            role="status"
          >
            <p className="font-semibold text-white">Thank you for opting in.</p>
            <p className="leading-relaxed text-white/80">
              You have consented to receive SMS text messages from Palladium Latin Art at{" "}
              <span className="font-medium text-white">{phone.trim()}</span>. You will receive a
              one-time verification code by SMS when you sign in to the PLI staff application. Reply
              STOP at any time to opt out.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
            <div className="flex flex-col gap-2">
              <label htmlFor="phone" className="font-medium text-white">
                Mobile phone number
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+1 (555) 123-4567"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="w-full rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-white/40"
              />
            </div>

            <div className="flex items-start gap-3">
              <input
                id="consent"
                name="consent"
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                className="mt-1 h-5 w-5 shrink-0 rounded border-white/30 bg-white/5 accent-emerald-400"
              />
              <label htmlFor="consent" className="text-sm leading-relaxed text-white/80">
                I agree to receive SMS text messages (one-time verification codes and
                account-security notifications) from Palladium Latin Art at the mobile number I
                provided. Message frequency varies. Message and data rates may apply. Reply STOP to
                opt out, HELP for help. I have read and agree to the{" "}
                <Link
                  href="/sms-terms"
                  className="text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
                >
                  SMS Terms &amp; Conditions
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  className="text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
                >
                  Privacy Policy
                </Link>
                .
              </label>
            </div>

            {error ? (
              <p className="text-sm text-red-400" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-lg bg-white px-5 py-3 font-semibold text-[#13141d] transition hover:bg-white/90 sm:w-auto"
            >
              Opt in to SMS
            </button>
          </form>
        )}

        <footer className="flex flex-wrap gap-4 border-t border-white/10 pt-6 text-sm text-white/50">
          <Link
            href="/sms-terms"
            className="underline decoration-white/30 underline-offset-4 hover:decoration-white"
          >
            SMS Terms &amp; Conditions
          </Link>
          <Link
            href="/privacy"
            className="underline decoration-white/30 underline-offset-4 hover:decoration-white"
          >
            Privacy Policy
          </Link>
        </footer>
      </article>
    </main>
  )
}
