import type { Metadata } from "next"
import { redirect } from "next/navigation"
import StaffTerminalSetupClient from "@/components/front/staff/StaffTerminalSetupClient"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"

export const metadata: Metadata = {
  title: "Staff terminal setup — PLI",
  description: "Create and manage kiosk terminals for local check-in devices.",
}

export default async function StaffTerminalSetupPage() {
  const authResult = await authorizeStaffPortalRequest()
  if (!authResult.ok) {
    if (authResult.status === 401) {
      redirect("/staff/sign-in")
    }
    redirect("/staff/resolve")
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
      <StaffTerminalSetupClient />
    </main>
  )
}
