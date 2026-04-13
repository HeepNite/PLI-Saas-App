"use client"

import React from "react"
import type { StudentProfileCard } from "@/components/front/staff/historyCardAggregates"

type StudentSearchResponse = {
  results?: StudentProfileCard[]
  error?: string
}

type UseStudentGlobalSearchOptions = {
  query: string
  isHistoryMode: boolean
  hasClientMatches: boolean
  onAuthFailure?: (status: number) => boolean
}

export const useStudentGlobalSearch = ({
  query,
  isHistoryMode,
  hasClientMatches,
  onAuthFailure,
}: UseStudentGlobalSearchOptions) => {
  const [searchResultCards, setSearchResultCards] = React.useState<StudentProfileCard[] | null>(null)
  const [isGlobalSearchLoading, setIsGlobalSearchLoading] = React.useState(false)
  const [globalSearchError, setGlobalSearchError] = React.useState<string | null>(null)
  const activeSearchQueryRef = React.useRef("")
  const searchDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetSearchState = React.useCallback((options?: { keepResults?: boolean }) => {
    activeSearchQueryRef.current = ""
    if (!options?.keepResults) {
      setSearchResultCards(null)
    }
    setGlobalSearchError(null)
    setIsGlobalSearchLoading(false)
  }, [])

  const triggerGlobalSearch = React.useCallback(
    async (nextQuery: string) => {
      activeSearchQueryRef.current = nextQuery
      setIsGlobalSearchLoading(true)
      setGlobalSearchError(null)

      try {
        const url = new URL("/api/staff/students/search", window.location.origin)
        url.searchParams.set("q", nextQuery)

        const res = await fetch(url.toString(), {
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        })
        const payload = (await res.json().catch(() => ({}))) as StudentSearchResponse

        if (activeSearchQueryRef.current !== nextQuery) return

        if (!res.ok) {
          if (onAuthFailure?.(res.status)) return
          setSearchResultCards(null)
          setGlobalSearchError(typeof payload.error === "string" ? payload.error : "Search failed. Please try again.")
          return
        }

        setSearchResultCards(Array.isArray(payload.results) ? payload.results : [])
      } catch {
        if (activeSearchQueryRef.current !== nextQuery) return
        setSearchResultCards(null)
        setGlobalSearchError("Network error. Please try again.")
      } finally {
        if (activeSearchQueryRef.current === nextQuery) {
          setIsGlobalSearchLoading(false)
        }
      }
    },
    [onAuthFailure]
  )

  React.useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current)
      searchDebounceRef.current = null
    }

    const trimmedQuery = query.trim()
    if (trimmedQuery.length < 2 || isHistoryMode) {
      resetSearchState()
      return
    }

    if (hasClientMatches) {
      resetSearchState()
      return
    }

    searchDebounceRef.current = setTimeout(() => {
      void triggerGlobalSearch(trimmedQuery)
    }, 300)

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current)
        searchDebounceRef.current = null
      }
    }
  }, [hasClientMatches, isHistoryMode, query, resetSearchState, triggerGlobalSearch])

  return {
    searchResultCards,
    isGlobalSearchLoading,
    globalSearchError,
    activeSearchQueryRef,
    searchDebounceRef,
    triggerGlobalSearch,
    resetSearchState,
  }
}
