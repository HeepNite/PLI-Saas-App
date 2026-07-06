"use client"

import React from "react"
import { RefreshCw } from "lucide-react"

import StaffPaymentsBoardControls from "./StaffPaymentsBoardControls"
import CreateStudentModal from "./CreateStudentModal"
import { ClerkSyncContext } from "./ClerkSyncContext"
import { ClerkSyncBanner } from "./banners/ClerkSyncBanner"
import { TerminalPinAlertsStrip } from "./banners/TerminalPinAlertsStrip"
import { StudentCardsGrid } from "./StudentCardsGrid"

export type {
  TerminalPinAlert,
  StudentsBoardLoadingProps,
  StudentsBoardClerkSyncProps,
  StudentsBoardTerminalAlertsProps,
  StudentsBoardPaginationProps,
  PaymentBackedStudentCard,
  AnyStudentCardForPanel,
  StudentsBoardCardsProps,
  StudentsBoardCreateStudentProps,
  StaffStudentsBoardPanelProps,
} from "./studentsBoardTypes"

import type { StaffStudentsBoardPanelProps } from "./studentsBoardTypes"

export default function StaffStudentsBoardPanel({
  isStudentsView,
  loadingStatus,
  clerkSync,
  terminalAlerts,
  controls,
  cards,
  pagination,
  createStudent,
}: StaffStudentsBoardPanelProps) {
  if (!isStudentsView) return null

  const { paymentsLoading, onRefreshPaymentsBoard } = loadingStatus
  const { currentPage, totalPages, setCurrentPage } = pagination

  return (
    <article
      id="students-payments"
      className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5"
    >
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Students</p>
          <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">
            Student payment board
          </h3>
          <p className="mt-1 text-sm text-black/65 dark:text-white/65">
            Grid view by student with class payment status, check-in and active package.
          </p>
        </div>
        <div className="mt-2 flex shrink-0 items-center gap-2">
          {createStudent && (
            <button
              type="button"
              onClick={createStudent.openModal}
              className="inline-flex items-center gap-1 h-9 whitespace-nowrap rounded-full border border-[var(--brand,#b61616)]/40 bg-[var(--brand,#b61616)]/10 px-3 text-xs font-medium text-[var(--brand,#b61616)] transition hover:bg-[var(--brand,#b61616)]/20 dark:border-[var(--brand,#b61616)]/40 dark:text-[var(--brand,#b61616)]"
              aria-label="Create new student"
            >
              + New student
            </button>
          )}
          <button
            type="button"
            onClick={() => onRefreshPaymentsBoard()}
            disabled={paymentsLoading}
            className="inline-flex items-center gap-1 h-9 whitespace-nowrap rounded-full border border-black/20 px-3 text-xs font-medium text-black/70 transition hover:border-[var(--brand,#b61616)]/60 hover:text-[var(--brand,#b61616)] disabled:opacity-50 dark:border-white/20 dark:text-white/70 dark:hover:border-[var(--brand,#b61616)]/60 dark:hover:text-[var(--brand,#b61616)]"
            aria-label="Refresh payments board"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${paymentsLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      {createStudent && (
        <CreateStudentModal
          isOpen={createStudent.isOpen}
          form={createStudent.form}
          submitting={createStudent.submitting}
          error={createStudent.error}
          result={createStudent.result}
          hasAmount={createStudent.hasAmount}
          canSubmit={createStudent.canSubmit}
          attendanceSessions={createStudent.attendanceSessions}
          onClose={createStudent.closeModal}
          onUpdateField={createStudent.updateField}
          onSubmit={createStudent.submit}
        />
      )}

      <ClerkSyncBanner {...clerkSync} />
      <TerminalPinAlertsStrip {...terminalAlerts} />

      <StaffPaymentsBoardControls {...controls} />

      <ClerkSyncContext.Provider value={clerkSync}>
        <StudentCardsGrid
          {...cards}
          paymentsLoading={paymentsLoading}
          onRefreshPaymentsBoard={onRefreshPaymentsBoard}
        />
      </ClerkSyncContext.Provider>

      {totalPages > 1 ? (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] px-4 py-3 text-sm text-white/80 shadow-[0_16px_32px_-24px_rgba(0,0,0,0.8)] backdrop-blur">
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="rounded-full border border-white/20 bg-black/20 px-3 py-1.5 text-xs font-semibold text-white/85 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-xs uppercase tracking-[0.16em] text-white/55">
            Page {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="rounded-full border border-white/20 bg-black/20 px-3 py-1.5 text-xs font-semibold text-white/85 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      ) : null}
    </article>
  )
}
