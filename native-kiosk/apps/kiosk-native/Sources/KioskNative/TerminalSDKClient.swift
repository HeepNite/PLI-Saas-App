import Foundation

/// A Stripe `Reader` reduced to the fields the policy needs. `deviceType` is lowercase snake case (`stripe_m2`);
/// a reader that was never registered reports no `stripeId` and no location.
public struct SDKReader: Equatable {
    public let stripeId: String?
    public let serialNumber: String
    public let deviceType: String
    public let locationId: String?

    public init(stripeId: String?, serialNumber: String, deviceType: String, locationId: String?) {
        self.stripeId = stripeId
        self.serialNumber = serialNumber
        self.deviceType = deviceType
        self.locationId = locationId
    }
}

/// Reader-level SDK callbacks for the one connected reader (`MobileReaderDelegate`).
public protocol TerminalSDKReaderEvents: AnyObject {
    func sdkReaderDidDisconnect()
    func sdkReaderDidStartReconnect()
    func sdkReaderDidSucceedReconnect()
    func sdkReaderDidFailReconnect()
    func sdkReaderDidRequestInput()
}

/// Cancels an SDK operation; `completion` runs when the SDK reports the cancel finished (success or not).
public typealias SDKCancel = (_ completion: @escaping () -> Void) -> Void

/// The only place the Stripe Terminal SDK is touched. The app implements it over `Terminal.shared`; package tests use
/// a fake. All completions may arrive on any thread.
public protocol TerminalSDKClient: AnyObject {
    /// Idempotent: the first call initializes the SDK for the process, later calls only replace the token fetcher.
    func setUp(connectionTokenFetcher: @escaping (_ completion: @escaping (Result<String, Error>) -> Void) -> Void)
    var connectedReader: SDKReader? { get }
    func discoverReaders(timeoutSeconds: Int, simulated: Bool, onUpdate: @escaping ([SDKReader]) -> Void, onFinished: @escaping (_ failed: Bool) -> Void) -> SDKCancel
    func connect(_ reader: SDKReader, locationId: String, autoReconnect: Bool, events: TerminalSDKReaderEvents, completion: @escaping (Result<SDKReader, Error>) -> Void)
    func disconnectReader()
    /// Retrieves the intent by client secret and keeps it for the following calls, which are addressed by id.
    func retrievePaymentIntent(clientSecret: String, completion: @escaping (Result<String, Error>) -> Void)
    func collectPaymentMethod(intentId: String, completion: @escaping (Result<String, Error>) -> Void) -> SDKCancel
    func confirmPaymentIntent(intentId: String, completion: @escaping (Result<String, Error>) -> Void) -> SDKCancel
}

/// Handle for a scheduled task.
public final class TerminalCancelable {
    private let action: () -> Void
    public init(_ action: @escaping () -> Void) { self.action = action }
    public func cancel() { action() }
}

/// Schedules retries and deadlines (milliseconds); tests inject a virtual clock.
public protocol DeadlineScheduler: AnyObject {
    func schedule(delayMs: Int64, _ task: @escaping () -> Void) -> TerminalCancelable
}

public protocol BluetoothPermissions: AnyObject {
    func hasBluetoothPermissions() -> Bool
    /// Shows the system prompt only; it never starts discovery.
    func requestBluetoothPermissions() throws
}
