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
  size = "default",
}: {
  onDigit: (digit: string) => void
  onBackspace: () => void
  onClear: () => void
  disabled?: boolean
  className?: string
  activeKey?: string | null
  framed?: boolean
  size?: "default" | "large" | "modal"
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
      `rounded-[1.15rem] border px-3 transition disabled:opacity-50 ${
        pressedKey === key || activeKey === key
          ? "border-white/40 bg-white/[0.12] text-white scale-[0.98] shadow-[0_0_0_1px_rgba(255,255,255,0.16)]"
          : "border-white/12 bg-white/[0.04] text-white hover:border-[rgba(182,22,22,0.72)] hover:bg-[rgba(182,22,22,0.12)] hover:text-white"
      }`,
    [activeKey, pressedKey]
  )

  const isLarge = size === "large"
  const isModal = size === "modal"
  const frameClassName = framed
    ? isLarge
      ? "rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-4 sm:p-5"
      : isModal
        ? "rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-3 sm:p-4"
      : "rounded-2xl border border-white/10 bg-white/[0.03] p-3"
    : ""
  const gridClassName = isLarge
    ? "grid grid-cols-3 gap-3 sm:gap-4"
      : isModal
        ? "grid grid-cols-3 gap-2 sm:gap-2.5"
      : "grid grid-cols-3 gap-2"
  const digitClassName = isLarge
    ? "h-20 text-[1.75rem] font-semibold sm:h-24"
    : isModal
      ? "h-14 text-[1.2rem] font-semibold sm:h-16 sm:text-[1.35rem]"
      : "py-3 text-lg font-semibold"
  const clearClassName = isLarge
    ? "h-20 text-base font-semibold sm:h-24"
    : isModal
      ? "h-14 text-sm font-semibold sm:h-16"
      : "py-3 text-sm font-semibold"
  const backspaceClassName = isLarge ? "h-20 sm:h-24" : isModal ? "h-14 sm:h-16" : "py-3"
  const iconClassName = isLarge ? "h-7 w-7" : isModal ? "h-5 w-5 sm:h-6 sm:w-6" : "h-5 w-5"

  return (
    <div className={`${frameClassName} ${className}`.trim()}>
      <div className={gridClassName}>
        {KIOSK_NUMERIC_KEYPAD_DIGITS.slice(0, 9).map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => triggerPress(digit, () => onDigit(digit))}
            disabled={disabled}
            className={`${getButtonClassName(digit)} ${digitClassName}`}
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          onClick={() => triggerPress("clear", onClear)}
          disabled={disabled}
          className={`${getButtonClassName("clear")} ${clearClassName}`}
        >
          Clear
        </button>
        <button
          type="button"
          onClick={() => triggerPress("0", () => onDigit("0"))}
          disabled={disabled}
          className={`${getButtonClassName("0")} ${digitClassName}`}
        >
          0
        </button>
        <button
          type="button"
          onClick={() => triggerPress("backspace", onBackspace)}
          disabled={disabled}
          aria-label="Delete last digit"
          className={`inline-flex items-center justify-center ${getButtonClassName("backspace")} ${backspaceClassName}`}
        >
          <ArrowLeft className={iconClassName} />
        </button>
      </div>
    </div>
  )
}
