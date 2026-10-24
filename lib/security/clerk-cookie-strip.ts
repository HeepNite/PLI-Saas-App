// Clerk cookie names from @clerk/backend `constants.Cookies`
// (__session, __refresh, __client_uat, __clerk_handshake, __clerk_db_jwt,
// __clerk_redirect_count, __clerk_handshake_nonce), plus the legacy `__client`
// cookie. Clerk also writes suffixed variants as `<name>_<suffix>`
// (see @clerk/shared getSuffixedCookieName).
const CLERK_COOKIE_BASE_NAMES = ["__session", "__refresh", "__client_uat", "__client"] as const
const CLERK_COOKIE_PREFIX = "__clerk_"

export function isClerkCookieName(name: string): boolean {
  if (name.startsWith(CLERK_COOKIE_PREFIX)) return true
  return CLERK_COOKIE_BASE_NAMES.some((base) => name === base || name.startsWith(`${base}_`))
}

export function stripClerkCookies(cookieHeader: string): string {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter((part) => {
      if (!part) return false
      const separator = part.indexOf("=")
      const name = (separator === -1 ? part : part.slice(0, separator)).trim()
      return !isClerkCookieName(name)
    })
    .join("; ")
}

// The kiosk WebView is locked to exactly /staff/terminal and authenticates with
// the terminal cookie, not Clerk. Leftover Clerk cookies (e.g. from a student
// SMS sign-in) would otherwise make clerkMiddleware answer with a cross-origin
// handshake redirect that the kiosk blocks, leaving a black screen.
export function isClerkFreeTerminalPath(pathname: string): boolean {
  return pathname === "/staff/terminal" || pathname === "/staff/terminal/"
}
