"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

type StaffResolveRedirectProps = {
  href: string
}

export default function StaffResolveRedirect({ href }: StaffResolveRedirectProps) {
  const router = useRouter()

  React.useEffect(() => {
    router.replace(href)
  }, [href, router])

  return null
}
