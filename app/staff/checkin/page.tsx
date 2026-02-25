import type { Metadata } from "next"
import StaffCheckInClient from "@/components/front/staff/StaffCheckInClient"

export const metadata: Metadata = {
  title: "Staff PIN terminal — PLI",
  description: "PIN check-in terminal for staff entry.",
}

export default async function StaffCheckInPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#13141d] px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_55%_at_50%_0%,rgba(182,22,22,0.2),transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0)_40%)]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-3xl items-center justify-center">
        <StaffCheckInClient />
      </div>
    </main>
  )
}
