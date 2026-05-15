/**
 * Demo seed — Populates the local database with realistic demo data in Spanish.
 *
 * Usage:
 *   npx tsx prisma/seed-demo.ts
 *
 * Idempotent: safe to run multiple times (uses upsert where possible).
 */

import { PrismaClient } from "@prisma/client"
import { createHash, randomBytes } from "crypto"

const prisma = new PrismaClient()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Replicate staff-terminal PIN hashing (crypto sha256 + salt + secret) */
const hashTerminalPin = (pin: string) => {
  const secret =
    process.env.STAFF_TERMINAL_SECRET ||
    process.env.STAFF_CHECKIN_TOKEN ||
    "dev-terminal-secret-local-only"
  const salt = randomBytes(16).toString("hex")
  const hash = createHash("sha256")
    .update(`${pin}:${salt}:${secret}`)
    .digest("hex")
  return `${salt}:${hash}`
}

/** Generate a stable cuid-like ID for demo data */
const demoId = (prefix: string, n: number) => `demo_${prefix}_${String(n).padStart(3, "0")}`

// ---------------------------------------------------------------------------
// Stable IDs
// ---------------------------------------------------------------------------

const ROOM_IDS = {
  principal: demoId("room", 1),
  ensayo: demoId("room", 2),
  privado: demoId("room", 3),
}

const COURSE_SLUGS = {
  salsa1: "salsa-nivel-1",
  bachata: "bachata-intermedio",
  tango: "tango-argentino",
  ritmos: "ritmos-latinos",
  contemporanea: "danza-contemporanea",
}

const USER_IDS = {
  maria: demoId("user", 1),
  juan: demoId("user", 2),
  ana: demoId("user", 3),
  carlos: demoId("user", 4),
  lucia: demoId("user", 5),
  pedro: demoId("user", 6),
}

const STAFF_IDS = {
  directora: demoId("staff", 1),
  instructor: demoId("staff", 2),
  recepcionista: demoId("staff", 3),
}

const PAYMENT_MODEL_ID = demoId("paymodel", 1)
const TERMINAL_ID = demoId("terminal", 1)

// ---------------------------------------------------------------------------
// Seed functions
// ---------------------------------------------------------------------------

async function seedCurrencies() {
  const currencies = [
    { code: "ARS", symbol: "$", decimals: 2, active: true },
    { code: "USD", symbol: "USD", decimals: 2, active: true },
  ]
  for (const c of currencies) {
    await prisma.currency.upsert({
      where: { code: c.code },
      update: { symbol: c.symbol, decimals: c.decimals, active: c.active },
      create: c,
    })
  }
  console.log("✓ Monedas: ARS, USD")
}

async function seedRooms() {
  const rooms = [
    {
      id: ROOM_IDS.principal,
      name: "Salón Principal",
      capacity: 20,
      location: "Planta baja",
      active: true,
    },
    {
      id: ROOM_IDS.ensayo,
      name: "Sala de Ensayo",
      capacity: 10,
      location: "Primer piso",
      active: true,
    },
    {
      id: ROOM_IDS.privado,
      name: "Estudio Privado",
      capacity: 5,
      location: "Segundo piso",
      active: true,
    },
  ]

  for (const r of rooms) {
    await prisma.room.upsert({
      where: { id: r.id },
      update: { name: r.name, capacity: r.capacity, location: r.location, active: r.active },
      create: r,
    })
  }
  console.log("✓ Salas: Salón Principal, Sala de Ensayo, Estudio Privado")
}

