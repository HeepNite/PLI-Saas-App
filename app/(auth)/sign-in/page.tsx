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
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#13141d] px-4 py-8"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_55%_at_50%_0%,rgba(182,22,22,0.2),transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0)_40%)]" />
      <div className="relative z-10 flex w-full justify-center">
        <SignIn
          routing="hash"
          appearance={{
            ...clerkDarkAuthAppearance,
            elements: {
              ...clerkDarkAuthAppearance.elements,
              rootBox: "mx-auto w-full max-w-sm",
              cardBox: "mx-auto w-full",
              card:
                "mx-auto w-full border border-white/10 bg-[#171922]/95 backdrop-blur rounded-2xl shadow-[0_20px_60px_-25px_rgba(0,0,0,0.65)]",
              socialButtonsIconButton:
                "border border-white/15 bg-white/[0.03] hover:bg-white/[0.08] text-white rounded-md h-12 [&_svg]:text-white [&_svg]:fill-white",
            },
          }}
          fallbackRedirectUrl="/client-profile"
        />
      </div>
    </main>
  )
}
