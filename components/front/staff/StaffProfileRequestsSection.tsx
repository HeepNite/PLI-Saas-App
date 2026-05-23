import React from "react"

type StaffProfileRequestsSectionProps = {
  children: React.ReactNode
}

export default function StaffProfileRequestsSection({ children }: StaffProfileRequestsSectionProps) {
  return <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">{children}</div>
}
