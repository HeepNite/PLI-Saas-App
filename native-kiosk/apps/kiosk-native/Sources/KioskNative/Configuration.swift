import Foundation

/// Exact-origin, exact-target admission policy kept independent of WebKit callbacks
/// (Kotlin `SecureWebAdmission` + `ApprovedOrigin`). Strings in, booleans out.
public struct OriginPolicy: Equatable {
    public static let terminalPath = "/staff/terminal"

    /// Serialized approved origin: `https://<lowercase host>` (default port, no userinfo, no path).
    public let origin: String
    public let terminalURL: String

    /// Accepts only `https://host` with an ASCII DNS-style host: no port (not even `:443`), userinfo,
    /// path (not even `/`), query, fragment, whitespace, or IP literal.
    public init?(approvedOrigin value: String) {
        let prefix = "https://"
        guard value.count > prefix.count, value.prefix(prefix.count).lowercased() == prefix else { return nil }
        let host = String(value.dropFirst(prefix.count)).lowercased()
        guard Self.isDNSHost(host) else { return nil }
        origin = prefix + host
        terminalURL = origin + Self.terminalPath
    }

    /// True when a navigation must be cancelled: a main frame may only load the exact terminal URL.
    public func shouldCancelNavigation(_ url: String?, isMainFrame: Bool) -> Bool {
        isMainFrame && url != terminalURL
    }

    /// A script message is admitted only from the approved origin's main frame while the document is the terminal URL.
    public func acceptsMessage(sourceOrigin: String?, isMainFrame: Bool, currentURL: String?) -> Bool {
        sourceOrigin == origin && isMainFrame && currentURL == terminalURL
    }

    /// Serializes WebKit security-origin parts like a browser: lowercase, default port (0/nil/443 on https) omitted.
    public static func serializedOrigin(scheme: String?, host: String?, port: Int?) -> String? {
        guard let scheme = scheme?.lowercased(), !scheme.isEmpty, let host = host?.lowercased(), !host.isEmpty else { return nil }
        let isDefault = port == nil || port == 0 || (scheme == "https" && port == 443)
        return isDefault ? "\(scheme)://\(host)" : "\(scheme)://\(host):\(port!)"
    }

    private static func isDNSHost(_ host: String) -> Bool {
        guard !host.isEmpty, host.utf8.count <= 253 else { return false }
        return host.split(separator: ".", omittingEmptySubsequences: false).allSatisfy { label in
            !label.isEmpty && label.utf8.count <= 63 && label.first != "-" && label.last != "-" &&
                label.utf8.allSatisfy { ($0 >= 0x61 && $0 <= 0x7A) || ($0 >= 0x30 && $0 <= 0x39) || $0 == 0x2D }
        }
    }
}
