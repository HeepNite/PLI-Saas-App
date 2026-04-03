import EmbeddedSignIn from "@/components/front/auth/EmbeddedSignIn"

export function PhoneSignInModal({
  redirectUrl,
  phoneNumber,
  useNumericKeypad,
  onSessionCreated,
  onSuccess,
  onClose,
}: {
  redirectUrl: string
  phoneNumber?: string
  useNumericKeypad: boolean
  onSessionCreated: (sessionId: string) => Promise<void>
  onSuccess: () => Promise<void>
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-[23rem] rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(210,52,52,0.18),transparent_52%),linear-gradient(160deg,rgba(12,15,28,0.98),rgba(21,25,40,0.96))] p-4 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.85)] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--brand,#b61616)]">Quick sign-in</p>
            <h2 className="mt-1 text-lg font-semibold text-white">Sign in with your account</h2>
            <p className="mt-1 text-sm text-white/68">Use your access to continue with repurchasing the current course.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/15 px-2 py-1 text-xs text-white/75 hover:bg-white/[0.04]"
          >
            Close
          </button>
        </div>
        <div className="mt-4 flex justify-center">
          <EmbeddedSignIn
            redirectUrl={redirectUrl}
            phoneNumber={phoneNumber}
            useNumericKeypad={useNumericKeypad}
            onSessionCreated={onSessionCreated}
            onSuccessAction={onSuccess}
          />
        </div>
      </div>
    </div>
  )
}
