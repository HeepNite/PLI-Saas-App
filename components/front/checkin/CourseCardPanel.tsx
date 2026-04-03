import Image from "next/image"

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
  qrImage?: string
}) {
  const hasQr = Boolean(qrImage)

  if (hasQr) {
    return (
      <div className="mt-6 rounded-2xl border border-white/15 bg-white/[0.02] px-4 py-5 sm:px-6">
        <div className="grid items-stretch gap-5 md:grid-cols-[minmax(0,1fr)_1px_16rem] md:gap-5 lg:grid-cols-[minmax(0,1fr)_1px_18rem] lg:gap-6">
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
          />
          <div className="hidden h-full w-px bg-white/15 md:block" aria-hidden />
          <div className="flex h-full flex-col items-center justify-center text-center md:pt-2 lg:pt-6">
            <p className="text-xs uppercase tracking-[0.2em] text-white/60">QR Code</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrImage}
              alt="Check-in QR"
              className="mt-4 h-48 w-48 rounded-2xl border border-white/15 bg-white object-contain lg:h-56 lg:w-56"
            />
            <p className="mt-4 max-w-[17rem] text-base font-medium leading-relaxed text-white/82">
              scan this code to continue the check-in process
            </p>
          </div>
        </div>
      </div>
    )
  }

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
      />
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
}) {
  const isSplit = variant === "split"

  return (
    <article className={`flex h-full flex-col ${isSplit ? "" : "overflow-hidden rounded-2xl border border-white/15 bg-[linear-gradient(150deg,rgba(3,5,12,0.96),rgba(10,14,28,0.96))]"}`}>
      {isSplit && <p className="text-xs uppercase tracking-[0.2em] text-white/60">Home card preview</p>}
      <div className={`${isSplit ? "mt-2 flex-1 overflow-hidden rounded-2xl border border-white/15 bg-[linear-gradient(150deg,rgba(3,5,12,0.96),rgba(10,14,28,0.96))]" : ""}`}>
        <div className={`grid h-full ${isSplit ? "grid-cols-1 xl:grid-cols-[0.9fr_1.1fr]" : "grid-cols-[0.92fr_1.08fr] sm:grid-cols-[0.9fr_1.1fr]"}`}>
          <div className={`relative ${isSplit ? "min-h-[220px] xl:h-full xl:min-h-0" : "min-h-[18rem]"}`}>
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
