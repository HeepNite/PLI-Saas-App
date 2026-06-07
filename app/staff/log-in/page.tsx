import type { Metadata } from "next"
import Link from "next/link"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import StaffCheckInClient from "@/components/front/staff/StaffCheckInClient"

export const metadata: Metadata = {
  title: "Staff log in — PLI",
  description: "Staff PIN log-in with session creation.",
}

export default async function StaffLogInPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) || {}
  const error = Array.isArray(params.error) ? params.error[0] : params.error
  
  // If already authenticated AND no error, redirect to resolve
  // Don't redirect if there's an error (prevents loop when user lacks staff role)
  const { userId } = await auth()
  if (userId && !error) {
    redirect("/staff/resolve")
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#13141d] px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_55%_at_50%_0%,rgba(182,22,22,0.2),transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0)_40%)]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-3xl items-center justify-center">
        <StaffCheckInClient mode="login" />
      </div>
      <p className="absolute bottom-6 left-0 right-0 text-center text-sm text-white/50">
        Are you a student?{" "}
        <Link href="/sign-in" className="font-semibold text-[var(--brand,#b61616)] underline-offset-4 hover:underline">
          Go to student sign in
        </Link>
      </p>
    </main>
  )
}
