import Image from "next/image"
import { cn } from "@/lib/utils"
import { formatTerminalClassDateTime } from "@/lib/checkin/class-date-format"
import type { TerminalPastClass } from "@/components/front/checkin/checkin.types"

/**
 * Design tokens for kiosk terminal layout
 * These values are extracted here for maintainability and consistency
 */
const KIOSK_TOKENS = {
  // QR-first terminal ratio: compact course context / prominent QR action
  gridColumns: "minmax(0, 0.68fr) minmax(15rem, 0.72fr) minmax(12.5rem, 0.5fr)",
  
  // Divider styling - subtle gray separator
  divider: {
    height: "12rem",                           // 192px - visual height of separator
    offsetTop: "1.5rem",                       // 24px - distance from top
    offsetLeft: "0.6rem",                      // ~10px - horizontal positioning
    width: "0.15rem",                          // ~2.4px - line thickness
    color: "rgba(255, 255, 255, 0.15)",        // Subtle gray/white at 15% opacity
  },
  
  // Spacing
  gap: "0.75rem",         // gap-3
  padding: "1.5rem",      // p-6
} as const

interface CourseCardPanelProps {
  cardImage: string
  courseTitle: string
  category: string
  badge: string
  duration: string
  students: string
  description: string
  teacher: string
  displayDate: string
  displayTime: string
  qrImage?: string
  terminalPastClasses?: TerminalPastClass[]
  selectedTerminalPastClass?: { courseSlug: string; time: string } | null
  onTerminalPastClassSelect?: (selection: { courseSlug: string; time: string }) => void
  onExistingClick?: (contextOverride?: { courseSlug: string; date: string; time: string }) => void
  onNewClick?: (contextOverride?: { courseSlug: string; date: string; time: string }) => void
  compact?: boolean
  actionSlot?: React.ReactNode
}

export function CourseCardPanel({
  cardImage,
  courseTitle,
  category,
  badge,
  duration,
  students,
  description,
  teacher,
  displayDate,
  displayTime,
  qrImage,
  terminalPastClasses,
  selectedTerminalPastClass,
  onTerminalPastClassSelect,
  onExistingClick,
  onNewClick,
  compact = false,
  actionSlot,
}: CourseCardPanelProps) {
  const hasQr = Boolean(qrImage)
  const showPastCourses = compact && Boolean(terminalPastClasses?.length)

  if (hasQr) {
    if (compact && actionSlot) {
      return (
        <div className="mx-[1.25rem] my-0 mt-3 rounded-2xl border border-white/15 bg-white/[0.02] p-4 lg:p-5">
          <div
            className="grid items-start"
            style={{ gridTemplateColumns: KIOSK_TOKENS.gridColumns }}
          >
            <div className="self-stretch pr-4">
              <CourseCardContent
                cardImage={cardImage}
                courseTitle={courseTitle}
                category={category}
                badge={badge}
                duration={duration}
                students={students}
                description={description}
                teacher={teacher}
                displayDate={displayDate}
                displayTime={displayTime}
                variant="split"
                compact={compact}
              />
            </div>
            <ActionSection>{actionSlot}</ActionSection>
            <div className="relative self-stretch pl-4">
              <ColumnDivider side="left" />
              <QrSection qrImage={qrImage} compact={compact} />
            </div>
          </div>
          {showPastCourses && (
            <div className="mt-4">
              <PastCoursesList
                classes={terminalPastClasses || []}
                onExistingClick={onExistingClick}
                onNewClick={onNewClick}
              />
            </div>
          )}
        </div>
      )
    }

    return (
      <div 
        className={cn(
          "rounded-2xl border border-white/15 bg-white/[0.02]",
            compact
            ? "mx-[1.25rem] my-0 mt-3 p-4 lg:p-5"
            : "mt-6 px-4 py-5 sm:px-6"
        )}
      >
        <SplitLayout compact={compact}>
          {/* Course Content Column (60%) */}
          <div className={cn("h-full", compact && "pr-4")}>
            <CourseCardContent
              cardImage={cardImage}
              courseTitle={courseTitle}
              category={category}
              badge={badge}
              duration={duration}
              students={students}
              description={description}
              teacher={teacher}
              displayDate={displayDate}
              displayTime={displayTime}
              variant="split"
              compact={compact}
            />
          </div>
          
          {/* Visual Divider */}
          <Divider compact={compact} />
          
          {/* QR Code Column (40%) */}
          <QrSection qrImage={qrImage} compact={compact} actionSlot={actionSlot} />
        </SplitLayout>
      </div>
    )
  }

  // Fallback: compact course card without QR
  return (
    <div className="mt-6">
      <CourseCardContent
        cardImage={cardImage}
        courseTitle={courseTitle}
        category={category}
        badge={badge}
        duration={duration}
        students={students}
        description={description}
        teacher={teacher}
        displayDate={displayDate}
        displayTime={displayTime}
        variant="compact"
        compact={compact}
      />
    </div>
  )
}

