import Header from "@/components/front/Header"
import FooterQuote from "@/components/front/FooterQuote"
import ProfilePageClient from "@/components/front/profile/ProfilePageClient"

export const metadata = {
  title: "Client Profile — PLI",
  description: "Perfil del alumno con progreso, paquetes y reservas.",
}

export default function ClientProfilePage() {
  return (
    <>
      <Header />
      <ProfilePageClient />
      <FooterQuote />
    </>
  )
}
