import React from "react"

import { POINTS_RULE_DEFINITIONS } from "@/lib/points/constants"
import type {
  AssignmentCourseOption,
  PackageFormState,
  PackagePlanStatus,
  PackageStatusFilter,
  PointsAssignFormState,
  PointsRuleFormState,
  PointsRuleRow,
  SchoolPackageRow,
} from "./staffAdminTypes"
import {
  createEmptyPackageForm,
  duplicatePackageRowToFormState,
  getPackageLifecycleStatus,
  packageRowToFormState,
} from "./staffPaymentFilters"
import { formatUsdInputLabel } from "./staffAdminFormatters"

type SchoolWizardEntity = "rooms" | "courses" | "packages" | "points"

type PackageCounts = Record<PackageStatusFilter | "live", number>

type PointsRuleTemplate = (typeof POINTS_RULE_DEFINITIONS)[number] | null | undefined

type StaffSchoolPackagesPointsPanelProps = {
  wizard: {
    activeEntity: SchoolWizardEntity
    step: number
    totalSteps: number
    onPrevious: () => void
    onNext: () => void
  }
  schoolLoading: boolean
  schoolBusy: string | null
  currentRole: string
  packages: {
    form: PackageFormState
    setForm: React.Dispatch<React.SetStateAction<PackageFormState>>
    editingPackageId: string | null
    setEditingPackageId: (value: string | null) => void
    courseOptions: AssignmentCourseOption[]
    togglePackageCourse: (courseSlug: string) => void
    onSave: (event: React.FormEvent<HTMLFormElement>) => void
    statusFilter: PackageStatusFilter
    setStatusFilter: (value: PackageStatusFilter) => void
    searchQuery: string
    setSearchQuery: (value: string) => void
    counts: PackageCounts
    filteredItems: SchoolPackageRow[]
    setLifecycleState: (item: SchoolPackageRow, status: PackagePlanStatus) => Promise<void>
    deletePackagePlan: (item: SchoolPackageRow) => Promise<void>
    formatMoney: (amountCents: number) => string
  }
  points: {
    ruleForm: PointsRuleFormState
    setRuleForm: React.Dispatch<React.SetStateAction<PointsRuleFormState>>
    selectedTemplate: PointsRuleTemplate
    onSaveRule: (event: React.FormEvent<HTMLFormElement>) => void
    resetRuleForm: () => void
    assignForm: PointsAssignFormState
    setAssignForm: React.Dispatch<React.SetStateAction<PointsAssignFormState>>
    onAssign: (event: React.FormEvent<HTMLFormElement>) => void
    resetAssignForm: () => void
    rules: PointsRuleRow[]
  }
}

export default function StaffSchoolPackagesPointsPanel({
  wizard,
  schoolLoading,
  schoolBusy,
  currentRole,
  packages,
  points,
}: StaffSchoolPackagesPointsPanelProps) {
  if (wizard.activeEntity !== "packages" && wizard.activeEntity !== "points") return null

  return (
    <div className="grid gap-4">
      <PackagesPanel
        visible={wizard.activeEntity === "packages"}
        step={wizard.step}
        totalSteps={wizard.totalSteps}
        onPrevious={wizard.onPrevious}
        onNext={wizard.onNext}
        schoolLoading={schoolLoading}
        schoolBusy={schoolBusy}
        currentRole={currentRole}
        packages={packages}
      />
      <PointsPanel
        visible={wizard.activeEntity === "points"}
        step={wizard.step}
        totalSteps={wizard.totalSteps}
        onPrevious={wizard.onPrevious}
        onNext={wizard.onNext}
        schoolLoading={schoolLoading}
        schoolBusy={schoolBusy}
        points={points}
      />
    </div>
  )
}

