import type { CourseData } from "@/constants/courses"

export type CourseOverviewData = Pick<
  CourseData,
  "title" | "description" | "level" | "heroMedia" | "schedule" | "location" | "benefits" | "instructors"
>

export type CourseSectionsData = Pick<CourseData, "description" | "requirements" | "syllabus" | "schedule" | "location">

export type CourseEnrollmentData = Pick<CourseData, "slug" | "title" | "enrollment" | "location" | "instructors">

export type EnrollmentContact = {
  firstName: string
  lastName: string
  email: string
  phone: string
  note: string
}

export type Coupon = { code: string; type: "percent" | "amount"; value: number } | null

export type PaymentMethod = "onsite" | "stripe" | ""

export type EnrollDraftState = {
  service: string
  pkg: string
  addons: string[]
  participants: number
  date: string
  time: string
  contact: EnrollmentContact
  couponInput: string
  appliedCoupon: Coupon
  paymentMethod: PaymentMethod
  step: number
}
