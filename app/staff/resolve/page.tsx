import type { Metadata } from "next"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { hasAnyStaffAdmin } from "@/lib/security/staff-portal-auth"
import {
  applyStaffCategoryToMetadata,
  extractStaffCategoryFromClaims,
  extractStaffCategoryFromUserMetadata,
} from "@/lib/security/staff-category"
import {
  applyStaffRoleToMetadata,
  extractStaffRoleFromClaims,
  extractStaffRoleFromUserMetadata,
  isStaffAdminRole,
  type StaffRole,
} from "@/lib/security/staff-role"

export const metadata: Metadata = {
  title: "Staff access resolve — PLI",
  description: "Assign staff access role and redirect.",
}

export default async function StaffResolvePage() {
  const authResult = await auth()
  if (!authResult.userId) {
    redirect("/staff/sign-in")
  }

  const client = await clerkClient()
  const currentUser = await client.users.getUser(authResult.userId)

  let role: StaffRole | null = extractStaffRoleFromUserMetadata(currentUser) || extractStaffRoleFromClaims(authResult.sessionClaims)
  let category =
    extractStaffCategoryFromUserMetadata(currentUser) || extractStaffCategoryFromClaims(authResult.sessionClaims)

  if (!role) {
    const hasAdmin = await hasAnyStaffAdmin()
    const assignedRole: StaffRole = hasAdmin ? "staff" : "owner"
    const assignedCategory = hasAdmin ? "guest_staff" : "partner"
    await client.users.updateUserMetadata(authResult.userId, {
      publicMetadata: applyStaffCategoryToMetadata(
        applyStaffRoleToMetadata(currentUser.publicMetadata, assignedRole),
        assignedCategory
      ),
    })
    role = assignedRole
    category = assignedCategory
  }

  if (role === "owner" || (isStaffAdminRole(role) && category === "manager")) {
    redirect("/staff/portal")
  }

  redirect("/staff/panel")
}