function PackagesPanel({
  visible,
  step,
  totalSteps,
  onPrevious,
  onNext,
  schoolLoading,
  schoolBusy,
  currentRole,
  packages,
}: {
  visible: boolean
  step: number
  totalSteps: number
  onPrevious: () => void
  onNext: () => void
  schoolLoading: boolean
  schoolBusy: string | null
  currentRole: string
  packages: StaffSchoolPackagesPointsPanelProps["packages"]
}) {
  if (!visible) return null
  const { form, setForm, editingPackageId, setEditingPackageId } = packages

  return (
    <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
      <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Package builder</p>
      <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">
        {step === 0 ? "Package information" : step === 1 ? "Assign courses" : step === 2 ? "Pricing and credits" : "Validity and status"}
      </h3>

      <form onSubmit={packages.onSave} className="mt-4 space-y-5">
        <div className="flex items-center justify-between gap-3 rounded-md border border-black/10 bg-black/[0.03] px-3 py-2 text-[11px] text-black/70 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/70">
          <span>{editingPackageId ? "Editing existing package" : "Create a package tied to one course."}</span>
          {editingPackageId ? (
            <button
              type="button"
              onClick={() => {
                setEditingPackageId(null)
                setForm(createEmptyPackageForm())
              }}
              className="font-semibold text-[var(--brand,#b61616)]"
            >
              New package
            </button>
          ) : null}
        </div>

        <PackageInfoStep visible={step === 0 || step === 1} showCourses={step === 1} packages={packages} />
        <PackagePricingStep visible={step === 2} form={form} setForm={setForm} />
        <PackageValidityStep
          visible={step === 3}
          form={form}
          setForm={setForm}
          schoolBusy={schoolBusy}
          editingPackageId={editingPackageId}
          setEditingPackageId={setEditingPackageId}
        />
      </form>

      <WizardFooter step={step} totalSteps={totalSteps} onPrevious={onPrevious} onNext={onNext} className="mt-6 border-t border-black/10 pt-4 dark:border-white/10" />

      <PackageCatalog
        schoolLoading={schoolLoading}
        schoolBusy={schoolBusy}
        currentRole={currentRole}
        packages={packages}
      />
    </article>
  )
}

