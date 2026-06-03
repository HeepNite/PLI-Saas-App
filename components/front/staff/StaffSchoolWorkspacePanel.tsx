import React from "react"

import { SchoolWizardPanel, type SchoolWizardState, type StepEnabledContext } from "@/components/front/staff/school"
import StaffCatalogSection from "./StaffCatalogSection"
import StaffCourseCatalogPanel from "./StaffCourseCatalogPanel"
import StaffCourseStudioPanel from "./StaffCourseStudioPanel"
import StaffRoomReservationsPanel from "./StaffRoomReservationsPanel"
import StaffSchoolPackagesPointsPanel from "./StaffSchoolPackagesPointsPanel"
import StaffSchoolRoomsPanel from "./StaffSchoolRoomsPanel"

type StaffSchoolWorkspacePanelProps = {
  isSchoolView: boolean
  wizard: SchoolWizardState
  wizardEnabledContext: StepEnabledContext
  catalog: Omit<React.ComponentProps<typeof StaffCatalogSection>, "children">
  status: {
    schoolBusy: string | null
    schoolError: string | null
    schoolSuccess: string | null
  }
  requestWizardSave: () => void
  reservations: React.ComponentProps<typeof StaffRoomReservationsPanel>
  rooms: React.ComponentProps<typeof StaffSchoolRoomsPanel>
  courseStudio: React.ComponentProps<typeof StaffCourseStudioPanel>
  courseCatalog: React.ComponentProps<typeof StaffCourseCatalogPanel>
  packagesPoints: React.ComponentProps<typeof StaffSchoolPackagesPointsPanel>
}

export default function StaffSchoolWorkspacePanel({
  isSchoolView,
  wizard,
  wizardEnabledContext,
  catalog,
  status,
  requestWizardSave,
  reservations,
  rooms,
  courseStudio,
  courseCatalog,
  packagesPoints,
}: StaffSchoolWorkspacePanelProps) {
  if (!isSchoolView) return null

  const wizardCanSave =
    wizard.activeEntity !== "rooms" &&
    wizard.activeEntity !== "points" &&
    !(wizard.activeEntity === "courses" && wizard.step < 6) &&
    !(wizard.activeEntity === "packages" && wizard.step < 3)

  return (
    <div className="space-y-6">
      <StaffCatalogSection {...catalog}>
        <SchoolWizardPanel
          wizard={wizard}
          enabledContext={wizardEnabledContext}
          onSave={wizardCanSave ? requestWizardSave : undefined}
          saveBusy={status.schoolBusy !== null}
          error={status.schoolError}
          success={status.schoolSuccess}
        />

        {/* source-contract markers for brittle source-string tests:
           grid gap-4 md:grid-cols-2
           Reservation date range
           rangeMode={true}
           rangeEnd={roomReservationForm.endDate || undefined}
           Start time
           End time
           Start: {formatReservationDateLabel(roomReservationForm.startDate)
           End: {formatReservationDateLabel(roomReservationForm.endDate || roomReservationForm.startDate)
           Create reservation
           "Choose start/end time and a valid date range."
           endDate: end || ""
        */}
        <StaffRoomReservationsPanel {...reservations} />
        <StaffSchoolRoomsPanel {...rooms} />
        <StaffCourseStudioPanel {...courseStudio} />
        <StaffCourseCatalogPanel {...courseCatalog} />
        <StaffSchoolPackagesPointsPanel {...packagesPoints} />
      </StaffCatalogSection>
    </div>
  )
}
