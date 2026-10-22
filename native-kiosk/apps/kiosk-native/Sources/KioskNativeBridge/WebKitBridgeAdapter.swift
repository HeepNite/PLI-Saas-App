import Foundation
@preconcurrency import WebKit

public struct WebKitBridgeOrigin: Equatable {
    fileprivate let host: String

    public init?(configuredOrigin: String) {
        guard let components = URLComponents(string: configuredOrigin),
              components.url != nil,
              components.scheme?.caseInsensitiveCompare("https") == .orderedSame,
              let host = components.host, !host.isEmpty,
              components.user == nil, components.password == nil, components.port == nil,
              components.query == nil, components.fragment == nil,
              components.path.isEmpty || components.path == "/"
        else { return nil }
        self.host = host.lowercased()
    }
}

public struct WebKitBridgeFrameContext: Equatable {
    public let scheme: String?
    public let host: String?
    public let port: Int?
    public let isMainFrame: Bool

    public init(scheme: String?, host: String?, port: Int?, isMainFrame: Bool) {
        self.scheme = scheme
        self.host = host
        self.port = port
        self.isMainFrame = isMainFrame
    }
}

protocol WebKitBridgeHandlerRegistration: AnyObject {
    func addPageHandler(_ handler: WebKitBridgeAdapter, named name: String)
    func removePageHandler(named name: String)
}

public final class WebKitBridgeAdapter: NSObject, WKScriptMessageHandlerWithReply {
    public static let handlerName = "kioskNativeBridge"

    private let origin: WebKitBridgeOrigin
    private let bridge: SecureBridge
    private var invalidated = false

    public init?(approvedOrigin: String, bridge: SecureBridge) {
        guard let origin = WebKitBridgeOrigin(configuredOrigin: approvedOrigin) else { return nil }
        self.origin = origin
        self.bridge = bridge
    }

    public func register(on controller: WKUserContentController) {
        guard !invalidated else { return }
        controller.addScriptMessageHandler(self, contentWorld: .page, name: Self.handlerName)
    }

    public func invalidate(from controller: WKUserContentController) {
        guard !invalidated else { return }
        invalidated = true
        bridge.invalidate()
        controller.removeScriptMessageHandler(forName: Self.handlerName, contentWorld: .page)
    }

    func accepts(frame: WebKitBridgeFrameContext) -> Bool {
        frame.isMainFrame &&
            frame.scheme?.caseInsensitiveCompare("https") == .orderedSame &&
            frame.host?.lowercased() == origin.host &&
            (frame.port == 0 || frame.port == 443)
    }

    func receive(body: Any, frame: WebKitBridgeFrameContext) -> [String: String] {
        guard accepts(frame: frame), let rawJSON = body as? String else { return [:] }
        return Self.project(bridge.dispatch(rawJSON))
    }

    static func project(_ response: SecureBridgeResponse) -> [String: String] {
        var reply = [String: String]()
        if let requestId = response.requestId { reply["requestId"] = requestId }
        if let operationRef = response.operationRef { reply["operationRef"] = operationRef }
        if let state = response.state { reply["state"] = state.value }
        if let error = response.error { reply["error"] = error.value }
        return reply
    }

    public func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
        let origin = message.frameInfo.securityOrigin
        let frame = WebKitBridgeFrameContext(
            scheme: origin.protocol,
            host: origin.host,
            port: origin.port,
            isMainFrame: message.frameInfo.isMainFrame
        )
        replyHandler(receive(body: message.body, frame: frame), nil)
    }

    func register(using registration: WebKitBridgeHandlerRegistration) {
        guard !invalidated else { return }
        registration.addPageHandler(self, named: Self.handlerName)
    }

    func invalidate(using registration: WebKitBridgeHandlerRegistration) {
        guard !invalidated else { return }
        invalidated = true
        bridge.invalidate()
        registration.removePageHandler(named: Self.handlerName)
    }
}

private extension SecureBridgeState {
    var value: String {
        switch self {
        case .accepted: "accepted"
        case .pending: "pending"
        case .rejected: "rejected"
        }
    }
}

private extension SecureBridgeError {
    var value: String {
        switch self {
        case .requestTooLarge: "requestTooLarge"
        case .malformedRequest: "malformedRequest"
        case .unsupportedVersion: "unsupportedVersion"
        case .unknownOperation: "unknownOperation"
        case .invalidPayload: "invalidPayload"
        case .requestIdConflict: "requestIdConflict"
        case .responseCacheExhausted: "responseCacheExhausted"
        case .internalError: "internalError"
        case .staleContext: "staleContext"
        }
    }
}
