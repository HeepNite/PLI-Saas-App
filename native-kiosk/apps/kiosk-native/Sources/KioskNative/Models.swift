import Foundation

/// The captured HttpOnly `pli_terminal_session` cookie. It flows only to the server client and the Keychain, never
/// to JavaScript, logs or the bridge. WKHTTPCookieStore exposes no Max-Age, so a capture is trusted for 15 minutes.
public struct StaffSession: Codable, Equatable, CustomStringConvertible {
    public static let cookieName = "pli_terminal_session"
    public static let captureTtlMs: Int64 = 15 * 60 * 1_000

    let origin: String
    let cookie: String
    /// Epoch milliseconds.
    let expiresAt: Int64

    public var description: String { "StaffSession(cookie: <redacted>)" }

    /// Exactly one secure, HttpOnly, host-only session cookie for the approved host with a header-safe value.
    public static func cookieValue(in cookies: [HTTPCookie], origin: String) -> String? {
        let host = URL(string: origin)?.host?.lowercased()
        let matches = cookies.filter {
            $0.name == cookieName && $0.isSecure && $0.isHTTPOnly && $0.domain.lowercased() == host && $0.path == "/"
        }
        guard matches.count == 1, let value = matches.first?.value, !value.isEmpty,
              value.unicodeScalars.allSatisfy({ (0x21...0x7E).contains($0.value) && !"\";,\\".unicodeScalars.contains($0) }) else { return nil }
        return value
    }
}

/// Server-signed ticket binding one prepared attempt to one reader and location.
public struct AttemptTicket: Codable, Equatable {
    let value: String
    /// Epoch milliseconds.
    let expiresAt: Int64
    let readerId: String
    let locationId: String
}

/// The one retained prepared attempt. A `nil` ticket is the marker persisted before the ticket request, so a lost
/// response is never replayed; the client secret is never stored.
struct RetainedAttempt: Codable, Equatable {
    var ticket: AttemptTicket?
    var paymentIntentId: String?
}

/// What survives a restart: the captured staff session and the retained attempt (one Keychain item).
struct DurableState: Codable, Equatable {
    var session: StaffSession?
    var attempt: RetainedAttempt?
}

/// A server PaymentIntent answer. Only a fresh server answer may report `paid`.
struct PaymentResult: Decodable, Equatable {
    let id: String
    let status: String
    let paid: Bool
    /// Collection-only, transient; never retained.
    let clientSecret: String?
}

func isBlank(_ value: String) -> Bool { value.unicodeScalars.allSatisfy { $0.properties.isWhitespace } }
