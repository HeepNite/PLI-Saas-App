import React from "react"
import { actionRequestLabels } from "../profile-constants"
import {
  actionRequestMetaLabel,
  actionRequestStatusLabel,
  formatDateTimeInTimeZone,
  getProcessTypeTone,
} from "../profile-formatters"
import type { ActionRequestItem, ActionRequestType } from "../profile-types"

type RecentRequestsListProps = {
  loading: boolean
  error: string | null
  requests: ActionRequestItem[]
}

export function RecentRequestsList({ loading, error, requests }: RecentRequestsListProps) {
  return (
    <>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      {loading ? (
        <div className="mt-3 space-y-2">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={`request-skeleton-${idx}`} className="h-14 animate-pulse rounded-lg border border-white/10 bg-white/5" />
          ))}
        </div>
      ) : requests.length > 0 ? (
        <div className="mt-3 space-y-2">
          {requests.map((request) => {
            const metaLabel = actionRequestMetaLabel(request)
            const tone = getProcessTypeTone(request.type)
            return (
              <div
                key={request.id}
                className="rounded-lg border px-3 py-2"
                style={{ borderColor: tone.border, background: tone.bg }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-zinc-800 dark:text-white/85">
                    {actionRequestLabels[request.type as ActionRequestType] || request.type}
                  </p>
                  <span
                    className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]"
                    style={{ borderColor: tone.border, color: tone.text }}
                  >
                    {actionRequestStatusLabel(request.status)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-600 dark:text-white/55">
                  {formatDateTimeInTimeZone(request.createdAt)}
                </p>
                {metaLabel && <p className="mt-1 text-xs text-zinc-700 dark:text-white/70">{metaLabel}</p>}
                {request.message && (
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-700 dark:text-white/70">{request.message}</p>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <p className="mt-3 text-xs text-zinc-600 dark:text-white/60">No requests for now.</p>
      )}
    </>
  )
}
