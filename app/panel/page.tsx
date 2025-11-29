import React from "react"
import Link from "next/link"
import GlassyCard from "@/components/front/courses/GlassyCard"

export const metadata = {
  title: "Mi Panel — PLI",
  description: "Gestiona tus reservas, cancelaciones y datos de perfil.",
}

export default function PanelPage() {
  return (
    <main className="min-h-[70vh] bg-background">
      <div className="mx-auto w-full max-w-screen-xl 2xl:max-w-[2500px] px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">Mi Panel</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-300">Revisa tus datos, tus próximas reservas y cancelaciones.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-8 space-y-4">
            <GlassyCard className="p-4">
              <h2 className="text-base font-semibold">Próximas reservas</h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-1">Aún no tienes reservas cargadas. Cuando confirmemos una, aparecerá aquí.</p>
            </GlassyCard>

            <GlassyCard className="p-4">
              <h2 className="text-base font-semibold">Historial y cancelaciones</h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-1">Podrás ver clases pasadas y gestionar cancelaciones cuando habilitemos la cuenta.</p>
            </GlassyCard>
          </section>

          <aside className="lg:col-span-4 space-y-4">
            <GlassyCard className="p-4">
              <h3 className="text-sm font-semibold">Tu información</h3>
              <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1">Pronto podrás actualizar tus datos personales desde aquí.</p>
              <div className="mt-3 flex gap-2">
                <Link href="/" className="px-3 py-2 rounded-md border border-black/10 dark:border-white/10 text-sm">Volver al inicio</Link>
                <Link href="/cursos/salsa-basico#enroll-cta" className="px-3 py-2 rounded-md bg-[var(--brand,#111)] text-white text-sm">Reservar una clase</Link>
              </div>
            </GlassyCard>
          </aside>
        </div>
      </div>
    </main>
  )
}
