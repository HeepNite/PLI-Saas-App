import Foundation

/// POSTs JSON to a fixed HTTPS endpoint with the session cookie as an explicit header.
public protocol HTTPClient: AnyObject {
    func post(_ url: URL, json: Data, cookie: String) throws -> (status: Int, body: Data)
}

/// Closed failure: transport error, non-2xx status or a response outside the contract. No details leak.
public struct ServerError: Error, Equatable {}

/// The fixed prepared internal-purchase protocol; the only HTTP surface that carries the staff-session cookie.
public final class PurchaseServer {
    public static let path = "/api/kiosk/terminal/internal-purchase"

    private let url: URL
    private let http: HTTPClient

    public init(origin: String, http: HTTPClient) {
        url = URL(string: origin + Self.path)!
        self.http = http
    }

    public func connectionToken(_ session: StaffSession) throws -> String {
        struct Token: Decodable { let secret: String }
        let secret = try post(session, ["action": "connection-token"], as: Token.self).secret
        guard !isBlank(secret) else { throw ServerError() }
        return secret
    }

    /// Sends only the opaque one-use reference; the server signs a ticket for its reader and location.
    public func preparedAttempt(_ session: StaffSession, reference: String) throws -> AttemptTicket {
        struct Ticket: Decodable { let ticket: String; let expiresAt: Int64; let readerId: String; let locationId: String }
        let t = try post(session, ["action": "prepared-attempt", "preparedPurchaseReference": reference], as: Ticket.self)
        return AttemptTicket(value: t.ticket, expiresAt: t.expiresAt, readerId: t.readerId, locationId: t.locationId)
    }

    /// Creates (or refreshes the known) PaymentIntent for the ticket; the answer carries the collection secret.
    func paymentIntent(_ session: StaffSession, _ ticket: AttemptTicket, knownId: String?) throws -> PaymentResult {
        var action = ["action": "prepared-payment-intent", "ticket": ticket.value]
        action["paymentIntentId"] = knownId
        let result = try payment(session, action)
        guard let secret = result.clientSecret, !isBlank(secret) else { throw ServerError() }
        return result
    }

    func recover(_ session: StaffSession, _ ticket: AttemptTicket, id: String) throws -> PaymentResult {
        try settlement(session, ["action": "prepared-recover", "ticket": ticket.value, "paymentIntentId": id])
    }

    /// Asks the server to cancel the exact PaymentIntent only if Stripe confirms it was not charged.
    func cancel(_ session: StaffSession, _ ticket: AttemptTicket, id: String) throws -> PaymentResult {
        try settlement(session, ["action": "prepared-cancel", "ticket": ticket.value, "paymentIntentId": id])
    }

    /// `true` only on the closed answer `UNCREATED`: no PaymentIntent was ever created for this ticket.
    public func isUncreated(_ session: StaffSession, _ ticket: AttemptTicket) throws -> Bool {
        struct Creation: Decodable { let creation: String }
        switch try post(session, ["action": "prepared-creation-status", "ticket": ticket.value], as: Creation.self).creation {
        case "UNCREATED": return true
        case "CREATED": return false
        default: throw ServerError()
        }
    }

    private func settlement(_ session: StaffSession, _ action: [String: String]) throws -> PaymentResult {
        let result = try payment(session, action)
        guard result.clientSecret == nil else { throw ServerError() }
        return result
    }

    private func payment(_ session: StaffSession, _ action: [String: String]) throws -> PaymentResult {
        let result = try post(session, action, as: PaymentResult.self)
        guard !isBlank(result.id), !isBlank(result.status), (result.status == "succeeded") == result.paid else { throw ServerError() }
        return result
    }

    private func post<T: Decodable>(_ session: StaffSession, _ action: [String: String], as type: T.Type) throws -> T {
        let name = action["action"] ?? "nil"
        guard let body = try? JSONSerialization.data(withJSONObject: action),
              let response = try? http.post(url, json: body, cookie: session.cookie) else {
            KioskDiagnostics.log("server action=\(name) result=transport_error")
            throw ServerError()
        }
        guard (200...299).contains(response.status), let decoded = try? JSONDecoder().decode(type, from: response.body) else {
            KioskDiagnostics.log("server action=\(name) result=refused status=\(response.status)")
            throw ServerError()
        }
        return decoded
    }
}

/// Production HTTP: HTTPS only, no cookie jar or cache, redirects never followed, responses over 64 KiB refused.
public final class URLSessionHTTPClient: HTTPClient {
    public static let maxResponseBytes = 64 * 1024

    let configuration: URLSessionConfiguration
    private let timeout: TimeInterval

    public init(timeout: TimeInterval = 30) {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpCookieStorage = nil
        configuration.httpShouldSetCookies = false
        configuration.httpCookieAcceptPolicy = .never
        configuration.urlCache = nil
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        self.configuration = configuration
        self.timeout = timeout
    }

    public func post(_ url: URL, json: Data, cookie: String) throws -> (status: Int, body: Data) {
        guard url.scheme == "https", url.user == nil, url.query == nil, url.fragment == nil else { throw ServerError() }
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: timeout)
        request.httpMethod = "POST"
        request.httpBody = json
        request.httpShouldHandleCookies = false
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("\(StaffSession.cookieName)=\(cookie)", forHTTPHeaderField: "Cookie")

        var result: (data: Data?, response: URLResponse?, error: Error?)
        let done = DispatchSemaphore(value: 0)
        let session = URLSession(configuration: configuration, delegate: RedirectRefusal(), delegateQueue: nil)
        defer { session.finishTasksAndInvalidate() }
        session.dataTask(with: request) { result = ($0, $1, $2); done.signal() }.resume()
        done.wait()
        guard result.error == nil, let response = result.response as? HTTPURLResponse, let data = result.data,
              data.count <= Self.maxResponseBytes, !(300...399).contains(response.statusCode),
              response.value(forHTTPHeaderField: "Location") == nil else { throw ServerError() }
        return (response.statusCode, data)
    }

    private final class RedirectRefusal: NSObject, URLSessionTaskDelegate {
        func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
            completionHandler(nil)
        }
    }
}
