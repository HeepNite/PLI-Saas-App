import type { Metadata } from "next"
import ShareableBookingPage from "@/components/front/booking/ShareableBookingPage"

export const metadata: Metadata = {
  title: "Monday Salsa Beginner — Palladium Latin Institute",
  description: "Choose an upcoming Monday Salsa Beginner class and reserve online.",
}

export default function MondaySalsaBeginnerPage() {
  return <ShareableBookingPage focus={{ courseSlug: "salsa-night-beginner", weekday: 1 }} />
}
