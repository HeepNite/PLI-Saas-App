// Demo course data and helpers for singular course pages.
// This is a simple in-memory source to power the UI.
// Replace with a CMS or database when needed.

export type CourseSchedule = {
  day: string // e.g., "Lunes y Miércoles"
  time: string // e.g., "19:00 – 20:30"
  starts: string // ISO date string or human string
  frequency?: string // e.g., "2 veces por semana"
}

export type CourseInstructor = {
  name: string
  role?: string
  photo?: string // public path
}

export type EnrollmentOption = {
  id: string
  label: string
  description?: string
  price?: number
}

export type CourseData = {
  slug: string
  title: string
  description: string
  level: "Inicial" | "Intermedio" | "Avanzado"
  duration: string // e.g., "8 semanas"
  requirements?: string[]
  benefits?: string[]
  syllabus?: string[]
  schedule: CourseSchedule
  location: {
    address: string
    mapUrl?: string
  }
  instructors: CourseInstructor[]
  heroMedia?: {
    image?: string
    video?: string
  }
  enrollment: {
    services: EnrollmentOption[]
    packages: EnrollmentOption[]
    addons?: EnrollmentOption[]
  }
}

export const demoCourses: CourseData[] = [
  {
    slug: "salsa-basico",
    title: "Salsa Básico",
    description:
      "Aprende las bases de la Salsa en un entorno presencial, divertido y guiado paso a paso.",
    level: "Inicial",
    duration: "8 semanas",
    requirements: ["Ganas de bailar", "Ropa cómoda"],
    benefits: [
      "Postura y ritmo desde cero",
      "Pasos básicos y giros",
      "Conexión en pareja",
      "Musicalidad y timing",
    ],
    syllabus: [
      "Introducción al ritmo",
      "Pasos básicos",
      "Giros derecha/izquierda",
      "Conducción y seguimiento",
      "Patrones simples",
      "Musicalidad y práctica",
    ],
    schedule: {
      day: "Martes y Jueves",
      time: "19:00 – 20:30",
      starts: "2025-11-15",
      frequency: "2 veces por semana",
    },
    location: {
      address: "Av. Corrientes 1234, CABA",
      mapUrl: "https://maps.google.com/?q=Av.+Corrientes+1234+CABA",
    },
    instructors: [
      { name: "María López", role: "Coach Principal", photo: "/images/instructors/maria.jpg" },
      { name: "Juan Pérez", role: "Asistente", photo: "/images/instructors/juan.jpg" },
    ],
    heroMedia: {
      image: "/images/courses/salsa-basic.jpg",
    },
    enrollment: {
      services: [
        { id: "single", label: "Clase suelta", price: 15 },
        { id: "monthly", label: "Mensual", price: 100 },
      ],
      packages: [
        { id: "pack4", label: "Paquete 4 clases", price: 50 },
        { id: "pack8", label: "Paquete 8 clases", price: 95 },
      ],
      addons: [
        { id: "private30", label: "30' asesoría privada", price: 20 },
        { id: "video", label: "Acceso a videos de práctica", price: 10 },
      ],
    },
  },
  {
    slug: "bachata-intermedio",
    title: "Bachata Intermedio",
    description:
      "Perfecciona técnica y fluidez con figuras y combinaciones, en encuentros presenciales.",
    level: "Intermedio",
    duration: "6 semanas",
    requirements: ["Conocer básicos de Bachata"],
    benefits: [
      "Técnica de pivots y body movement",
      "Combinaciones intermedias",
      "Mejora de conexión",
    ],
    syllabus: [
      "Repaso técnica base",
      "Figuras intermedias",
      "Musicalidad y acentos",
      "Trabajo en pareja",
    ],
    schedule: {
      day: "Sábados",
      time: "11:00 – 13:00",
      starts: "2025-11-23",
      frequency: "1 vez por semana",
    },
    location: {
      address: "Calle 9 de Julio 567, CABA",
      mapUrl: "https://maps.google.com/?q=9+de+Julio+567+CABA",
    },
    instructors: [
      { name: "Ana Torres", role: "Coach", photo: "/images/instructors/ana.jpg" },
    ],
    heroMedia: {
      image: "/images/courses/bachata-intermediate.jpg",
    },
    enrollment: {
      services: [
        { id: "single", label: "Clase suelta", price: 18 },
        { id: "monthly", label: "Mensual", price: 110 },
      ],
      packages: [
        { id: "pack4", label: "Paquete 4 clases", price: 60 },
      ],
      addons: [
        { id: "video", label: "Acceso a videos", price: 12 },
      ],
    },
  },
]

export function getCourseBySlug(slug: string): CourseData | undefined {
  return demoCourses.find((c) => c.slug === slug)
}

export function getAllCourseSlugs(): string[] {
  return demoCourses.map((c) => c.slug)
}