async function seedCourses() {
  const courses = [
    {
      slug: COURSE_SLUGS.salsa1,
      title: "Salsa Nivel 1",
      kind: "course",
      category: "Ritmos Latinos",
      description:
        "Aprendé los pasos básicos de la salsa desde cero. Ideal para principiantes sin experiencia previa.",
      dropInPriceCents: 8500,
      firstClassPriceCents: 5000,
      level: "beginner",
      durationMinutes: 60,
      location: "Salón Principal",
      defaultRoomId: ROOM_IDS.principal,
      availableWeekdays: [1, 3], // Lunes y Miércoles
      availableTimes: ["19:00"],
      active: true,
    },
    {
      slug: COURSE_SLUGS.bachata,
      title: "Bachata Intermedio",
      kind: "course",
      category: "Ritmos Latinos",
      description:
        "Perfeccioná tu técnica de bachata con combinaciones y musicalidad. Se requiere experiencia previa.",
      dropInPriceCents: 9000,
      firstClassPriceCents: 6000,
      level: "intermediate",
      durationMinutes: 60,
      location: "Salón Principal",
      defaultRoomId: ROOM_IDS.principal,
      availableWeekdays: [2, 4], // Martes y Jueves
      availableTimes: ["20:00"],
      active: true,
    },
    {
      slug: COURSE_SLUGS.tango,
      title: "Tango Argentino",
      kind: "course",
      category: "Tango",
      description:
        "Descubrí el tango argentino: abrazo, caminata, ochos y giros. Para todos los niveles.",
      dropInPriceCents: 10000,
      firstClassPriceCents: 7000,
      level: "all",
      durationMinutes: 75,
      location: "Sala de Ensayo",
      defaultRoomId: ROOM_IDS.ensayo,
      availableWeekdays: [3, 5], // Miércoles y Viernes
      availableTimes: ["18:00"],
      active: true,
    },
    {
      slug: COURSE_SLUGS.ritmos,
      title: "Ritmos Latinos",
      kind: "course",
      category: "Ritmos Latinos",
      description:
        "Clase mixta de merengue, cumbia y reggaetón. Mucha energía y diversión garantizada.",
      dropInPriceCents: 8000,
      firstClassPriceCents: 5000,
      level: "beginner",
      durationMinutes: 60,
      location: "Salón Principal",
      defaultRoomId: ROOM_IDS.principal,
      availableWeekdays: [5], // Viernes
      availableTimes: ["20:00"],
      active: true,
    },
    {
      slug: COURSE_SLUGS.contemporanea,
      title: "Danza Contemporánea",
      kind: "course",
      category: "Contemporáneo",
      description:
        "Explorá el movimiento libre y la expresión corporal. Clase técnica con improvisación guiada.",
      dropInPriceCents: 9500,
      firstClassPriceCents: 6500,
      level: "intermediate",
      durationMinutes: 90,
      location: "Estudio Privado",
      defaultRoomId: ROOM_IDS.privado,
      availableWeekdays: [6], // Sábado
      availableTimes: ["10:00"],
      active: true,
    },
  ]

  for (const c of courses) {
    await prisma.courseCatalog.upsert({
      where: { slug: c.slug },
      update: {
        title: c.title,
        kind: c.kind,
        category: c.category,
        description: c.description,
        dropInPriceCents: c.dropInPriceCents,
        firstClassPriceCents: c.firstClassPriceCents,
        level: c.level,
        durationMinutes: c.durationMinutes,
        location: c.location,
        defaultRoomId: c.defaultRoomId,
        availableWeekdays: c.availableWeekdays,
        availableTimes: c.availableTimes,
        active: c.active,
      },
      create: c,
    })
  }
  console.log("✓ Cursos: Salsa, Bachata, Tango, Ritmos Latinos, Danza Contemporánea")
}

async function seedPackagePlans() {
  const plans = [
    {
      id: demoId("plan", 1),
      key: "mensual-8",
      label: "Pack Mensual — 8 clases",
      description: "8 clases por mes para usar en cualquier curso. Ideal para alumnos regulares.",
      priceCents: 52000,
      cadence: "monthly",
      status: "ACTIVE",
      totalCredits: 8,
      makeUps: 2,
      validDays: 30,
      isUnlimited: false,
      active: true,
    },
    {
      id: demoId("plan", 2),
      key: "trimestral-ilimitado",
      label: "Pack Trimestral Ilimitado",
      description: "Clases ilimitadas durante 3 meses. La mejor opción para quienes vienen todos los días.",
      priceCents: 120000,
      cadence: "quarterly",
      status: "ACTIVE",
      totalCredits: null,
      makeUps: 0,
      validDays: 90,
      isUnlimited: true,
      active: true,
    },
    {
      id: demoId("plan", 3),
      key: "clase-suelta",
      label: "Clase Suelta",
      description: "Una clase individual. Pagás solo cuando venís.",
      priceCents: 8500,
      cadence: null,
      status: "ACTIVE",
      totalCredits: 1,
      makeUps: 0,
      validDays: 7,
      isUnlimited: false,
      active: true,
    },
  ]

  for (const p of plans) {
    await prisma.packagePlan.upsert({
      where: { key: p.key },
      update: {
        label: p.label,
        description: p.description,
        priceCents: p.priceCents,
        cadence: p.cadence,
        status: p.status,
        totalCredits: p.totalCredits,
        makeUps: p.makeUps,
        validDays: p.validDays,
        isUnlimited: p.isUnlimited,
        active: p.active,
      },
      create: p,
    })
  }
  console.log("✓ Paquetes: Mensual 8, Trimestral Ilimitado, Clase Suelta")
}

