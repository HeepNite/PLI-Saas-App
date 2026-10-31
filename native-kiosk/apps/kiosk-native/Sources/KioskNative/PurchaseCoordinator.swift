import Foundation

public typealias Execute = (@escaping () -> Void) -> Void

/// Closed, identifier-free refusal reasons (they also appear in diagnostics).
public struct PurchaseError: Error, Equatable {
    public let reason: String
    init(_ reason: String) { self.reason = reason }
}

public struct CollectionStart: Equatable {
    public let ticket: AttemptTicket
    public let paymentIntentId: String
    /// Transient: handed straight to the SDK, never stored.
    public let clientSecret: String
}

/// How a server settlement ended. Only `.paid` and `.canceled` clear the retained attempt.
public enum Settlement: Equatable {
    case paid, canceled, retained
}

/// Owns the staff session capture and the one retained server-signed prepared attempt. Every server answer is
/// checked against the retained PaymentIntent id; the attempt is cleared only after a fresh server PAID or a server
/// confirmed uncharged cancel (or, for a ticket whose intent was never created, a fresh UNCREATED). Any durable-state
/// failure poisons the coordinator: it refuses everything until the app restarts.
public final class PurchaseCoordinator {
    private let origin: String
    private let locationId: String
    private let store: KeychainStore
    private let server: PurchaseServer
    private let clock: () -> Int64
    private let currentCookie: () -> String?
    private let execute: Execute
    private let operationLock = NSLock()
    private let stateLock = NSLock()
    private var poisoned = false
    private var capturedCookie: String?
    private var recovering = false

    public init(
        origin: String, locationId: String, store: KeychainStore, server: PurchaseServer, clock: @escaping () -> Int64,
        currentCookie: @escaping () -> String?, execute: @escaping Execute
    ) {
        self.origin = origin
        self.locationId = locationId
        self.store = store
        self.server = server
        self.clock = clock
        self.currentCookie = currentCookie
        self.execute = execute
    }

    // MARK: Session

    /// The terminal page loaded: capture its session. A retained attempt blocks the capture and starts startup
    /// recovery in the background (only with the same browser session); `onRecovered` runs once it was cleared.
    public func capture(onRecovered: @escaping () -> Void) -> Bool {
        var blocked: DurableState?
        let captured = (try? exclusive { () -> Bool in
            let state = try load()
            if state.attempt != nil {
                blocked = state
                return false
            }
            guard let cookie = currentCookie() else { return false }
            if !(state.session.map { $0.cookie == cookie && isCurrent($0) } ?? false) {
                try persist(DurableState(session: fresh(cookie)))
            }
            synced { capturedCookie = cookie }
            return true
        }) ?? false
        if let blocked { recover(blocked, onRecovered) }
        return captured
    }

    /// Sale admission renews the bounded capture, only while the web view still holds the captured cookie and no
    /// attempt is retained. It never adopts a different session.
    public func renewSession() -> Bool {
        guard let cookie = currentCookie(), cookie == captured() else { return false }
        return (try? exclusive { () -> Bool in
            let state = try load()
            guard state.attempt == nil, state.session?.cookie == cookie else { return false }
            try persist(DurableState(session: fresh(cookie)))
            return true
        }) ?? false
    }

    /// Reader connection tokens create no payment state, so they need no exclusive operation (a mid-sale reconnect).
    public func connectionToken() throws -> String {
        let state = try store.readState()
        guard let session = state.session, session.cookie == captured(), isCurrent(session) else {
            KioskDiagnostics.log("connection token refused reason=session")
            throw PurchaseError("session")
        }
        return try server.connectionToken(session)
    }

    // MARK: Sale

    /// Persists the issuance marker, then requests and persists the signed ticket.
    public func admit(_ reference: String) throws -> AttemptTicket {
        try exclusive {
            guard Self.isPreparedReference(reference) else { throw PurchaseError("invalid_reference") }
            let state = try load()
            guard let session = state.session else { throw PurchaseError("session_missing") }
            guard isCurrent(session) else { throw PurchaseError("session_expired") }
            guard state.attempt == nil else { throw PurchaseError("attempt_retained") }
            try persist(DurableState(session: session, attempt: RetainedAttempt()))
            guard let ticket = try? server.preparedAttempt(session, reference: reference) else { throw PurchaseError("server") }
            guard isValid(ticket), ticket.expiresAt > clock() else { throw PurchaseError("invalid_ticket") }
            try persist(DurableState(session: session, attempt: RetainedAttempt(ticket: ticket)))
            return ticket
        }
    }

    /// Creates (or refreshes the retained) PaymentIntent and persists only its id before handing over the secret.
    public func startCollection() throws -> CollectionStart {
        try exclusive {
            let (session, attempt, ticket) = try retained()
            guard attempt.paymentIntentId != nil || ticket.expiresAt > clock() else { throw PurchaseError("invalid_ticket") }
            guard let result = try? server.paymentIntent(session, ticket, knownId: attempt.paymentIntentId),
                  attempt.paymentIntentId == nil || attempt.paymentIntentId == result.id, !result.paid,
                  let secret = result.clientSecret else { throw PurchaseError("server") }
            try persist(DurableState(session: session, attempt: RetainedAttempt(ticket: ticket, paymentIntentId: result.id)))
            return CollectionStart(ticket: ticket, paymentIntentId: result.id, clientSecret: secret)
        }
    }

