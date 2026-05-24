import React from "react"
import type { ActivityStats, PackageSummary, ProfilePackageItem } from "../profile-types"
import { mockProfile } from "../mock-profile"

export type ProfilePackagesState = {
  packagesData: ProfilePackageItem[]
  packagesSummary: PackageSummary
  activityStats: ActivityStats
  monthlyAttendance: Array<{ label: string; value: number }>
}

export function useProfilePackages(canLoadProtectedData: boolean): ProfilePackagesState {
  const [packagesData, setPackagesData] = React.useState<ProfilePackageItem[]>([])
  const [packagesSummary, setPackagesSummary] = React.useState<PackageSummary>({
    activePackages: 0,
    unlimitedPackages: 0,
    totalRemainingCredits: 0,
    nextExpiration: null,
  })
  const [activityStats, setActivityStats] = React.useState<ActivityStats>({
    classesTaken: mockProfile.stats.classesTaken,
    weeklyAverage: 3.4,
    streakWeeks: 3,
    recurringLabel: mockProfile.schedule.recurring,
    lastClassLabel: mockProfile.stats.lastClass,
  })
  const [monthlyAttendance, setMonthlyAttendance] = React.useState<Array<{ label: string; value: number }>>(
    mockProfile.attendance
  )

  React.useEffect(() => {
    if (!canLoadProtectedData) return
    let active = true
    Promise.all([
      fetch("/api/profile/packages").then((res) => (res.ok ? res.json() : null)),
      fetch("/api/profile/activity").then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([packagesPayload, activityPayload]) => {
        if (!active) return
        if (packagesPayload?.packages) {
          setPackagesData(packagesPayload.packages)
          setPackagesSummary(
            packagesPayload.summary || {
              activePackages: 0,
              unlimitedPackages: 0,
              totalRemainingCredits: 0,
              nextExpiration: null,
            }
          )
        }
        if (activityPayload?.stats) {
          setActivityStats({
            classesTaken: activityPayload.stats.classesTaken ?? 0,
            weeklyAverage: activityPayload.stats.weeklyAverage ?? 0,
            streakWeeks: activityPayload.stats.streakWeeks ?? 0,
            recurringLabel: activityPayload.stats.recurringLabel ?? null,
            lastClassLabel: activityPayload.stats.lastClassLabel ?? null,
          })
        }
        if (Array.isArray(activityPayload?.monthlyAttendance) && activityPayload.monthlyAttendance.length) {
          setMonthlyAttendance(activityPayload.monthlyAttendance)
        }
      })
      .catch(() => {
        // keep current fallback UI values if profile activity endpoints fail
      })
    return () => {
      active = false
    }
  }, [canLoadProtectedData])

  return {
    packagesData,
    packagesSummary,
    activityStats,
    monthlyAttendance,
  }
}
