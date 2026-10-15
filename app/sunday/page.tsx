import type { Metadata } from "next"
import ShareableBookingPage from "@/components/front/booking/ShareableBookingPage"
import { WEEKDAY_BOOKING_ROUTES } from "@/lib/checkin/shareable-booking"

export const metadata: Metadata = {
  title: "Sunday Classes — Palladium Latin Institute",
  description: "Browse upcoming Sunday classes and reserve online.",
}

export default function SundayBookingPage() {
  return <ShareableBookingPage weekday={WEEKDAY_BOOKING_ROUTES[6].weekday} />
}
