import type { StudentPinModalState } from "../staffAdminTypes"
import type { IssuedStudentPin } from "./types"
import { ModalShell, ModalActions, SecondaryButton, PrimaryButton, SecondaryMiniButton } from "./ModalShell"

async function copyIssuedPin(value: string, onCopyError: (message: string) => void) {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return
  try {
    await navigator.clipboard.writeText(value)
  } catch {
    onCopyError("Unable to copy provisional PIN.")
  }
}

export function StudentPinModal({
  modal,
  reason,
  draft,
  submitting,
  error,
  issued,
  revealIssued,
  onClose,
  onReasonChange,
  onDraftChange,
  onToggleReveal,
  onCopyError,
  onSubmit,
  formatIsoDate,
}: {
  modal: StudentPinModalState | null
  reason: string
  draft: string
  submitting: boolean
  error: string | null
  issued: IssuedStudentPin | null
  revealIssued: boolean
  onClose: () => void
  onReasonChange: (reason: string) => void
  onDraftChange: (pin: string) => void
  onToggleReveal: () => void
  onCopyError: (message: string) => void
  onSubmit: () => void
  formatIsoDate: (value: string | null) => string
}) {
  if (!modal) return null

  return (
    <ModalShell
      title="Student PIN"
      heading={modal.name}
      description={`${modal.email || "No email on file"} · ${modal.needsEnrollment ? "PIN setup" : "Same-day recovery"}`}
      closeLabel="Close student PIN dialog"
      maxWidthClassName="max-w-xl"
      onClose={onClose}
    >
      <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/10 p-3 text-sm text-cyan-950 dark:text-cyan-100">
        Provisional PINs stay valid until end of day. Use them only for front-desk assisted enrollment or same-day recovery.
      </div>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-black dark:text-white">Reason</span>
        <textarea
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          rows={3}
          placeholder="Example: Walk-in recovery before class starts"
          className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-black dark:text-white">Custom PIN (optional)</span>
        <input
          value={draft}
          onChange={(event) => onDraftChange(event.target.value.replace(/\D+/g, "").slice(0, 4))}
          inputMode="numeric"
          placeholder="Leave blank to auto-generate"
          className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
        />
      </label>
      {modal.provisionalActive || modal.provisionalExpiresAt ? (
        <p className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
          Existing provisional PIN {modal.provisionalActive ? "is active" : "was created"}. Expiry: {formatIsoDate(modal.provisionalExpiresAt)}.
        </p>
      ) : null}
      {error ? <p className="text-sm text-[var(--brand,#ff4b4b)]">{error}</p> : null}
      {issued?.value ? (
        <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm text-emerald-950 dark:text-emerald-100">
          <p className="text-xs uppercase tracking-[0.2em]">Issued</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="rounded-md bg-black/10 px-3 py-2 text-base font-semibold tracking-[0.35em] dark:bg-black/20">
              {revealIssued ? issued.value : issued.masked}
            </code>
            <SecondaryMiniButton onClick={onToggleReveal}>{revealIssued ? "Hide" : "Reveal"}</SecondaryMiniButton>
            <SecondaryMiniButton onClick={() => void copyIssuedPin(issued.value, onCopyError)}>Copy PIN</SecondaryMiniButton>
          </div>
          <p className="mt-2 text-xs">Expires: {formatIsoDate(issued.expiresAt)}</p>
        </div>
      ) : null}
      <ModalActions>
        <SecondaryButton onClick={onClose}>Close</SecondaryButton>
        <PrimaryButton onClick={onSubmit} disabled={submitting}>
          {submitting ? "Saving..." : issued ? "Reissue PIN" : "Create provisional PIN"}
        </PrimaryButton>
      </ModalActions>
    </ModalShell>
  )
}
