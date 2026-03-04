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
      <div className="mb-4 flex justify-end">
        <a
          href="/staff/terminal/setup"
          className="rounded-xl border border-black/10 bg-black/[0.03] px-3 py-2 text-sm font-medium text-black transition hover:border-[var(--brand,#b61616)] dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
        >
          Gestionar terminals
        </a>
      </div>
      <StaffUsersAdminClient currentRole={authResult.role} currentUserId={authResult.userId} />
    </main>
  )
}
