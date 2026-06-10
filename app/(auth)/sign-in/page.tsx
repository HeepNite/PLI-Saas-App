import type { Metadata } from "next"
import { SignIn } from "@clerk/nextjs"
import { clerkDarkAuthAppearance } from "@/lib/clerk-auth-appearance"

export const metadata: Metadata = {
  title: "Sign in — PLI",
  description: "Access your PLI account to manage bookings and courses.",
}

export default function SignInPage() {
  return (
    <main
      data-auth-page="true"
      className="relative grid min-h-screen place-items-center overflow-hidden bg-[#13141d] px-4 py-8"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_55%_at_50%_0%,rgba(182,22,22,0.2),transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0)_40%)]" />
      <section className="relative w-full max-w-4xl">
        <div className="relative mx-auto min-h-[44rem] w-full max-w-2xl rounded-2xl border border-white/10 bg-[#171922]/80 shadow-[0_16px_48px_-18px_rgba(0,0,0,0.6)] backdrop-blur">
          <div className="absolute inset-0 flex items-center justify-center p-6 sm:p-8">
            <div className="w-full max-w-md">
            <SignIn
              routing="hash"
              appearance={{
                ...clerkDarkAuthAppearance,
                elements: {
                  ...clerkDarkAuthAppearance.elements,
                  rootBox: "w-full",
                  cardBox: "w-full",
                  card:
                    "mx-auto w-full border border-white/10 bg-[#171922]/95 backdrop-blur rounded-2xl shadow-[0_20px_60px_-25px_rgba(0,0,0,0.65)]",
                  socialButtonsIconButton:
                    "border border-white/15 bg-white/[0.03] hover:bg-white/[0.08] text-white rounded-md h-12 [&_svg]:text-white [&_svg]:fill-white",
                },
              }}
              fallbackRedirectUrl="/client-profile"
            />
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
