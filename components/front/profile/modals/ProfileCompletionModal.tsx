import React from "react"

type ProfileCompletionModalProps = {
  isOpen: boolean
  onComplete: () => void
}

export function ProfileCompletionModal({ isOpen, onComplete }: ProfileCompletionModalProps) {
  const dialogRef = React.useRef<HTMLDialogElement>(null)
  const completeProfileCtaRef = React.useRef<HTMLButtonElement>(null)
  const priorFocusRef = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || !isOpen) return

    priorFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    let usesNativeModal = false
    if (typeof dialog.showModal === "function") {
      try {
        if (!dialog.open) dialog.showModal()
        usesNativeModal = true
      } catch {
        dialog.setAttribute("open", "")
      }
    } else {
      dialog.setAttribute("open", "")
    }
    completeProfileCtaRef.current?.focus()

    return () => {
      if (!dialog.open) return
      if (usesNativeModal && typeof dialog.close === "function") {
        dialog.close()
      } else {
        dialog.removeAttribute("open")
      }
      priorFocusRef.current?.focus()
    }
  }, [isOpen])

  return (
    <>
      <div
        className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-[2px]"
        data-testid="profile-completion-modal-backdrop"
        aria-hidden="true"
        hidden={!isOpen}
      />
      <dialog
        ref={dialogRef}
        aria-modal="true"
        aria-labelledby="profile-completion-modal-title"
        aria-describedby="profile-completion-modal-description"
        className="fixed left-1/2 top-1/2 z-[151] m-0 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-zinc-950 p-6 text-white shadow-2xl [&::backdrop]:bg-transparent"
        data-testid="profile-completion-modal"
        onCancel={(event) => event.preventDefault()}
      >
        <h2 id="profile-completion-modal-title" className="text-xl font-semibold">
          Complete profile
        </h2>
        <p id="profile-completion-modal-description" className="mt-3 text-sm text-white/75">
          Complete your profile and earn 10 points toward your free class.
        </p>
        <button
          ref={completeProfileCtaRef}
          type="button"
          onClick={onComplete}
          className="mt-6 w-full rounded-md bg-[color:var(--brand)] px-4 py-2 text-sm font-semibold text-white"
        >
          Complete profile
        </button>
      </dialog>
    </>
  )
}
