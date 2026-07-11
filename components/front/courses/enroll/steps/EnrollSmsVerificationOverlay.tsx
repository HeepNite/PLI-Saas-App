"use client"
import React from "react"
import EmbeddedSignIn from "@/components/front/auth/EmbeddedSignIn"
import { handleEmbeddedSignInSessionCreated } from "@/lib/checkin/enroll-flow"

export type EnrollSmsVerificationOverlayProps = {
  signInReturnTo: string
  phoneE164: string | undefined
  isKioskTerminalFlow: boolean
  pendingClerkSessionRef: React.MutableRefObject<string | null>
  onKioskSessionCreated?: (sessionId: string) => void
  onCodeSent: () => void
  onSmsVerified: () => void
  onDismiss: () => void
  cancelLabel: string
  closeAriaLabel: string
}

export default function EnrollSmsVerificationOverlay({
  signInReturnTo,
  phoneE164,
  isKioskTerminalFlow,
  pendingClerkSessionRef,
  onKioskSessionCreated,
  onCodeSent,
  onSmsVerified,
  onDismiss,
  cancelLabel,
  closeAriaLabel,
}: EnrollSmsVerificationOverlayProps) {
  return (
    <div className="fixed inset-0 z-[10020] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={closeAriaLabel}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onDismiss}
      />
      <div className="relative z-10 w-full max-w-[22rem] rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(210,52,52,0.18),transparent_52%),linear-gradient(160deg,rgba(12,15,28,0.98),rgba(21,25,40,0.96))] p-4 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.85)] sm:p-5">
        <button
          type="button"
          className="absolute right-5 top-5 z-10 shrink-0 rounded-md border border-white/15 px-2 py-1 text-xs text-white/75 transition hover:bg-white/[0.04]"
          onClick={onDismiss}
        >
          {cancelLabel}
        </button>
        {/* Code input + numpad */}
        <EmbeddedSignIn
          redirectUrl={signInReturnTo}
          phoneNumber={phoneE164}
          useNumericKeypad={isKioskTerminalFlow}
          activateSessionOnSuccess={false}
          bare
          onCodeSent={onCodeSent}
          onSessionCreated={(sessionId) => {
            pendingClerkSessionRef.current = sessionId
            handleEmbeddedSignInSessionCreated({ onKioskSessionCreated, sessionId })
          }}
          onSuccessAction={async () => {
            onSmsVerified()
          }}
        />
      </div>
    </div>
  )
}
