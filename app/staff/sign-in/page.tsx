import type { Metadata } from "next"
import Link from "next/link"
import { SignIn } from "@clerk/nextjs"
import { clerkDarkStaffAppearance } from "@/lib/clerk-auth-appearance"

export const metadata: Metadata = {
  title: "Staff sign in — PLI",
  description: "Staff-only access to attendance check-in.",
}

export default function StaffSignInPage() {
  return (
    <main data-staff-auth="true" className="relative min-h-screen overflow-hidden bg-[#13141d] px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_55%_at_50%_0%,rgba(182,22,22,0.2),transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0)_40%)]" />

      <section className="relative mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-5xl items-center justify-center">
        <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#171922]/80 p-6 shadow-[0_16px_48px_-18px_rgba(0,0,0,0.6)] backdrop-blur sm:p-8">
          <div className="mb-5 text-center">
            <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Staff access</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Check-in</h1>
          </div>

          <div className="mx-auto flex w-full max-w-lg justify-center">
            <SignIn
              routing="hash"
              appearance={{
                ...clerkDarkStaffAppearance,
                elements: {
                  ...clerkDarkStaffAppearance.elements,
                  headerTitle: "hidden",
                  headerSubtitle: "hidden",
                },
              }}
              fallbackRedirectUrl="/staff/resolve"
              forceRedirectUrl="/staff/resolve"
              signUpUrl="/staff/sign-up"
            />
          </div>

          <p className="mt-6 text-center text-sm text-white/70">
            Are you a student?{" "}
            <Link href="/sign-in" className="font-semibold text-[var(--brand,#b61616)] underline-offset-4 hover:underline">
              Go to student sign in
            </Link>
          </p>
        </div>
      </section>
    </main>
  )
}
