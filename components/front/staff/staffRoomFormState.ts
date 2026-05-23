const toLocalIsoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`

export type RoomFormState = {
  id: string
  name: string
  capacity: string
  location: string
  active: boolean
}

export type RoomReservationFormState = {
  roomId: string
  title: string
  reason: string
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  assignedStaffClerkUserId: string
}

export type RoomReservationTimeOption = {
  value: string
  label: string
}

type RoomFormRoomLike = {
  id: string
  name: string
  capacity: number
  location: string | null
  active: boolean
}

export const createInitialRoomForm = (): RoomFormState => ({
  id: "",
  name: "",
  capacity: "",
  location: "",
  active: true,
})

export const createRoomFormFromRoom = (room: RoomFormRoomLike): RoomFormState => ({
  id: room.id,
  name: room.name,
  capacity: String(room.capacity),
  location: room.location || "",
  active: room.active,
})

export const createEmptyRoomReservationForm = (): RoomReservationFormState => ({
  roomId: "",
  title: "",
  reason: "",
  startDate: toLocalIsoDate(new Date()),
  endDate: "",
  startTime: "",
  endTime: "",
  assignedStaffClerkUserId: "",
})

export const ROOM_RESERVATION_TIME_OPTIONS: RoomReservationTimeOption[] = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2)
  const minute = index % 2 === 0 ? "00" : "30"
  const value = `${String(hour).padStart(2, "0")}:${minute}`
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  const ampm = hour < 12 ? "AM" : "PM"
  return {
    value,
    label: `${hour12}:${minute} ${ampm}`,
  }
})
