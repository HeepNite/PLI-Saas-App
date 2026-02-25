import Header from "@/components/front/Header"
import FooterQuote from "@/components/front/FooterQuote"
import ProfilePageClient from "@/components/front/profile/ProfilePageClient"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

export const metadata = {
  title: "Client Profile — PLI",
  description: "Perfil del alumno con progreso, paquetes y reservas.",
}

type ClientProfilePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function ClientProfilePage({ searchParams }: ClientProfilePageProps) {
  const params = (await searchParams) || {}
  const e2eAuthValue = params.e2eAuth
  const allowE2eBypass =
    process.env.NODE_ENV !== "production" &&
    (Array.isArray(e2eAuthValue) ? e2eAuthValue.includes("1") : e2eAuthValue === "1")

  const { userId } = await auth()
  if (!userId && !allowE2eBypass) {
    redirect("/sign-in?redirect_url=%2Fclient-profile")
  }

  return (
    <>
      <Header />
      <ProfilePageClient />
      <FooterQuote />
    </>
  )
}
