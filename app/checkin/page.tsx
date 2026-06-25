import type { Metadata } from "next"
import CheckInPageRouter from "@/components/front/checkin/CheckInPageRouter"

export const metadata: Metadata = {
  title: "QR Check-in — PLI",
  description: "QR check-in flow for new and returning students.",
}

export default function CheckInPage() {
  return <CheckInPageRouter />
}
