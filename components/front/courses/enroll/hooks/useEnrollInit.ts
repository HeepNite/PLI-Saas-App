import React from "react"
import type { EnrollmentContact } from "@/components/front/courses/types"
import type { EnrollPrefillSelection } from "@/components/front/courses/enroll/types/enroll-modal-props"

type UseEnrollInitInput = {
  open: boolean
  prefillContact?: Partial<EnrollmentContact>
  prefillSelection?: EnrollPrefillSelection
  userContact: Partial<EnrollmentContact>
  setKioskStepHydrating: React.Dispatch<React.SetStateAction<boolean>>
}

type UseEnrollInitResult = {
  openInitializationRef: React.MutableRefObject<boolean>
  prefillContactRef: React.MutableRefObject<Partial<EnrollmentContact> | undefined>
  prefillSelectionRef: React.MutableRefObject<EnrollPrefillSelection | undefined>
  userContactRef: React.MutableRefObject<Partial<EnrollmentContact>>
}

export function useEnrollInit({
  open,
  prefillContact,
  prefillSelection,
  userContact,
  setKioskStepHydrating,
}: UseEnrollInitInput): UseEnrollInitResult {
  const openInitializationRef = React.useRef(false)
  const prefillContactRef = React.useRef(prefillContact)
  const prefillSelectionRef = React.useRef(prefillSelection)
  const userContactRef = React.useRef<Partial<EnrollmentContact>>(userContact)

  React.useEffect(() => {
    prefillContactRef.current = prefillContact
  }, [prefillContact])

  React.useEffect(() => {
    prefillSelectionRef.current = prefillSelection
  }, [prefillSelection])

  React.useEffect(() => {
    userContactRef.current = userContact
  }, [userContact])

  React.useEffect(() => {
    if (open) return
    openInitializationRef.current = false
    setKioskStepHydrating(false)
  }, [open, setKioskStepHydrating])

  return {
    openInitializationRef,
    prefillContactRef,
    prefillSelectionRef,
    userContactRef,
  }
}
