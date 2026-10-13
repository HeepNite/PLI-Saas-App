import type { Metadata } from "next"
import ShareableBookingPage from "@/components/front/booking/ShareableBookingPage"
import { WEEKDAY_BOOKING_ROUTES } from "@/lib/checkin/shareable-booking"

export const metadata: Metadata = {
  title: "Wednesday Classes — Palladium Latin Institute",
  description: "Browse upcoming Wednesday classes and reserve online.",
}

export default function WednesdayBookingPage() {
  return <ShareableBookingPage weekday={WEEKDAY_BOOKING_ROUTES[2].weekday} />
}
