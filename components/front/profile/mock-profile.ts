import type { ProfileStatus } from "./profile-types"

export const mockProfile = {
  name: "Student",
  level: "Beginner",
  status: "ACTIVE" as ProfileStatus,
  email: "",
  phone: "",
  avatar: "/images/Teaches/elvira-portrait.jpg",
  stats: {
    classesTaken: 18,
    lastClass: "Thursday 11:00 AM",
  },
  attendance: [
    { label: "Oct", value: 5 },
    { label: "Nov", value: 4 },
    { label: "Dec", value: 6 },
    { label: "Jan", value: 3 },
  ],
  moments: [
    "/images/carousel/_DSC1079.JPG",
    "/images/carousel/_DSC1087.JPG",
    "/images/carousel/_DSC1076.JPG",
    "/images/carousel/_DSC1082.JPG",
  ],
  preferredCourses: ["salsa-femenina-matutina", "salsa-nocturno"],
  schedule: {
    recurring: "Tuesday 7:00 PM",
    nextClass: "Tuesday 7:00 PM",
  },
  shoeTracking: {
    model: "Nike Flex",
    km: 320,
    maxKm: 500,
  },
}
