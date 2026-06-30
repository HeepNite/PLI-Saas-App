import React from "react"
import { Bot } from "lucide-react"

import { STAFF_ASSISTANT_RAIL_EXIT_DURATION_CLASS } from "@/components/front/staff/useStaffAssistantRailLayout"

type StaffAssistantRightRailProps = {
  showRightRail: boolean
  showInlineRightRail: boolean
  reserveAssistantColumn: boolean
  isRailCollapsed: boolean
  rightRailRef: React.RefObject<HTMLDivElement | null>
  onCloseOverlay: () => void
  onToggleRail: () => void
  children: React.ReactNode
}

export default function StaffAssistantRightRail({
  showRightRail,
  showInlineRightRail,
  reserveAssistantColumn,
  isRailCollapsed,
  rightRailRef,
  onCloseOverlay,
  onToggleRail,
  children,
}: StaffAssistantRightRailProps) {
  if (!showRightRail) return null

  return (
    <>
      {showInlineRightRail ? (
        <button
          type="button"
          onClick={onCloseOverlay}
          className="fixed inset-0 z-[123] bg-[#02040a]/58 backdrop-blur-[3px] min-[1180px]:hidden"
          aria-label="Close AI assistant"
        />
      ) : null}

      <aside
        aria-hidden={isRailCollapsed ? "true" : undefined}
        inert={isRailCollapsed ? true : undefined}
        className={`fixed inset-x-0 bottom-[4.5rem] z-[124] flex justify-end px-0 transform-gpu transition-[transform,opacity] ${STAFF_ASSISTANT_RAIL_EXIT_DURATION_CLASS} ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[transform,opacity] sm:bottom-[5.25rem] md:bottom-[6rem] min-[1180px]:sticky min-[1180px]:top-3 min-[1180px]:z-40 min-[1180px]:h-fit min-[1180px]:self-start ${
          reserveAssistantColumn ? "min-[1180px]:block" : "min-[1180px]:hidden"
        } ${
          showInlineRightRail
            ? "translate-y-0 scale-100 opacity-100"
            : "pointer-events-none translate-y-6 scale-[0.98] opacity-0 min-[1180px]:translate-y-0 min-[1180px]:scale-100 min-[1180px]:opacity-100"
        } relative`}
      >
        <div
          ref={rightRailRef}
          className={`w-full max-w-md max-h-[64vh] overflow-y-auto rounded-[1.75rem] border border-white/10 bg-[#0f121a]/96 p-4 text-white shadow-[0_28px_80px_-36px_rgba(0,0,0,0.82)] backdrop-blur-xl min-[1180px]:w-[330px] min-[1180px]:max-h-none min-[1180px]:max-w-none min-[1180px]:overflow-visible min-[1180px]:rounded-2xl min-[1180px]:border-black/10 min-[1180px]:bg-white/80 min-[1180px]:p-3 min-[1180px]:text-inherit min-[1180px]:shadow-[0_20px_46px_-24px_rgba(0,0,0,0.45)] min-[1180px]:transition-[transform,opacity] ${STAFF_ASSISTANT_RAIL_EXIT_DURATION_CLASS} min-[1180px]:ease-[cubic-bezier(0.16,1,0.3,1)] min-[1180px]:dark:border-white/10 min-[1180px]:dark:bg-[#11131a]/95 xl:w-[360px] ${
            showInlineRightRail
              ? "min-[1180px]:translate-x-0 min-[1180px]:opacity-100"
              : "min-[1180px]:translate-x-3 min-[1180px]:opacity-0"
          }`}
        >
          <div className="pointer-events-none mb-3 flex justify-center min-[1180px]:hidden">
            <span
              aria-hidden="true"
              className="h-1.5 w-14 rounded-full border border-white/6 bg-[linear-gradient(90deg,rgba(255,255,255,0.08),rgba(255,255,255,0.24),rgba(255,255,255,0.08))] shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]"
            />
          </div>
          {children}
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 right-[2.6rem] h-5 w-5 translate-y-[58%] rotate-45 rounded-[0.7rem] border-r border-b border-white/10 bg-[linear-gradient(135deg,rgba(15,18,26,0.98),rgba(19,24,34,0.92))] shadow-[10px_10px_24px_-18px_rgba(0,0,0,0.9)] min-[1180px]:hidden"
        />
      </aside>

      {isRailCollapsed ? (
        <button
          type="button"
          onClick={onToggleRail}
          className="fixed bottom-4 right-4 z-[125] flex h-[56px] w-[56px] items-center justify-center gap-2 rounded-full border border-white/12 bg-[#0f121a]/95 text-white shadow-[0_18px_42px_-20px_rgba(0,0,0,0.72)] backdrop-blur transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-[#171c28] active:scale-[0.98] sm:bottom-5 sm:right-5 md:bottom-6 md:right-6 min-[1180px]:h-11 min-[1180px]:w-auto min-[1180px]:px-4"
          aria-label="Show AI assistant"
          data-assistant-rail-trigger
        >
          <Bot className="h-5.5 w-5.5" />
          <span className="hidden text-sm font-semibold min-[1180px]:inline">AI Assistant</span>
        </button>
      ) : null}
    </>
  )
}
