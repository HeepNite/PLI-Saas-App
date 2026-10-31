import Foundation

/// Keeps the pinned M2 connected for one foreground host: it connects at start, lets the SDK auto-reconnect, and
/// retries with 5/10/20 s backoff until stopped. It never creates or mutates payment state. On a device's first
/// pairing (no stored reader id) it accepts the one reader matching serial, type and location, pins the id the live
/// connection reports and hands it to `onPaired` for persistence.
public final class ReaderConnectionOwner: TerminalSDKReaderEvents {
    public enum State: Equatable {
        case idle, permissionRequired, discovering, connecting, ready, reconnecting, waitingRetry, stopped
    }

    public static let initialRetryMs: Int64 = 5_000
    public static let maxRetryMs: Int64 = 20_000
    /// Bounds one discovery plus connection so SDK callbacks that never arrive cannot stall retries.
    public static let attemptTimeoutMs: Int64 = 30_000
    public static let discoveryTimeoutSeconds = 10

    public private(set) var state = State.idle
    public private(set) var pinnedReaderId: String?

    private let lock = NSRecursiveLock()
    private let sdk: TerminalSDKClient
    private let permissions: BluetoothPermissions
    private let policy: ReaderPolicy
    private let scheduler: DeadlineScheduler
    private let events: NativeWebEvents
    private let fetchToken: () throws -> String
    private let execute: (@escaping () -> Void) -> Void
    private let onPaired: (String) -> Void
    private var generation = 0
    private var discovery: SDKCancel?
    private var deadline: TerminalCancelable?
    private var retry: TerminalCancelable?
    private var nextRetryMs = initialRetryMs
    private var permissionRequested = false

    public init(
        sdk: TerminalSDKClient, permissions: BluetoothPermissions, policy: ReaderPolicy, pinnedReaderId: String?,
        scheduler: DeadlineScheduler, events: NativeWebEvents, fetchToken: @escaping () throws -> String,
        execute: @escaping (@escaping () -> Void) -> Void = { DispatchQueue.global(qos: .userInitiated).async(execute: $0) },
        onPaired: @escaping (String) -> Void = { _ in }
    ) {
        self.sdk = sdk
        self.permissions = permissions
        self.policy = policy
        self.pinnedReaderId = pinnedReaderId
        self.scheduler = scheduler
        self.events = events
        self.fetchToken = fetchToken
        self.execute = execute
        self.onPaired = onPaired
    }

    /// The pinned reader id while its live link is ready and still matches; a sale starts only on it.
    public func readyReaderId() -> String? {
        locked {
            guard state == .ready, let pinnedReaderId, let current = sdk.connectedReader,
                  policy.matches(current, pinnedId: pinnedReaderId, connected: true) else { return nil }
            return pinnedReaderId
        }
    }

    public func start() {
        locked {
            guard state == .idle else { return }
            events.readerStatus(.connecting)
            // Never adopt a link an older host created: release it and connect with this owner's listener.
            if sdk.connectedReader != nil { sdk.disconnectReader() }
            attempt()
        }
    }

    public func onBluetoothPermissionResult(_ granted: Bool) {
        locked {
            guard state == .permissionRequired else { return }
            if granted && permissions.hasBluetoothPermissions() { attempt() } else { scheduleRetry() }
        }
    }

    public func invalidate() {
        locked {
            guard state != .stopped else { return }
            retireAttempt()
            retry?.cancel()
            retry = nil
            state = .stopped
            events.readerStatus(.disconnected)
            sdk.disconnectReader()
        }
    }

    // MARK: TerminalSDKReaderEvents

    public func sdkReaderDidStartReconnect() {
        locked {
            guard state == .ready else { return }
            state = .reconnecting
            events.readerStatus(.connecting)
        }
    }

    public func sdkReaderDidSucceedReconnect() {
        locked {
            guard state == .reconnecting else { return }
            state = .ready
            events.readerStatus(.connected)
        }
    }

    /// The SDK follows a failed reconnect with a final disconnect; that disconnect drives the retry.
    public func sdkReaderDidFailReconnect() {}

    public func sdkReaderDidDisconnect() {
        locked {
            guard [.ready, .reconnecting, .connecting].contains(state) else { return }
            retireAttempt()
            scheduleRetry()
        }
    }

    public func sdkReaderDidRequestInput() {
        if locked({ state != .stopped }) { events.collectionPrompt(.awaitingCard) }
    }

    // MARK: Attempts

