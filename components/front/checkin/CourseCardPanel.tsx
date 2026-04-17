import Image from "next/image"
import { cn } from "@/lib/utils"

/**
 * Design tokens for kiosk terminal layout
 * These values are extracted here for maintainability and consistency
 */
const KIOSK_TOKENS = {
  // Grid ratio: 60% course content / 40% QR
  gridColumns: "4fr auto 1.5fr",
  
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
  compact?: boolean
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
  compact = false,
}: CourseCardPanelProps) {
  const hasQr = Boolean(qrImage)

  if (hasQr) {
    return (
      <div 
        className={cn(
          "rounded-2xl border border-white/15 bg-white/[0.02]",
          compact
            ? "mx-[1.25rem] my-0 mt-3 p-4"
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
          <QrSection qrImage={qrImage} compact={compact} />
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

/**
 * QR Code section with scan instructions
 */
function QrSection({ 
  qrImage, 
  compact 
}: { 
  qrImage: string | undefined
  compact: boolean 
}) {
  if (!qrImage) return null
  return (
    <div className={cn(
      "flex h-full flex-col items-center justify-center text-center",
      compact ? "md:pt-1 lg:pt-2" : "md:pt-2 lg:pt-6"
    )}>
      <p className="text-xs uppercase tracking-[0.2em] text-white/60">
        QR Code
      </p>
      
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={qrImage}
        alt="Check-in QR code"
        className={cn(
          "mt-4 rounded-2xl border border-white/15 bg-white object-contain",
          compact ? "h-44 w-44" : "h-48 w-48 lg:h-56 lg:w-56"
        )}
      />
      
      <p className={cn(
        "max-w-[17rem] font-medium leading-relaxed text-white/82",
        compact ? "mt-2 text-xs" : "mt-4 text-base"
      )}>
        scan this code to continue the check-in process
      </p>
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

  return (
    <article className={`flex h-full flex-col ${isSplit ? "" : "overflow-hidden rounded-2xl border border-white/15 bg-[linear-gradient(150deg,rgba(3,5,12,0.96),rgba(10,14,28,0.96))]"}`}>
      {isSplit && <p className="text-xs uppercase tracking-[0.2em] text-white/60">Current Course</p>}
      <div className={`${isSplit ? "mt-2 flex-1 overflow-hidden rounded-2xl border border-white/15 bg-[linear-gradient(150deg,rgba(3,5,12,0.96),rgba(10,14,28,0.96))]" : ""}`}>
        <div className={`grid h-full ${isSplit ? "grid-cols-1 xl:grid-cols-[0.9fr_1.1fr]" : "grid-cols-[0.92fr_1.08fr] sm:grid-cols-[0.9fr_1.1fr]"}`}>
          <div className={`relative ${isSplit ? (compact ? "min-h-[120px] xl:h-full xl:min-h-0" : "min-h-[220px] xl:h-full xl:min-h-0") : "min-h-[18rem]"}`}>
            <Image
              src={cardImage}
              alt={courseTitle}
              fill
              sizes={isSplit
                ? "(max-width: 767px) 100vw, (max-width: 1279px) 38vw, 32vw"
                : "(max-width: 640px) 42vw, 32vw"
              }
              className="object-cover"
            />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.05),rgba(0,0,0,0.62))]" />
            <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[var(--brand,#b61616)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
                {category}
              </span>
              <span className="rounded-full border border-white/25 bg-black/45 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/85">
                {badge}
              </span>
            </div>
            <div className="absolute inset-x-0 bottom-0 px-3 pb-3">
              <div className="flex flex-wrap gap-2 text-xs text-white/85">
                <span className="rounded-full border border-white/20 bg-black/45 px-2.5 py-1">{duration}</span>
                <span className="rounded-full border border-white/20 bg-black/45 px-2.5 py-1">{students}</span>
              </div>
            </div>
          </div>
          <div className={`flex h-full flex-col justify-between ${isSplit ? "p-4 sm:p-5" : "min-h-[18rem] p-3 sm:p-5"}`}>
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--brand,#ff4b4b)]">{category}</p>
              <h3 className={`mt-2 font-semibold leading-tight text-white ${isSplit ? "text-2xl" : "text-xl sm:text-2xl"}`}>
                {courseTitle}
              </h3>
              <p className={`mt-2 text-white/75 ${isSplit ? "text-sm" : "text-xs sm:text-sm"}`}>{displayDate} {displayTime}</p>
              <p className="mt-4 text-sm leading-relaxed text-white/76">{description}</p>
            </div>
            <div className={`mt-5 flex flex-wrap gap-2 text-xs text-white/78 ${isSplit ? "" : "mt-4"}`}>
              <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1">Instructor: {teacher}</span>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
