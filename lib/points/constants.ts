export const POINTS_RULE_KEYS = {
  PROFILE_COMPLETED: "profile-completed",
  PACKAGE_PURCHASE: "package-purchase",
  PACKAGE_ASSIGNMENT: "package-assignment",
  CONSECUTIVE_ATTENDANCE: "consecutive-attendance",
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

export const ATTENDANCE_STREAK_MILESTONE = 3
export const DEFAULT_FREE_CLASS_THRESHOLD = 500

export const POINTS_RULE_DEFINITIONS: PointsRuleDefinition[] = [
  {
    key: POINTS_RULE_KEYS.PROFILE_COMPLETED,
    label: "Perfil completado",
    eventType: "PROFILE_COMPLETED",
    description: "Premio único cuando el alumno completa su perfil.",
    defaultPoints: 10,
  },
  {
    key: POINTS_RULE_KEYS.PACKAGE_PURCHASE,
    label: "Compra de paquete",
    eventType: "PACKAGE_PURCHASE",
    description: "Puntos por compra de paquete confirmada.",
    defaultPoints: 5,
  },
  {
    key: POINTS_RULE_KEYS.PACKAGE_ASSIGNMENT,
    label: "Asignación de clases de paquete",
    eventType: "PACKAGE_ASSIGNMENT",
    description: "Puntos por asignar clases del paquete (una vez por paquete).",
    defaultPoints: 2.5,
  },
  {
    key: POINTS_RULE_KEYS.CONSECUTIVE_ATTENDANCE,
    label: "Asistencia consecutiva",
    eventType: "CONSECUTIVE_ATTENDANCE",
    description: "Puntos por completar hitos de asistencias consecutivas.",
    defaultPoints: 3,
  },
  {
    key: POINTS_RULE_KEYS.FREE_CLASS_THRESHOLD,
    label: "Meta clase gratis",
    eventType: "FREE_CLASS_THRESHOLD",
    description: "Puntos necesarios para habilitar 1 clase gratis.",
    defaultPoints: DEFAULT_FREE_CLASS_THRESHOLD,
  },
]

const pointsRuleDefinitionByKey = new Map(POINTS_RULE_DEFINITIONS.map((item) => [item.key, item] as const))

export const getPointsRuleDefinition = (key: string) => pointsRuleDefinitionByKey.get(key as PointsRuleKey)

