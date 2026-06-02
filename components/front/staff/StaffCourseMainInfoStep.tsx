import React from "react"

import { SCHOOL_COURSE_KINDS } from "./staffAdminConstants"
import type { RoomRow, CourseFormState } from "./staffAdminTypes"
import type { CourseSlugConflictState } from "./useStaffCoursesAdmin"

const COURSE_FIELD_CLASS = "w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
const COURSE_SLUG_FIELD_CLASS = "w-full rounded-md border bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:bg-white/5 dark:text-white"

type StaffCourseMainInfoStepProps = {
  visible: boolean
  courseForm: CourseFormState
  setCourseForm: React.Dispatch<React.SetStateAction<CourseFormState>>
  courseSlugConflict: CourseSlugConflictState
  courseRoomOptions: RoomRow[]
  roomById: Record<string, RoomRow>
  onUseSlugSuggestion: () => void
  onEditExistingCourse: () => void
}

export default function StaffCourseMainInfoStep({
  visible,
  courseForm,
  setCourseForm,
  courseSlugConflict,
  courseRoomOptions,
  roomById,
  onUseSlugSuggestion,
  onEditExistingCourse,
}: StaffCourseMainInfoStepProps) {
  if (!visible) return null

  const updateCourseField = <Field extends keyof CourseFormState>(field: Field, value: CourseFormState[Field]) => {
    setCourseForm((previous) => ({ ...previous, [field]: value }))
  }

  return (
    <div className="space-y-3">
      <span className="block text-xs uppercase tracking-[0.2em] text-black/60 dark:text-white/60">Course main information</span>
      <CourseSlugConflictAlert
        courseSlug={courseForm.slug}
        conflict={courseSlugConflict}
        onUseSuggestion={onUseSlugSuggestion}
        onEditExisting={onEditExistingCourse}
      />
      <div className="grid grid-cols-2 gap-3">
        <input
          name="courseSlug"
          value={courseForm.slug}
          onChange={(event) => updateCourseField("slug", event.target.value)}
          placeholder="slug (e.g., salsa-feminine-morning)"
          className={`${COURSE_SLUG_FIELD_CLASS} ${
            courseSlugConflict.exists ? "border-amber-500 dark:border-amber-400" : "border-black/15 dark:border-white/15"
          }`}
          required
        />
        <input
          name="courseTitle"
          value={courseForm.title}
          onChange={(event) => updateCourseField("title", event.target.value)}
          placeholder="Title"
          className={COURSE_FIELD_CLASS}
          required
        />
      </div>
      <textarea
        name="courseDescription"
        value={courseForm.description}
        onChange={(event) => updateCourseField("description", event.target.value)}
        placeholder="Short course description"
        rows={3}
        className={COURSE_FIELD_CLASS}
      />
      <div className="grid grid-cols-2 gap-3">
        <select
          name="courseKind"
          value={courseForm.kind}
          onChange={(event) => updateCourseField("kind", event.target.value)}
          className={COURSE_FIELD_CLASS}
        >
          {SCHOOL_COURSE_KINDS.map((kind) => (
            <option key={`course-kind-${kind}`} value={kind}>
              {kind}
            </option>
          ))}
        </select>
        <input
          name="courseCategory"
          value={courseForm.category}
          onChange={(event) => updateCourseField("category", event.target.value)}
          placeholder="Category"
          className={COURSE_FIELD_CLASS}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input
          name="courseLevel"
          value={courseForm.level}
          onChange={(event) => updateCourseField("level", event.target.value)}
          placeholder="Level"
          className={COURSE_FIELD_CLASS}
        />
        <input
          name="courseDurationMinutes"
          type="number"
          min={0}
          max={600}
          value={courseForm.durationMinutes}
          onChange={(event) => updateCourseField("durationMinutes", event.target.value)}
          placeholder="Duration (min)"
          className={COURSE_FIELD_CLASS}
        />
      </div>
      <input
        name="courseLocation"
        value={courseForm.location}
        onChange={(event) => updateCourseField("location", event.target.value)}
        placeholder="Location"
        className={COURSE_FIELD_CLASS}
      />
      <DefaultRoomField
        defaultRoomId={courseForm.defaultRoomId}
        courseRoomOptions={courseRoomOptions}
        roomById={roomById}
        onChange={(value) => updateCourseField("defaultRoomId", value)}
      />
    </div>
  )
}

function CourseSlugConflictAlert({
  courseSlug,
  conflict,
  onUseSuggestion,
  onEditExisting,
}: {
  courseSlug: string
  conflict: CourseSlugConflictState
  onUseSuggestion: () => void
  onEditExisting: () => void
}) {
  if (!conflict.exists) return null

  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-50 px-3 py-2 dark:border-amber-400/30 dark:bg-amber-900/20">
      <p className="text-xs text-amber-800 dark:text-amber-200">
        The slug <span className="font-semibold">&quot;{courseSlug}&quot;</span> already exists for{" "}
        <span className="font-semibold">&quot;{conflict.existingTitle}&quot;</span>.
      </p>
      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
        Suggestion: <code className="rounded bg-amber-100 px-1 py-0.5 font-mono dark:bg-amber-800/50">{conflict.suggestion}</code>
      </p>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={onUseSuggestion} className="rounded-md bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-700">
          Use suggestion
        </button>
        <button
          type="button"
          onClick={onEditExisting}
          className="rounded-md border border-amber-600 bg-transparent px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/30"
        >
          Edit existing
        </button>
      </div>
    </div>
  )
}

function DefaultRoomField({
  defaultRoomId,
  courseRoomOptions,
  roomById,
  onChange,
}: {
  defaultRoomId: string
  courseRoomOptions: RoomRow[]
  roomById: Record<string, RoomRow>
  onChange: (value: string) => void
}) {
  const selectedRoom = defaultRoomId ? roomById[defaultRoomId] : null

  return (
    <div className="space-y-2">
      <select
        name="courseDefaultRoomId"
        value={defaultRoomId}
        onChange={(event) => onChange(event.target.value)}
        className={COURSE_FIELD_CLASS}
      >
        <option value="">No default room</option>
        {courseRoomOptions.map((room) => (
          <option key={`course-room-${room.id}`} value={room.id}>
            {room.name} · cap {room.capacity}
            {room.active ? "" : " · inactive"}
          </option>
        ))}
      </select>
      <p className="text-xs text-black/55 dark:text-white/55">
        Optional. Future sessions can reuse this room as the default assignment.
      </p>
      {selectedRoom ? (
        <p className="text-xs text-black/60 dark:text-white/60">
          {selectedRoom.location || "No location detail"} · cap {selectedRoom.capacity ?? "—"}
        </p>
      ) : null}
    </div>
  )
}
