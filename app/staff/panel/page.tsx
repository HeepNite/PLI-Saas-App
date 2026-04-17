import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { authorizeStaffPortalBaseRequest } from "@/lib/security/staff-portal-auth"
import { getDefaultStaffPortalSection } from "@/lib/security/staff-access"

export const metadata: Metadata = {
  title: "Staff panel — PLI",
  description: "Staff control panel.",
}

export default async function StaffPanelPage() {
  const authResult = await authorizeStaffPortalBaseRequest()
  if (!authResult.ok || !authResult.userId) {
    redirect("/staff/resolve")
  }

  const role = authResult.role
  const category = authResult.category

  if (!role) {
    redirect("/staff/resolve")
  }

  const defaultSection = getDefaultStaffPortalSection(role, category)
  if (!defaultSection) {
    redirect("/staff/checkin")
  }

  redirect(`/staff/portal?nav=${encodeURIComponent(defaultSection)}`)
}
