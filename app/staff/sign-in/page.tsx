import { redirect } from "next/navigation"

export default function StaffSignInPage() {
  // Redirect to the new PIN-based log-in page
  redirect("/staff/log-in")
}