    private func attempt() {
        retry = nil
        guard permissions.hasBluetoothPermissions() else {
            KioskDiagnostics.log("reader owner bluetooth permission missing")
            state = .permissionRequired
            if !permissionRequested {
                permissionRequested = true
                if (try? permissions.requestBluetoothPermissions()) != nil { return } // the result resumes us
            }
            return scheduleRetry()
        }
        sdk.setUp { [fetchToken, execute] completion in execute { completion(Result { try fetchToken() }) } }
        generation += 1
        let current = generation
        state = .discovering
        KioskDiagnostics.log("reader discovery start")
        events.readerStatus(.connecting)
        deadline = scheduler.schedule(delayMs: Self.attemptTimeoutMs) { [weak self] in self?.fail(current) }
        let cancel = sdk.discoverReaders(
            timeoutSeconds: Self.discoveryTimeoutSeconds, simulated: false,
            onUpdate: { [weak self] in self?.discovered(current, $0) },
            onFinished: { [weak self] failed in self?.discoveryFinished(current, failed: failed) }
        )
        if state == .discovering && generation == current { discovery = cancel } else { cancel {} }
    }

    private func discovered(_ attempt: Int, _ readers: [SDKReader]) {
        locked {
            guard attempt == generation, state == .discovering else { return }
            // Empty or foreign-only updates are an in-progress scan; the scan timeout bounds them.
            let matching = readers.filter { policy.matches($0, pinnedId: pinnedReaderId, connected: false) }
            KioskDiagnostics.log("reader discovery update found=\(readers.count) matching=\(matching.count)")
            guard matching.count == 1, let match = matching.first else { return }
            // Leave `.discovering` first: the SDK finishes the scan we cancel with an error that is not a failure.
            state = .connecting
            let connect: () -> Void = { [weak self] in
                guard let self else { return }
                self.locked {
                    guard attempt == self.generation, self.state == .connecting else { return }
                    self.sdk.connect(match, locationId: self.policy.locationId, autoReconnect: true, events: self) { [weak self] result in
                        self?.connected(attempt, match, result)
                    }
                }
            }
            // Connect only once the scan has actually stopped.
            if let cancel = discovery { discovery = nil; cancel(connect) } else { connect() }
        }
    }

    /// A scan ending with an error fails the attempt only while it is still scanning.
    private func discoveryFinished(_ attempt: Int, failed: Bool) {
        locked {
            KioskDiagnostics.log("reader discovery finished failed=\(failed) state=\(state)")
            guard failed, attempt == generation, state == .discovering else { return }
            fail(attempt)
        }
    }

    private func connected(_ attempt: Int, _ expected: SDKReader, _ result: Result<SDKReader, Error>) {
        locked {
            guard case .success(let reader) = result else {
                if case .failure(let error) = result {
                    let ns = error as NSError
                    KioskDiagnostics.log("reader connect result=failed domain=\(ns.domain) code=\(ns.code)")
                }
                return fail(attempt)
            }
            guard attempt == generation, state == .connecting, reader.serialNumber == expected.serialNumber,
                  policy.matches(reader, pinnedId: pinnedReaderId, connected: true), let id = reader.stripeId else {
                // A stale or foreign connection must not stay attached (owners never overlap, so it is ours).
                KioskDiagnostics.log("reader connect result=rejected")
                sdk.disconnectReader()
                return fail(attempt)
            }
            retireAttempt()
            nextRetryMs = Self.initialRetryMs
            state = .ready
            KioskDiagnostics.log("reader owner connected")
            events.readerStatus(.connected)
            if pinnedReaderId == nil {
                pinnedReaderId = id
                onPaired(id)
            }
        }
    }

    private func fail(_ attempt: Int) {
        locked {
            guard attempt == generation, state == .discovering || state == .connecting else { return }
            retireAttempt()
            scheduleRetry()
        }
    }

    /// Invalidates every callback of the current attempt; the physical link is untouched.
    private func retireAttempt() {
        generation += 1
        discovery?({})
        discovery = nil
        deadline?.cancel()
        deadline = nil
    }

    private func scheduleRetry() {
        let delay = nextRetryMs
        nextRetryMs = min(delay * 2, Self.maxRetryMs)
        guard state != .stopped else { return }
        state = .waitingRetry
        events.readerStatus(.disconnected)
        retry?.cancel()
        retry = scheduler.schedule(delayMs: delay) { [weak self] in
            self?.locked { if self?.state == .waitingRetry { self?.attempt() } }
        }
    }

    @discardableResult
    private func locked<T>(_ body: () -> T) -> T {
        lock.lock()
        defer { lock.unlock() }
        return body()
    }
}