async function seedUsers() {
  const users = [
    {
      id: USER_IDS.maria,
      email: "maria.lopez@demo.pli.local",
      name: "María López",
      phone: "+5491155551001",
    },
    {
      id: USER_IDS.juan,
      email: "juan.rodriguez@demo.pli.local",
      name: "Juan Rodríguez",
      phone: "+5491155551002",
    },
    {
      id: USER_IDS.ana,
      email: "ana.garcia@demo.pli.local",
      name: "Ana García",
      phone: "+5491155551003",
    },
    {
      id: USER_IDS.carlos,
      email: "carlos.martinez@demo.pli.local",
      name: "Carlos Martínez",
      phone: "+5491155551004",
    },
    {
      id: USER_IDS.lucia,
      email: "lucia.fernandez@demo.pli.local",
      name: "Lucía Fernández",
      phone: "+5491155551005",
    },
    {
      id: USER_IDS.pedro,
      email: "pedro.sanchez@demo.pli.local",
      name: "Pedro Sánchez",
      phone: "+5491155551006",
    },
  ]

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, phone: u.phone },
      create: u,
    })
  }

  // Student profiles
  const profiles = [
    {
      userId: USER_IDS.maria,
      firstName: "María",
      lastName: "López",
      birthDate: new Date("1995-03-15"),
      emergencyContactName: "Roberto López",
      emergencyContactRelation: "Padre",
      emergencyContactPhone: "+5491155559001",
    },
    {
      userId: USER_IDS.juan,
      firstName: "Juan",
      lastName: "Rodríguez",
      birthDate: new Date("1990-07-22"),
      emergencyContactName: "Laura Rodríguez",
      emergencyContactRelation: "Esposa",
      emergencyContactPhone: "+5491155559002",
    },
    {
      userId: USER_IDS.ana,
      firstName: "Ana",
      lastName: "García",
      birthDate: new Date("1998-11-08"),
      emergencyContactName: "Silvia García",
      emergencyContactRelation: "Madre",
      emergencyContactPhone: "+5491155559003",
    },
    {
      userId: USER_IDS.carlos,
      firstName: "Carlos",
      lastName: "Martínez",
      birthDate: new Date("1987-01-30"),
      emergencyContactName: "Patricia Martínez",
      emergencyContactRelation: "Hermana",
      emergencyContactPhone: "+5491155559004",
    },
    {
      userId: USER_IDS.lucia,
      firstName: "Lucía",
      lastName: "Fernández",
      birthDate: new Date("2000-06-12"),
      emergencyContactName: "Miguel Fernández",
      emergencyContactRelation: "Padre",
      emergencyContactPhone: "+5491155559005",
    },
  ]

  for (const p of profiles) {
    await prisma.studentProfile.upsert({
      where: { userId: p.userId },
      update: {
        firstName: p.firstName,
        lastName: p.lastName,
        birthDate: p.birthDate,
        emergencyContactName: p.emergencyContactName,
        emergencyContactRelation: p.emergencyContactRelation,
        emergencyContactPhone: p.emergencyContactPhone,
      },
      create: p,
    })
  }
  console.log("✓ Alumnos: María, Juan, Ana, Carlos, Lucía, Pedro (con perfiles)")
}

