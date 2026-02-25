import type { Metadata } from "next"
import Link from "next/link"
import { SignUp } from "@clerk/nextjs"
import { clerkDarkStaffAppearance } from "@/lib/clerk-auth-appearance"

export const metadata: Metadata = {
  title: "Staff sign up — PLI",
  description: "Create staff account access.",
}

export default function StaffSignUpPage() {
  return (
    <main data-staff-auth="true" className="relative min-h-screen overflow-hidden bg-[#13141d] px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_55%_at_50%_0%,rgba(182,22,22,0.2),transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0)_40%)]" />

      <section className="relative mx-auto w-full max-w-4xl rounded-2xl border border-white/10 bg-[#171922]/80 p-6 shadow-[0_16px_48px_-18px_rgba(0,0,0,0.6)] backdrop-blur sm:p-8">
        <p className="text-center text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Staff access</p>
        <h1 className="mt-2 text-center text-3xl font-semibold text-white">Create staff account</h1>
        <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-white/70">
          Access role is assigned automatically after sign-up based on existing staff admins.
        </p>

        <div className="mt-6 flex justify-center">
          <div className="w-full max-w-lg">
            <SignUp
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
              signInUrl="/staff/sign-in"
            />
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-white/70">
          Already have staff account?{" "}
          <Link
            href="/staff/sign-in"
            className="font-semibold text-[var(--brand,#b61616)] underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </section>
    </main>
  )
}
