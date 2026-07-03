import React from "react"
import { X } from "lucide-react"

export function ModalShell({
  title,
  heading,
  description,
  closeLabel,
  closeDisabled,
  maxWidthClassName = "max-w-lg",
  bodyClassName = "space-y-4 p-5",
  onClose,
  children,
}: {
  title: string
  heading: string
  description?: string
  closeLabel: string
  closeDisabled?: boolean
  maxWidthClassName?: string
  bodyClassName?: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <div className={`w-full ${maxWidthClassName} rounded-2xl border border-black/15 bg-white shadow-[0_40px_90px_-40px_rgba(0,0,0,0.75)] dark:border-white/15 dark:bg-[#10131d]`}>
        <div className="flex items-start justify-between border-b border-black/10 px-5 py-4 dark:border-white/10">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--brand,#b61616)]">{title}</p>
            <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">{heading}</h3>
            {description ? <p className="mt-1 text-xs text-black/65 dark:text-white/65">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/20 text-black/70 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/20 dark:text-white/70 dark:hover:bg-white/5"
            aria-label={closeLabel}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className={bodyClassName}>{children}</div>
      </div>
    </div>
  )
}

export function ModalError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p className="rounded-md border border-[var(--brand,#b61616)]/35 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-sm text-[var(--brand,#ff4b4b)]">
      {message}
    </p>
  )
}

export function ModalActions({ children }: { children: React.ReactNode }) {
  return <div className="flex justify-end gap-2">{children}</div>
}

export function SecondaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl border border-black/15 px-4 py-2 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/15 dark:text-white"
    >
      {children}
    </button>
  )
}

export function PrimaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
    >
      {children}
    </button>
  )
}

export function SecondaryMiniButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-black/15 px-3 py-1.5 text-xs font-semibold text-black dark:border-white/15 dark:text-white"
    >
      {children}
    </button>
  )
}
