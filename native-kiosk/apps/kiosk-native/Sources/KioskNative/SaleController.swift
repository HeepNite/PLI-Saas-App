import Foundation

/// The bridge's one native sale and its closed registry. Flow: ready pinned reader -> server ticket for that reader ->
/// PaymentIntent -> SDK retrieve/collect/confirm within 90 s -> server settlement. The page sees only an opaque
/// operation reference and `pending`/`paid`/`rejected`; `paid` comes only from a fresh server PAID. When the page
/// stops polling for 10 s or its document is retired, a reader still waiting for the card is canceled (never after
/// the card was read). Invalidation (background, web process loss) rejects the sale and leaves any retained attempt
/// to startup recovery.
public final class SaleController {
    public static let start = "startPreparedPurchase"
    public static let poll = "getPreparedPurchaseState"
    public static let diagnostic = "diagnosticRoundTrip"
    public static let readerStatus = "getReaderStatus"
    public static let collectionTimeoutMs: Int64 = 90_000
    /// The web polls every 500 ms and drops a reply after 5 s; twice that tolerates jank.
    public static let webLivenessWindowMs: Int64 = 10_000

    private enum Phase { case admitting, retrieving, awaitingCard, processing, settling, done }

    private final class Sale {
        let reference: String
        /// What polls see; the first terminal value wins.
        var state = SecureBridgeState.pending
        var phase = Phase.admitting
        var lastSeenAt: Int64
        var abandoned = false
        var cancelRequested = false
        /// Lifecycle loss: no settlement runs (startup recovery owns the attempt).
        var closed = false
        var paymentIntentId: String?
        var readerOperation: TerminalCancelable?
        var deadline: TerminalCancelable?
        var watchdog: TerminalCancelable?
        init(_ reference: String, _ now: Int64) { self.reference = reference; lastSeenAt = now }
    }

    private let lock = NSRecursiveLock()
    private let coordinator: PurchaseCoordinator
    private let sdk: TerminalSDKClient
    private let readyReaderId: () -> String?
    private let scheduler: DeadlineScheduler
    private let execute: Execute
    private let clock: () -> Int64
    private let onPrompt: (CollectionPrompt) -> Void
    private var sale: Sale?
    private var invalidated = false

    public init(
        coordinator: PurchaseCoordinator, sdk: TerminalSDKClient, readyReaderId: @escaping () -> String?, scheduler: DeadlineScheduler,
        execute: @escaping Execute, clock: @escaping () -> Int64, onPrompt: @escaping (CollectionPrompt) -> Void
    ) {
        self.coordinator = coordinator
        self.sdk = sdk
        self.readyReaderId = readyReaderId
        self.scheduler = scheduler
        self.execute = execute
        self.clock = clock
        self.onPrompt = onPrompt
    }

    /// The closed registry: start, poll, the empty-schema diagnostic and the reader status request.
    public func registry(events: NativeWebEvents) -> [String: SecureBridgeOperation] {
        let accepted = { (_: String, reference: String, _: [String: String]) in SecureBridgeOperationResult(operationRef: reference, state: .accepted) }
        return [
            Self.start: SecureBridgeOperation(payloadSchema: ["preparedPurchaseReference": 43]) { _, reference, fields in
                self.start(reference, fields["preparedPurchaseReference"] ?? "")
            },
            Self.poll: SecureBridgeOperation(payloadSchema: ["operationReference": 128]) { _, _, fields in self.poll(fields["operationReference"] ?? "") },
            Self.diagnostic: SecureBridgeOperation(payloadSchema: [:], handler: accepted),
            Self.readerStatus: SecureBridgeOperation(payloadSchema: [:]) { requestId, reference, fields in
                events.requestStatus()
                return try accepted(requestId, reference, fields)
            },
        ]
    }

    func start(_ reference: String, _ preparedReference: String) -> SecureBridgeOperationResult {
        locked {
            guard !invalidated, PurchaseCoordinator.isPreparedReference(preparedReference),
                  sale.map({ $0.phase == .done && $0.reference != reference }) ?? true else {
                return SecureBridgeOperationResult(operationRef: nil, state: .rejected)
            }
            let started = Sale(reference, clock())
            sale = started
            guard readyReaderId() != nil else {
                started.phase = .done
                started.state = .rejected
                return SecureBridgeOperationResult(operationRef: reference, state: .rejected)
            }
            watch(started, after: Self.webLivenessWindowMs)
            execute { [self] in admit(started, preparedReference) }
            return SecureBridgeOperationResult(operationRef: reference, state: .pending)
        }
    }

