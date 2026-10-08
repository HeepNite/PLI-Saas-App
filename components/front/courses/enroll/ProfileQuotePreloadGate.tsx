import React from "react"

type ProfileQuotePreloadGateProps = {
  isProfileQuoteRequired: boolean
  isProfileQuoteReady: boolean
  profileQuoteError: string | null
  retryProfileQuote: () => void
  children: React.ReactNode
}

export default function ProfileQuotePreloadGate({
  isProfileQuoteRequired,
  isProfileQuoteReady,
  profileQuoteError,
  retryProfileQuote,
  children,
}: ProfileQuotePreloadGateProps) {
  if (!isProfileQuoteRequired || isProfileQuoteReady) return children

  if (profileQuoteError) {
    return (
      <div className="p-6 text-center" role="alert">
        <p className="text-lg font-semibold">Price unavailable</p>
        <button
          type="button"
          onClick={retryProfileQuote}
          className="mt-4 rounded-md border border-black/15 px-4 py-2 text-sm font-medium"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 text-center" role="status" aria-live="polite">
      <p className="text-lg font-semibold">Loading price</p>
    </div>
  )
}