async function seedStaff() {
  const staffPaymentModel = {
    id: PAYMENT_MODEL_ID,
    name: "Modelo por Hora — Demo",
    type: "per_hour",
    hourlyRate: 5000,
    currency: "ARS",
    paydayWeekday: 5,
    creditCapCents: 0,
    isDefault: true,
    active: true,
  }

  await prisma.staffPaymentModel.upsert({
    where: { id: PAYMENT_MODEL_ID },
    update: {
      name: staffPaymentModel.name,
      hourlyRate: staffPaymentModel.hourlyRate,
      isDefault: staffPaymentModel.isDefault,
    },
    create: staffPaymentModel,
  })

  const staff = [
    {
      id: STAFF_IDS.directora,
      clerkUserId: "demo_clerk_staff_001",
      email: "valentina.romero@demo.pli.local",
      firstName: "Valentina",
      lastName: "Romero",
      role: "admin",
      category: "Dirección",
      source: "demo",
      paymentModelId: PAYMENT_MODEL_ID,
    },
    {
      id: STAFF_IDS.instructor,
      clerkUserId: "demo_clerk_staff_002",
      email: "matias.herrera@demo.pli.local",
      firstName: "Matías",
      lastName: "Herrera",
      role: "instructor",
      category: "Instructor",
      subCategory: "Ritmos Latinos",
      source: "demo",
      paymentModelId: PAYMENT_MODEL_ID,
    },
    {
      id: STAFF_IDS.recepcionista,
      clerkUserId: "demo_clerk_staff_003",
      email: "camila.torres@demo.pli.local",
      firstName: "Camila",
      lastName: "Torres",
      role: "receptionist",
      category: "Recepción",
      source: "demo",
      paymentModelId: PAYMENT_MODEL_ID,
    },
  ]

  for (const s of staff) {
    await prisma.staffAccount.upsert({
      where: { clerkUserId: s.clerkUserId },
      update: {
        email: s.email,
        firstName: s.firstName,
        lastName: s.lastName,
        role: s.role,
        category: s.category,
      },
      create: s,
    })
  }
  console.log("✓ Staff: Valentina (admin), Matías (instructor), Camila (recepcionista)")
}

async function seedPointsRules() {
  const rules = [
    {
      key: "asistencia",
      label: "Asistencia a clase",
      description: "Puntos por asistir a una clase programada",
      eventType: "attendance",
      points: 10,
      active: true,
    },
    {
      key: "referido",
      label: "Referido nuevo",
      description: "Puntos por traer un alumno nuevo a la escuela",
      eventType: "referral",
      points: 50,
      active: true,
    },
    {
      key: "puntualidad",
      label: "Puntualidad",
      description: "Bonus por llegar antes de que empiece la clase",
      eventType: "on_time",
      points: 5,
      active: true,
    },
  ]

  for (const r of rules) {
    await prisma.pointsRule.upsert({
      where: { key: r.key },
      update: { label: r.label, description: r.description, points: r.points },
      create: r,
    })
  }
  console.log("✓ Reglas de puntos: Asistencia, Referido, Puntualidad")
}

async function seedClassSessions() {
  const now = new Date()
  const sessions: {
    id: string
    courseSlug: string
    title: string
    startsAt: Date
    durationMinutes: number
    capacity: number
    roomId: string
  }[] = []

  // Generate sessions for the next 2 weeks
  const coursesConfig = [
    {
      slug: COURSE_SLUGS.salsa1,
      title: "Salsa Nivel 1",
      weekdays: [1, 3],
      hour: 19,
      duration: 60,
      capacity: 20,
      roomId: ROOM_IDS.principal,
    },
    {
      slug: COURSE_SLUGS.bachata,
      title: "Bachata Intermedio",
      weekdays: [2, 4],
      hour: 20,
      duration: 60,
      capacity: 20,
      roomId: ROOM_IDS.principal,
    },
    {
      slug: COURSE_SLUGS.tango,
      title: "Tango Argentino",
      weekdays: [3, 5],
      hour: 18,
      duration: 75,
      capacity: 10,
      roomId: ROOM_IDS.ensayo,
    },
    {
      slug: COURSE_SLUGS.ritmos,
      title: "Ritmos Latinos",
      weekdays: [5],
      hour: 20,
      duration: 60,
      capacity: 20,
      roomId: ROOM_IDS.principal,
    },
    {
      slug: COURSE_SLUGS.contemporanea,
      title: "Danza Contemporánea",
      weekdays: [6],
      hour: 10,
      duration: 90,
      capacity: 5,
      roomId: ROOM_IDS.privado,
    },
  ]

  let sessionCounter = 0
  for (const course of coursesConfig) {
    for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
      const date = new Date(now)
      date.setDate(date.getDate() + dayOffset)
      const weekday = date.getDay() // 0=Sun, 1=Mon, ...

      if (course.weekdays.includes(weekday)) {
        sessionCounter++
        const startsAt = new Date(date)
        startsAt.setHours(course.hour, 0, 0, 0)

        sessions.push({
          id: demoId("session", sessionCounter),
          courseSlug: course.slug,
          title: course.title,
          startsAt,
          durationMinutes: course.duration,
          capacity: course.capacity,
          roomId: course.roomId,
        })
      }
    }
  }

  for (const s of sessions) {
    await prisma.classSession.upsert({
      where: { courseSlug_startsAt: { courseSlug: s.courseSlug, startsAt: s.startsAt } },
      update: {
        title: s.title,
        durationMinutes: s.durationMinutes,
        capacity: s.capacity,
        roomId: s.roomId,
      },
      create: s,
    })
  }
  console.log(`✓ Clases programadas: ${sessions.length} sesiones en las próximas 2 semanas`)
  return sessions
}

