import type { Metadata } from "next"
import ShareableBookingPage from "@/components/front/booking/ShareableBookingPage"
import { WEEKDAY_BOOKING_ROUTES } from "@/lib/checkin/shareable-booking"

export const metadata: Metadata = {
  title: "Tuesday Classes — Palladium Latin Institute",
  description: "Browse upcoming Tuesday classes and reserve online.",
}

export default function TuesdayBookingPage() {
  return <ShareableBookingPage weekday={WEEKDAY_BOOKING_ROUTES[1].weekday} />
}
