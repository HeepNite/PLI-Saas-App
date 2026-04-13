import type { Metadata } from "next"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import {
  extractStaffCategoryWithSubCategoryFromUser,
} from "@/lib/security/staff-category"
import {
  extractStaffRoleFromUserMetadata,
} from "@/lib/security/staff-role"
import { getDefaultStaffPortalSection } from "@/lib/security/staff-access"
import { syncStaffAccountFromClerkUser } from "@/lib/security/staff-account-sync"

export const metadata: Metadata = {
  title: "Staff access resolve — PLI",
  description: "Assign staff access role and redirect.",
}

export const dynamic = "force-dynamic"

export default async function StaffResolvePage() {
  const authResult = await auth()
  if (!authResult.userId) {
    redirect("/staff/log-in")
  }

  let role: ReturnType<typeof extractStaffRoleFromUserMetadata> = null
  let category: ReturnType<typeof extractStaffCategoryWithSubCategoryFromUser>["category"] | null = null

  let currentUser: Awaited<ReturnType<Awaited<ReturnType<typeof clerkClient>>["users"]["getUser"]>> | null = null
  try {
    const client = await clerkClient()
    currentUser = await client.users.getUser(authResult.userId)
  } catch {
    redirect("/staff/sign-in?error=resolve_failed")
  }

  role = extractStaffRoleFromUserMetadata(currentUser)
  // Extract normalized category + subCategory (handles legacy teacher → guest normalization)
  const { category: normalizedCategory, subCategory } = extractStaffCategoryWithSubCategoryFromUser(currentUser)
  category = normalizedCategory

  if (role && currentUser) {
    try {
      await syncStaffAccountFromClerkUser(currentUser, { source: "staff_resolve" })
    } catch (error) {
      console.warn("staff/resolve: failed to sync staff mirror, continuing with Clerk metadata", error)
    }
  }

  if (!role) {
    redirect("/staff/log-in?error=staff_invite_required")
  }

  const defaultSection = getDefaultStaffPortalSection(role, category, subCategory)
  if (!defaultSection) {
    redirect("/staff/checkin")
  }

  redirect(`/staff/portal?nav=${encodeURIComponent(defaultSection)}`)
}