    func poll(_ reference: String) -> SecureBridgeOperationResult {
        locked {
            guard !invalidated, let sale, sale.reference == reference else { return SecureBridgeOperationResult(operationRef: nil, state: .rejected) }
            if sale.state == .pending { sale.lastSeenAt = clock() }
            return SecureBridgeOperationResult(operationRef: reference, state: sale.state)
        }
    }

    /// A new main-frame document started: the page that started the sale can no longer watch it.
    public func documentRetired() {
        if let sale = locked({ invalidated ? nil : sale }) { abandon(sale, reason: "document_retired") }
    }

    /// Final: later starts and polls are rejected; a reader operation is canceled and nothing is settled.
    public func invalidate() {
        guard let (sale, operation) = locked({ () -> (Sale, TerminalCancelable?)? in
            invalidated = true
            guard let sale, sale.phase != .done, !sale.closed else { return nil }
            sale.closed = true
            let onReader = [.retrieving, .awaitingCard, .processing].contains(sale.phase)
            if onReader { sale.cancelRequested = true }
            return (sale, onReader ? sale.readerOperation : nil)
        }) else { return }
        operation?.cancel()
        publish(sale, .rejected)
    }

    // MARK: Admission (server, background)

    private func admit(_ sale: Sale, _ preparedReference: String) {
        // The browser capture is locally bounded; renew it from the same web view cookie first.
        if !coordinator.renewSession() { KioskDiagnostics.log("sale session renewal refused") }
        let ticket: AttemptTicket
        do { ticket = try coordinator.admit(preparedReference) } catch {
            KioskDiagnostics.log("sale admission rejected reason=\((error as? PurchaseError)?.reason ?? "other")")
            return end(sale, .rejected)
        }
        // A sale nobody watches, or a ticket for another reader, never opens the reader for a card; the issued
        // attempt is settled now (ticket-only included) so it does not lock the kiosk until the next start.
        guard ticket.readerId == readyReaderId(), locked({ !sale.closed && !sale.abandoned }),
              let start = try? coordinator.startCollection(), start.ticket == ticket else { return settle(sale, from: .admitting) }
        beginCollection(sale, start)
    }

    private func beginCollection(_ sale: Sale, _ start: CollectionStart) {
        let readerStillReady = start.ticket.readerId == readyReaderId()
        enum Next { case collect, settle, stop }
        let next: Next = locked {
            sale.paymentIntentId = start.paymentIntentId
            if sale.closed { return .stop }
            if sale.abandoned || !readerStillReady { return .settle }
            sale.phase = .retrieving
            sale.deadline = scheduler.schedule(delayMs: Self.collectionTimeoutMs) { [weak self] in self?.cancelOnReader(sale, awaitingCardOnly: false) }
            return .collect
        }
        switch next {
        case .stop: end(sale, .rejected)
        case .settle: settle(sale, from: .admitting)
        case .collect:
            sdk.retrievePaymentIntent(clientSecret: start.clientSecret) { [weak self] result in
                if case .success(let id) = result { self?.retrieved(sale, id) } else { self?.settle(sale, from: .retrieving) }
            }
        }
    }

    // MARK: Reader (SDK callbacks may arrive on any thread; SDK calls and settlement run outside the lock)

    private func retrieved(_ sale: Sale, _ id: String) {
        guard let proceed = advance(sale, from: .retrieving, to: .awaitingCard, id) else { return }
        guard proceed else { return settle(sale, from: .retrieving) }
        attach(sale, .awaitingCard, sdk.collectPaymentMethod(intentId: id) { [weak self] result in
            if case .success(let collected) = result { self?.collected(sale, collected) } else { self?.settle(sale, from: .awaitingCard) }
        })
    }

    private func collected(_ sale: Sale, _ id: String) {
        // A cancel that raced a read card skips confirmation; the server decides the outcome.
        guard let proceed = advance(sale, from: .awaitingCard, to: .processing, id) else { return }
        guard proceed else { return settle(sale, from: .awaitingCard) }
        onPrompt(.processing)
        attach(sale, .processing, sdk.confirmPaymentIntent(intentId: id) { [weak self] _ in self?.settle(sale, from: .processing) })
    }

