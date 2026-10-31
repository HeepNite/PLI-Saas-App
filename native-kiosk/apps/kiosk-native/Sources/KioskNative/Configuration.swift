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

/// Per-device build inputs from Info.plist (xcconfig substitution). The origin is mandatory; without valid reader
/// pins (a Debug build with placeholders) the app is a plain web kiosk with no native bridge.
public struct KioskConfiguration: Equatable {
    public static let originKey = "PLIApprovedOrigin"
    public static let serialKey = "PLIM2Serial"
    public static let locationKey = "PLIStripeLocation"

    public let originPolicy: OriginPolicy
    public let readerPolicy: ReaderPolicy?

    public init?(info: [String: Any]) {
        guard let origin = info[Self.originKey] as? String, let policy = OriginPolicy(approvedOrigin: origin), policy.origin == origin else { return nil }
        originPolicy = policy
        let serial = info[Self.serialKey] as? String ?? ""
        let location = info[Self.locationKey] as? String ?? ""
        readerPolicy = Self.matches(serial, #"^STRM2[A-Z0-9]+$"#) && Self.matches(location, #"^tml_[A-Za-z0-9]+$"#)
            ? ReaderPolicy(serial: serial, locationId: location) : nil
    }

    private static func matches(_ value: String, _ pattern: String) -> Bool {
        value.range(of: pattern, options: .regularExpression) != nil
    }
}

/// The one M2 this tablet may use: serial and Stripe location come from the per-device xcconfig (Info.plist).
public struct ReaderPolicy: Equatable {
    public static let readerType = "stripe_m2"

    public let serial: String
    public let locationId: String

    public init(serial: String, locationId: String) {
        self.serial = serial
        self.locationId = locationId
    }

    /// Serial, type and location must match, and the pinned reader id once one is known (`nil` only at first
    /// pairing). A discovered reader that was never registered reports no id or location: connecting registers it
    /// to the configured location. A connected reader must report both.
    public func matches(_ reader: SDKReader, pinnedId: String?, connected: Bool) -> Bool {
        guard reader.serialNumber == serial, reader.deviceType == Self.readerType else { return false }
        if connected {
            guard let id = reader.stripeId, reader.locationId == locationId else { return false }
            return pinnedId == nil || id == pinnedId
        }
        let reported = reader.locationId.flatMap { $0.isEmpty ? nil : $0 }
        let location = reported ?? (reader.stripeId == nil ? locationId : "")
        return location == locationId && (pinnedId == nil || reader.stripeId == nil || reader.stripeId == pinnedId)
    }
}
