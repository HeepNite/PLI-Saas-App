"use client"

import React from "react"
import CheckInQrClient from "@/components/front/checkin/CheckInQrClient"

type TerminalSummary = {
  id: string
  slug: string
  name: string
  location: string | null
  defaultCourseSlug: string | null
}

export default function StaffTerminalShell({
  terminal,
}: {
  terminal: TerminalSummary
}) {
  return (
    <CheckInQrClient
      forcedDeviceMode="station"
      forcedCourseSlug={terminal.defaultCourseSlug || ""}
      shellVariant="terminal"
      terminalName={terminal.name}
      terminalLocation={terminal.location || ""}
      qrPathOverride="/checkin"
    />
  )
}
