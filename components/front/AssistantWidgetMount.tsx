'use client'
import React from 'react'
import AssistantWidget from '@/components/front/AssistantWidget'
import { usePathname } from "next/navigation"

// Client-only mount wrapper for AssistantWidget.
// This allows importing it from a Server Component layout without using
// next/dynamic { ssr: false }, which is not allowed in Server Components.

export type AssistantWidgetMountProps = React.ComponentProps<typeof AssistantWidget>

export default function AssistantWidgetMount(props: AssistantWidgetMountProps) {
  const pathname = usePathname()
  if (pathname?.startsWith("/staff")) return null
  return <AssistantWidget {...props} />
}
