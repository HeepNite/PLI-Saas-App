"use client"
import React from "react"

export type EnrollFlowPopupProps = {
  title: string
  message: string
  onContinue: () => void
}

export default function EnrollFlowPopup({ title, message, onContinue }: EnrollFlowPopupProps) {
  return (
    <div className="fixed inset-0 z-[10015] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[1.5rem] border border-white/10 bg-[linear-gradient(160deg,rgba(12,15,28,0.98),rgba(21,25,40,0.96))] p-5 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.85)]">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--brand,#c71818)]">Booking update</p>
        <h3 className="mt-2 text-lg font-semibold text-white">{title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-white/70">{message}</p>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onContinue}
            className="rounded-md bg-[var(--brand,#111)] px-4 py-2 text-sm font-semibold text-white"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
