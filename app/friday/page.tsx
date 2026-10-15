import type { Metadata } from "next"
import ShareableBookingPage from "@/components/front/booking/ShareableBookingPage"
import { WEEKDAY_BOOKING_ROUTES } from "@/lib/checkin/shareable-booking"

export const metadata: Metadata = {
  title: "Friday Classes — Palladium Latin Institute",
  description: "Browse upcoming Friday classes and reserve online.",
}

export default function FridayBookingPage() {
  return <ShareableBookingPage weekday={WEEKDAY_BOOKING_ROUTES[4].weekday} />
}
