import Foundation
import StripeTerminal
import KioskNative

/// The one production binding to the Stripe Terminal iOS SDK (6.0.0). It only translates calls and callbacks for
/// `TerminalSDKClient`; every reader, payment and authority decision lives in the unit-tested package. It cannot be
/// unit tested without hardware and is covered by the on-device matrix (I14).
final class LiveTerminalSDKClient: NSObject, TerminalSDKClient, ConnectionTokenProvider, DiscoveryDelegate, MobileReaderDelegate {
    static let shared = LiveTerminalSDKClient()

    private let lock = NSLock()
    private var fetcher: ((@escaping (Result<String, Error>) -> Void) -> Void)?
    private var initialized = false
    private var discoveredReaders = [Reader]()
    private var discoveryUpdate: (([SDKReader]) -> Void)?
    private var readerEvents: TerminalSDKReaderEvents?
    private var intents = [String: PaymentIntent]()

    // MARK: TerminalSDKClient

    func setUp(connectionTokenFetcher: @escaping (@escaping (Result<String, Error>) -> Void) -> Void) {
        lock.lock()
        fetcher = connectionTokenFetcher
        let shouldInitialize = !initialized
        initialized = true
        lock.unlock()
        // `Terminal.initWithTokenProvider` may run once per process, before `Terminal.shared` is used.
        if shouldInitialize { Terminal.initWithTokenProvider(self) }
    }

    var connectedReader: SDKReader? { initialized ? Terminal.shared.connectedReader.map(Self.map) : nil }

    func discoverReaders(timeoutSeconds: Int, simulated: Bool, onUpdate: @escaping ([SDKReader]) -> Void, onFinished: @escaping (Bool) -> Void) -> SDKCancel {
        lock.lock()
        discoveredReaders = []
        discoveryUpdate = onUpdate
        lock.unlock()
        let configuration: BluetoothScanDiscoveryConfiguration
        do {
            configuration = try BluetoothScanDiscoveryConfigurationBuilder().setSimulated(simulated).setTimeout(UInt(timeoutSeconds)).build()
        } catch {
            DispatchQueue.main.async { onFinished(true) }
            return { done in done() }
        }
        let cancelable = Terminal.shared.discoverReaders(configuration, delegate: self) { error in onFinished(error != nil) }
        return { done in cancelable.cancel { _ in done() } }
    }

    func connect(_ reader: SDKReader, locationId: String, autoReconnect: Bool, events: TerminalSDKReaderEvents, completion: @escaping (Result<SDKReader, Error>) -> Void) {
        lock.lock()
        let match = discoveredReaders.first { $0.serialNumber == reader.serialNumber && $0.stripeId == reader.stripeId }
        readerEvents = events
        lock.unlock()
        guard let match else { return completion(.failure(LiveClientError.readerNotDiscovered)) }
        do {
            let configuration = try BluetoothConnectionConfigurationBuilder(delegate: self, locationId: locationId)
                .setAutoReconnectOnUnexpectedDisconnect(autoReconnect).build()
            Terminal.shared.connectReader(match, connectionConfig: configuration) { connected, error in
                if let connected { completion(.success(Self.map(connected))) } else { completion(.failure(error ?? LiveClientError.unknown)) }
            }
        } catch {
            completion(.failure(error))
        }
    }

    func disconnectReader() {
        guard initialized else { return }
        Terminal.shared.disconnectReader { _ in }
    }

    func retrievePaymentIntent(clientSecret: String, completion: @escaping (Result<String, Error>) -> Void) {
        Terminal.shared.retrievePaymentIntent(clientSecret: clientSecret) { [weak self] intent, error in
            guard let self, let intent, let id = intent.stripeId else { return completion(.failure(error ?? LiveClientError.unknown)) }
            self.remember(intent, id)
            completion(.success(id))
        }
    }

    func collectPaymentMethod(intentId: String, completion: @escaping (Result<String, Error>) -> Void) -> SDKCancel {
        run(intentId, completion) { intent, done in Terminal.shared.collectPaymentMethod(intent, completion: done) }
    }

