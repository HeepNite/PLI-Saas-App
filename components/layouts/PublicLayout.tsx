import React from "react"
import Header from "@/components/front/Header"
import NotificationBar from "@/components/front/ui/NotificationBar"
import FooterQuote from "@/components/front/FooterQuote"

type PublicLayoutProps = {
  children: React.ReactNode
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="min-h-screen w-full m-0 flex flex-col">
      <NotificationBar />
      <Header />
      <main>{children}</main>
      <FooterQuote />
    </div>
  )
}
