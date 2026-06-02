import React from "react"

import type { StaffRole } from "@/lib/security/staff-role"
import type { StaffCategory } from "@/lib/security/staff-category"
import {
  CATEGORY_LABELS,
  CATEGORY_OPTIONS,
  getFixedCategoryForRole,
  normalizeCategoryForRole,
  ROLE_FORM_LABELS,
} from "./staffAdminConstants"

type StaffAccessCreatePanelProps = {
  showStaffOps: boolean
  form: {
    email: string
    setEmail: (value: string) => void
    firstName: string
    setFirstName: (value: string) => void
    lastName: string
    setLastName: (value: string) => void
    newRole: StaffRole
    setNewRole: (value: StaffRole) => void
    newCategory: StaffCategory
    setNewCategory: React.Dispatch<React.SetStateAction<StaffCategory>>
    newPin: string
    setNewPin: (value: string) => void
  }
  assignableRoles: StaffRole[]
  status: {
    createBusy: boolean
    createMessage: string | null
    error: string | null
  }
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}

export default function StaffAccessCreatePanel({
  showStaffOps,
  form,
  assignableRoles,
  status,
  onSubmit,
}: StaffAccessCreatePanelProps) {
  if (!showStaffOps) return null

  const fixedCategory = getFixedCategoryForRole(form.newRole)
  const categoryOptions = (fixedCategory ? [fixedCategory] : CATEGORY_OPTIONS) as StaffCategory[]

  return (
    <article
      id="staff-create"
      className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5"
    >
      <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Staff access</p>
      <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Invite or promote user</h3>
      <p className="mt-1 text-sm text-black/65 dark:text-white/65">
        Assign role and department in one step. If the user exists, we promote directly.
      </p>

      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          name="staffEmail"
          required
          value={form.email}
          onChange={(e) => form.setEmail(e.target.value)}
          placeholder="staff@email.com"
          className="min-w-0 flex-[1.5] rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
        />
        <input
          name="staffFirstName"
          value={form.firstName}
          onChange={(e) => form.setFirstName(e.target.value)}
          placeholder="First"
          className="min-w-0 flex-1 rounded-md border border-black/15 bg-white px-2 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
        />
        <input
          name="staffLastName"
          value={form.lastName}
          onChange={(e) => form.setLastName(e.target.value)}
          placeholder="Last"
          className="min-w-0 flex-1 rounded-md border border-black/15 bg-white px-2 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
        />
        <select
          name="staffRole"
          value={form.newRole}
          onChange={(e) => {
            const nextRole = e.target.value as StaffRole
            form.setNewRole(nextRole)
            form.setNewCategory((prev) => normalizeCategoryForRole(nextRole, prev))
          }}
          className="min-w-0 flex-1 rounded-md border border-black/15 bg-white px-2 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
        >
          {assignableRoles.map((role) => (
            <option key={`create-role-${role}`} value={role}>
              {ROLE_FORM_LABELS[role]}
            </option>
          ))}
        </select>
        <select
          name="staffCategory"
          value={form.newCategory}
          onChange={(e) => form.setNewCategory(e.target.value as StaffCategory)}
          disabled={Boolean(fixedCategory)}
          className="min-w-0 flex-1 rounded-md border border-black/15 bg-white px-2 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
        >
          {categoryOptions.map((category) => (
            <option key={`create-category-${category}`} value={category}>
              {CATEGORY_LABELS[category]}
            </option>
          ))}
        </select>
        <input
          name="staffPin"
          value={form.newPin}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, "").slice(0, 4)
            form.setNewPin(value)
          }}
          placeholder="PIN"
          maxLength={4}
          inputMode="numeric"
          pattern="[0-9]*"
          className="min-w-0 flex-[0.75] rounded-md border border-black/15 bg-white px-2 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
        />
        <button
          type="submit"
          disabled={status.createBusy}
          className="shrink-0 rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
        >
          {status.createBusy ? "Processing..." : "Create / invite"}
        </button>
      </form>

      {status.createMessage ? (
        <p className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {status.createMessage}
        </p>
      ) : null}

      {status.error ? (
        <p className="mt-3 rounded-md border border-[var(--brand,#b61616)]/40 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-sm text-[var(--brand,#b61616)]">
          {status.error}
        </p>
      ) : null}
    </article>
  )
}