function PastCoursesList({
  classes,
  onExistingClick,
  onNewClick,
}: {
  classes: TerminalPastClass[]
  onExistingClick?: (contextOverride?: { courseSlug: string; date: string; time: string }) => void
  onNewClick?: (contextOverride?: { courseSlug: string; date: string; time: string }) => void
}) {
  return (
    <div className="flex h-full min-h-full flex-col">
      <div className="mb-5 grid items-start" style={{ gridTemplateColumns: KIOSK_TOKENS.gridColumns }}>
        <p className="text-xs uppercase tracking-[0.2em] text-white/60">Past Courses</p>
        <p className="text-center text-xs uppercase tracking-[0.2em] text-white/60">Continue here</p>
        <p className="text-center text-xs uppercase tracking-[0.2em] text-white/60">Scan QR code</p>
      </div>
      <div className="flex flex-col gap-4">
        {classes.map((item) => {
          const context = { courseSlug: item.courseSlug, date: item.date, time: item.time }
          return (
            <div
              key={`${item.courseSlug}-${item.time}`}
              className="grid items-stretch rounded-2xl border border-white/15 bg-white/[0.02] p-4"
              style={{ gridTemplateColumns: KIOSK_TOKENS.gridColumns }}
            >
              <div className="relative min-h-[148px] pr-5">
                <span aria-hidden="true" className="absolute inset-y-2 right-0 w-px bg-gradient-to-b from-transparent via-white/12 to-transparent" />
                <div className="relative h-full overflow-hidden rounded-2xl">
                <Image
                  src={item.imageUrl || "/images/hero-menu/live-academy.JPG"}
                  alt={item.title}
                  fill
                  unoptimized={item.imageUrl?.startsWith("/api/")}
                  sizes="18vw"
                  className="object-cover"
                />
                <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.12)_0%,rgba(0,0,0,0.08)_30%,rgba(0,0,0,0.42)_62%,rgba(0,0,0,0.94)_100%)]" />
                <span className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                  <span className="rounded-full border border-sky-300/25 bg-sky-950/70 px-2.5 py-1 text-[9px] uppercase tracking-[0.13em] text-sky-100/90">
                    {item.durationMinutes ? `${item.durationMinutes} min` : "Class"}
                  </span>
                  {item.level && (
                    <span className="rounded-full border border-emerald-300/25 bg-emerald-950/70 px-2.5 py-1 text-[9px] uppercase tracking-[0.13em] text-emerald-100/90">
                      {item.level}
                    </span>
                  )}
                </span>
                <span className="absolute inset-x-0 bottom-0 px-3 pb-3">
                  <span className="block truncate text-sm font-semibold text-white">{item.title}</span>
                  <span className="mt-0.5 block text-xs text-white/70">{formatPastCourseTime(item.time)}</span>
                </span>
                </div>
              </div>

              <div className="relative flex h-full flex-col justify-center px-5">
                <div className="grid gap-3">
                  <button
                    type="button"
                    onClick={() => onExistingClick?.(context)}
                    className="rounded-2xl border border-white/15 bg-black/20 px-4 py-3 text-left transition hover:border-white/25 hover:bg-white/[0.06]"
                  >
                    <span className="block text-sm font-semibold text-white">I am already a customer</span>
                    <span className="mt-1 block text-xs text-white/60">Enter your PIN for this class.</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNewClick?.(context)}
                    className="rounded-2xl border border-white/15 bg-black/20 px-4 py-3 text-left transition hover:border-white/25 hover:bg-white/[0.06]"
                  >
                    <span className="block text-sm font-semibold text-white">I am new</span>
                    <span className="mt-1 block text-xs text-white/60">Create account and purchase.</span>
                  </button>
                </div>
              </div>

              <div className="relative flex items-center justify-center pl-5">
                <span aria-hidden="true" className="absolute inset-y-2 left-0 w-px bg-gradient-to-b from-transparent via-white/12 to-transparent" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.qrImageUrl}
                  alt={`${item.title} QR code`}
                  className="h-36 w-36 rounded-2xl border border-white/15 bg-white object-contain lg:h-40 lg:w-40"
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatPastCourseTime(time: string) {
  const [hour, minute] = time.split(":").map(Number)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return time
  const suffix = hour >= 12 ? "PM" : "AM"
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`
}

/**
 * Split layout container with configurable grid
 */
function SplitLayout({
  children,
  compact
}: {
  children: React.ReactNode
  compact: boolean
}) {
  if (compact) {
    return (
      <div
        className="grid items-center"
        style={{
          gridTemplateColumns: KIOSK_TOKENS.gridColumns,
          gap: KIOSK_TOKENS.gap,
        }}
      >
        {children}
      </div>
    )
  }

  return (
    <div className="grid items-stretch gap-5 md:grid-cols-[minmax(0,1fr)_1px_16rem] md:gap-5 lg:grid-cols-[minmax(0,1fr)_1px_18rem] lg:gap-6">
      {children}
    </div>
  )
}

/**
 * Visual divider with kiosk-specific accent styling
 */
function Divider({ compact }: { compact: boolean }) {
  // Standard divider for non-kiosk mode
  if (!compact) {
    return (
      <div 
        className="hidden h-full w-px bg-white/15 md:block" 
        aria-hidden="true"
      />
    )
  }

  // Kiosk terminal accent divider - centered vertically
  return (
    <div
      className="hidden self-center md:block"
      aria-hidden="true"
      style={{
        height: KIOSK_TOKENS.divider.height,
        width: KIOSK_TOKENS.divider.width,
        marginLeft: KIOSK_TOKENS.divider.offsetLeft,
        backgroundColor: KIOSK_TOKENS.divider.color,
      }}
    />
  )
}

function ActionSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-full flex-col px-4 py-1">
      <ColumnDivider side="left" />
      <p className="mb-5 text-center text-xs uppercase tracking-[0.2em] text-white/55">
        Continue here
      </p>
      <div className="flex min-h-[238px] flex-col justify-center">{children}</div>
    </div>
  )
}

function ColumnDivider({ side }: { side: "left" }) {
  return (
    <span
      aria-hidden="true"
      className="absolute left-0 top-[3.3rem] h-[196px] w-px bg-gradient-to-b from-transparent via-white/12 to-transparent"
    />
  )
}

/**
 * QR Code section with scan instructions
 */
function QrSection({ 
  qrImage, 
  compact,
  actionSlot,
}: { 
  qrImage: string | undefined
  compact: boolean 
  actionSlot?: React.ReactNode
}) {
  if (!qrImage) return null
  return (
    <div className={cn(
      "flex h-full flex-col items-center text-center",
      compact ? "md:pt-1 lg:pt-2" : "md:pt-2 lg:pt-6"
    )}>
      <p className="text-xs uppercase tracking-[0.2em] text-white/60">
        Scan QR code
      </p>
      <div className="flex min-h-[238px] items-center justify-center">
      
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={qrImage}
        alt="Check-in QR code"
        className={cn(
          "mt-4 rounded-2xl border border-white/15 bg-white object-contain",
          compact ? "h-48 w-48 lg:h-52 lg:w-52" : "h-48 w-48 lg:h-56 lg:w-56"
        )}
      />
      </div>
      
      {actionSlot && <div className="mt-4 w-full max-w-[22rem]">{actionSlot}</div>}
    </div>
  )
}

function CourseCardContent({
  cardImage,
  courseTitle,
  category,
  badge,
  duration,
  students,
  description,
  teacher,
  displayDate,
  displayTime,
  variant,
  compact = false,
}: {
  cardImage: string
  courseTitle: string
  category: string
  badge: string
  duration: string
  students: string
  description: string
  teacher: string
  displayDate: string
  displayTime: string
  variant: "split" | "compact"
  compact?: boolean
}) {
  const isSplit = variant === "split"
  const classDateTimeLabel = formatTerminalClassDateTime(displayDate, displayTime)

  return (
    <article className={`flex h-full min-h-full flex-col ${isSplit ? "" : "overflow-hidden rounded-2xl border border-white/15 bg-[linear-gradient(150deg,rgba(3,5,12,0.96),rgba(10,14,28,0.96))]"}`}>
      {isSplit && <p className="mb-5 text-xs uppercase tracking-[0.2em] text-white/60">Current Course</p>}
        <div className={`${isSplit ? "flex-1 overflow-hidden rounded-2xl border border-white/15 bg-[linear-gradient(150deg,rgba(3,5,12,0.96),rgba(10,14,28,0.96))]" : ""}`}>
        <div className={`grid h-full ${isSplit ? "grid-cols-1 xl:grid-cols-[0.72fr_1.28fr]" : "grid-cols-[0.92fr_1.08fr] sm:grid-cols-[0.9fr_1.1fr]"}`}>
          <div className={`relative ${isSplit ? (compact ? "min-h-[132px] xl:h-full xl:min-h-0" : "min-h-[220px] xl:h-full xl:min-h-0") : "min-h-[18rem]"}`}>
            <Image
              src={cardImage}
              alt={courseTitle}
              fill
              unoptimized={cardImage.startsWith("/api/")}
              sizes={isSplit
                ? "(max-width: 767px) 100vw, (max-width: 1279px) 38vw, 32vw"
                : "(max-width: 640px) 42vw, 32vw"
              }
              className="object-cover"
            />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.16)_0%,rgba(0,0,0,0.08)_30%,rgba(0,0,0,0.36)_58%,rgba(0,0,0,0.94)_100%)]" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-[radial-gradient(90%_95%_at_50%_100%,rgba(0,0,0,0.88),transparent_72%)]" />
            <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[color-mix(in_oklab,var(--color-sky-300)_30%,transparent)] bg-[color-mix(in_oklab,oklch(0.34_0.09_239.14)_70%,transparent)] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-sky-100/90 backdrop-blur-sm">
                {duration}
              </span>
              <span className="rounded-full border border-[color-mix(in_oklab,var(--color-emerald-300)_30%,transparent)] bg-[color-mix(in_oklab,oklch(0.34_0.08_163.27)_70%,transparent)] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-emerald-100/90 backdrop-blur-sm">
                {students}
              </span>
              <span className="rounded-full border border-[color-mix(in_oklab,#ff4242_30%,transparent)] bg-[color-mix(in_oklab,oklch(0.37_0.16_28.11)_70%,transparent)] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-red-100/90 backdrop-blur-sm">
                {teacher}
              </span>
            </div>
            <div className="absolute inset-x-0 bottom-0 px-3 pb-3">
            </div>
          </div>
            <div className={`relative flex h-full flex-col justify-between ${isSplit ? (compact ? "p-3 sm:p-4" : "p-4 sm:p-5") : "min-h-[18rem] p-3 sm:p-5"}`}>
              <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/28 to-transparent" />
              <div>
              <h3 className={`font-semibold leading-tight text-white ${isSplit ? (compact ? "text-base" : "text-2xl") : "text-xl sm:text-2xl"}`}>
                {courseTitle}
              </h3>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full border border-white/15 bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/85">
                  $20 drop-in
                </span>
                <span className="rounded-full border border-emerald-300/25 bg-emerald-400/[0.10] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-100/90">
                  $15 first time
                </span>
              </div>
              <p className={`mt-2 text-white/75 ${isSplit ? "text-sm" : "text-xs sm:text-sm"}`}>{classDateTimeLabel}</p>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
