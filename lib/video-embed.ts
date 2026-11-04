// Video URL helpers for course media. Hosts are checked on the parsed URL
// (never by substring) so lookalike URLs cannot be rendered inside an iframe.

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"])
const YOUTU_BE_HOSTS = new Set(["youtu.be", "www.youtu.be"])
const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com"])
const VIMEO_PLAYER_HOST = "player.vimeo.com"

const YOUTUBE_ID = /^[\w-]+$/
const VIMEO_ID = /^\d+$/

const HAS_SCHEME = /^[a-z][a-z\d+.-]*:/i

// Stored course links may omit the scheme ("youtube.com/watch?v=..." or "//youtube.com/...");
// those are read as https. Any explicit non-http(s) scheme is rejected.
const parseHttpUrl = (value: string): URL | null => {
  const candidate = value.startsWith("//") ? `https:${value}` : HAS_SCHEME.test(value) ? value : `https://${value}`
  try {
    const url = new URL(candidate)
    return url.protocol === "https:" || url.protocol === "http:" ? url : null
  } catch {
    return null
  }
}

const firstPathSegment = (url: URL) => url.pathname.split("/").filter(Boolean)[0] ?? ""

type EmbedProvider = "youtube" | "vimeo"

const embedProvider = (url: URL): EmbedProvider | null => {
  const host = url.hostname.toLowerCase()
  if (YOUTUBE_HOSTS.has(host) && url.pathname.startsWith("/embed/")) return "youtube"
  if (host === VIMEO_PLAYER_HOST && url.pathname.startsWith("/video/")) return "vimeo"
  return null
}

/** Converts a YouTube/Vimeo page link into its embed URL; returns other values unchanged. */
export const toEmbedVideoUrl = (input: string): string => {
  const value = input.trim()
  if (!value) return ""
  const url = parseHttpUrl(value)
  if (!url) return value
  const host = url.hostname.toLowerCase()

  if (YOUTUBE_HOSTS.has(host) && url.pathname === "/watch") {
    const id = url.searchParams.get("v") ?? ""
    return YOUTUBE_ID.test(id) ? `https://www.youtube.com/embed/${id}` : value
  }
  if (YOUTU_BE_HOSTS.has(host)) {
    const id = firstPathSegment(url)
    return YOUTUBE_ID.test(id) ? `https://www.youtube.com/embed/${id}` : value
  }
  if (VIMEO_HOSTS.has(host)) {
    const id = firstPathSegment(url)
    return VIMEO_ID.test(id) ? `https://player.vimeo.com/video/${id}` : value
  }
  return value
}

/** True only for real YouTube/Vimeo player URLs. */
export const isEmbedVideoUrl = (value: string): boolean => {
  const url = parseHttpUrl(value.trim())
  return url ? embedProvider(url) !== null : false
}

/** Appends provider-specific autoplay params to an embed URL; non-embed URLs are returned unchanged. */
export const toAutoplayEmbedUrl = (value: string, params: Record<EmbedProvider, string>): string => {
  const base = value.trim()
  if (!base) return ""
  const url = parseHttpUrl(base)
  const provider = url ? embedProvider(url) : null
  if (!provider) return base
  return `${base}${base.includes("?") ? "&" : "?"}${params[provider]}`
}
