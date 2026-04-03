export function KioskResolvingOverlay() {
  return (
    <div
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading"
      className="fixed inset-0 z-[11000] flex flex-col items-center justify-center bg-[#13141d]"
    >
      <svg
        className="h-10 w-10 animate-spin text-[var(--brand,#b61616)]"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      <p className="mt-4 text-sm text-white/65">
        Alright niños, hang tight — we&apos;re getting your payment ready.
      </p>
    </div>
  )
}
