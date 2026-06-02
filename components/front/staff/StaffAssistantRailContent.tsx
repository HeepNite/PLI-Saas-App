import React from "react"
import { ChevronLeft, ChevronRight, Settings } from "lucide-react"

import type { StaffAssistantChatMessage } from "./useStaffAssistantAdmin"

type StaffAssistantRailContentProps = {
  isRailCollapsed: boolean
  activeNavLabel: string
  chatMessages: StaffAssistantChatMessage[]
  chatInput: string
  onToggleRail: () => void
  onOpenAssistantConfig: () => void
  onChatInputChange: (value: string) => void
  onSendChatMessage: (event: React.FormEvent) => void
}

export default function StaffAssistantRailContent({
  isRailCollapsed,
  activeNavLabel,
  chatMessages,
  chatInput,
  onToggleRail,
  onOpenAssistantConfig,
  onChatInputChange,
  onSendChatMessage,
}: StaffAssistantRailContentProps) {
  return (
    <>
      <div className="flex flex-col gap-2.5 min-[1180px]:gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 pr-1">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--brand,#b61616)] min-[1180px]:text-xs min-[1180px]:tracking-[0.35em]">AI Assistant</p>
            <h3 className="mt-1.5 text-lg font-semibold leading-tight text-white min-[1180px]:text-xl min-[1180px]:text-black xl:text-2xl dark:min-[1180px]:text-white">Admin copilot</h3>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onToggleRail}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/[0.06] text-white/80 transition hover:border-[var(--brand,#b61616)] hover:text-[var(--brand,#ff3c3c)] min-[1180px]:border-black/20 min-[1180px]:bg-white/70 min-[1180px]:text-black/75 dark:min-[1180px]:border-white/20 dark:min-[1180px]:bg-white/5 dark:min-[1180px]:text-white/75"
              aria-label={isRailCollapsed ? "Show AI assistant" : "Hide AI assistant"}
            >
              {isRailCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onOpenAssistantConfig}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/12 bg-white/[0.06] text-xs font-semibold text-white transition hover:border-[var(--brand,#b61616)] min-[1180px]:h-auto min-[1180px]:w-auto min-[1180px]:gap-1.5 min-[1180px]:border-black/20 min-[1180px]:bg-white/70 min-[1180px]:px-2.5 min-[1180px]:py-1.5 min-[1180px]:text-black dark:min-[1180px]:border-white/20 dark:min-[1180px]:bg-white/5 dark:min-[1180px]:text-white"
              aria-label="Open assistant configuration"
              title="Open assistant configuration"
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden min-[1180px]:inline">Config</span>
            </button>
          </div>
        </div>
        <p className="max-w-none text-xs leading-relaxed text-white/68 min-[1180px]:text-sm min-[1180px]:text-black/65 dark:min-[1180px]:text-white/65">
          Live chat for operations. Configure behavior from the AI icon in the left menu.
        </p>
      </div>

      <div className="mt-4 flex min-h-0 max-h-[58vh] flex-col rounded-[1.2rem] border border-white/10 bg-black/20 p-3 min-[1180px]:min-h-[60vh] min-[1180px]:max-h-[60vh] min-[1180px]:rounded-xl min-[1180px]:border-black/10 min-[1180px]:bg-white/60 dark:min-[1180px]:border-white/10 dark:min-[1180px]:bg-white/[0.02]">
        <div className="flex-1 space-y-3 overflow-y-auto pr-1 text-sm">
          {chatMessages.map((message) => (
            <div
              key={message.id}
              className={`max-w-[92%] rounded-lg border px-3 py-2 ${
                message.role === "user"
                  ? "ml-auto border-[var(--brand,#b61616)]/35 bg-[var(--brand,#b61616)]/12 text-white min-[1180px]:text-black dark:min-[1180px]:text-white"
                  : "border-white/10 bg-white/[0.05] text-white/82 min-[1180px]:border-black/10 min-[1180px]:bg-black/[0.03] min-[1180px]:text-black/80 dark:min-[1180px]:border-white/10 dark:min-[1180px]:bg-white/[0.03] dark:min-[1180px]:text-white/80"
              }`}
            >
              {message.text}
            </div>
          ))}
        </div>

        <form
          onSubmit={onSendChatMessage}
          className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3 min-[1180px]:border-black/10 dark:min-[1180px]:border-white/10"
        >
          <input
            name="assistantPromptRight"
            value={chatInput}
            onChange={(event) => onChatInputChange(event.target.value)}
            placeholder={`Message about ${activeNavLabel.toLowerCase()}...`}
            className="w-full rounded-md border border-white/12 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-[var(--brand,#b61616)] min-[1180px]:border-black/15 min-[1180px]:bg-white min-[1180px]:text-black min-[1180px]:placeholder:text-black/35 dark:min-[1180px]:border-white/15 dark:min-[1180px]:bg-white/5 dark:min-[1180px]:text-white dark:min-[1180px]:placeholder:text-white/40"
          />
          <button type="submit" className="rounded-md bg-[var(--brand,#b61616)] px-3 py-2 text-sm font-semibold text-white">
            Send
          </button>
        </form>
      </div>
    </>
  )
}
