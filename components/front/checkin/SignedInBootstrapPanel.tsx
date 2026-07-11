import Image from "next/image"

export function SignedInBootstrapPanel({
  loading,
  bootstrap,
  courseImage,
  cardCategory,
  cardBadge,
  cardDuration,
  cardStudents,
  cardDescription,
  cardTeacher,
  quickCheckoutDetails,
  isLatePaymentContext,
  hasFixedRecommendation,
  checkInWindowOpen,
  processingPackageCheckIn,
  checkInWindowLabel,
  packageExpiresLabel,
  onSwitchAccount,
  onAction,
  onBackToCurrentClass,
}: {
  loading: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bootstrap: any | null
  courseImage: string
  cardCategory: string
  cardBadge: string
  cardDuration: string
  cardStudents: string
  cardDescription: string
  cardTeacher: string
  quickCheckoutDetails?: {
    serviceLabel?: string
    packageLabel?: string
    addonLabels?: string[]
  } | null
  isLatePaymentContext: boolean
  hasFixedRecommendation: boolean | null
  checkInWindowOpen: boolean
  processingPackageCheckIn: boolean
  checkInWindowLabel: string
  packageExpiresLabel?: string | null
  onSwitchAccount: () => void
  onAction: () => void
  onBackToCurrentClass: () => void
}) {
  const bootstrapCardButtonLabel = bootstrap?.package
    ? processingPackageCheckIn
      ? "Checking in..."
      : "Check in with package"
    : bootstrap?.quickCheckout
      ? "Repurchase"
      : "Buy"

  return (
    <div className="mt-5 rounded-xl border border-white/15 bg-black/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-white/80">Active session for fast flow.</p>
        <button
          type="button"
          onClick={onSwitchAccount}
          className="text-xs text-white/70 underline"
        >
          Switch account
        </button>
      </div>
      {loading ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-white/65">Checking purchases for the current course...</p>
          <div className="h-10 animate-pulse rounded-md border border-white/10 bg-white/5" />
        </div>
      ) : bootstrap ? (
        <div className="mt-3 space-y-3">
          <div className="overflow-hidden rounded-2xl border border-white/12 bg-[linear-gradient(150deg,rgba(3,5,12,0.96),rgba(10,14,28,0.96))]">
            <div className="grid grid-cols-1 sm:grid-cols-[210px_1fr]">
              <div className="relative h-52 bg-black/30 sm:h-full">
                <Image
                  src={courseImage}
                  alt={bootstrap.context.courseTitle}
                  fill
                  sizes="(max-width: 640px) 100vw, 210px"
                  className="object-cover"
                />
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.05),rgba(0,0,0,0.62))]" />
                <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[var(--brand,#b61616)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
                    {cardCategory}
                  </span>
                  <span className="rounded-full border border-white/25 bg-black/45 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/85">
                    {cardBadge}
                  </span>
                </div>
                <div className="absolute inset-x-0 bottom-0 px-3 pb-3">
                  <div className="flex flex-wrap gap-2 text-xs text-white/85">
                    <span className="rounded-full border border-white/20 bg-black/45 px-2.5 py-1">{cardDuration}</span>
                    <span className="rounded-full border border-white/20 bg-black/45 px-2.5 py-1">{cardStudents}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col justify-between p-4 text-white/85">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--brand,#ff4b4b)]">Current course</p>
                  <h3 className="mt-2 text-lg font-semibold leading-tight text-white sm:text-2xl">
                    {bootstrap.context.courseTitle}
                  </h3>
                  <p className="mt-2 text-xs text-white/75 sm:text-sm">
                    {bootstrap.context.date} {bootstrap.context.time}
                  </p>
                  <p className="mt-4 text-sm leading-relaxed text-white/76">{cardDescription}</p>
                  <p className="mt-4 text-xs text-white/65">
                    Check-in {checkInWindowLabel}
                  </p>
                  {bootstrap.quickCheckout && (
                    <div className="mt-3 space-y-1 text-xs text-white/65">
                      <p>Service: {quickCheckoutDetails?.serviceLabel || bootstrap.quickCheckout.serviceId}</p>
                      {quickCheckoutDetails?.packageLabel && <p>Package: {quickCheckoutDetails.packageLabel}</p>}
                      {quickCheckoutDetails?.addonLabels && quickCheckoutDetails.addonLabels.length > 0 && (
                        <p>Extras: {quickCheckoutDetails.addonLabels.join(", ")}</p>
                      )}
                    </div>
                  )}
                  {bootstrap.package && (
                    <div className="mt-3 space-y-1 text-xs text-white/65">
                      <p>
                        Active package: {bootstrap.package.packageLabel || bootstrap.package.packageId}
                      </p>
                      <p>
                        Credits:{" "}
                        {bootstrap.package.isUnlimited
                          ? "Unlimited"
                          : typeof bootstrap.package.remainingCredits === "number"
                            ? bootstrap.package.remainingCredits
                            : "0"}
                      </p>
                      {bootstrap.package.expiresAt && (
                        <p>Expires: {packageExpiresLabel || bootstrap.package.expiresAt}</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="mt-4 flex flex-col items-start gap-3">
                  <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white/78">
                    Instructor: {cardTeacher}
                  </span>
                  {isLatePaymentContext && (
                    <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1 text-xs text-amber-100/92">
                      Late payment for previous class
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={onAction}
                    className={`rounded-md px-4 py-2 text-sm font-semibold text-white ${
                      checkInWindowOpen
                        ? "bg-[var(--brand,#b61616)]"
                        : "bg-white/15"
                    }`}
                  >
                    {bootstrapCardButtonLabel}
                  </button>
                  {isLatePaymentContext && !hasFixedRecommendation && (
                    <button
                      type="button"
                      onClick={onBackToCurrentClass}
                      className="text-xs text-white/70 underline"
                    >
                      Back to current class
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3" />
      )}
    </div>
  )
}
