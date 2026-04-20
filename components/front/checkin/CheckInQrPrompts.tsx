export function ContextWarning() {
  return (
    <div className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
      The QR code is missing required data. Use a link with `courseSlug`, `date`, and `time`.
    </div>
  )
}

export function QrPromptText({ variant }: { variant: "terminal" | "personal" }) {
  return (
    <p
      className={
        variant === "terminal"
          ? "mt-8 text-center text-sm font-medium tracking-[0.02em] text-white/78"
          : "mt-7 text-center text-lg font-semibold tracking-[0.14em] text-[var(--brand,#ff3f3f)]"
      }
    >
      {variant === "terminal"
        ? "you can complete your check-in on this tablet"
        : "or complete the process right here"}
    </p>
  )
}
