"use client"

import React, { useRef, useEffect, useCallback, useState } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import {
  CalendarDays,
  CreditCard,
  Banknote,
  Package,
  CheckCircle2,
  Clock,
  RotateCcw,
  DollarSign,
  Percent,
  User,
  PencilLine,
  X,
} from "lucide-react"
import {
  computePopoverPosition,
  computePopoverPositionFromRect,
  useClickOutside,
  useKeyboardClose,
  getArrowStyle,
  getArrowRotation,
  type PopoverPosition,
} from "./shared/popover-utils"

// Re-export for backwards compatibility with existing tests
export { computePopoverPositionFromRect }

gsap.registerPlugin(useGSAP)

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PaymentModification {
  date: Date
  description: string
  staffName: string
}

export interface PaymentEvent {
  id: string
  date: Date
  amount: number
  method: "card" | "cash" | "other"
  product: string
  productType: "package" | "dropin" | "other"
  status: "paid" | "pending" | "refunded" | "cancelled"
  debt?: number
  discount?: number
  staffName?: string
  modifications?: PaymentModification[]
  failureInfo?: {
    message?: string
    code?: string
    declineCode?: string
    cardBrand?: string
    cardLast4?: string
  } | null
}

export interface PaymentHistoryTimelineProps {
  payments: PaymentEvent[]
  anchorEl: HTMLElement | null
  isOpen: boolean
  onClose: () => void
  loading?: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  paid: {
    label: "Paid",
    icon: CheckCircle2,
    color: "text-green-400",
    bg: "bg-green-400/10",
    border: "border-green-400/20",
    dot: "bg-green-400",
  },
  pending: {
    label: "Pending",
    icon: Clock,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    border: "border-amber-400/20",
    dot: "bg-amber-400",
  },
  refunded: {
    label: "Refunded",
    icon: RotateCcw,
    color: "text-red-400",
    bg: "bg-red-400/10",
    border: "border-red-400/20",
    dot: "bg-red-400",
  },
  cancelled: {
    label: "Cancelled",
    icon: X,
    color: "text-zinc-400",
    bg: "bg-zinc-400/10",
    border: "border-zinc-400/20",
    dot: "bg-zinc-400",
  },
} as const

const METHOD_CONFIG = {
  card: { label: "Card", icon: CreditCard },
  cash: { label: "Cash", icon: Banknote },
  other: { label: "Other", icon: DollarSign },
} as const

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

// ─── Timeline Item Component ─────────────────────────────────────────────────

interface TimelineItemProps {
  payment: PaymentEvent
  isLast: boolean
}

