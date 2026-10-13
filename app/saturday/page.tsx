import type { Metadata } from "next"
import ShareableBookingPage from "@/components/front/booking/ShareableBookingPage"
import { WEEKDAY_BOOKING_ROUTES } from "@/lib/checkin/shareable-booking"

export const metadata: Metadata = {
  title: "Saturday Classes — Palladium Latin Institute",
  description: "Browse upcoming Saturday classes and reserve online.",
}

export default function SaturdayBookingPage() {
  return <ShareableBookingPage weekday={WEEKDAY_BOOKING_ROUTES[5].weekday} />
}
