import type { Metadata } from "next"
import CheckInQrClient from "@/components/front/checkin/CheckInQrClient"

export const metadata: Metadata = {
  title: "QR Check-in — PLI",
  description: "QR check-in flow for new and returning students.",
}

export default function CheckInPage() {
  return <CheckInQrClient />
}
