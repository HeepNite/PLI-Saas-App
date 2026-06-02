import React from "react"

import type { StaffRole } from "@/lib/security/staff-role"
import type { StaffCategory } from "@/lib/security/staff-category"

import { normalizeCategoryForRole } from "./staffAdminConstants"

type UseStaffCreateAdminOptions = {
  refreshRows: () => Promise<void>
  setError: React.Dispatch<React.SetStateAction<string | null>>
}

export function useStaffCreateAdmin({ refreshRows, setError }: UseStaffCreateAdminOptions) {
  const [email, setEmail] = React.useState("")
  const [firstName, setFirstName] = React.useState("")
  const [lastName, setLastName] = React.useState("")
  const [newRole, setNewRole] = React.useState<StaffRole>("staff")
  const [newCategory, setNewCategory] = React.useState<StaffCategory>("guest")
  const [newPin, setNewPin] = React.useState("")
  const [createBusy, setCreateBusy] = React.useState(false)
  const [createMessage, setCreateMessage] = React.useState<string | null>(null)

  const createStaff = React.useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCreateMessage(null)
    setError(null)
    setCreateBusy(true)
    try {
      const body: Record<string, string> = {
        email,
        firstName,
        lastName,
        role: newRole,
        category: normalizeCategoryForRole(newRole, newCategory),
      }
      if (newPin && /^\d{4}$/.test(newPin)) {
        body.pin = newPin
      }
      const res = await fetch("/api/staff/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Failed to create staff user")
        return
      }

      if (data?.mode === "invited") {
        setCreateMessage(`Invitation sent to ${data?.invitation?.emailAddress || email}`)
      } else {
        setCreateMessage(newPin ? "Existing user promoted to staff with PIN assigned" : "Existing user promoted to staff")
      }

      setEmail("")
      setFirstName("")
      setLastName("")
      setNewRole("staff")
      setNewCategory("guest")
      setNewPin("")
      await refreshRows()
    } catch {
      setError("Network error while creating staff user")
    } finally {
      setCreateBusy(false)
    }
  }, [email, firstName, lastName, newCategory, newPin, newRole, refreshRows, setError])

  return {
    email,
    setEmail,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    newRole,
    setNewRole,
    newCategory,
    setNewCategory,
    newPin,
    setNewPin,
    createBusy,
    createMessage,
    createStaff,
  }
}