async function seedPackagePurchases() {
  const now = new Date()
  const expiresAt = new Date(now)
  expiresAt.setDate(expiresAt.getDate() + 30)

  const purchases = [
    {
      id: demoId("pkgpurchase", 1),
      userId: USER_IDS.maria,
      packagePlanId: demoId("plan", 1),
      packageId: "mensual-8",
      packageLabel: "Pack Mensual — 8 clases",
      totalCredits: 8,
      remainingCredits: 6,
      isUnlimited: false,
      status: "active",
      source: "demo",
      expiresAt,
    },
    {
      id: demoId("pkgpurchase", 2),
      userId: USER_IDS.juan,
      packagePlanId: demoId("plan", 2),
      packageId: "trimestral-ilimitado",
      packageLabel: "Pack Trimestral Ilimitado",
      totalCredits: null,
      remainingCredits: null,
      isUnlimited: true,
      status: "active",
      source: "demo",
      expiresAt: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
    },
    {
      id: demoId("pkgpurchase", 3),
      userId: USER_IDS.ana,
      packagePlanId: demoId("plan", 1),
      packageId: "mensual-8",
      packageLabel: "Pack Mensual — 8 clases",
      totalCredits: 8,
      remainingCredits: 3,
      isUnlimited: false,
      status: "active",
      source: "demo",
      expiresAt,
    },
  ]

  for (const p of purchases) {
    await prisma.packagePurchase.upsert({
      where: { id: p.id },
      update: { remainingCredits: p.remainingCredits, status: p.status },
      create: p,
    })
  }
  console.log("✓ Paquetes comprados: María (Mensual), Juan (Trimestral), Ana (Mensual)")
}

async function seedTerminal() {
  const slug = "terminal-recepcion"

  await prisma.staffTerminal.upsert({
    where: { id: TERMINAL_ID },
    update: { name: "Terminal Recepción", location: "Entrada principal" },
    create: {
      id: TERMINAL_ID,
      slug,
      name: "Terminal Recepción",
      location: "Entrada principal",
      defaultCourseSlug: COURSE_SLUGS.salsa1,
      pinHash: hashTerminalPin("1234"),
      active: true,
    },
  })
  console.log("✓ Terminal: Recepción (PIN: 1234)")
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("\n🎭 Seedeando base de datos demo PLI...\n")

  await seedCurrencies()
  await seedRooms()
  await seedCourses()
  await seedPackagePlans()
  await seedUsers()
  await seedStaff()
  await seedPointsRules()
  await seedClassSessions()
  await seedPackagePurchases()
  await seedTerminal()

  console.log("\n✅ ¡Demo seedeado con éxito!\n")
  console.log("Datos incluidos:")
  console.log("  • 2 monedas (ARS, USD)")
  console.log("  • 3 salas")
  console.log("  • 5 cursos de danza")
  console.log("  • 3 paquetes/planes")
  console.log("  • 6 alumnos con perfiles")
  console.log("  • 3 staff (admin, instructor, recepcionista)")
  console.log("  • Sesiones de clase para 2 semanas")
  console.log("  • 3 paquetes activos comprados")
  console.log("  • 3 reglas de puntos")
  console.log("  • 1 terminal de kiosk (PIN: 1234)")
  console.log("")
}

main()
  .catch((error) => {
    console.error("❌ Error seedeando demo:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
