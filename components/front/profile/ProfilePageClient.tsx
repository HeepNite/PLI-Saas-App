"use client"

import React from "react"
import dynamic from "next/dynamic"
import GlassyCard from "@/components/front/courses/GlassyCard"
import { Award, Flame, Medal, Sparkles, Star, Trophy, X, Music2, Camera } from "lucide-react"
import { demoCourses } from "@/constants/courses"
import type { CourseData } from "@/constants/courses"
import { useUser } from "@clerk/nextjs"

const EnrollModal = dynamic(() => import("../courses/EnrollModal"), { ssr: false })

type ProfileStatus = "NEW" | "ACTIVE" | "ALUMNI"

const statusLabel: Record<ProfileStatus, string> = {
  NEW: "Nuevo",
  ACTIVE: "Activo",
  ALUMNI: "Ex‑alumno",
}

const mockProfile = {
  name: "Alumno",
  level: "Beginner",
  status: "ACTIVE" as ProfileStatus,
  email: "",
  phone: "",
  phoneVerified: false,
  avatar: "/images/Teaches/elvira-portrait.jpg",
  packages: [
    { label: "Morning 3-week pack", remaining: 6 },
    { label: "Practice video access", remaining: 1 },
  ],
  promos: ["New student promo (used)", "Winter bonus 10%"],
  stats: {
    classesTaken: 18,
    streak: "3 semanas",
    lastClass: "Jueves 11:00 AM",
  },
  coins: {
    current: 320,
    goal: 500,
    freeClassesEarned: 1,
  },
  attendance: [
    { label: "Oct", value: 5 },
    { label: "Nov", value: 4 },
    { label: "Dic", value: 6 },
    { label: "Ene", value: 3 },
  ],
  medals: ["5 clases", "10 clases", "1 mes activo"],
  moments: [
    "/images/carousel/_DSC1079.JPG",
    "/images/carousel/_DSC1087.JPG",
    "/images/carousel/_DSC1076.JPG",
    "/images/carousel/_DSC1082.JPG",
  ],
  preferredCourses: ["salsa-femenina-matutina", "salsa-nocturno"],
  schedule: {
    recurring: "Martes 7:00 PM",
    nextClass: "Martes 7:00 PM",
    hasActiveBooking: false,
  },
  shoeTracking: {
    model: "Nike Flex",
    km: 320,
    maxKm: 500,
  },
}

const toDateInput = (value?: string | Date | null) => {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toISOString().slice(0, 10)
}

const buildProfileFormState = (profile: any, user: any) => ({
  firstName: profile?.firstName || user?.firstName || user?.first_name || "",
  lastName: profile?.lastName || user?.lastName || user?.last_name || "",
  birthDate: toDateInput(profile?.birthDate),
  emergencyContactName: profile?.emergencyContactName || "",
  emergencyContactRelation: profile?.emergencyContactRelation || "",
  emergencyContactPhone: profile?.emergencyContactPhone || "",
})

