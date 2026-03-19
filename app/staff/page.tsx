import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

export default async function StaffEntryPage() {
  const { userId } = await auth()
  if (!userId) {
    redirect("/staff/checkin")
  }
  redirect("/staff/resolve")
}
