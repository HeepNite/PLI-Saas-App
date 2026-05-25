export type PaymentsMode = "today" | "history" | "userHistory"

export const TODAY_MODE_TAKE_LIMIT = 200
export const HISTORY_MODE_TAKE_LIMIT = 2000

type HistoryRange = {
  from: string
  to: string
}

type BaseStaffPaymentsRequest = {
  query: string
  settlementFilter: string
  selectedFrom: string
  selectedTo: string
  selectedClass: string
}

export type StaffPaymentsRequest =
  | (BaseStaffPaymentsRequest & {
      ok: true
      mode: "today"
      userHistoryId: ""
    })
  | (BaseStaffPaymentsRequest & {
      ok: true
      mode: "history"
      userHistoryId: ""
      historyRange: HistoryRange
    })
  | (BaseStaffPaymentsRequest & {
      ok: true
      mode: "userHistory"
      userHistoryId: string
    })

export type StaffPaymentsRequestError = {
  ok: false
  error: string
  status: 400
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const getTrimmedSearchParam = (searchParams: URLSearchParams, key: string) => searchParams.get(key)?.trim() || ""

const normalizeHistoryRangeInputs = (input: { from: string; to: string; date: string }) => {
  const normalizedFrom = input.from || input.date
  const normalizedTo = input.to || input.date

  if (!normalizedFrom || !normalizedTo) {
    return {
      ok: false as const,
      error: "History mode requires both from and to dates.",
    }
  }

  if (!DATE_REGEX.test(normalizedFrom) || !DATE_REGEX.test(normalizedTo)) {
    return {
      ok: false as const,
      error: "History mode requires valid YYYY-MM-DD from/to dates.",
    }
  }

  if (normalizedFrom > normalizedTo) {
    return {
      ok: false as const,
      error: "History mode requires from to be on or before to.",
    }
  }

  return {
    ok: true as const,
    from: normalizedFrom,
    to: normalizedTo,
  }
}

const parsePaymentsQueryParams = (searchParams: URLSearchParams) => {
  const query = getTrimmedSearchParam(searchParams, "q")
  const settlementFilter = getTrimmedSearchParam(searchParams, "settlement").toLowerCase() || "all"
  const requestedMode = getTrimmedSearchParam(searchParams, "mode").toLowerCase()
  const userHistoryId = getTrimmedSearchParam(searchParams, "userId")
  const selectedDate = getTrimmedSearchParam(searchParams, "date")
  const selectedFrom = getTrimmedSearchParam(searchParams, "from")
  const selectedTo = getTrimmedSearchParam(searchParams, "to")
  const selectedClass = getTrimmedSearchParam(searchParams, "class")

  return {
    query,
    settlementFilter,
    requestedMode,
    userHistoryId,
    selectedDate,
    selectedFrom,
    selectedTo,
    selectedClass,
  }
}

export const parseStaffPaymentsRequest = (req: Request): StaffPaymentsRequest | StaffPaymentsRequestError => {
  const url = new URL(req.url)
  const queryParams = parsePaymentsQueryParams(url.searchParams)
  const mode: PaymentsMode = queryParams.userHistoryId
    ? "userHistory"
    : queryParams.requestedMode === "history"
      ? "history"
      : "today"

  const historyRange = mode === "history"
    ? normalizeHistoryRangeInputs({
        from: queryParams.selectedFrom,
        to: queryParams.selectedTo,
        date: queryParams.selectedDate,
      })
    : null

  if (historyRange && !historyRange.ok) {
    return {
      ok: false as const,
      error: historyRange.error,
      status: 400,
    }
  }

  const base = {
    query: queryParams.query,
    settlementFilter: queryParams.settlementFilter,
    selectedFrom: queryParams.selectedFrom,
    selectedTo: queryParams.selectedTo,
    selectedClass: queryParams.selectedClass,
  }

  if (mode === "history") {
    if (!historyRange || !historyRange.ok) {
      return {
        ok: false,
        error: "History mode requires both from and to dates.",
        status: 400,
      }
    }

    return {
      ok: true,
      mode,
      userHistoryId: "",
      historyRange: {
        from: historyRange.from,
        to: historyRange.to,
      },
      ...base,
    }
  }

  if (mode === "userHistory") {
    return {
      ok: true,
      mode,
      userHistoryId: queryParams.userHistoryId,
      ...base,
    }
  }

  return {
    ok: true,
    mode,
    userHistoryId: "",
    ...base,
  }
}
