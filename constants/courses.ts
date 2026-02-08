// Demo course data and helpers for singular course pages.
// This is a simple in-memory source to power the UI.
// Replace with a CMS or database when needed.

export type CourseSchedule = {
  day: string // e.g., "Lunes y Miércoles"
  time: string // e.g., "19:00 – 20:30"
  starts: string // ISO date string or human string
  frequency?: string // e.g., "2 veces por semana"
  availableWeekdays?: number[] // 0=Mon ... 6=Sun
  availableTimes?: string[] // HH:MM in 24h
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
  level: "Beginner" | "Intermediate" | "Advanced"
  duration: string // e.g., "8 week"
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
    slug: "salsa-nocturno",
    title: "Salsa (Evening program)",
    description: "In-person salsa at night focused on musicality, partner work and confidence.",
    level: "Beginner",
    duration: "55 min",
    requirements: ["Comfortable clothes", "Desire to dance"],
    benefits: [
      "Connection and lead/follow",
      "Musicality and timing",
      "Basic figures and styling",
      "Guided social practice",
    ],
    syllabus: [
      "Warm-up and rhythm",
      "Basic steps On1/On2",
      "Right/left turns",
      "Partner: leading/following",
      "Simple patterns and shines",
    ],
    schedule: {
      day: "Mon/Fri 9:10–10:10pm • Tue/Thu 8:10–9:10pm • Sun 5:00pm",
      time: "See slot per day",
      starts: "Ongoing",
      frequency: "3-5 times per week",
      // 0=Mon ... 6=Sun
      availableWeekdays: [0, 1, 3, 4, 6], // Mon, Tue, Thu, Fri, Sun
      // Night slots; Sunday has 5pm as extra (handled in logic)
      availableTimes: ["20:10", "21:10"],
    },
    location: {
      address: "Av. Corrientes 1234, CABA",
      mapUrl: "https://maps.google.com/?q=Av.+Corrientes+1234+CABA",
    },
    instructors: [
      { name: "Mariano", role: "Instructor", photo: "/images/Teaches/Mariano.jpg" },
      { name: "Elvira", role: "Instructor", photo: "/images/Teaches/elvira-portrait.jpg" },
    ],
    heroMedia: {
      image: "/images/carousel/_DSC1076.JPG",
    },
    enrollment: {
      services: [
        { id: "dropin", label: "Single class", price: 20 },
        { id: "new-student", label: "New students", price: 15 },
      ],
      packages: [
        { id: "night-flex", label: "Night Flex (8 classes)", price: 140, description: "8 night classes / month" },
        { id: "night-pro", label: "Night Pro (unlimited)", price: 220, description: "Unlimited classes / month" },
      ],
      addons: [
        { id: "video", label: "Practice video access", price: 10 },
      ],
    },
  },
  {
    slug: "salsa-femenina-matutina",
    title: "Salsa feminine style (morning)",
    description: "Morning class focused on feminine technique, arms, spins and personal style.",
    level: "Beginner",
    duration: "55 min",
    requirements: ["Comfortable clothes", "Stable footwear"],
    benefits: [
      "Posture and stylized arms",
      "Clean spins and balance",
      "Musicality and accents",
    ],
    syllabus: [
      "Warm-up and mobility",
      "Isolations and body movement",
      "Shines and coordination",
      "Spins with spotting technique",
      "Short applied combo",
    ],
    schedule: {
      day: "Mon/Wed/Thu",
      time: "11:00 – 12:00",
      starts: "Ongoing",
      frequency: "3 times per week",
      availableWeekdays: [0, 2, 3], // Mon, Wed, Thu
      availableTimes: ["11:00"],
    },
    location: {
      address: "Av. Corrientes 1234, CABA",
      mapUrl: "https://maps.google.com/?q=Av.+Corrientes+1234+CABA",
    },
    instructors: [{ name: "Elvira", role: "Instructor", photo: "/images/Teaches/elvira-portrait.jpg" }],
    heroMedia: {
      image: "/images/LadiesStyles.png",
    },
    enrollment: {
      services: [
        { id: "dropin", label: "Single class", price: 20 },
        { id: "new-student", label: "New students", price: 15 },
      ],
      packages: [
        { id: "morning-3-week", label: "Morning 3-week pack", price: 145, description: "8 classes + 8 make-ups" },
        { id: "morning-2-week", label: "Morning 2-week pack", price: 125, description: "5 classes + 5 make-ups" },
        { id: "morning-1-week", label: "Morning 1-week pack", price: 90, description: "3 classes + 3 make-ups" },
        { id: "morning-monthly", label: "Morning Monthly", price: 200, description: "1 class per day, make-ups included" },
        { id: "morning-6-month", label: "Morning 6-month pack", price: 480, description: "1 class per day, no make-ups" },
      ],
      addons: [],
    },
  },
  {
    slug: "zumba-matutino",
    title: "Zumba (Morning program)",
    description: "Morning zumba to start the day with cardio, latin music and energy.",
    level: "Beginner",
    duration: "55 min",
    requirements: ["Sports shoes", "Hydration"],
    benefits: [
      "Low-impact cardio",
      "Coordination and rhythm",
      "Improved endurance",
    ],
    syllabus: [
      "Warm-up",
      "Dance/cardio blocks",
      "Core and legs work",
      "Cool down and stretch",
    ],
    schedule: {
      day: "Mon/Wed/Thu",
      time: "10:00 – 11:00",
      starts: "Ongoing",
      frequency: "3 times per week",
      availableWeekdays: [0, 2, 3], // Mon, Wed, Thu
      availableTimes: ["10:00"],
    },
    location: {
      address: "Av. Corrientes 1234, CABA",
      mapUrl: "https://maps.google.com/?q=Av.+Corrientes+1234+CABA",
    },
    instructors: [{ name: "Elvira", role: "Instructor", photo: "/images/Teaches/elvira-portrait.jpg" }],
    heroMedia: {
      image: "/images/Zumba.png",
      video: "/videos/Zumba.mp4",
    },
    enrollment: {
      services: [
        { id: "dropin", label: "Single class", price: 20 },
        { id: "new-student", label: "New students", price: 15 },
      ],
      packages: [
        { id: "morning-3-week", label: "Morning 3-week pack", price: 145, description: "8 classes + 8 make-ups" },
        { id: "morning-2-week", label: "Morning 2-week pack", price: 125, description: "5 classes + 5 make-ups" },
        { id: "morning-1-week", label: "Morning 1-week pack", price: 90, description: "3 classes + 3 make-ups" },
        { id: "morning-monthly", label: "Morning Monthly", price: 200, description: "1 class per day, make-ups included" },
        { id: "morning-6-month", label: "Morning 6-month pack", price: 480, description: "1 class per day, no make-ups" },
      ],
      addons: [],
    },
  },
  {
    slug: "musica-bebes",
    title: "Musical stimulation for babies",
    description: "Music and sensory play for babies with parent participation.",
    level: "Beginner",
    duration: "55 min",
    requirements: ["Comfortable clothes", "Bring mat or changing pad"],
    benefits: [
      "Bonding through music",
      "Sensory and motor stimulation",
      "Age-adapted routines",
    ],
    syllabus: [
      "Songs and soft rhythms",
      "Play with instruments",
      "Activities by age range",
      "Closing and relaxation",
    ],
    schedule: {
      day: "Tuesday and Friday",
      time: "10:00–11:00 (6–18m) / 11:00–12:00 (18–36m)",
      starts: "Ongoing",
      frequency: "2 times per week",
      availableWeekdays: [1, 4], // Tue, Fri
      availableTimes: ["10:00", "11:00"],
    },
    location: {
      address: "Av. Corrientes 1234, CABA",
      mapUrl: "https://maps.google.com/?q=Av.+Corrientes+1234+CABA",
    },
    instructors: [
      { name: "Omer Melendez", role: "Instructor (Tuesday)", photo: "/images/Teaches/Omer.jpg" },
      { name: "Manuela", role: "Instructor (Friday)", photo: "/images/Teaches/MAnuela.jpeg" },
    ],
    heroMedia: {
      image: "/images/Kids/Artboard 1.jpg",
      video: "/videos/Kids.mp4",
    },
    enrollment: {
      services: [
        { id: "dropin", label: "Single class", price: 30 },
      ],
      packages: [
        { id: "babies-3-week", label: "Babies 3-week pack", price: 145, description: "8 classes + 8 make-ups" },
        { id: "babies-2-week", label: "Babies 2-week pack", price: 125, description: "5 classes + 5 make-ups" },
        { id: "babies-1-week", label: "Babies 1-week pack", price: 90, description: "3 classes + 3 make-ups" },
        { id: "babies-monthly", label: "Babies Monthly", price: 200, description: "1 class per day, make-ups included" },
      ],
      addons: [
        { id: "reserve", label: "Priority reservation (12 spots)", price: 5 },
      ],
    },
  },
  {
    slug: "programas-asilos",
    title: "Programs for nursing homes",
    description: "Adapted Salsa and Zumba for senior residences. Inclusive and safe sessions.",
    level: "Beginner",
    duration: "55 min",
    requirements: ["Suitable space", "Center authorization"],
    benefits: [
      "Gentle mobility and rhythm",
      "Socialization and wellbeing",
      "Adaptations by mobility",
    ],
    syllabus: [
      "Guided warm-up",
      "Simple salsa sequences",
      "Adapted zumba blocks",
      "Cool down and breathing",
    ],
    schedule: {
      day: "To schedule with the center",
      time: "To coordinate",
      starts: "Coming soon",
      frequency: "Custom",
    },
    location: {
      address: "At the residence (scheduled visit)",
    },
    instructors: [
      { name: "PLI Team", role: "Visiting instructors" },
    ],
    enrollment: {
      services: [
        { id: "session", label: "Scheduled session", price: 0 },
      ],
      packages: [],
      addons: [],
    },
    heroMedia: {
      video: "/videos/DayCare.mp4",
      image: "/images/social-program/Background.jpg",
    },
  },
  {
    slug: "programas-discapacidad",
    title: "Programs for care centers",
    description: "Inclusive classes (Salsa, Zumba and more) designed for specialized care centers.",
    level: "Beginner",
    duration: "55 min",
    requirements: ["Coordination with the center", "Review adaptations"],
    benefits: [
      "Motor and musical stimulation",
      "Activities adapted to the group",
      "Focus on wellbeing and enjoyment",
    ],
    syllabus: [
      "Quick group assessment",
      "Soft rhythm blocks",
      "Assisted exercises",
      "Cool down and relaxation",
    ],
    schedule: {
      day: "To schedule with the center",
      time: "To coordinate",
      starts: "Coming soon",
      frequency: "Custom",
    },
    location: {
      address: "At the care center (scheduled visit)",
    },
    instructors: [
      { name: "PLI Team", role: "Visiting instructors" },
    ],
    enrollment: {
      services: [
        { id: "session", label: "Scheduled session", price: 0 },
      ],
      packages: [],
      addons: [],
    },
    heroMedia: {
      video: "/videos/DayCare.mp4",
      image: "/images/social-program/Background-1.jpg",
    },
  },
]
