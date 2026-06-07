"use client"

import { CheckInQrShell } from "@/components/front/checkin/CheckInQrShell"
import { useCheckInQrController } from "@/components/front/checkin/hooks/useCheckInQrController"
import type { CheckInQrClientProps } from "@/components/front/checkin/checkin.types"

export default function CheckInQrClient(props: CheckInQrClientProps & { selectedCourseSlug?: string }) {
  const shellProps = useCheckInQrController(props)
  return <CheckInQrShell {...shellProps} />
}
