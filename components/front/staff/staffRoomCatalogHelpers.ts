type RoomLike = {
  id: string
  name: string
  location: string | null
  active: boolean
}

type RoomStatusFilter = "all" | "active" | "inactive"

export const buildRoomLookup = <TRoom extends RoomLike>(rooms: TRoom[]) =>
  rooms.reduce<Record<string, TRoom>>((acc, room) => {
    acc[room.id] = room
    return acc
  }, {})

export const buildCourseRoomOptions = <TRoom extends RoomLike>(rooms: TRoom[], defaultRoomId: string) => {
  const activeRooms = rooms.filter((room) => room.active)
  if (!defaultRoomId) return activeRooms

  const selectedRoom = rooms.find((room) => room.id === defaultRoomId)
  if (!selectedRoom || activeRooms.some((room) => room.id === selectedRoom.id)) return activeRooms

  return [selectedRoom, ...activeRooms]
}

export const filterVisibleRooms = <TRoom extends RoomLike>(rooms: TRoom[], query: string, statusFilter: RoomStatusFilter) => {
  const normalizedQuery = query.trim().toLowerCase()
  return rooms.filter((room) => {
    if (statusFilter === "active" && !room.active) return false
    if (statusFilter === "inactive" && room.active) return false
    if (!normalizedQuery) return true
    return `${room.name} ${room.location || ""}`.toLowerCase().includes(normalizedQuery)
  })
}

export const resolveRoomDisableActionState = (room: Pick<RoomLike, "active" | "id">, roomBusyId: string | null) => ({
  disabled: !room.active || roomBusyId === room.id,
  label: roomBusyId === room.id ? "Disabling..." : room.active ? "Disable" : "Disabled",
})

export const resolveRoomCatalogErrorMessage = (sources: Array<unknown>) => {
  for (const source of sources) {
    if (source && typeof source === "object" && typeof (source as { error?: unknown }).error === "string") {
      return (source as { error: string }).error
    }
  }

  return "Failed to load school catalog."
}
