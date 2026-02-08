import type { Metadata } from "next"
import { SignIn } from "@clerk/nextjs"

export const metadata: Metadata = {
  title: "Sign in — PLI",
  description: "Access your PLI account to manage bookings and courses.",
}

export default function SignInPage() {
  return (
    <main className="flex min-h-[80vh] items-center justify-center bg-background px-4 py-10">
      <SignIn routing="hash" fallbackRedirectUrl="/panel" />
    </main>
  )
}
