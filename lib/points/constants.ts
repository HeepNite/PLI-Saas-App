export const POINTS_RULE_KEYS = {
  PROFILE_COMPLETED: "profile-completed",
  PACKAGE_PURCHASE: "package-purchase",
  PACKAGE_ASSIGNMENT: "package-assignment",
  CONSECUTIVE_ATTENDANCE: "consecutive-attendance",
  ATTENDANCE_MILESTONE_CLASSES: "attendance-milestone-classes",
  FREE_CLASS_THRESHOLD: "free-class-threshold",
} as const

export type PointsRuleKey = (typeof POINTS_RULE_KEYS)[keyof typeof POINTS_RULE_KEYS]

export type PointsRuleDefinition = {
  key: PointsRuleKey
  label: string
  eventType: string
  description: string
  defaultPoints: number
}

export const DEFAULT_ATTENDANCE_MILESTONE_CLASSES = 3
export const DEFAULT_FREE_CLASS_THRESHOLD = 500

export const POINTS_RULE_DEFINITIONS: PointsRuleDefinition[] = [
  {
    key: POINTS_RULE_KEYS.PROFILE_COMPLETED,
    label: "Profile completed",
    eventType: "PROFILE_COMPLETED",
    description: "One-time reward when the student completes their profile.",
    defaultPoints: 10,
  },
  {
    key: POINTS_RULE_KEYS.PACKAGE_PURCHASE,
    label: "Package purchase",
    eventType: "PACKAGE_PURCHASE",
    description: "Points for confirmed package purchase.",
    defaultPoints: 5,
  },
  {
    key: POINTS_RULE_KEYS.PACKAGE_ASSIGNMENT,
    label: "Package class assignment",
    eventType: "PACKAGE_ASSIGNMENT",
    description: "Points for assigning package classes (once per package).",
    defaultPoints: 2.5,
  },
  {
    key: POINTS_RULE_KEYS.CONSECUTIVE_ATTENDANCE,
    label: "Consecutive attendance",
    eventType: "CONSECUTIVE_ATTENDANCE",
    description: "Points for completing consecutive attendance milestones.",
    defaultPoints: 3,
  },
  {
    key: POINTS_RULE_KEYS.ATTENDANCE_MILESTONE_CLASSES,
    label: "Attendance milestone (every X classes)",
    eventType: "ATTENDANCE_MILESTONE_CLASSES",
    description: "Number of classes required to trigger the attendance reward.",
    defaultPoints: DEFAULT_ATTENDANCE_MILESTONE_CLASSES,
  },
  {
    key: POINTS_RULE_KEYS.FREE_CLASS_THRESHOLD,
    label: "Free class goal",
    eventType: "FREE_CLASS_THRESHOLD",
    description: "Points required to unlock 1 free class.",
    defaultPoints: DEFAULT_FREE_CLASS_THRESHOLD,
  },
]

const pointsRuleDefinitionByKey = new Map(POINTS_RULE_DEFINITIONS.map((item) => [item.key, item] as const))

export const getPointsRuleDefinition = (key: string) => pointsRuleDefinitionByKey.get(key as PointsRuleKey)
