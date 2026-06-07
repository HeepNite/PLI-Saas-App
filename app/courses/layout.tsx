import React from "react"
import PublicLayout from "@/components/layouts/PublicLayout"

export default function CoursesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <PublicLayout>{children}</PublicLayout>
}
