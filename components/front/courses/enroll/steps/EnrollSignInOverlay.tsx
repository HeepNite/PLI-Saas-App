"use client"
import React from "react"
import EmbeddedSignIn from "@/components/front/auth/EmbeddedSignIn"

export type SignInModalVariant = "compact" | "sheet"

export type EnrollSignInOverlayProps = {
  title: string
  subtitle: string
  variant: SignInModalVariant
  signInReturnTo: string
  phoneE164: string
  isKioskTerminalFlow: boolean
  isCheckInFlow: boolean
  onDismiss: () => void
  onSuccessAction?: () => Promise<void>
  cancelLabel: string
  backLabel: string
}

export default function EnrollSignInOverlay({
  title,
  subtitle,
  variant,
  signInReturnTo,
  phoneE164,
  isKioskTerminalFlow,
  isCheckInFlow,
  onDismiss,
  onSuccessAction,
  cancelLabel,
  backLabel,
}: EnrollSignInOverlayProps) {
  return (
    <div
      className={`fixed inset-0 z-[10020] flex ${
        variant === "compact"
          ? "items-center justify-center px-4 py-4"
          : "items-stretch justify-end px-2 py-6 sm:px-4"
      }`}
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onDismiss}
      />
      <div
        className={`relative z-10 w-full rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(210,52,52,0.18),transparent_52%),linear-gradient(160deg,rgba(12,15,28,0.98),rgba(21,25,40,0.96))] p-5 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.85)] ${
          variant === "compact" ? "max-w-sm" : "sm:max-w-md"
        }`}
      >
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <button
              type="button"
              className="shrink-0 rounded-md border border-white/15 px-2 py-1 text-xs text-white/75 hover:bg-white/[0.04]"
              onClick={onDismiss}
            >
              {cancelLabel}
            </button>
          </div>
          <p className="text-sm leading-relaxed text-white/68">{subtitle}</p>
        </div>
        <div className="mt-5">
          <EmbeddedSignIn
            redirectUrl={signInReturnTo}
            phoneNumber={phoneE164}
            useNumericKeypad={isKioskTerminalFlow}
            bare
            onSuccessAction={
              isCheckInFlow
                ? onSuccessAction
                : undefined
            }
          />
        </div>
        {variant === "sheet" && (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              className="text-sm font-medium text-white/72 underline decoration-white/25 underline-offset-4"
              onClick={onDismiss}
            >
              {backLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
