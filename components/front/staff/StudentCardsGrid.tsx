"use client"

import React from "react"
import type { StudentsBoardCardsProps, AnyStudentCardForPanel } from "./studentsBoardTypes"
import { ProfileStudentCard } from "./cards/ProfileStudentCard"
import { PaymentStudentCard } from "./cards/PaymentStudentCard"

export type StudentCardsGridProps = StudentsBoardCardsProps & {
  paymentsLoading: boolean
  onRefreshPaymentsBoard: () => void
}

const resolveMasonryColumnCount = () => {
  if (typeof window === "undefined") return 1
  if (window.matchMedia("(min-width: 1280px)").matches) return 3
  if (window.matchMedia("(min-width: 640px)").matches) return 2
  return 1
}

const isFrontDeskPurchaseSource = (source: string | undefined) =>
  source === "kiosk" || source === "front_desk" || source === "admin"

export function StudentCardsGrid(props: StudentCardsGridProps) {
  const {
    paymentsLoading,
    displayedStudentCards,
    filteredStudentCardsCount,
    searchResultCards,
    shouldPreservePaymentBoard,
    cardContext,
    studentSearchQuery,
    historyFrom,
    historyTo,
  } = props
  const [masonryColumnCount, setMasonryColumnCount] = React.useState(resolveMasonryColumnCount)

  React.useEffect(() => {
    const mediaQueries = [
      window.matchMedia("(min-width: 1280px)"),
      window.matchMedia("(min-width: 640px)"),
    ]
    const updateColumnCount = () => setMasonryColumnCount(resolveMasonryColumnCount())

    updateColumnCount()
    mediaQueries.forEach((query) => query.addEventListener("change", updateColumnCount))
    return () => mediaQueries.forEach((query) => query.removeEventListener("change", updateColumnCount))
  }, [])

  const renderStudentCard = (student: AnyStudentCardForPanel) =>
    student.source === "profile" ? (
      <ProfileStudentCard
        key={`student-card-${student.key}`}
        student={student}
        {...props}
      />
    ) : (
      <PaymentStudentCard
        key={`student-card-${student.key}`}
        student={student}
        {...props}
      />
    )

  const getCardPurchaseSource = (card: AnyStudentCardForPanel): string | undefined =>
    card.source === "payment" ? card.latestPayment.purchaseSource : undefined

  const { webCards, kioskCards } = React.useMemo(() => {
    const web: AnyStudentCardForPanel[] = []
    const kiosk: AnyStudentCardForPanel[] = []
    for (const card of displayedStudentCards) {
      const source = getCardPurchaseSource(card)
      if (isFrontDeskPurchaseSource(source)) {
        kiosk.push(card)
      } else {
        web.push(card)
      }
    }
    return { webCards: web, kioskCards: kiosk }
  }, [displayedStudentCards])

  const buildMasonryColumns = React.useCallback(
    (cards: AnyStudentCardForPanel[]) =>
      cards.reduce<Array<AnyStudentCardForPanel[]>>(
        (columns, student, index) => {
          columns[index % columns.length].push(student)
          return columns
        },
        Array.from({ length: masonryColumnCount }, () => []),
      ),
    [masonryColumnCount],
  )

  const webMasonryColumns = React.useMemo(() => buildMasonryColumns(webCards), [buildMasonryColumns, webCards])
  const kioskMasonryColumns = React.useMemo(() => buildMasonryColumns(kioskCards), [buildMasonryColumns, kioskCards])

  return (
    <>
      {cardContext === "global-search" ? (
        <p
          aria-live="polite"
          className="mt-5 rounded-lg border border-black/10 bg-black/[0.03] px-3 py-2 text-sm text-black/70 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/70"
        >
          Search results for &quot;{studentSearchQuery.trim()}&quot;
        </p>
      ) : null}

      <div className="mt-5">
        {paymentsLoading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`students-skeleton-${index}`}
                className="h-[190px] rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(191,30,30,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_28%),linear-gradient(180deg,rgba(18,20,29,0.98),rgba(11,13,20,0.99))] shadow-[0_28px_60px_-36px_rgba(0,0,0,0.92)] ring-1 ring-white/5 shimmer"
              />
            ))}
          </div>
        ) : cardContext === "global-search" && (searchResultCards?.length ?? 0) === 0 ? (
          <p className="col-span-full rounded-lg border border-black/10 bg-black/[0.03] px-3 py-2 text-sm text-black/65 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/65">
            No students found.
          </p>
        ) : !searchResultCards &&
          !shouldPreservePaymentBoard &&
          filteredStudentCardsCount === 0 ? (
          <p className="col-span-full rounded-lg border border-black/10 bg-black/[0.03] px-3 py-2 text-sm text-black/65 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/65">
            {cardContext === "history" && (!historyFrom || !historyTo)
              ? "Select a range to load payment history."
              : cardContext === "history" && historyFrom > historyTo
                ? "History range must start on or before the end date."
                : "No student payments found."}
          </p>
        ) : (
          <div className="space-y-6">
            {webCards.length > 0 && (
              <section>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-400/80">
                  Web
                </p>
                <div className="grid max-h-none grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {webMasonryColumns.map((column, columnIndex) => (
                    <div key={`web-card-column-${columnIndex}`} className="flex flex-col gap-5">
                      {column.map(renderStudentCard)}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {kioskCards.length > 0 && (
              <section>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-400/80">
                  Kiosk / Terminal / Front desk
                </p>
                <div className="grid max-h-none grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {kioskMasonryColumns.map((column, columnIndex) => (
                    <div key={`kiosk-card-column-${columnIndex}`} className="flex flex-col gap-5">
                      {column.map(renderStudentCard)}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </>
  )
}