function PackageInfoStep({ visible, showCourses, packages }: { visible: boolean; showCourses: boolean; packages: StaffSchoolPackagesPointsPanelProps["packages"] }) {
  if (!visible) return null
  const { form, setForm, editingPackageId, courseOptions, togglePackageCourse } = packages

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <input
        name="packageKey"
        value={form.key}
        onChange={(event) => setForm((prev) => ({ ...prev, key: event.target.value }))}
        placeholder="Key (e.g., morning-3-week)"
        className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
        required
        disabled={editingPackageId !== null}
      />
      <input
        name="packageLabel"
        value={form.label}
        onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))}
        placeholder="Label"
        className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
        required
      />
      <input
        name="packageDescription"
        value={form.description}
        onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
        placeholder="Description (optional)"
        className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
      />
      {showCourses ? <div className="md:col-span-3">
        <label className="mb-2 block text-xs font-medium text-black/70 dark:text-white/70">
          Courses <span className="text-[var(--brand,#b61616)]">*</span>
        </label>
        <div className="grid grid-cols-6 gap-2">
          {courseOptions.map((course, index) => {
            const active = form.courseSlugs.includes(course.slug)
            const spanClass = resolveCourseCardSpanClass(courseOptions.length, index)
            return (
              <button
                key={`package-course-${course.slug}`}
                type="button"
                onClick={() => togglePackageCourse(course.slug)}
                className={`rounded-xl border px-3 py-3 text-left text-sm transition ${spanClass} ${
                  active
                    ? "border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/12 text-[var(--brand,#ff4b4b)] shadow-[0_10px_24px_-18px_rgba(182,22,22,0.85)]"
                    : "border-black/15 bg-white/80 text-black/80 dark:border-white/15 dark:bg-white/5 dark:text-white/80"
                }`}
              >
                <CourseOptionCard course={course} active={active} />
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-black/60 dark:text-white/60">
          {form.courseSlugs.length > 0
            ? `${form.courseSlugs.length} course${form.courseSlugs.length > 1 ? "s" : ""} assigned to this package.`
            : "No courses selected yet."}
        </p>
      </div> : null}
    </div>
  )
}

function PackagePricingStep({
  visible,
  form,
  setForm,
}: {
  visible: boolean
  form: PackageFormState
  setForm: React.Dispatch<React.SetStateAction<PackageFormState>>
}) {
  if (!visible) return null
  return (
    <div>
      <div className="grid gap-2 md:grid-cols-4">
        <input name="packagePriceCents" type="text" inputMode="decimal" value={form.priceCents} onChange={(event) => setForm((prev) => ({ ...prev, priceCents: event.target.value }))} placeholder="Price (e.g., 145.50)" className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white" />
        <input name="packageTotalCredits" type="number" min={0} value={form.totalCredits} onChange={(event) => setForm((prev) => ({ ...prev, totalCredits: event.target.value }))} placeholder="Classes included" className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white" disabled={form.isUnlimited} />
        <input name="packageMakeUps" type="number" min={0} value={form.makeUps || ""} onChange={(event) => setForm((prev) => ({ ...prev, makeUps: event.target.value }))} placeholder="Extra make-up classes" className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white" />
        <label className="inline-flex items-center gap-2 rounded-md border border-black/15 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-white/5 dark:text-white">
          <input name="packageIsUnlimited" type="checkbox" checked={form.isUnlimited} onChange={(event) => setForm((prev) => ({ ...prev, isUnlimited: event.target.checked }))} />
          Unlimited
        </label>
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-4">
        <p className="text-[11px] text-black/70 dark:text-white/70">Public price preview: <span className="font-semibold text-black dark:text-white">{formatUsdInputLabel(form.priceCents)}</span></p>
        <p className="text-[11px] text-black/70 dark:text-white/70"><span className="font-semibold text-black dark:text-white">Classes included</span> is the base number of classes in the package. <span className="font-semibold text-black dark:text-white">Make-ups</span> add extra usable classes on top of that total.</p>
      </div>
    </div>
  )
}

function PackageValidityStep({
  visible,
  form,
  setForm,
  schoolBusy,
  editingPackageId,
  setEditingPackageId,
}: {
  visible: boolean
  form: PackageFormState
  setForm: React.Dispatch<React.SetStateAction<PackageFormState>>
  schoolBusy: string | null
  editingPackageId: string | null
  setEditingPackageId: (value: string | null) => void
}) {
  if (!visible) return null
  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-3">
        <input name="packageValidDays" type="number" min={1} value={form.validDays} onChange={(event) => setForm((prev) => ({ ...prev, validDays: event.target.value }))} placeholder="Validity days" className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white" />
        <select
          name="packageStatus"
          value={form.status}
          onChange={(event) => {
            const nextStatus = event.target.value as PackagePlanStatus
            setForm((prev) => ({ ...prev, status: nextStatus, active: nextStatus === "ACTIVE", launchAt: nextStatus === "SCHEDULED" ? prev.launchAt : "" }))
          }}
          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
        >
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="DELETED">Deleted</option>
        </select>
        <input name="packageLaunchAt" type="datetime-local" value={form.launchAt} onChange={(event) => setForm((prev) => ({ ...prev, launchAt: event.target.value, status: "SCHEDULED", active: false }))} disabled={form.status !== "SCHEDULED"} className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:text-white" />
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-4">
        <p className="text-[11px] text-black/70 dark:text-white/70">Lifecycle: <span className="font-semibold text-black dark:text-white">{form.status}</span></p>
        <p className="text-[11px] text-black/70 dark:text-white/70"><span className="font-semibold text-black dark:text-white">Active</span> shows in the catalog. <span className="font-semibold text-black dark:text-white">Suspended</span> hides it. <span className="font-semibold text-black dark:text-white">Scheduled</span> waits for the launch date. <span className="font-semibold text-black dark:text-white">Deleted</span> hides it from the default admin view.</p>
      </div>
      {form.status === "SCHEDULED" ? (
        <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-200">
          This package will stay hidden until the launch date arrives. Use a future date, or switch back to <span className="font-semibold">Active</span> to publish now.
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <button type="submit" disabled={schoolBusy !== null} className="inline-flex w-full items-center justify-center rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60">
          {schoolBusy === "package" ? "Saving..." : editingPackageId ? "Update package" : "Save package"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditingPackageId(null)
            setForm(createEmptyPackageForm())
          }}
          disabled={schoolBusy !== null}
          className="inline-flex w-full items-center justify-center rounded-md border border-black/10 px-4 py-2 text-sm font-semibold text-black transition hover:bg-black/5 disabled:opacity-60 dark:border-white/10 dark:text-white dark:hover:bg-white/5"
        >
          Reset package
        </button>
      </div>
    </div>
  )
}

function PackageCatalog({
  schoolLoading,
  schoolBusy,
  currentRole,
  packages,
}: {
  schoolLoading: boolean
  schoolBusy: string | null
  currentRole: string
  packages: StaffSchoolPackagesPointsPanelProps["packages"]
}) {
  return (
    <>
      <header className="mb-4 mt-6 border-t border-black/10 pt-4 dark:border-white/10">
        <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Package catalog</p>
        <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Saved packages</h3>
      </header>
      <div className="max-h-[32rem] overflow-y-auto rounded-xl border border-black/10 bg-white/60 p-3 text-xs dark:border-white/10 dark:bg-white/[0.02]">
        <PackageCatalogFilters packages={packages} />
        {packages.statusFilter === "all" && packages.counts.DELETED > 0 ? (
          <p className="mb-2 text-[11px] text-black/55 dark:text-white/55">Deleted packages are hidden from the default view. Open the <span className="font-semibold">Deleted</span> filter to review or restore them.</p>
        ) : null}
        {schoolLoading ? <p className="text-black/60 dark:text-white/60">Loading packages...</p> : null}
        {!schoolLoading && packages.filteredItems.length === 0 ? <p className="text-black/60 dark:text-white/60">No packages created yet.</p> : null}
        {!schoolLoading && packages.filteredItems.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-3">
            {packages.filteredItems.map((item) => (
              <PackageCatalogCard key={`package-row-${item.id}`} item={item} schoolBusy={schoolBusy} currentRole={currentRole} packages={packages} />
            ))}
          </div>
        ) : null}
      </div>
    </>
  )
}

function PackageCatalogFilters({ packages }: { packages: StaffSchoolPackagesPointsPanelProps["packages"] }) {
  return (
    <div className="mb-3 flex items-center gap-3 pb-1">
      <div className="flex flex-nowrap gap-2">
        {([
          ["all", `Live (${packages.counts.live})`],
          ["ACTIVE", `Active (${packages.counts.ACTIVE})`],
          ["SUSPENDED", `Suspended (${packages.counts.SUSPENDED})`],
          ["SCHEDULED", `Scheduled (${packages.counts.SCHEDULED})`],
          ["DELETED", `Deleted (${packages.counts.DELETED})`],
        ] as const).map(([value, label]) => {
          const selected = packages.statusFilter === value
          return (
            <button key={`package-filter-${value}`} type="button" onClick={() => packages.setStatusFilter(value)} className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${selected ? "border-[var(--brand,#b61616)] bg-[var(--brand,#b61616)] text-white" : "border-black/10 text-black/70 hover:bg-black/5 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/5"}`}>{label}</button>
          )
        })}
      </div>
      <input type="search" value={packages.searchQuery} onChange={(event) => packages.setSearchQuery(event.target.value)} placeholder="Search packages" className="ml-auto w-full min-w-0 flex-1 rounded-full border border-black/10 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/10 dark:bg-white/5 dark:text-white" />
    </div>
  )
}

function PackageCatalogCard({ item, schoolBusy, currentRole, packages }: { item: SchoolPackageRow; schoolBusy: string | null; currentRole: string; packages: StaffSchoolPackagesPointsPanelProps["packages"] }) {
  const status = getPackageLifecycleStatus(item)
  return (
    <div className="flex h-full flex-col rounded-xl border border-black/10 bg-black/[0.03] px-3 py-3 dark:border-white/10 dark:bg-white/[0.02]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-black dark:text-white">{item.label}</p>
          <p className="truncate text-black/65 dark:text-white/65">{item.key} · {item.courseSlug || "no course"}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${getPackageLifecycleBadgeClass(status)}`}>{status}</span>
      </div>
      <div className="mt-3 grid w-full grid-cols-2 gap-x-6 gap-y-3 text-xs text-black/70 dark:text-white/70">
        <PackageMetric label="Price" value={item.priceCents === null ? "—" : packages.formatMoney(item.priceCents)} />
        <PackageMetric label="Classes" value={item.totalCredits ?? "∞"} />
        <PackageMetric label="Make-ups" value={item.makeUps} />
        <PackageMetric label="Valid" value={`${item.validDays} days`} />
      </div>
      <div className="mt-4 space-y-2 border-t border-black/10 pt-3 dark:border-white/10">
        {item.cadence ? <p className="text-[11px] text-black/55 dark:text-white/55">Cadence: {item.cadence}</p> : null}
        <p className="text-[11px] text-black/55 dark:text-white/55">Public visibility: {status === "ACTIVE" ? "Shown in catalog" : "Hidden from catalog"}</p>
        {item.launchAt ? <p className="text-[11px] text-black/55 dark:text-white/55">Launch date: {formatPackageLaunchLabel(item.launchAt) || String(item.launchAt).replace("T", " ").slice(0, 16)}</p> : null}
      </div>
      <PackageCatalogActions item={item} status={status} schoolBusy={schoolBusy} currentRole={currentRole} packages={packages} />
    </div>
  )
}

function PackageMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="min-w-0 text-center"><p className="font-medium text-black/55 dark:text-white/55">{label}</p><p className="mt-1 text-sm font-semibold text-black/90 dark:text-white/90">{value}</p></div>
}

function PackageCatalogActions({ item, status, schoolBusy, currentRole, packages }: { item: SchoolPackageRow; status: PackagePlanStatus; schoolBusy: string | null; currentRole: string; packages: StaffSchoolPackagesPointsPanelProps["packages"] }) {
  return (
    <div className="mt-4 flex flex-nowrap gap-1.5 border-t border-black/10 pt-3 dark:border-white/10">
      <button type="button" onClick={() => { packages.setEditingPackageId(item.id); packages.setForm(packageRowToFormState(item)) }} className="rounded-md border border-black/10 px-1.5 py-0.5 text-[10px] font-semibold text-black transition hover:bg-black/5 dark:border-white/10 dark:text-white dark:hover:bg-white/5">Edit</button>
      <button type="button" onClick={() => { packages.setEditingPackageId(null); packages.setForm(duplicatePackageRowToFormState(item)) }} className="rounded-md border border-black/10 px-1.5 py-0.5 text-[10px] font-semibold text-black transition hover:bg-black/5 dark:border-white/10 dark:text-white dark:hover:bg-white/5">Duplicate</button>
      {status === "DELETED" ? (
        <button type="button" disabled={schoolBusy !== null} onClick={() => void packages.setLifecycleState(item, "ACTIVE")} className="rounded-md border border-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 transition hover:bg-emerald-500/10 disabled:opacity-60 dark:border-emerald-400/20 dark:text-emerald-300 dark:hover:bg-emerald-400/10">Restore</button>
      ) : (
        <>
          {status === "SCHEDULED" ? <button type="button" disabled={schoolBusy !== null} onClick={() => void packages.setLifecycleState(item, "ACTIVE")} className="rounded-md border border-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 transition hover:bg-amber-500/10 disabled:opacity-60 dark:border-amber-400/20 dark:text-amber-300 dark:hover:bg-amber-400/10">Launch now</button> : null}
          <button type="button" disabled={schoolBusy !== null} onClick={() => void packages.setLifecycleState(item, status === "ACTIVE" ? "SUSPENDED" : "ACTIVE")} className="rounded-md border border-black/10 px-1.5 py-0.5 text-[10px] font-semibold text-black transition hover:bg-black/5 disabled:opacity-60 dark:border-white/10 dark:text-white dark:hover:bg-white/5">{status === "ACTIVE" ? "Hold" : "Activate"}</button>
          {currentRole === "owner" ? <button type="button" disabled={schoolBusy !== null} onClick={() => void packages.deletePackagePlan(item)} className="rounded-md border border-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 transition hover:bg-rose-500/10 disabled:opacity-60 dark:border-rose-400/20 dark:text-rose-300 dark:hover:bg-rose-400/10">Delete</button> : null}
        </>
      )}
    </div>
  )
}

function PointsPanel({ visible, step, totalSteps, onPrevious, onNext, schoolLoading, schoolBusy, points }: { visible: boolean; step: number; totalSteps: number; onPrevious: () => void; onNext: () => void; schoolLoading: boolean; schoolBusy: string | null; points: StaffSchoolPackagesPointsPanelProps["points"] }) {
  if (!visible) return null
  return (
    <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
      <PointsRuleStep visible={step === 0} schoolBusy={schoolBusy} points={points} />
      <PointsAssignStep visible={step === 1} schoolBusy={schoolBusy} points={points} />
      <WizardFooter step={step} totalSteps={totalSteps} onPrevious={onPrevious} onNext={onNext} className="mt-4" />
      <header className="mb-4 mt-6 border-t border-black/10 pt-4 dark:border-white/10">
        <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Points catalog</p>
        <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Saved rules</h3>
      </header>
      <div className="max-h-[32rem] overflow-y-auto rounded-xl border border-black/10 bg-white/60 p-3 text-xs dark:border-white/10 dark:bg-white/[0.02]">
        {schoolLoading ? <p className="text-black/60 dark:text-white/60">Loading rules...</p> : null}
        {!schoolLoading && points.rules.length === 0 ? <p className="text-black/60 dark:text-white/60">No rules defined.</p> : null}
        {!schoolLoading && points.rules.length > 0 ? <div className="space-y-2">{points.rules.map((item) => <PointsRuleRow key={`points-rule-row-${item.id}`} item={item} />)}</div> : null}
      </div>
    </article>
  )
}

function PointsRuleStep({ visible, schoolBusy, points }: { visible: boolean; schoolBusy: string | null; points: StaffSchoolPackagesPointsPanelProps["points"] }) {
  if (!visible) return null
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Points builder</p>
      <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Rule builder</h3>
      <p className="mt-1 text-sm text-black/65 dark:text-white/65">Configure automatic point rules for attendance, referrals, and other events.</p>
      <form onSubmit={points.onSaveRule} className="mt-3 space-y-2">
        <div className="grid grid-cols-[minmax(180px,0.9fr)_minmax(0,1fr)_110px_140px] gap-2">
          <select name="pointsRuleTemplate" value={points.ruleForm.templateKey} onChange={(event) => points.setRuleForm((prev) => ({ ...prev, templateKey: event.target.value }))} className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white">
            {POINTS_RULE_DEFINITIONS.map((item) => <option key={`points-template-${item.key}`} value={item.key}>{item.label}</option>)}
          </select>
          <input name="pointsRuleEventType" value={points.selectedTemplate?.eventType || ""} readOnly className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white" />
          <input name="pointsRulePoints" type="number" step="0.5" value={points.ruleForm.points} onChange={(event) => points.setRuleForm((prev) => ({ ...prev, points: event.target.value }))} placeholder="Points" className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white" required />
          <label className="inline-flex h-full items-center justify-center gap-2 rounded-md border border-black/10 bg-white/60 px-3 py-2 text-xs dark:border-white/10 dark:bg-white/[0.02]"><input name="pointsRuleActive" type="checkbox" checked={points.ruleForm.active} onChange={(event) => points.setRuleForm((prev) => ({ ...prev, active: event.target.checked }))} />Active rule</label>
        </div>
        <p className="rounded-md border border-black/10 bg-white/60 px-3 py-2 text-xs text-black/70 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/70">{points.selectedTemplate?.description || "Select a rule to configure points."}</p>
        <div className="grid grid-cols-2 gap-2"><button type="submit" disabled={schoolBusy !== null} className="inline-flex w-full items-center justify-center rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60">{schoolBusy === "rule" ? "Saving..." : "Save rule"}</button><button type="button" disabled={schoolBusy !== null} onClick={points.resetRuleForm} className="inline-flex w-full items-center justify-center rounded-md border border-black/15 bg-white/70 px-4 py-2 text-sm font-semibold text-black transition hover:bg-white disabled:opacity-60 dark:border-white/15 dark:bg-white/[0.06] dark:text-white dark:hover:bg-white/[0.1]">Reset</button></div>
      </form>
    </div>
  )
}

function PointsAssignStep({ visible, schoolBusy, points }: { visible: boolean; schoolBusy: string | null; points: StaffSchoolPackagesPointsPanelProps["points"] }) {
  if (!visible) return null
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Points</p><h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Manual assignment</h3><p className="mt-1 text-sm text-black/65 dark:text-white/65">Assign points directly to a student by email.</p>
      <form onSubmit={points.onAssign} className="mt-3 space-y-3 rounded-md border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.02]">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <input name="pointsAssignUserEmail" type="email" value={points.assignForm.userEmail} onChange={(event) => points.setAssignForm((prev) => ({ ...prev, userEmail: event.target.value }))} placeholder="Student email" className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white" required />
          <input name="pointsAssignType" value={points.assignForm.type} onChange={(event) => points.setAssignForm((prev) => ({ ...prev, type: event.target.value }))} placeholder="Type" className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white" required />
          <input name="pointsAssignPoints" type="number" step="0.5" value={points.assignForm.points} onChange={(event) => points.setAssignForm((prev) => ({ ...prev, points: event.target.value }))} placeholder="Points" className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white" required />
          <input name="pointsAssignNote" value={points.assignForm.note} onChange={(event) => points.setAssignForm((prev) => ({ ...prev, note: event.target.value }))} placeholder="Note" className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white" />
          <input name="pointsAssignEventKey" value={points.assignForm.eventKey} onChange={(event) => points.setAssignForm((prev) => ({ ...prev, eventKey: event.target.value }))} placeholder="Event key (optional)" className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white" />
        </div>
        <div className="grid grid-cols-2 gap-2"><button type="submit" disabled={schoolBusy !== null} className="inline-flex w-full items-center justify-center rounded-md border border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/15 px-4 py-2 text-sm font-semibold text-[var(--brand,#ff4b4b)] transition disabled:opacity-60">{schoolBusy === "assign" ? "Assigning..." : "Assign points"}</button><button type="button" disabled={schoolBusy !== null} onClick={points.resetAssignForm} className="inline-flex w-full items-center justify-center rounded-md border border-black/15 bg-white/70 px-4 py-2 text-sm font-semibold text-black transition hover:bg-white disabled:opacity-60 dark:border-white/15 dark:bg-white/[0.06] dark:text-white dark:hover:bg-white/[0.1]">Reset</button></div>
      </form>
    </div>
  )
}

function PointsRuleRow({ item }: { item: PointsRuleRow }) {
  return <div className="rounded-md border border-black/10 bg-black/[0.03] px-2 py-1.5 dark:border-white/10 dark:bg-white/[0.02]"><p className="font-semibold text-black dark:text-white">{item.label}</p><p className="text-black/65 dark:text-white/65">{item.eventType} · {item.points} pts · {item.active ? "active" : "inactive"}</p></div>
}

function WizardFooter({ step, totalSteps, onPrevious, onNext, className = "" }: { step: number; totalSteps: number; onPrevious: () => void; onNext: () => void; className?: string }) {
  return <div className={`flex items-center justify-between ${className}`}><button type="button" onClick={onPrevious} disabled={step === 0} className="rounded-lg border border-black/10 px-4 py-1.5 text-xs font-medium text-black/60 transition hover:bg-black/[0.04] disabled:opacity-30 dark:border-white/10 dark:text-white/60 dark:hover:bg-white/[0.04]">← Previous</button><span className="text-[10px] text-black/40 dark:text-white/40">Step {step + 1} of {totalSteps}</span><button type="button" onClick={onNext} disabled={step >= totalSteps - 1} className="rounded-lg border border-[var(--brand,#b61616)]/30 bg-[var(--brand,#b61616)]/10 px-4 py-1.5 text-xs font-medium text-[var(--brand,#ff4b4b)] transition hover:bg-[var(--brand,#b61616)]/20 disabled:opacity-30">Next →</button></div>
}

function CourseOptionCard({ course, active }: { course: AssignmentCourseOption; active: boolean }) {
  return <div className="flex items-start gap-3"><CourseThumb course={course} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className={`font-semibold ${active ? "text-[var(--brand,#b61616)] dark:text-[var(--brand,#ff7b7b)]" : "text-black dark:text-white"}`}>{course.title}</p>{course.kindLabel ? <p className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-black/45 dark:text-white/45">{course.kindLabel}</p> : null}</div><span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${active ? "border-[var(--brand,#b61616)]/40 bg-[var(--brand,#b61616)]/10 text-[var(--brand,#ff4b4b)]" : "border-black/10 bg-black/[0.04] text-black/55 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/55"}`}>{active ? "Selected" : "Available"}</span></div>{course.scheduleLabel ? <p className="mt-2 text-xs text-black/65 dark:text-white/65">{course.scheduleLabel}</p> : null}{course.description ? <p className="mt-1 line-clamp-2 text-xs text-black/60 dark:text-white/60">{course.description}</p> : null}</div></div>
}

function CourseThumb({ course }: { course: AssignmentCourseOption }) {
  if (course.imageUrl) return <div role="img" aria-label={course.title} className="h-12 w-12 rounded-xl bg-cover bg-center ring-1 ring-black/10 dark:ring-white/10" style={{ backgroundImage: `url("${course.imageUrl}")` }} />
  return <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-black/5 text-xs font-semibold uppercase text-black/50 ring-1 ring-black/10 dark:bg-white/10 dark:text-white/55 dark:ring-white/10">{course.title.split(" ").slice(0, 2).map((part) => part[0]).join("")}</div>
}

function resolveCourseCardSpanClass(total: number, index: number) {
  const remainder = total % 3
  if (remainder === 1 && index === total - 1) return "col-span-6"
  if (remainder === 2 && index >= total - 2) return "col-span-3"
  return "col-span-2"
}

function getPackageLifecycleBadgeClass(status: PackagePlanStatus) {
  switch (status) {
    case "ACTIVE": return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    case "SCHEDULED": return "bg-amber-500/15 text-amber-700 dark:text-amber-300"
    case "DELETED": return "bg-rose-500/15 text-rose-700 dark:text-rose-300"
    default: return "bg-black/10 text-black/60 dark:bg-white/10 dark:text-white/60"
  }
}

function formatPackageLaunchLabel(value: string | null | undefined) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(parsed)
}
