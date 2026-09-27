import type { Metadata } from "next"
import ShareableBookingPage from "@/components/front/booking/ShareableBookingPage"

export const metadata: Metadata = {
  title: "Book a Class — Palladium Latin Institute",
  description: "Choose today’s class and complete your booking online.",
}

export default function BookingPage() {
  return <ShareableBookingPage />
}
