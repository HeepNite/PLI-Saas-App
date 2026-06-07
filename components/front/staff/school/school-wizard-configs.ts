import type { SchoolWizardEntity, SchoolWizardStepConfig } from "./school-wizard-types"

export const WIZARD_STEP_CONFIGS: Record<SchoolWizardEntity, SchoolWizardStepConfig[]> = {
  courses: [
    { key: "main-info", label: "Info" },
    { key: "prices", label: "Prices" },
    { key: "media-assets", label: "Media" },
    { key: "schedule", label: "Schedule" },
    { key: "course-links", label: "Relations" },
    { key: "preview-calendar", label: "Preview" },
    { key: "publish", label: "Publish" },
  ],
  rooms: [
    { key: "manage-rooms", label: "Manage Rooms" },
    { key: "reservations", label: "Reservations" },
  ],
  packages: [
    { key: "main-info", label: "Main Info" },
    { key: "assign-courses", label: "Assign Courses" },
    { key: "pricing-credits", label: "Pricing" },
    { key: "valid-days-status", label: "Valid Days" },
  ],
  points: [
    { key: "rule-builder", label: "Rule Builder" },
    { key: "manual-assignment", label: "Manual Assignment" },
  ],
}
