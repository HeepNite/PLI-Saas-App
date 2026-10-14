import Image from "next/image"
import { getHeritagePinCountryName } from "@/lib/campaigns/heritage-pin"

export function HeritageVerificationBackdrop({
  courseTitle,
  countryCode,
}: {
  courseTitle: string
  countryCode: string
}) {
  return (
    <div
      aria-hidden="true"
      data-heritage-verification-context="true"
      className="absolute inset-0 flex flex-col items-center bg-[#09070d] px-6 pt-8 text-center text-white sm:pt-10"
    >
      <Image
        src="/logo/logo-white.png"
        alt=""
        width={160}
        height={64}
        className="h-auto w-32 object-contain sm:w-36"
      />
      <p className="mt-5 text-[10px] font-black uppercase tracking-[0.16em] text-[#ef4b55]">
        ¡Feliz Mes de la Herencia Latina!
      </p>
      <p className="mt-2 text-sm font-semibold text-white/72">Your country. Your pin. Your community.</p>
      <h2 className="mt-4 max-w-xl text-xl font-black text-white sm:text-2xl">{courseTitle}</h2>
      <span className="mt-3 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-[10px] font-black text-white/72">
        {getHeritagePinCountryName(countryCode)}
      </span>
    </div>
  )
}
