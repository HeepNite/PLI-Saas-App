export default function CoursePageLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-[1800px] px-0 sm:px-1 lg:px-2 xl:px-3 py-8">
        <div className="grid grid-cols-1 gap-6 lg:items-start lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)_minmax(360px,430px)]">
          {/* Left column skeleton */}
          <aside className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="h-3 w-28 rounded-full shimmer" />
              <div className="mt-4 aspect-[3/4] w-full rounded-2xl shimmer" />
              <div className="mt-4 h-4 w-2/3 rounded-full shimmer" />
              <div className="mt-2 h-3 w-1/2 rounded-full shimmer" />
              <div className="mt-4 grid grid-cols-2 gap-2">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={`left-card-${idx}`} className="h-12 rounded-lg shimmer" />
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div key={`left-pill-${idx}`} className="h-7 w-24 rounded-full shimmer" />
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="h-3 w-24 rounded-full shimmer" />
              <div className="mt-3 space-y-2">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div key={`left-prof-${idx}`} className="h-10 rounded-lg shimmer" />
                ))}
              </div>
            </div>
          </aside>

          {/* Center column skeleton */}
          <section className="space-y-6">
            <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/5 p-4">
              <div className="h-3 w-32 rounded-full shimmer" />
              <div className="mt-4 aspect-[16/9] w-full rounded-2xl shimmer" />
              <div className="mt-4 h-5 w-3/4 rounded-full shimmer" />
              <div className="mt-2 h-3 w-2/3 rounded-full shimmer" />
              <div className="mt-2 h-3 w-1/2 rounded-full shimmer" />
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="h-3 w-28 rounded-full shimmer" />
              <div className="mt-3 h-5 w-2/3 rounded-full shimmer" />
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div key={`center-card-${idx}`} className="h-28 rounded-2xl shimmer" />
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="h-3 w-28 rounded-full shimmer" />
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={`center-review-${idx}`} className="h-24 rounded-2xl shimmer" />
                ))}
              </div>
            </div>
          </section>

          {/* Right column skeleton */}
          <aside className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="h-4 w-40 rounded-full shimmer" />
              <div className="mt-3 h-10 w-full rounded-lg shimmer" />
              <div className="mt-3 h-10 w-full rounded-lg shimmer" />
              <div className="mt-3 h-10 w-full rounded-lg shimmer" />
              <div className="mt-5 h-12 w-full rounded-xl shimmer" />
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="h-4 w-28 rounded-full shimmer" />
              <div className="mt-3 space-y-2">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div key={`right-line-${idx}`} className="h-4 rounded-full shimmer" />
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