    /// `nil`: stale callback. `false`: canceled or a foreign PaymentIntent id, settle. `true`: moved on.
    private func advance(_ sale: Sale, from: Phase, to next: Phase, _ id: String) -> Bool? {
        locked {
            guard sale.phase == from else { return nil }
            guard !sale.cancelRequested, id == sale.paymentIntentId else { return false }
            sale.phase = next
            return true
        }
    }

    /// Keeps the SDK handle; a cancel requested while it was being created is applied now. A finished cancel settles.
    private func attach(_ sale: Sale, _ phase: Phase, _ sdkCancel: @escaping SDKCancel) {
        let operation = TerminalCancelable { sdkCancel { [weak self] in self?.settle(sale, from: phase) } }
        let cancelNow: Bool = locked {
            sale.readerOperation = operation
            return sale.cancelRequested && sale.phase == phase
        }
        if cancelNow { operation.cancel() }
    }

    /// Deadline: anything still on the reader. Abandonment: only while waiting for the card.
    @discardableResult
    private func cancelOnReader(_ sale: Sale, awaitingCardOnly: Bool) -> Bool {
        let cancellable: [Phase] = awaitingCardOnly ? [.retrieving, .awaitingCard] : [.retrieving, .awaitingCard, .processing]
        guard let (phase, operation) = locked({ () -> (Phase, TerminalCancelable?)? in
            guard cancellable.contains(sale.phase), !sale.cancelRequested else { return nil }
            sale.cancelRequested = true
            return (sale.phase, sale.readerOperation)
        }) else { return false }
        // Retrieval has no SDK cancel: settle now and ignore its late callback.
        if phase == .retrieving { settle(sale, from: .retrieving) } else { operation?.cancel() }
        return true
    }

    // MARK: Web liveness

    private func watch(_ sale: Sale, after delayMs: Int64) {
        sale.watchdog = scheduler.schedule(delayMs: delayMs) { [weak self] in self?.checkLiveness(sale) }
    }

    private func checkLiveness(_ watched: Sale) {
        let silent: Bool = locked {
            guard !invalidated, sale === watched, watched.state == .pending else { return false }
            let silentFor = clock() - watched.lastSeenAt
            if silentFor < Self.webLivenessWindowMs { watch(watched, after: Self.webLivenessWindowMs - silentFor) }
            return silentFor >= Self.webLivenessWindowMs
        }
        if silent { abandon(watched, reason: "poll_timeout") }
    }

    private func abandon(_ sale: Sale, reason: String) {
        guard locked({ () -> Bool in
            guard sale.state == .pending, !sale.abandoned, sale.phase != .done else { return false }
            sale.abandoned = true
            sale.watchdog?.cancel()
            return true
        }) else { return }
        let action = cancelOnReader(sale, awaitingCardOnly: true) ? "cancel" : locked({ sale.phase == .admitting }) ? "reject" : "keep"
        KioskDiagnostics.log("sale abandoned by web reason=\(reason) action=\(action)")
        if action == "reject" { publish(sale, .rejected) }
    }

    // MARK: Settlement (server, background)

    private func settle(_ sale: Sale, from phase: Phase) {
        guard let runServer: Bool = locked({
            guard sale.phase == phase else { return nil }
            sale.phase = .settling
            sale.deadline?.cancel()
            sale.deadline = nil
            sale.readerOperation = nil
            return !sale.closed
        }) else { return }
        guard runServer else { return end(sale, .rejected) }
        execute { [self] in end(sale, coordinator.settle() == .paid ? .paid : .rejected) }
    }

    private func end(_ sale: Sale, _ state: SecureBridgeState) {
        locked {
            sale.phase = .done
            sale.deadline?.cancel()
            sale.deadline = nil
        }
        publish(sale, state)
    }

    private func publish(_ sale: Sale, _ state: SecureBridgeState) {
        let delivered: Bool = locked {
            guard sale.state == .pending else { return false }
            sale.state = state
            sale.watchdog?.cancel()
            return true
        }
        if delivered { onPrompt(.none) }
    }

    @discardableResult
    private func locked<T>(_ body: () throws -> T) rethrows -> T {
        lock.lock()
        defer { lock.unlock() }
        return try body()
    }
}
