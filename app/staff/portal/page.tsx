import type { Metadata } from "next"
import { redirect } from "next/navigation"
import StaffUsersAdminClient from "@/components/front/staff/StaffUsersAdminClient"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"

export const metadata: Metadata = {
  title: "Staff users admin — PLI",
  description: "Manage staff users, roles, and access",
}

export default async function StaffUsersAdminPage() {
  const authResult = await authorizeStaffPortalRequest()
  if (!authResult.ok) {
    if (authResult.status === 401) {
      redirect("/staff/sign-in")
    }
    redirect("/staff/resolve")
  }

  return (
    <main className="mx-auto w-full max-w-[1680px] px-3 py-4 sm:px-4 sm:py-6">
      <StaffUsersAdminClient currentRole={authResult.role} currentUserId={authResult.userId} />
    </main>
  )
}
