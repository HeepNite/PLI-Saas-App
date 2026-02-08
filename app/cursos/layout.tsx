import React from "react"
import PublicLayout from "@/components/layouts/PublicLayout"

export default function CursosLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <PublicLayout>{children}</PublicLayout>
}