    /// Fresh `prepared-recover` first; anything but PAID asks `prepared-cancel`. Failures keep the attempt. A ticket-only
    /// attempt is first resolved through `prepared-creation-status` (startup and after a sale alike).
    public func settle() -> Settlement {
        (try? exclusive { try settleLocked() }) ?? .retained
    }

    // MARK: Internals

    private func settleLocked() throws -> Settlement {
        let (session, attempt, ticket) = try retained()
        guard let id = try attempt.paymentIntentId ?? createdIntentId(session, ticket) else { return try clear(session, .canceled) }
        if let recovered = try? server.recover(session, ticket, id: id), recovered.id == id, recovered.paid {
            return try clear(session, .paid)
        }
        let answer = try? server.cancel(session, ticket, id: id)
        let outcome: Settlement? = answer.flatMap { $0.id != id ? nil : $0.paid ? .paid : $0.status == "canceled" ? .canceled : .retained }
        KioskDiagnostics.log("prepared cancel outcome=\(outcome.map { [.paid: "PAID", .canceled: "CANCELED"][$0] ?? "PENDING" } ?? "ERROR")")
        guard let outcome, outcome != .retained else { return .retained }
        return try clear(session, outcome)
    }

    /// Ticket-only attempt: `nil` only on a fresh UNCREATED (narrow negative authority: no PaymentIntent exists);
    /// CREATED fetches and persists the bound intent id. An unavailable answer keeps the attempt.
    private func createdIntentId(_ session: StaffSession, _ ticket: AttemptTicket) throws -> String? {
        let uncreated = try? server.isUncreated(session, ticket)
        KioskDiagnostics.log("prepared creation status=\(uncreated.map { $0 ? "UNCREATED" : "CREATED" } ?? "ERROR")")
        if uncreated == true { return nil }
        guard uncreated == false, let bound = try? server.paymentIntent(session, ticket, knownId: nil) else { throw PurchaseError("server") }
        try persist(DurableState(session: session, attempt: RetainedAttempt(ticket: ticket, paymentIntentId: bound.id)))
        return bound.id
    }

    private func clear(_ session: StaffSession, _ outcome: Settlement) throws -> Settlement {
        try persist(DurableState(session: session))
        KioskDiagnostics.log("retained attempt cleared reason=\(outcome == .paid ? "paid" : "canceled")")
        return outcome
    }

    /// Startup recovery runs at most once at a time, only for a ticketed attempt and the same browser session.
    private func recover(_ state: DurableState, _ onRecovered: @escaping () -> Void) {
        guard let retainedSession = state.session, let attempt = state.attempt, attempt.ticket != nil,
              let cookie = currentCookie(), cookie == retainedSession.cookie,
              synced({ () -> Bool in defer { recovering = true }; return !recovering }) else { return }
        execute { [self] in
            let cleared = (try? exclusive { () -> Bool in
                let session = fresh(cookie)
                try persist(DurableState(session: session, attempt: attempt))
                return try settleLocked() != .retained
            }) ?? false
            synced { recovering = false }
            if cleared { onRecovered() }
        }
    }

    private func retained() throws -> (StaffSession, RetainedAttempt, AttemptTicket) {
        let state = try load()
        guard let session = state.session, isCurrent(session) else { throw PurchaseError("session_expired") }
        guard let attempt = state.attempt, let ticket = attempt.ticket else { throw PurchaseError("no_attempt") }
        return (session, attempt, ticket)
    }

    private func exclusive<T>(_ body: () throws -> T) throws -> T {
        guard operationLock.try() else { throw PurchaseError("busy") }
        defer { operationLock.unlock() }
        guard !poisoned else { throw PurchaseError("poisoned") }
        return try body()
    }

    /// Unreadable or inconsistent durable state poisons; an expired session is valid state awaiting renewal.
    private func load() throws -> DurableState {
        guard let state = try? store.readState(), isConsistent(state) else {
            poisoned = true
            throw PurchaseError("store_unavailable")
        }
        return state
    }

    private func persist(_ state: DurableState) throws {
        do { try store.writeState(state) } catch {
            poisoned = true
            throw PurchaseError("store_unavailable")
        }
    }

    private func isConsistent(_ state: DurableState) -> Bool {
        if let session = state.session, session.origin != origin || isBlank(session.cookie) { return false }
        guard let attempt = state.attempt else { return true }
        guard state.session != nil else { return false }
        guard let ticket = attempt.ticket else { return attempt.paymentIntentId == nil }
        return isValid(ticket) && attempt.paymentIntentId.map { !isBlank($0) } ?? true
    }

    private func isValid(_ ticket: AttemptTicket) -> Bool {
        !isBlank(ticket.value) && !isBlank(ticket.readerId) && ticket.expiresAt > 0 && ticket.locationId == locationId
    }

    private func isCurrent(_ session: StaffSession) -> Bool { session.expiresAt > clock() }
    private func fresh(_ cookie: String) -> StaffSession { StaffSession(origin: origin, cookie: cookie, expiresAt: clock() + StaffSession.captureTtlMs) }
    private func captured() -> String? { synced { capturedCookie } }
    private func synced<T>(_ body: () -> T) -> T { stateLock.lock(); defer { stateLock.unlock() }; return body() }

    /// Exactly 43 base64url characters that decode canonically to 32 bytes.
    static func isPreparedReference(_ value: String) -> Bool {
        guard value.utf8.count == 43,
              let decoded = Data(base64Encoded: value.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/") + "="),
              decoded.count == 32 else { return false }
        return decoded.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "") == value
    }
}