export default function ProfilePageClient() {
  const { isLoaded, isSignedIn, user } = useUser()
  const stickyTop = 96
  const gridRef = React.useRef<HTMLDivElement>(null)
  const leftStickyRef = React.useRef<HTMLDivElement>(null)
  const rightStickyRef = React.useRef<HTMLDivElement>(null)
  const [activeMetric, setActiveMetric] = React.useState<"attendance" | "progress" | "rhythm">("attendance")
  const [hoverPoint, setHoverPoint] = React.useState<{ label: string; value: number; x: number; y: number; idx: number } | null>(null)
  const [coursePickerOpen, setCoursePickerOpen] = React.useState(false)
  const [selectedCourse, setSelectedCourse] = React.useState<CourseData | null>(null)
  const [enrollOpen, setEnrollOpen] = React.useState(false)
  const [profileLoading, setProfileLoading] = React.useState(false)
  const [profileSaving, setProfileSaving] = React.useState(false)
  const [profileError, setProfileError] = React.useState<string | null>(null)
  const [profileSaved, setProfileSaved] = React.useState(false)
  const [profileComplete, setProfileComplete] = React.useState(false)
  const [showProfileForm, setShowProfileForm] = React.useState(true)
  const [profileFormMounted, setProfileFormMounted] = React.useState(true)
  const [profileFormVisible, setProfileFormVisible] = React.useState(true)
  const [pointsBalance, setPointsBalance] = React.useState(0)
  const profileSavedTimeout = React.useRef<number | null>(null)
  const currentCoins = pointsBalance || mockProfile.coins.current
  const progress = Math.min(100, Math.round((currentCoins / mockProfile.coins.goal) * 100))
  const shoeProgress = Math.min(100, Math.round((mockProfile.shoeTracking.km / mockProfile.shoeTracking.maxKm) * 100))
  const [profileUser, setProfileUser] = React.useState({
    name: "",
    email: "",
    phone: "",
    phoneVerified: false,
    imageUrl: "",
    level: mockProfile.level,
    status: mockProfile.status,
  })
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [avatarUploading, setAvatarUploading] = React.useState(false)
  const [avatarError, setAvatarError] = React.useState<string | null>(null)
  const [profileForm, setProfileForm] = React.useState(() => buildProfileFormState(null, null))
  const bookingPrefillContact = React.useMemo(
    () => ({
      firstName: profileForm.firstName || user?.firstName || "",
      lastName: profileForm.lastName || user?.lastName || "",
      email: profileUser.email || user?.primaryEmailAddress?.emailAddress || "",
      phone: profileUser.phone || user?.primaryPhoneNumber?.phoneNumber || "+1 ",
    }),
    [
      profileForm.firstName,
      profileForm.lastName,
      profileUser.email,
      profileUser.phone,
      user?.firstName,
      user?.lastName,
      user?.primaryEmailAddress?.emailAddress,
      user?.primaryPhoneNumber?.phoneNumber,
    ]
  )

  const preferredSet = React.useMemo(() => new Set(mockProfile.preferredCourses), [])
  const orderedCourses = React.useMemo(() => {
    const preferred = demoCourses.filter((course) => preferredSet.has(course.slug))
    const rest = demoCourses.filter((course) => !preferredSet.has(course.slug))
    return [...preferred, ...rest]
  }, [preferredSet])

  React.useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    let active = true
    setProfileLoading(true)
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => {
        if (!active) return
        const profile = data.profile
        const userPayload = data.user || {}
        const nameFromPayload =
          userPayload.name || [userPayload.firstName, userPayload.lastName].filter(Boolean).join(" ").trim()
        setProfileUser({
          name: nameFromPayload || user?.fullName || "",
          email: userPayload.email || user?.primaryEmailAddress?.emailAddress || "",
          phone: userPayload.phone || user?.primaryPhoneNumber?.phoneNumber || "",
          phoneVerified: Boolean(user?.primaryPhoneNumber?.verification?.status === "verified"),
          imageUrl: user?.imageUrl || "",
          level: mockProfile.level,
          status: mockProfile.status,
        })
        setPointsBalance(data.pointsBalance || 0)
        setProfileComplete(Boolean(data.profileComplete))
        setProfileForm(buildProfileFormState(profile, data.user || user))
      })
      .catch(() => {
        if (!active) return
        setProfileUser({
          name: user?.fullName || "",
          email: user?.primaryEmailAddress?.emailAddress || "",
          phone: user?.primaryPhoneNumber?.phoneNumber || "",
          phoneVerified: Boolean(user?.primaryPhoneNumber?.verification?.status === "verified"),
          imageUrl: user?.imageUrl || "",
          level: mockProfile.level,
          status: mockProfile.status,
        })
        setProfileError("No pudimos cargar tu perfil.")
      })
      .finally(() => {
        if (!active) return
        setProfileLoading(false)
      })
    return () => {
      active = false
    }
  }, [isLoaded, isSignedIn, user?.firstName, user?.lastName, user?.primaryEmailAddress?.emailAddress, user?.primaryPhoneNumber?.phoneNumber])

  React.useEffect(() => {
    if (profileComplete) {
      setShowProfileForm(false)
    }
  }, [profileComplete])

  React.useEffect(() => {
    if (showProfileForm) {
      setProfileFormMounted(true)
      requestAnimationFrame(() => setProfileFormVisible(true))
      return
    }
    setProfileFormVisible(false)
    const id = window.setTimeout(() => setProfileFormMounted(false), 280)
    return () => window.clearTimeout(id)
  }, [showProfileForm])

  React.useEffect(() => {
    return () => {
      if (profileSavedTimeout.current) {
        window.clearTimeout(profileSavedTimeout.current)
      }
    }
  }, [])

  const completionPercent = React.useMemo(() => {
    const completionFields = [
      profileForm.firstName,
      profileForm.lastName,
      profileForm.birthDate,
      profileForm.emergencyContactName,
      profileForm.emergencyContactRelation,
      profileForm.emergencyContactPhone,
    ]
    return Math.round(
      (completionFields.filter((value) => value && value.trim().length > 0).length / completionFields.length) * 100
    )
  }, [profileForm])

  const avatarSrc =
    profileUser.imageUrl ||
    user?.imageUrl ||
    user?.externalAccounts?.[0]?.imageUrl ||
    mockProfile.avatar

  const handleAvatarUpload = async (file: File) => {
    setAvatarError(null)
    setAvatarUploading(true)
    try {
      if (file.size > 5 * 1024 * 1024) {
        setAvatarError("La imagen supera los 5MB.")
        return
      }
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAvatarError(data?.error || "No se pudo actualizar el avatar.")
        return
      }
      setProfileUser((prev) => ({ ...prev, imageUrl: data?.imageUrl || prev.imageUrl }))
    } catch {
      setAvatarError("No se pudo actualizar el avatar.")
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleProfileSave = async () => {
    setProfileSaving(true)
    setProfileError(null)
    setProfileSaved(false)
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm),
      })
      let data: any = null
      try {
        data = await res.json()
      } catch {
        data = null
      }
      if (!res.ok) {
        const fallback = res.status ? `No se pudo guardar el perfil (${res.status}).` : "No se pudo guardar el perfil."
        setProfileError(data?.error || fallback)
        return
      }
      setProfileComplete(Boolean(data.profileComplete))
      setPointsBalance(data.pointsBalance || 0)
      if (data?.profile) {
        setProfileForm(buildProfileFormState(data.profile, user))
      }
      setProfileSaved(true)
      if (profileSavedTimeout.current) {
        window.clearTimeout(profileSavedTimeout.current)
      }
      profileSavedTimeout.current = window.setTimeout(() => setProfileSaved(false), 2500)
    } catch {
      setProfileError("No se pudo guardar el perfil.")
    } finally {
      setProfileSaving(false)
    }
  }

  React.useEffect(() => {
    const grid = gridRef.current
    const left = leftStickyRef.current
    const right = rightStickyRef.current
    if (!grid || !left || !right) return

    let frame = 0

    const reset = (el: HTMLDivElement) => {
      el.style.position = ""
      el.style.top = ""
      el.style.left = ""
      el.style.width = ""
      el.style.zIndex = ""
    }

    const update = () => {
      if (window.innerWidth < 1024) {
        reset(left)
        reset(right)
        return
      }

      const scrollY = window.scrollY
      const gridRect = grid.getBoundingClientRect()
      const gridTop = gridRect.top + scrollY
      const gridBottom = gridTop + grid.offsetHeight
      const gridLeft = gridRect.left + window.scrollX
      const gridWidth = gridRect.width

      const leftParent = left.parentElement as HTMLElement | null
      const rightParent = right.parentElement as HTMLElement | null
      const leftWidth = leftParent?.getBoundingClientRect().width ?? left.getBoundingClientRect().width
      const rightWidth = rightParent?.getBoundingClientRect().width ?? right.getBoundingClientRect().width

      const apply = (el: HTMLDivElement, leftPos: number, width: number, maxTop: number) => {
        if (scrollY + stickyTop < gridTop) {
          reset(el)
          return
        }
        if (scrollY + stickyTop >= maxTop) {
          el.style.position = "absolute"
          el.style.top = `${maxTop - gridTop}px`
          el.style.left = `${leftPos - gridLeft}px`
          el.style.width = `${width}px`
          el.style.zIndex = "20"
          return
        }
        el.style.position = "fixed"
        el.style.top = `${stickyTop}px`
        el.style.left = `${leftPos}px`
        el.style.width = `${width}px`
        el.style.zIndex = "20"
      }

      apply(left, gridLeft, leftWidth, gridBottom - left.offsetHeight)
      apply(right, gridLeft + gridWidth - rightWidth, rightWidth, gridBottom - right.offsetHeight)
    }

    const onScroll = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }

    const resizeObserver = new ResizeObserver(() => onScroll())
    resizeObserver.observe(grid)
    resizeObserver.observe(left)
    resizeObserver.observe(right)

    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    update()

    return () => {
      if (frame) cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      reset(left)
      reset(right)
    }
  }, [])

  const metricConfig = {
    attendance: {
      label: "Asistencia",
      color: "var(--brand,#b61616)",
      values: [5, 4, 6, 3],
    },
    progress: {
      label: "Progreso",
      color: "#ef6b6b",
      values: [2, 3, 4, 5],
    },
    rhythm: {
      label: "Ritmo",
      color: "#f59e0b",
      values: [1, 2, 3, 4],
    },
  }

  const months = ["Oct", "Nov", "Dic", "Ene"]
  const series = metricConfig[activeMetric]
  const maxValue = Math.max(...series.values, 6)
  const chartWidth = 520
  const chartHeight = 170
  const paddingX = 20
  const paddingY = 10
  const gridCount = 5
  const stepX = (chartWidth - paddingX * 2) / (series.values.length - 1)
  const toPoint = (value: number, index: number) => {
    const x = paddingX + index * stepX
    const y = chartHeight - paddingY - (value / maxValue) * (chartHeight - paddingY * 2)
    return { x, y }
  }
  const points = series.values.map((value, index) => ({ value, label: months[index], ...toPoint(value, index), idx: index }))
  const pathD = points
    .map((point, idx) => `${idx === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ")
  const targetValues = series.values.map((value, idx) => {
    const prev = series.values[idx - 1] ?? value
    const next = series.values[idx + 1] ?? value
    return Math.max(1, Math.round((value + prev + next) / 3))
  })
  const targetPoints = targetValues.map((value, index) => ({ value, label: months[index], ...toPoint(value, index) }))
  const targetPathD = targetPoints.map((point, idx) => `${idx === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ")
  const yTicks = Array.from({ length: gridCount }).map((_, idx) => {
    const ratio = idx / (gridCount - 1)
    const y = paddingY + ratio * (chartHeight - paddingY * 2)
    const value = Math.round(maxValue - ratio * maxValue)
    return { y, value }
  })

  const pieSegments = [
    { label: "Asistencia", value: 42, color: "var(--brand,#b61616)" },
    { label: "Progreso", value: 34, color: "#ef6b6b" },
    { label: "Ritmo", value: 24, color: "#f59e0b" },
  ]
  const pieStops = pieSegments.reduce<{ value: number; color: string }[]>((acc, segment) => {
    const total = acc.reduce((sum, s) => sum + s.value, 0)
    acc.push({ value: total + segment.value, color: segment.color })
    return acc
  }, [])
  const pieGradient = pieStops
    .map((stop, idx) => {
      const start = idx === 0 ? 0 : pieStops[idx - 1].value
      return `${stop.color} ${start}% ${stop.value}%`
    })
    .join(", ")

  const medalItems = [
    { label: "5 clases", icon: Trophy },
    { label: "10 clases", icon: Medal },
    { label: "1 mes activo", icon: Flame },
    { label: "Consistencia", icon: Star },
  ]

  const buildCalendar = () => {
    const year = 2026
    const monthIndex = 1 // Febrero
    const firstDay = new Date(year, monthIndex, 1)
    const lastDay = new Date(year, monthIndex + 1, 0)
    const startWeekday = firstDay.getDay()
    const totalDays = lastDay.getDate()
    const days: Array<{ day: number; isCurrent: boolean }> = []
    for (let i = 0; i < startWeekday; i += 1) {
      days.push({ day: 0, isCurrent: false })
    }
    for (let day = 1; day <= totalDays; day += 1) {
      days.push({ day, isCurrent: true })
    }
    while (days.length % 7 !== 0) {
      days.push({ day: 0, isCurrent: false })
    }
    return days
  }
  const calendarDays = buildCalendar()
  const classDays = new Set([4, 11, 18, 25])

  return (
    <main className="min-h-[70vh] bg-background">
      <div className="mx-auto w-full max-w-screen-xl 2xl:max-w-[2500px] px-4 sm:px-6 lg:px-8 py-8">
        <div ref={gridRef} className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:items-start">
          {/* Left */}
          <aside className="lg:col-span-2 lg:self-start space-y-4">
            <div ref={leftStickyRef}>
            <GlassyCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={avatarSrc} alt={profileUser.name || mockProfile.name} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-[var(--brand,#b61616)] text-white shadow-[0_6px_16px_-6px_rgba(182,22,22,0.8)]"
                    aria-label="Cambiar avatar"
                    title="Cambiar avatar"
                  >
                    <Camera className="h-3.5 w-3.5" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleAvatarUpload(file)
                      e.currentTarget.value = ""
                    }}
                  />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Alumno</p>
                  <h2 className="text-lg font-semibold">{profileUser.name || mockProfile.name}</h2>
                  <p className="text-xs text-white/60">{mockProfile.level}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md border border-white/10 px-3 py-2">
                  <p className="text-[color:var(--brand)]">Estado</p>
                  <p className="font-semibold">{statusLabel[profileUser.status]}</p>
                </div>
                <div className="rounded-md border border-white/10 px-3 py-2">
                  <p className="text-[color:var(--brand)]">Teléfono</p>
                  <p className="font-semibold">{profileUser.phoneVerified ? "Verificado" : "Sin validar"}</p>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-sm text-white/70">
                <p>{profileUser.email || mockProfile.email}</p>
                <p>{profileUser.phone || mockProfile.phone}</p>
              </div>
              {avatarError && <p className="mt-2 text-xs text-red-400">{avatarError}</p>}
              {avatarUploading && <p className="mt-2 text-xs text-white/60">Actualizando avatar...</p>}

              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Actividad</p>
                <p className="mt-2">Clases tomadas: <strong>{mockProfile.stats.classesTaken}</strong></p>
                <p>Racha: <strong>{mockProfile.stats.streak}</strong></p>
                <p>Última clase: <strong>{mockProfile.stats.lastClass}</strong></p>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowProfileForm(true)}
                  className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 hover:border-white/30"
                >
                  Editar perfil
                </button>
                {(() => {
                  const ringColor =
                    completionPercent >= 80 ? "rgba(34,197,94,1)" : completionPercent >= 50 ? "rgba(245,158,11,1)" : "rgba(182,22,22,1)"
                  return (
                    <div
                      className="relative h-10 w-10 rounded-full p-[2px]"
                      style={{ background: `conic-gradient(${ringColor} ${completionPercent}%, rgba(255,255,255,0.12) 0)` }}
                    >
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-black/70 text-[11px] font-semibold text-white">
                    {completionPercent}%
                  </div>
                    </div>
                  )
                })()}
                {!profileComplete && (
                  <span className="text-[11px] text-[var(--brand,#b61616)]">Completa tu perfil y gana puntos</span>
                )}
              </div>
            </GlassyCard>

            <GlassyCard className="p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Paquetes y promos</p>
              <div className="mt-3 space-y-3 text-sm">
                {mockProfile.packages.map((pkg) => (
                  <div key={pkg.label} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <p className="font-semibold">{pkg.label}</p>
                    <p className="text-xs text-white/60">Restantes: {pkg.remaining}</p>
                  </div>
                ))}
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <p className="font-semibold">Promos activas</p>
                  <p className="text-xs text-white/60">{mockProfile.promos.join(" • ")}</p>
                </div>
              </div>
            </GlassyCard>
            </div>
          </aside>

          {/* Center */}
          <section className="lg:col-span-7 space-y-6">
            {profileFormMounted && (
            <div
              className={`transition-all duration-300 ease-out overflow-hidden ${
                profileFormVisible ? "max-h-[1600px] opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-2"
              }`}
            >
            <GlassyCard className="p-5 relative">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Perfil</p>
                  <h3 className="mt-2 text-lg font-semibold text-white">Completa tu perfil y gana puntos</h3>
                  <p className="mt-1 text-sm text-white/60">
                    Al completar tu perfil sumás puntos para canjear por beneficios.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="rounded-full border border-[var(--brand,#b61616)]/60 bg-[rgba(182,22,22,0.15)] px-4 py-2 text-sm font-semibold text-[var(--brand,#b61616)] shadow-[0_0_20px_rgba(182,22,22,0.25)]">
                    PLI Coins: <span className="text-white">{pointsBalance}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowProfileForm(false)}
                    className="rounded-full border border-white/10 bg-black/40 p-2 text-white/70 hover:text-white"
                    aria-label="Cerrar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <fieldset className="space-y-2">
                  <label className="text-sm font-medium">Nombre</label>
                  <input
                    value={profileForm.firstName}
                    onChange={(e) => setProfileForm((s) => ({ ...s, firstName: e.target.value }))}
                    className="w-full rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm text-white/90 placeholder:text-white/40"
                    placeholder="Tu nombre"
                  />
                </fieldset>
                <fieldset className="space-y-2">
                  <label className="text-sm font-medium">Apellido</label>
                  <input
                    value={profileForm.lastName}
                    onChange={(e) => setProfileForm((s) => ({ ...s, lastName: e.target.value }))}
                    className="w-full rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm text-white/90 placeholder:text-white/40"
                    placeholder="Tu apellido"
                  />
                </fieldset>
                <fieldset className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium">Email</label>
                  <input
                    value={user?.primaryEmailAddress?.emailAddress || ""}
                    readOnly
                    className="w-full rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm text-white/60"
                  />
                </fieldset>
                <fieldset className="space-y-2">
                  <label className="text-sm font-medium">Teléfono</label>
                  <input
                    value={user?.primaryPhoneNumber?.phoneNumber || ""}
                    readOnly
                    className="w-full rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm text-white/60"
                  />
                </fieldset>
                <fieldset className="space-y-2">
                  <label className="text-sm font-medium">Cumpleaños</label>
                  <input
                    type="date"
                    value={profileForm.birthDate}
                    onChange={(e) => setProfileForm((s) => ({ ...s, birthDate: e.target.value }))}
                    className="w-full rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm text-white/90"
                  />
                </fieldset>
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Contacto de emergencia</p>
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <fieldset className="space-y-2">
                    <label className="text-sm font-medium">Nombre</label>
                    <input
                      value={profileForm.emergencyContactName}
                      onChange={(e) => setProfileForm((s) => ({ ...s, emergencyContactName: e.target.value }))}
                      className="w-full rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm text-white/90"
                      placeholder="Nombre y apellido"
                    />
                  </fieldset>
                  <fieldset className="space-y-2">
                    <label className="text-sm font-medium">Relación</label>
                    <input
                      value={profileForm.emergencyContactRelation}
                      onChange={(e) => setProfileForm((s) => ({ ...s, emergencyContactRelation: e.target.value }))}
                      className="w-full rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm text-white/90"
                      placeholder="Ej: Madre, Padre, Amigo"
                    />
                  </fieldset>
                  <fieldset className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-medium">Teléfono</label>
                    <input
                      value={profileForm.emergencyContactPhone}
                      onChange={(e) => setProfileForm((s) => ({ ...s, emergencyContactPhone: e.target.value }))}
                      className="w-full rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm text-white/90"
                      placeholder="Número"
                    />
                  </fieldset>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-white/60">
                  {profileComplete ? "Perfil completo. ¡Seguís sumando puntos!" : "Completa tu perfil para ganar 10 puntos."}
                </div>
                <button
                  type="button"
                  onClick={handleProfileSave}
                  disabled={profileSaving || profileLoading}
                  className="rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {profileSaving ? "Guardando..." : "Guardar perfil"}
                </button>
              </div>
              {profileError && <p className="mt-2 text-sm text-red-400">{profileError}</p>}
              {profileSaved && !profileError && (
                <p className="mt-2 text-sm text-emerald-300">Perfil guardado.</p>
              )}
            </GlassyCard>
            </div>
            )}

            <GlassyCard className="p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Momentos del alumno</p>
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                {mockProfile.moments.map((src, idx) => (
                  <div key={`moment-${idx}`} className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="momento" className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            </GlassyCard>

            <GlassyCard className="p-4">
              <div className="relative overflow-visible rounded-3xl border border-white/10 bg-gradient-to-br from-[#120b14] via-[#0f0b12] to-[#0b0b0f] p-5 shadow-[0_30px_120px_-60px_rgba(182,22,22,0.8)]">
                <div className="pointer-events-none absolute -left-24 -top-20 h-40 w-40 rounded-full bg-[radial-gradient(circle_at_center,rgba(182,22,22,0.45),transparent_70%)] blur-3xl" />
                <div className="pointer-events-none absolute right-10 top-6 h-24 w-24 rounded-full bg-[radial-gradient(circle_at_center,rgba(239,107,107,0.4),transparent_70%)] blur-3xl" />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Analytics</p>
                    <p className="mt-2 text-sm text-white/70">Progreso general del alumno.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60">Filtros</span>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60">Este mes</span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {(["attendance", "progress", "rhythm"] as const).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveMetric(key)}
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        activeMetric === key
                          ? "border-[var(--brand,#b61616)] bg-[rgba(182,22,22,0.22)] text-white shadow-[0_12px_30px_-16px_rgba(182,22,22,0.8)]"
                          : "border-white/10 text-white/70 hover:border-white/30"
                      }`}
                    >
                      {metricConfig[key].label}
                    </button>
                  ))}
                </div>

                <div className="mt-5 grid grid-cols-1 lg:grid-cols-[0.65fr_2.75fr_0.85fr] gap-4 items-stretch">
                  <div className="space-y-3 h-full flex flex-col">
                    <div className="relative min-h-[148px] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-[#0b0b0f]/80 px-5 py-4 flex-1 flex flex-col justify-between text-center">
                      <div className="pointer-events-none absolute -left-10 -top-10 h-24 w-24 rounded-full bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.35),transparent_70%)] blur-2xl" />
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Clases totales</p>
                      <p className="mt-2 text-[52px] font-semibold leading-none tracking-tight">{mockProfile.stats.classesTaken}</p>
                      <p className="mt-2 text-[11px] text-white/50">+12% vs mes anterior</p>
                    </div>
                    <div className="min-h-[148px] rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-[#0b0b0f]/80 px-5 py-4 flex-1 flex flex-col justify-between text-center">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Promedio semanal</p>
                      <p className="mt-2 text-[52px] font-semibold leading-none tracking-tight">3.4</p>
                      <p className="mt-2 text-[11px] text-white/50">Racha: {mockProfile.stats.streak}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 h-full flex flex-col">
                    <div className="flex items-center justify-between text-[11px] text-white/60">
                      <span>{metricConfig[activeMetric].label}</span>
                      <span>Últimos 4 meses</span>
                    </div>
                    <div className="mt-2 flex flex-col overflow-visible">
                      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#141017] via-[#0d0b12] to-[#09090d] px-3 pb-2 pt-3 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.9)]">
                        <div className="pointer-events-none absolute right-4 top-3 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] text-white/70">
                          Progreso estimado
                        </div>
                        <div className="grid grid-cols-[40px_1fr] gap-2">
                          <div className="relative h-[185px] text-[10px] text-white/40">
                            {yTicks.map((tick) => (
                              <span
                                key={`y-label-${tick.value}`}
                                className="absolute right-1"
                                style={{ top: `${(tick.y / chartHeight) * 100}%`, transform: "translateY(-50%)" }}
                              >
                                {tick.value}
                              </span>
                            ))}
                          </div>
                          <div className="relative h-[185px]">
                            <svg
                              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                              preserveAspectRatio="xMidYMid meet"
                              className="h-full w-full"
                            >
                              <defs>
                                <linearGradient id="lineGlow" x1="0" y1="0" x2="1" y2="0">
                                  <stop offset="0%" stopColor="rgba(182,22,22,0.25)" />
                                  <stop offset="50%" stopColor="rgba(182,22,22,0.95)" />
                                  <stop offset="100%" stopColor="rgba(182,22,22,0.4)" />
                                </linearGradient>
                                <linearGradient id="areaGlow" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="rgba(182,22,22,0.5)" />
                                  <stop offset="55%" stopColor="rgba(182,22,22,0.2)" />
                                  <stop offset="100%" stopColor="rgba(11,11,15,0)" />
                                </linearGradient>
                                <linearGradient id="targetGlow" x1="0" y1="0" x2="1" y2="0">
                                  <stop offset="0%" stopColor="rgba(245,158,11,0.4)" />
                                  <stop offset="100%" stopColor="rgba(245,158,11,0.95)" />
                                </linearGradient>
                              </defs>
                              {yTicks.map((tick) => (
                                <line
                                  key={`grid-${tick.value}`}
                                  x1={paddingX}
                                  x2={chartWidth - paddingX}
                                  y1={tick.y}
                                  y2={tick.y}
                                  stroke="rgba(255,255,255,0.08)"
                                  strokeDasharray="4 6"
                                />
                              ))}
                              <path
                                d={`${pathD} L ${chartWidth - paddingX} ${chartHeight - paddingY} L ${paddingX} ${chartHeight - paddingY} Z`}
                                fill="url(#areaGlow)"
                              />
                              <path
                                d={pathD}
                                fill="none"
                                stroke="url(#lineGlow)"
                                strokeWidth="3"
                                strokeLinecap="round"
                                style={{ filter: "drop-shadow(0 0 8px rgba(182,22,22,0.6))" }}
                              />
                              <path
                                d={targetPathD}
                                fill="none"
                                stroke="url(#targetGlow)"
                                strokeWidth="2"
                                strokeLinecap="round"
                              />
                              {targetPoints.map((point, idx) => (
                                <circle
                                  key={`target-${point.label}`}
                                  cx={point.x}
                                  cy={point.y}
                                  r={hoverPoint?.idx === idx ? 4.5 : 3}
                                  fill="rgba(245,158,11,0.95)"
                                  stroke="rgba(255,255,255,0.6)"
                                  strokeWidth="1"
                                />
                              ))}
                              {hoverPoint && (
                                <line
                                  x1={hoverPoint.x}
                                  x2={hoverPoint.x}
                                  y1={paddingY}
                                  y2={chartHeight - paddingY}
                                  stroke="rgba(255,255,255,0.35)"
                                  strokeDasharray="4 6"
                                />
                              )}
                              {points.map((point, idx) => {
                                const isActive = hoverPoint?.idx === idx
                                return (
                                  <g
                                    key={`${point.label}-${point.value}`}
                                    onMouseEnter={() =>
                                      setHoverPoint({ label: point.label, value: point.value, x: point.x, y: point.y, idx: point.idx })
                                    }
                                    onMouseLeave={() => setHoverPoint(null)}
                                  >
                                    <circle cx={point.x} cy={point.y} r={isActive ? 18 : 12} fill="rgba(182,22,22,0.2)" />
                                    <circle
                                      cx={point.x}
                                      cy={point.y}
                                      r={isActive ? 7 : 6}
                                      fill="#fff"
                                      stroke="rgba(182,22,22,0.85)"
                                      strokeWidth="2"
                                    />
                                  </g>
                                )
                              })}
                            </svg>
                            {hoverPoint && (
                              <div
                                className="pointer-events-none absolute z-10 min-w-[170px] rounded-2xl border border-white/10 bg-[#151018] px-4 py-3 text-[11px] text-white/80 shadow-[0_25px_55px_-30px_rgba(0,0,0,0.85)] backdrop-blur-md"
                                style={{
                                  left: `clamp(12%, ${(hoverPoint.x / chartWidth) * 100}%, 88%)`,
                                  top: `clamp(18%, ${(hoverPoint.y / chartHeight) * 100}%, 78%)`,
                                  transform: "translate(-50%, -40%)",
                                }}
                              >
                                <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">
                                  {hoverPoint.label} 2026
                                </p>
                                <div className="mt-2 grid grid-cols-2 gap-4 text-xs">
                                  <div>
                                    <p className="text-white/50">{metricConfig[activeMetric].label}</p>
                                    <p className="text-sm font-semibold text-white">{hoverPoint.value}</p>
                                  </div>
                                  <div>
                                    <p className="text-white/50">Meta</p>
                                    <p className="text-sm font-semibold text-white">{targetValues[hoverPoint.idx]}</p>
                                  </div>
                                </div>
                                <div className="mt-3 flex items-center gap-3 text-[10px] text-white/50">
                                  <span className="inline-flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-[var(--brand,#b61616)]" />
                                    Actual
                                  </span>
                                  <span className="inline-flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-[#f59e0b]" />
                                    Objetivo
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-1 relative h-3 text-[11px] text-white/50 overflow-visible ml-[40px]">
                        {points.map((point) => (
                          <span
                            key={`label-${point.label}`}
                            className="absolute"
                            style={{
                              left: `${(point.x / chartWidth) * 100}%`,
                              transform: "translateX(-50%)",
                            }}
                          >
                            {point.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 h-full flex flex-col">
                    <div className="relative min-h-[148px] overflow-hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-4 flex-1 flex flex-col">
                      <div className="pointer-events-none absolute -right-10 -bottom-10 h-24 w-24 rounded-full bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.4),transparent_70%)] blur-2xl" />
                      <div className="flex items-center gap-2 text-[11px] text-white/60">
                        <span className="h-2 w-2 rounded-full bg-[var(--brand,#b61616)]" />
                        Distribución
                      </div>
                      <div className="mt-3 flex flex-1 flex-col">
                        <div className="flex flex-1 items-center justify-center">
                          <div className="relative h-32 w-32">
                          <div
                            className="absolute inset-0 rounded-full"
                            style={{ background: `conic-gradient(${pieGradient})` }}
                          />
                          <div className="absolute inset-[10px] rounded-full bg-[#0b0b0f] border border-white/10 flex items-center justify-center">
                            <div className="text-center">
                              <p className="text-[10px] text-white/60">Total</p>
                              <p className="text-lg font-semibold">100%</p>
                            </div>
                          </div>
                          <div className="absolute -bottom-4 left-1/2 h-6 w-16 -translate-x-1/2 rounded-full bg-[var(--brand,#b61616)]/30 blur-xl" />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <div className="space-y-2 text-[11px] text-white/70">
                        {pieSegments.map((seg) => (
                          <div key={seg.label} className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full" style={{ background: seg.color }} />
                              <span>{seg.label}</span>
                            </div>
                            <span className="text-white/50">{seg.value}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </GlassyCard>

            <GlassyCard className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">PLI Coins</p>
                  <p className="mt-2 text-sm text-white/70">
                    Te faltan <strong>{Math.max(0, mockProfile.coins.goal - currentCoins)}</strong> puntos para una clase gratis.
                  </p>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
                  Meta: {mockProfile.coins.goal} PLI Coins
                </div>
              </div>
              <div className="relative mt-4 h-28 overflow-hidden rounded-2xl border border-white/10">
                <div className="absolute inset-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/carousel/_DSC1087.JPG"
                    alt="Clase gratis"
                    className="h-full w-full object-cover grayscale"
                  />
                </div>
                <div className="absolute inset-0 overflow-hidden" style={{ width: `${progress}%` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/carousel/_DSC1087.JPG"
                    alt="Clase gratis progreso"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-3 left-3 text-sm font-semibold">
                  {currentCoins} / {mockProfile.coins.goal} PLI Coins
                </div>
              </div>
              <p className="mt-3 text-xs text-white/60">
                Clases gratis obtenidas: <strong>{mockProfile.coins.freeClassesEarned}</strong>
              </p>
            </GlassyCard>

            <GlassyCard className="p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Medallas</p>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {medalItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <div key={item.label} className="flex flex-col items-center gap-2 text-center">
                      <div className="relative">
                        <div className="h-14 w-14 rounded-full bg-gradient-to-br from-[var(--brand,#b61616)] to-[#f97316] p-[2px] shadow-[0_12px_40px_-20px_rgba(182,22,22,0.85)]">
                          <div className="flex h-full w-full items-center justify-center rounded-full bg-black/70">
                            <Icon className="h-6 w-6 text-white" />
                          </div>
                        </div>
                        <div className="absolute -bottom-2 left-1/2 h-4 w-10 -translate-x-1/2 rounded-full bg-[var(--brand,#b61616)]/40 blur-sm" />
                      </div>
                      <p className="text-xs text-white/80">{item.label}</p>
                    </div>
                  )
                })}
              </div>
            </GlassyCard>

            <GlassyCard className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Agenda</p>
                  <p className="mt-2 text-sm text-white/70">Tu clase recurrente: <strong>{mockProfile.schedule.recurring}</strong></p>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/60">
                  <button className="rounded-full border border-white/10 px-2 py-1">Feb</button>
                  <button className="rounded-full border border-white/10 px-2 py-1">Mar</button>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>Febrero 2026</span>
                  <button className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60">Hoy</button>
                </div>
                <div className="mt-3 grid grid-cols-7 text-[11px] uppercase tracking-[0.18em] text-white/40">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d} className="py-2 text-center">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-px rounded-lg border border-white/10 bg-white/5 text-sm">
                  {calendarDays.map((day, idx) => (
                    <div
                      key={`cal-${idx}`}
                      className={`min-h-[72px] border border-white/5 px-2 py-2 text-right text-xs ${
                        day.isCurrent ? "text-white/80" : "text-white/20"
                      }`}
                    >
                      {day.day > 0 && (
                        <>
                          <div>{day.day}</div>
                          {classDays.has(day.day) && (
                            <div className="mt-2 hidden items-center gap-1 rounded-full bg-[var(--brand,#b61616)]/70 px-2 py-1 text-[10px] text-left text-white sm:inline-flex">
                              Clase 7:00 PM
                            </div>
                          )}
                          {classDays.has(day.day) && (
                            <div className="mt-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand,#b61616)]/80 text-white sm:hidden">
                              <Music2 className="h-3.5 w-3.5" aria-hidden />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-sm">
                Próxima clase: <strong>{mockProfile.schedule.nextClass}</strong>
              </div>
              {!mockProfile.schedule.hasActiveBooking && (
                <div className="mt-3 rounded-lg border border-[var(--brand,#b61616)]/40 bg-[rgba(182,22,22,0.1)] px-3 py-3 text-sm">
                  Tu próxima clase es el martes. ¿Deseas agendar?
                </div>
              )}
            </GlassyCard>

            <GlassyCard className="p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Equipo</p>
              <div className="mt-4 flex items-center gap-4">
                <div className="h-20 w-28 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/shoes-pli.svg" alt="Calzado" className="h-full w-full object-cover" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-white/80">Calzado: {mockProfile.shoeTracking.model}</p>
                  <div className="mt-2 h-3 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-[var(--brand,#b61616)]" style={{ width: `${shoeProgress}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-white/60">
                    {mockProfile.shoeTracking.km} km usados · Recomendado cambiar en {mockProfile.shoeTracking.maxKm} km.
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                  {shoeProgress}% vida
                </span>
              </div>
            </GlassyCard>
          </section>

          {/* Right */}
          <aside className="lg:col-span-3 lg:self-start space-y-4">
            <div ref={rightStickyRef}>
            <GlassyCard className="p-4">
              <h3 className="text-base font-semibold">Reservar nueva clase</h3>
              <p className="mt-2 text-sm text-white/60">Agenda una nueva clase disponible en tu horario.</p>
              <button
                className="mt-4 w-full rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white"
                onClick={() => setCoursePickerOpen(true)}
              >
                Reservar
              </button>
            </GlassyCard>
            <GlassyCard className="p-4">
              <h3 className="text-base font-semibold">Cambiar clase</h3>
              <p className="mt-2 text-sm text-white/60">Reprograma tu próxima clase sin perder tu cupo.</p>
              <button className="mt-4 w-full rounded-md border border-white/10 px-4 py-2 text-sm font-semibold text-white/80">
                Cambiar
              </button>
            </GlassyCard>
            <GlassyCard className="p-4">
              <h3 className="text-base font-semibold">Suspender / Cancelar</h3>
              <p className="mt-2 text-sm text-white/60">Pausá o cancelá tu suscripción cuando lo necesites.</p>
              <button className="mt-4 w-full rounded-md border border-[var(--brand,#b61616)]/50 px-4 py-2 text-sm font-semibold text-white/80">
                Gestionar
              </button>
            </GlassyCard>
            </div>
          </aside>
        </div>
      </div>

      {coursePickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm" data-lenis-prevent>
          <div className="relative w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#141017] via-[#0d0b12] to-[#09090d] p-6 shadow-[0_30px_120px_-50px_rgba(0,0,0,0.85)] flex flex-col">
            <button
              className="absolute right-5 top-5 rounded-full border border-white/10 bg-black/40 p-2 text-white/70 hover:text-white"
              onClick={() => setCoursePickerOpen(false)}
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Reservar</p>
                <h3 className="mt-2 text-lg font-semibold text-white">Elegí la clase que querés reservar</h3>
                <p className="mt-1 text-sm text-white/60">Mostramos primero las clases que más elegís.</p>
              </div>
            </div>

            <div className="mt-6 flex-1 min-h-0 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {orderedCourses.map((course) => (
                <button
                  key={course.slug}
                  type="button"
                  onClick={() => {
                    setSelectedCourse(course)
                    setCoursePickerOpen(false)
                    setEnrollOpen(true)
                  }}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-[var(--brand,#b61616)]/60 hover:bg-white/10"
                >
                  <div className="relative mb-4 aspect-[16/10] w-full overflow-hidden rounded-xl border border-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={course.heroMedia?.image ?? "/images/carousel/_DSC1079.JPG"}
                      alt={course.title}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-white">{course.title}</p>
                      <p className="mt-1 text-xs text-white/60">{course.level} · {course.duration}</p>
                    </div>
                    {preferredSet.has(course.slug) && (
                      <span className="rounded-full border border-[var(--brand,#b61616)]/60 bg-[rgba(182,22,22,0.15)] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--brand,#b61616)]">
                        Preferida
                      </span>
                    )}
                  </div>
                  <div className="mt-4 text-xs text-white/60">
                    <p>{course.schedule.day}</p>
                    <p>{course.location.address}</p>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-[11px] text-white/70">
                    <span className="rounded-full border border-white/10 px-2 py-1">Ver detalles</span>
                    <span className="rounded-full border border-white/10 px-2 py-1">Reservar</span>
                  </div>
                </button>
              ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedCourse && (
        <EnrollModal
          course={selectedCourse}
          open={enrollOpen}
          initialStep={1}
          onCloseAction={() => setEnrollOpen(false)}
          prefillContact={bookingPrefillContact}
        />
      )}
    </main>
  )
}
