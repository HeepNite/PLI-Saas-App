import type { NativeReaderStatus } from "@/components/front/courses/enroll/effects/native-payment-bridge"

const dot: Record<Exclude<NativeReaderStatus, "unknown">, { color: string; label: string }> = {
  connected: { color: "bg-emerald-400", label: "Card reader connected" },
  connecting: { color: "bg-amber-400 animate-pulse", label: "Card reader connecting" },
  disconnected: { color: "bg-red-500", label: "Card reader disconnected" },
}

/** Small reader readiness dot; renders only once the native kiosk app has reported a status. */
export function NativeReaderStatusDot({ status }: { status: NativeReaderStatus }) {
  if (status === "unknown") return null
  const { color, label } = dot[status]
  return (
    <span
      data-reader-status={status}
      role="img"
      aria-label={label}
      title={label}
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${color}`}
    />
  )
}
