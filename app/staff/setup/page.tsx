import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

export default async function LegacyStaffSetupPage() {
  const { userId } = await auth()
  if (!userId) {
    redirect("/staff/sign-in")
  }
  redirect("/staff/resolve")
}
