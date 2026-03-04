import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { authorizeStaffPortalBaseRequest } from "@/lib/security/staff-portal-auth"

export const metadata: Metadata = {
  title: "Staff panel — PLI",
  description: "Staff control panel.",
}

export default async function StaffPanelPage() {
  const authResult = await authorizeStaffPortalBaseRequest()
  if (!authResult.ok) {
    redirect("/staff/sign-in")
  }

  if (!authResult.userId) {
    redirect("/staff/sign-in")
  }

  const role = authResult.role

  if (!role) {
    redirect("/staff/sign-in")
  }

  if (role === "owner" || role === "admin") {
    redirect("/staff/portal")
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-10">
      <section className="rounded-2xl border border-black/10 bg-white/80 p-5 shadow-[0_10px_32px_-14px_rgba(0,0,0,0.4)] backdrop-blur dark:border-white/10 dark:bg-white/5">
        <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Staff panel</p>
        <h1 className="mt-2 text-2xl font-semibold text-black dark:text-white">Panel de control</h1>
        <p className="mt-2 text-sm text-black/65 dark:text-white/65">
          Ingreso registrado correctamente. Este panel queda habilitado según tu rol.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <a
            href="/staff/checkin?mode=terminal"
            className="rounded-xl border border-black/10 bg-black/[0.03] px-4 py-3 text-sm font-medium text-black transition hover:border-[var(--brand,#b61616)] dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
          >
            Abrir terminal de check-in
          </a>
          <a
            href="/staff/sign-in"
            className="rounded-xl border border-black/10 bg-black/[0.03] px-4 py-3 text-sm font-medium text-black transition hover:border-[var(--brand,#b61616)] dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
          >
            Cambiar usuario
          </a>
        </div>
      </section>
    </main>
  )
}
