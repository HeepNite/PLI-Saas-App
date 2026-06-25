import type { EnrollmentOption } from "@/constants/courses"
import type { Coupon } from "@/components/front/courses/types"

type EnrollPricingInput = {
  services: EnrollmentOption[]
  packages: EnrollmentOption[]
  addons?: EnrollmentOption[]
  serviceId: string
  packageId: string
  addonIds: string[]
  participants: number
  appliedCoupon: Coupon
  consecutiveAccepted: boolean
  consecutiveAddedCents: number
}

export type EnrollPricing = {
  serviceOpt?: EnrollmentOption
  packageOpt?: EnrollmentOption
  addonOptions: EnrollmentOption[]
  serviceBase: number
  packagePrice: number
  addonsTotal: number
  serviceCharge: number
  perPerson: number
  subtotal: number
  discount: number
  total: number
}

export const calculateEnrollPricing = ({
  services,
  packages,
  addons = [],
  serviceId,
  packageId,
  addonIds,
  participants,
  appliedCoupon,
  consecutiveAccepted,
  consecutiveAddedCents,
}: EnrollPricingInput): EnrollPricing => {
  const serviceOpt = services.find((option) => option.id === serviceId)
  const packageOpt = packages.find((option) => option.id === packageId)
  const addonOptions = addons.filter((option) => addonIds.includes(option.id))
  const serviceBase = serviceOpt?.price || 0
  const packagePrice = packageOpt?.price || 0
  const addonsTotal = addonOptions.reduce((sum, option) => sum + (option.price || 0), 0)
  const serviceCharge = packageOpt ? 0 : serviceBase
  const perPerson = serviceCharge + packagePrice + addonsTotal
  const subtotal = perPerson * Math.max(1, participants)
  const discount = appliedCoupon
    ? appliedCoupon.type === "percent"
      ? (subtotal * appliedCoupon.value) / 100
      : appliedCoupon.value
    : 0
  const total = Math.max(0, subtotal - discount + (consecutiveAccepted ? consecutiveAddedCents / 100 : 0))

  return {
    serviceOpt,
    packageOpt,
    addonOptions,
    serviceBase,
    packagePrice,
    addonsTotal,
    serviceCharge,
    perPerson,
    subtotal,
    discount,
    total,
  }
}