function TimelineItem({ payment, isLast }: TimelineItemProps) {
  const [expanded, setExpanded] = useState(false)
  const statusCfg = STATUS_CONFIG[payment.status]
  const methodCfg = METHOD_CONFIG[payment.method]
  const StatusIcon = statusCfg.icon
  const MethodIcon = methodCfg.icon
  const hasModifications = payment.modifications && payment.modifications.length > 0

  return (
    <div
      className="timeline-item relative pl-8 pb-6 group"
      role="listitem"
      aria-label={`Payment on ${formatDate(payment.date)}: ${formatCurrency(payment.amount)} - ${statusCfg.label}`}
    >
      {/* Timeline dot */}
      <div
        className={`absolute left-0 top-1 w-3.5 h-3.5 rounded-full ${statusCfg.dot} ring-4 ring-zinc-900 group-hover:scale-125 transition-transform`}
        aria-hidden
      />

      {/* Timeline line (not on last item) */}
      {!isLast && (
        <div
          className="timeline-line absolute left-[7px] top-5 bottom-0 w-px bg-gradient-to-b from-white/20 to-transparent"
          aria-hidden
        />
      )}

      {/* Card */}
      <div
        className={`rounded-xl border ${statusCfg.border} bg-white/5 backdrop-blur-sm p-4 hover:bg-white/8 transition-colors cursor-pointer`}
        onClick={() => hasModifications && setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            hasModifications && setExpanded(!expanded)
          }
        }}
        tabIndex={hasModifications ? 0 : -1}
        role={hasModifications ? "button" : undefined}
        aria-expanded={hasModifications ? expanded : undefined}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <StatusIcon className={`w-4 h-4 flex-shrink-0 ${statusCfg.color}`} />
            <span className={`text-xs font-medium ${statusCfg.color} uppercase tracking-wider`}>
              {statusCfg.label}
            </span>
          </div>
          <span className="text-sm font-semibold text-white tabular-nums">
            {formatCurrency(payment.amount)}
          </span>
        </div>

        {/* Product */}
        <div className="flex items-center gap-2 mb-2 text-white/80">
          <Package className="w-3.5 h-3.5 flex-shrink-0 text-white/50" />
          <span className="text-sm truncate">{payment.product}</span>
          {payment.productType === "package" && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-500/20 text-purple-300 rounded">
              PACKAGE
            </span>
          )}
          {payment.productType === "dropin" && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-sky-500/20 text-sky-300 rounded">
              DROP-IN
            </span>
          )}
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/50">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="w-3 h-3" />
            {formatDate(payment.date)}
          </span>
          <span className="flex items-center gap-1.5">
            <MethodIcon className="w-3 h-3" />
            {methodCfg.label}
          </span>
          {payment.staffName && (
            <span className="flex items-center gap-1.5">
              <User className="w-3 h-3" />
              {payment.staffName}
            </span>
          )}
        </div>

        {/* Discount */}
        {payment.discount != null && payment.discount > 0 && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400">
            <Percent className="w-3 h-3" />
            <span>Discount: {formatCurrency(payment.discount)}</span>
          </div>
        )}

        {/* Debt */}
        {payment.debt != null && payment.debt > 0 && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
            <DollarSign className="w-3 h-3" />
            <span>Outstanding: {formatCurrency(payment.debt)}</span>
          </div>
        )}

        {/* Stripe failure details — only for pending card payments */}
        {payment.status === "pending" && payment.method === "card" && payment.failureInfo && (
          <div className="mt-2 rounded-lg bg-red-500/10 border border-red-500/20 p-2 text-xs">
            <p className="text-red-400 font-medium">
              {payment.failureInfo.message || "Payment failed"}
            </p>
            {payment.failureInfo.declineCode && (
              <p className="text-red-400/70 mt-1">
                Code: {payment.failureInfo.declineCode}
              </p>
            )}
            {payment.failureInfo.cardLast4 && (
              <p className="text-zinc-400 mt-1">
                Card: {payment.failureInfo.cardBrand} •••• {payment.failureInfo.cardLast4}
              </p>
            )}
          </div>
        )}

        {/* Modifications expandable */}
        {hasModifications && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <div className="flex items-center gap-1.5 text-xs text-blue-400 mb-2">
              <PencilLine className="w-3 h-3" />
              <span>
                {payment.modifications!.length} modification{payment.modifications!.length > 1 ? "s" : ""}
              </span>
              <span className="ml-auto text-white/40">{expanded ? "▼" : "▶"}</span>
            </div>
            {expanded && (
              <ul className="space-y-2" aria-label="Modification history">
                {payment.modifications!.map((mod, idx) => (
                  <li key={idx} className="text-xs text-white/60 pl-3 border-l-2 border-blue-400/30">
                    <span className="text-white/40">{formatDate(mod.date)}</span>
                    <span className="mx-1.5">—</span>
                    {mod.description}
                    <span className="text-white/40 ml-1">by {mod.staffName}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PaymentHistoryTimeline({
  payments,
  anchorEl,
  isOpen,
  onClose,
  loading = false,
}: PaymentHistoryTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const lineRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<PopoverPosition | null>(null)
  const [mounted, setMounted] = useState(false)

  const handleClose = useCallback(() => {
    if (!isOpen) return
    onClose()
  }, [isOpen, onClose])

  useClickOutside(popoverRef, handleClose)
  useKeyboardClose(handleClose)

  // Compute position when opened
  useEffect(() => {
    if (!isOpen || !anchorEl) return

    const updatePosition = () => {
      setPosition(computePopoverPosition(anchorEl, 408, 560, 8))
    }

    // Initial position
    updatePosition()

    // Update on resize/scroll
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)

    return () => {
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
    }
  }, [isOpen, anchorEl])

  // Mark mounted for SSR safety
  useEffect(() => {
    setMounted(true)
  }, [])

  // GSAP animations
  useGSAP(
    () => {
      if (!isOpen || !popoverRef.current) return

      const tl = gsap.timeline({ defaults: { ease: "power2.out" } })

      // 1. Popover container scales in from badge
      tl.fromTo(
        popoverRef.current,
        { scale: 0.8, opacity: 0, transformOrigin: "top left" },
        { scale: 1, opacity: 1, duration: 0.3 }
      )

      // 2. Timeline vertical line draws itself
      if (lineRef.current) {
        tl.fromTo(
          lineRef.current,
          { scaleY: 0, transformOrigin: "top" },
          { scaleY: 1, duration: 0.4 },
          "-=0.1"
        )
      }

      // 3. Items stagger in
      tl.fromTo(
        ".timeline-item",
        { x: -20, opacity: 0 },
        { x: 0, opacity: 1, stagger: 0.08, duration: 0.3 },
        "-=0.2"
      )
    },
    { scope: containerRef, dependencies: [isOpen] }
  )

  // Exit animation
  useGSAP(
    () => {
      if (isOpen || !popoverRef.current) return

      const tl = gsap.timeline({
        defaults: { ease: "power2.in" },
        onComplete: () => onClose(),
      })

      // Reverse stagger: items fade out first
      tl.to(".timeline-item", {
        x: -20,
        opacity: 0,
        stagger: 0.04,
        duration: 0.15,
      })

      // Line shrinks
      if (lineRef.current) {
        tl.to(
          lineRef.current,
          { scaleY: 0, duration: 0.2 },
          "-=0.1"
        )
      }

      // Popover scales out
      tl.to(
        popoverRef.current,
        { scale: 0.8, opacity: 0, duration: 0.2 },
        "-=0.15"
      )
    },
    { scope: containerRef, dependencies: [isOpen, onClose] }
  )

  // Don't render anything if not open and not mounted (SSR safety)
  if (!mounted) return null
  if (!isOpen) return null

  const sortedPayments = [...payments].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  const arrowStyle = getArrowStyle(position)
  const arrowRotation = getArrowRotation(position)

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 pointer-events-none" aria-hidden={!isOpen}>
      {/* Backdrop (transparent, captures clicks) */}
      <div className="absolute inset-0 pointer-events-auto" aria-hidden />

      {/* Popover */}
      <div
        ref={popoverRef}
        role="dialog"
        aria-modal="true"
        aria-label="Payment history timeline"
        className="pointer-events-auto absolute"
        style={
          position
            ? {
                top: position.top,
                left: position.left,
                width: "min(408px, calc(100vw - 24px))",
                maxHeight: "calc(100vh - 32px)",
                height: "min(560px, calc(100vh - 32px))",
              }
            : { visibility: "hidden" }
        }
      >
        {/* Arrow */}
        <div
          className={`absolute w-3 h-3 bg-zinc-900 border border-zinc-700/50 ${arrowRotation}`}
          style={arrowStyle}
          aria-hidden
        />

        <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-700/70 bg-zinc-950 shadow-2xl shadow-black/65 ring-1 ring-black/60 backdrop-blur-md">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-white/60" />
              <h3 className="text-sm font-semibold text-white">Payment History</h3>
              <span className="text-xs text-white/40 bg-white/5 px-2 py-0.5 rounded-full">
                {sortedPayments.length}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
              aria-label="Close payment history"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Timeline content */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 no-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin mb-3" />
                <p className="text-sm text-white/50">Loading history...</p>
              </div>
            ) : sortedPayments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="w-10 h-10 text-white/20 mb-3" />
                <p className="text-sm text-white/50">No payment history found</p>
              </div>
            ) : (
              <div ref={lineRef} className="relative" role="list" aria-label="Payment timeline">
                {sortedPayments.map((payment, idx) => (
                  <TimelineItem
                    key={payment.id}
                    payment={payment}
                    isLast={idx === sortedPayments.length - 1}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer summary */}
          {sortedPayments.length > 0 && (
            <div className="px-5 py-3 border-t border-white/10 bg-white/5">
              <div className="flex items-center justify-between text-xs text-white/50">
                <span>Total transactions</span>
                <span className="text-white/70 font-medium tabular-nums">
                  {sortedPayments.length}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-white/50 mt-1">
                <span>Total paid</span>
                <span className="text-green-400 font-medium tabular-nums">
                  {formatCurrency(
                    sortedPayments
                      .filter((p) => p.status === "paid")
                      .reduce((sum, p) => sum + p.amount, 0)
                  )}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
