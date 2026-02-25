"use client"

import React from "react"
import Link from "next/link"
import { SignedIn, SignedOut, UserProfile, useUser } from "@clerk/nextjs"
import { useRouter, useSearchParams } from "next/navigation"
import { useI18n } from "@/lib/i18n"

export default function VerifyPhonePage() {
  const { t } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isLoaded, user } = useUser()
  const returnParam = searchParams.get("return")
  const safeReturnTo = returnParam && returnParam.startsWith("/") ? returnParam : "/cursos"
  const verifyUrl = `/verify-phone?return=${encodeURIComponent(safeReturnTo)}`
  const signInUrl = `/sign-in?redirect_url=${encodeURIComponent(verifyUrl)}`

  React.useEffect(() => {
    if (!isLoaded || !user) return
    const primary = user.phoneNumbers.find((p) => p.id === user.primaryPhoneNumberId) || user.phoneNumbers[0]
    if (primary?.verification?.status === "verified") {
      router.replace(safeReturnTo)
    }
  }, [isLoaded, user, router, safeReturnTo])

  return (
    <div className="min-h-[80vh] px-4 py-12">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">{t("verify_phone_title")}</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-300">{t("verify_phone_subtitle")}</p>
        </div>

        <SignedOut>
          <div className="rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-6">
            <p className="text-sm text-neutral-700 dark:text-neutral-200">{t("verify_phone_signed_out")}</p>
            <Link href={signInUrl} className="mt-4 inline-flex text-sm font-medium underline">
              {t("signIn")}
            </Link>
          </div>
        </SignedOut>

        <SignedIn>
          <div className="rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4">
            <UserProfile
              routing="hash"
              __experimental_startPath="/account"
              appearance={{
                elements: {
                  navbar: "hidden",
                  navbarButtons: "hidden",
                  navbarButton: "hidden",
                  profilePage__security: "hidden",
                  profilePage__account: "block",
                  profileSection: "hidden",
                  profileSection__phoneNumbers: "block",
                },
              }}
            />
          </div>
          <div>
            <Link href={safeReturnTo} className="text-sm font-medium underline">
              {t("verify_phone_back")}
            </Link>
          </div>
        </SignedIn>
      </div>
    </div>
  )
}
