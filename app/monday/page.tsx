import type { Metadata } from "next"
import ShareableBookingPage from "@/components/front/booking/ShareableBookingPage"
import { WEEKDAY_BOOKING_ROUTES } from "@/lib/checkin/shareable-booking"

export const metadata: Metadata = {
  title: "Monday Classes — Palladium Latin Institute",
  description: "Browse upcoming Monday classes and reserve online.",
}

export default function MondayBookingPage() {
  return <ShareableBookingPage weekday={WEEKDAY_BOOKING_ROUTES[0].weekday} />
}
