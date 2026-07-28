"use client"
import React from "react"
import ProfilePhotoCapture from "@/components/front/checkin/ProfilePhotoCapture"
import { resolveEnrollStepKeys } from "@/lib/checkin/enroll-flow"
import type { PhotoPolicy } from "@/lib/checkin/photo-context-policy"
import type { PreparedAccountState } from "../types/enroll-modal-props"
import type { ConsecutiveOfferData } from "@/components/front/checkin/ConsecutiveClassOffer"
import type { CourseEnrollmentData } from "@/components/front/courses/types"

type StepPhotoProps = {
  isCheckInFlow: boolean
  isQrMobileCompactFlow: boolean
  isCheckInNewFlow: boolean
  isKioskTerminalFlow: boolean
  skipContactStep: boolean
  requiresPhotoStep: boolean
  photoPolicy: PhotoPolicy
  preparedAccount: PreparedAccountState | null
  setPreparedAccount: React.Dispatch<React.SetStateAction<PreparedAccountState | null>>
  setPhotoSaved: React.Dispatch<React.SetStateAction<boolean>>
  setFormError: React.Dispatch<React.SetStateAction<string | null>>
  setStep: (value: React.SetStateAction<number>) => void
  course: CourseEnrollmentData
  effectiveConsecutiveOffer: ConsecutiveOfferData | null | undefined
}

export default function StepPhoto({
  isCheckInFlow,
  isQrMobileCompactFlow,
  isCheckInNewFlow,
  isKioskTerminalFlow,
  skipContactStep,
  requiresPhotoStep,
  photoPolicy,
  preparedAccount,
  setPreparedAccount,
  setPhotoSaved,
  setFormError,
  setStep,
  course,
  effectiveConsecutiveOffer,
}: StepPhotoProps) {
  return (
    <div className="space-y-4">
      <ProfilePhotoCapture
        policy={photoPolicy}
        targetUserId={preparedAccount?.clerkUserId}
        onSaved={() => {
          setPhotoSaved(true)
          setPreparedAccount((prev) =>
            prev
              ? {
                  ...prev,
                  hasAvatar: true,
                }
              : prev
          )
          setFormError(null)
        }}
        onSkipped={() => {
          const postSkipKeys = resolveEnrollStepKeys({
            isCheckInFlow,
            isQrMobileCompactFlow,
            isCheckInNewFlow,
            isKioskTerminalFlow,
            requiresPhotoStep: false,
            skipInfoStep: skipContactStep,
            hasPackages: (course?.enrollment?.packages?.length ?? 0) > 0,
            hasConsecutiveOffer: Boolean(effectiveConsecutiveOffer),
          })
          const packagesIdx = postSkipKeys.indexOf("packages")
          const consecutiveIdx = postSkipKeys.indexOf("consecutive")
          const paymentsIdx = postSkipKeys.indexOf("payments")
          const targetStep = packagesIdx >= 0
            ? packagesIdx
            : consecutiveIdx >= 0
              ? consecutiveIdx
              : paymentsIdx >= 0
                ? paymentsIdx
                : postSkipKeys.length - 1

          setPhotoSaved(true)
          setStep(targetStep)
        }}
      />
    </div>
  )
}
