import type { Metadata } from "next"
import { redirect } from "next/navigation"
import StaffUsersAdminClient from "@/components/front/staff/StaffUsersAdminClient"
import { authorizeStaffPortalBaseRequest } from "@/lib/security/staff-portal-auth"
import { resolveStaffPortalSections } from "@/lib/security/staff-access"

export const metadata: Metadata = {
  title: "Staff users admin — PLI",
  description: "Manage staff users, roles, and access",
}

export default async function StaffUsersAdminPage() {
  const authResult = await authorizeStaffPortalBaseRequest()
  if (!authResult.ok) {
    if (authResult.status === 401) {
      redirect("/staff/checkin")
    }
    redirect("/staff/resolve")
  }
  if (!authResult.role) {
    redirect("/staff/resolve")
  }
  const allowedSections = resolveStaffPortalSections(authResult.role, authResult.category)
  if (allowedSections.length === 0) {
    redirect("/staff/panel")
  }

  return (
    <main className="mx-auto w-full max-w-[1680px] px-3 py-4 sm:px-4 sm:py-6">
      <StaffUsersAdminClient
        currentRole={authResult.role}
        currentCategory={authResult.category}
        currentUserId={authResult.userId}
      />
    </main>
  )
}
