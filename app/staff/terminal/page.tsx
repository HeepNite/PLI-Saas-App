import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { authorizeStaffTerminalSession } from "@/lib/security/staff-terminal"
import StaffTerminalShell from "@/components/front/staff/StaffTerminalShell"
import StaffTerminalSignInClient from "@/components/front/staff/StaffTerminalSignInClient"

export const metadata: Metadata = {
  title: "Staff terminal — PLI",
  description: "Dedicated kiosk terminal for student check-in and purchases.",
}

export default async function StaffTerminalPage() {
  const authResult = await authorizeStaffTerminalSession()

  if (!authResult.ok) {
    const terminals = await prisma.staffTerminal.findMany({
      where: { active: true },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        location: true,
        defaultCourseSlug: true,
      },
    })

    return (
      <main className="relative min-h-screen overflow-hidden bg-[#13141d] px-3 py-6 sm:px-4 sm:py-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_55%_at_50%_0%,rgba(182,22,22,0.2),transparent_70%)]" />
        <div className="relative mx-auto w-full max-w-4xl">
          <StaffTerminalSignInClient terminals={terminals} />
        </div>
      </main>
    )
  }

  return <StaffTerminalShell terminal={authResult.terminal} />
}