    func confirmPaymentIntent(intentId: String, completion: @escaping (Result<String, Error>) -> Void) -> SDKCancel {
        run(intentId, completion) { intent, done in Terminal.shared.confirmPaymentIntent(intent, completion: done) }
    }

    /// Runs one SDK step on the remembered intent and remembers the intent it returns.
    private func run(
        _ intentId: String, _ completion: @escaping (Result<String, Error>) -> Void,
        _ step: (PaymentIntent, @escaping (PaymentIntent?, Error?) -> Void) -> Cancelable?
    ) -> SDKCancel {
        guard let intent = recall(intentId) else {
            DispatchQueue.main.async { completion(.failure(LiveClientError.unknownIntent)) }
            return { done in done() }
        }
        let cancelable = step(intent) { [weak self] next, error in
            guard let self, let next, let id = next.stripeId else { return completion(.failure(error ?? LiveClientError.unknown)) }
            self.remember(next, id)
            completion(.success(id))
        }
        return { done in if let cancelable { cancelable.cancel { _ in done() } } else { done() } }
    }

    // MARK: ConnectionTokenProvider

    func fetchConnectionToken(_ completion: @escaping ConnectionTokenCompletionBlock) {
        lock.lock()
        let current = fetcher
        lock.unlock()
        guard let current else { return completion(nil, LiveClientError.tokenUnavailable) }
        current { result in
            switch result {
            case .success(let token): completion(token, nil)
            case .failure(let error): completion(nil, error)
            }
        }
    }

    // MARK: DiscoveryDelegate

    func terminal(_ terminal: Terminal, didUpdateDiscoveredReaders readers: [Reader]) {
        lock.lock()
        discoveredReaders = readers
        let update = discoveryUpdate
        lock.unlock()
        update?(readers.map(Self.map))
    }

    // MARK: MobileReaderDelegate

    func reader(_ reader: Reader, didDisconnect reason: DisconnectReason) { events()?.sdkReaderDidDisconnect() }
    func reader(_ reader: Reader, didStartReconnect cancelable: Cancelable, disconnectReason: DisconnectReason) { events()?.sdkReaderDidStartReconnect() }
    func readerDidSucceedReconnect(_ reader: Reader) { events()?.sdkReaderDidSucceedReconnect() }
    func readerDidFailReconnect(_ reader: Reader) { events()?.sdkReaderDidFailReconnect() }
    func reader(_ reader: Reader, didRequestReaderInput inputOptions: ReaderInputOptions) { events()?.sdkReaderDidRequestInput() }
    func reader(_ reader: Reader, didRequestReaderDisplayMessage displayMessage: ReaderDisplayMessage) {}
    func reader(_ reader: Reader, didReportAvailableUpdate update: ReaderSoftwareUpdate) {}
    func reader(_ reader: Reader, didStartInstallingUpdate update: ReaderSoftwareUpdate, cancelable: Cancelable?) {}
    func reader(_ reader: Reader, didReportReaderSoftwareUpdateProgress progress: Float) {}
    func reader(_ reader: Reader, didFinishInstallingUpdate update: ReaderSoftwareUpdate?, error: Error?) {}

    // MARK: Helpers

    private func events() -> TerminalSDKReaderEvents? { lock.lock(); defer { lock.unlock() }; return readerEvents }
    private func remember(_ intent: PaymentIntent, _ id: String) { lock.lock(); intents[id] = intent; lock.unlock() }
    private func recall(_ id: String) -> PaymentIntent? { lock.lock(); defer { lock.unlock() }; return intents[id] }

    private static func map(_ reader: Reader) -> SDKReader {
        SDKReader(
            stripeId: reader.stripeId,
            serialNumber: reader.serialNumber,
            deviceType: reader.deviceType == .stripeM2 ? "stripe_m2" : "other",
            locationId: reader.locationId ?? reader.location?.stripeId
        )
    }

    private enum LiveClientError: Error {
        case readerNotDiscovered, unknownIntent, tokenUnavailable, unknown
    }
}
