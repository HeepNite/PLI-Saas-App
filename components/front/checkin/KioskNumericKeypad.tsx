"use client"

import React from "react"
import { ArrowLeft } from "lucide-react"
import { KIOSK_NUMERIC_KEYPAD_DIGITS } from "@/lib/checkin/numeric-keypad"

export default function KioskNumericKeypad({
  onDigit,
  onBackspace,
  onClear,
  disabled = false,
  className = "",
  activeKey = null,
  framed = true,
}: {
  onDigit: (digit: string) => void
  onBackspace: () => void
  onClear: () => void
  disabled?: boolean
  className?: string
  activeKey?: string | null
  framed?: boolean
}) {
  const [pressedKey, setPressedKey] = React.useState<string | null>(null)

  const triggerPress = React.useCallback((key: string, action: () => void) => {
    setPressedKey(key)
    action()
    window.setTimeout(() => {
      setPressedKey((current) => (current === key ? null : current))
    }, 140)
  }, [])

  const getButtonClassName = React.useCallback(
    (key: string) =>
      `rounded-xl border px-3 py-3 transition disabled:opacity-50 ${
        pressedKey === key || activeKey === key
          ? "border-[var(--brand,#ff6b6b)] bg-[rgba(199,24,24,0.18)] text-white scale-[0.98] shadow-[0_0_0_1px_rgba(255,107,107,0.25)]"
          : "border-white/12 bg-white/[0.04] text-white hover:border-[var(--brand,#c71818)] hover:text-[var(--brand,#ff7a7a)]"
      }`,
    [activeKey, pressedKey]
  )

  return (
    <div
      className={
        `${framed ? "rounded-2xl border border-white/10 bg-white/[0.03] p-3" : ""} ${className}`.trim()
      }
    >
      <div className="grid grid-cols-3 gap-2">
        {KIOSK_NUMERIC_KEYPAD_DIGITS.slice(0, 9).map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => triggerPress(digit, () => onDigit(digit))}
            disabled={disabled}
            className={`${getButtonClassName(digit)} text-lg font-semibold`}
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          onClick={() => triggerPress("clear", onClear)}
          disabled={disabled}
          className={`${getButtonClassName("clear")} text-sm font-semibold`}
        >
          Clear
        </button>
        <button
          type="button"
          onClick={() => triggerPress("0", () => onDigit("0"))}
          disabled={disabled}
          className={`${getButtonClassName("0")} text-lg font-semibold`}
        >
          0
        </button>
        <button
          type="button"
          onClick={() => triggerPress("backspace", onBackspace)}
          disabled={disabled}
          aria-label="Delete last digit"
          className={`inline-flex items-center justify-center ${getButtonClassName("backspace")}`}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
