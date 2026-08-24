import type { Metadata } from "next"
import { redirect } from "next/navigation"
import StaffUsersAdminClient from "@/components/front/staff/StaffUsersAdminClient"
import { authorizeStaffPortalBaseRequest } from "@/lib/security/staff-portal-auth"
import { resolveStaffPortalSections } from "@/lib/security/staff-access"

export const metadata: Metadata = {
  title: "Staff users admin — PLI",
  description: "Manage staff users, roles, and access",
}

export default async function StaffUsersAdminPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) || {}
  const navParam = Array.isArray(params.nav) ? params.nav[0] : params.nav
  const authResult = await authorizeStaffPortalBaseRequest()
  if (!authResult.ok) {
    // Redirect to log-in instead of resolve to break potential redirect loops
    // (resolve may re-redirect here if it finds a role the portal cannot validate).
    redirect("/staff/log-in?error=session_expired")
  }
  if (!authResult.role) {
    redirect("/staff/log-in?error=staff_invite_required")
  }
  const allowedSections = resolveStaffPortalSections(authResult.role, authResult.category)
  if (allowedSections.length === 0) {
    // Preserve nav param when redirecting to panel
    const panelRedirectUrl = navParam ? `/staff/panel?nav=${encodeURIComponent(navParam)}` : "/staff/panel"
    redirect(panelRedirectUrl)
  }

  return (
    <main className="mx-auto w-full max-w-[1680px] px-3 py-4 sm:px-4 sm:py-6">
      <StaffUsersAdminClient
        currentRole={authResult.role}
        currentCategory={authResult.category}
        currentSubCategory={authResult.subCategory}
        currentUserId={authResult.userId}
      />
    </main>
  )
}
