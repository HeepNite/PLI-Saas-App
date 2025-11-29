import React from "react"
import Header from "@/components/front/Header"
import NotificationBar from "@/components/front/ui/NotificationBar"
import FooterQuote from "@/components/front/FooterQuote"

export default function CursosLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen w-full m-0 flex flex-col">
      <NotificationBar />
      <Header />
      <main>{children}</main>
      <FooterQuote />
    </div>
  )
}
