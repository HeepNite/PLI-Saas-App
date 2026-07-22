import type { CourseEnrollmentData, Coupon, EnrollmentContact } from "@/components/front/courses/types"
import type { ConsecutiveOfferData } from "@/components/front/checkin/ConsecutiveClassOffer"

type CheckoutPayloadInput = {
  course: Pick<CourseEnrollmentData, "slug" | "title">
  total: number
  date: string
  time: string
  contact: EnrollmentContact
  participants: number
  addonIds: string[]
  appliedCoupon: Coupon
  packageId: string
  serviceId: string
  photoFlowContext: string
  kioskSessionFields: Record<string, unknown>
  checkInContextDate: string
  checkInContextTime: string
  consecutiveAccepted: boolean
  consecutiveAddedCents: number
  consecutiveOffer?: ConsecutiveOfferData
  extra?: Record<string, unknown>
}

export const buildEnrollCheckoutPayload = ({
  course,
  total,
  date,
  time,
  contact,
  participants,
  addonIds,
  appliedCoupon,
  packageId,
  serviceId,
  photoFlowContext,
  kioskSessionFields,
  checkInContextDate,
  checkInContextTime,
  consecutiveAccepted,
  consecutiveAddedCents,
  consecutiveOffer,
  extra = {},
}: CheckoutPayloadInput) => ({
  courseSlug: course.slug,
  courseTitle: course.title,
  amount: Math.round(total * 100),
  currency: "usd",
  date,
  time,
  firstName: contact.firstName,
  lastName: contact.lastName,
  name: `${contact.firstName} ${contact.lastName}`.trim(),
  email: contact.email,
  participants,
  addons: addonIds,
  coupon: appliedCoupon?.code || undefined,
  packageId,
  serviceId,
  phone: contact.phone,
  photoContext: photoFlowContext,
  flowContext: photoFlowContext,
  ...kioskSessionFields,
  kioskCurrentCourseDate: checkInContextDate || undefined,
  kioskCurrentCourseTime: checkInContextTime || undefined,
  ...(consecutiveAccepted && consecutiveOffer
    ? {
        consecutivePriceCents: consecutiveAddedCents,
        consecutiveLinkedCourseSlug: consecutiveOffer.linkedCourseSlug,
        consecutiveCourseTitle: consecutiveOffer.linkedCourseTitle,
        consecutiveLinkedCourseTime: consecutiveOffer.linkedCourseTime,
      }
    : {}),
  ...extra,
})
