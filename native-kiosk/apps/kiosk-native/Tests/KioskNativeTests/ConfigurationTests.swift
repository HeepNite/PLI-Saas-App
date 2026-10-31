import XCTest
@testable import KioskNative

/// Origin lock, per-device configuration and the native-only session cookie selection.
final class ConfigurationTests: XCTestCase {
    private let origin = Fixtures.origin
    private var terminal: String { origin + "/staff/terminal" }
    private func policy() throws -> OriginPolicy { try XCTUnwrap(OriginPolicy(approvedOrigin: origin)) }

    func testApprovedOriginRequiresOneExactHttpsHostWithDefaultPort() throws {
        XCTAssertEqual(try policy().terminalURL, terminal)
        XCTAssertEqual(OriginPolicy(approvedOrigin: "HTTPS://PLI.PalladiumLatin.ART")?.origin, origin)
        let invalid = [
            "", " https://pli.palladiumlatin.art", "http://pli.palladiumlatin.art", "pli.palladiumlatin.art", origin + "/", origin + "/x",
            origin + "?q", origin + "#f", "https://user@pli.palladiumlatin.art", "https://pli.palladiumlatin.art:443", "https://a..b",
            "https://-a.example", "https://pli_palladiumlatin.art", "https://pli.palladiumlatin.art@evil.example", "https://[::1]", "https://pliñ.example",
        ]
        invalid.forEach { XCTAssertNil(OriginPolicy(approvedOrigin: $0), $0) }
    }

    func testMainFramesMayLoadOnlyTheExactTerminalURL() throws {
        let policy = try policy()
        XCTAssertFalse(policy.shouldCancelNavigation(terminal, isMainFrame: true))
        XCTAssertFalse(policy.shouldCancelNavigation("https://js.stripe.com/frame", isMainFrame: false))
        let denied = [nil, terminal + "/", terminal + "?next=1", terminal + "#pay", origin, origin + "/Staff/Terminal", "http://pli.palladiumlatin.art/staff/terminal",
                      "https://evil.pli.palladiumlatin.art/staff/terminal", "https://pli.palladiumlatin.art:443/staff/terminal", "about:blank"]
        denied.forEach { XCTAssertTrue(policy.shouldCancelNavigation($0, isMainFrame: true), $0 ?? "nil") }
    }

    func testMessagesRequireExactOriginMainFrameAndTerminalDocument() throws {
        let policy = try policy()
        XCTAssertTrue(policy.acceptsMessage(sourceOrigin: origin, isMainFrame: true, currentURL: terminal))
        XCTAssertFalse(policy.acceptsMessage(sourceOrigin: origin, isMainFrame: false, currentURL: terminal))
        XCTAssertFalse(policy.acceptsMessage(sourceOrigin: origin, isMainFrame: true, currentURL: terminal + "#payment"))
        for source in [nil, "null", "http://pli.palladiumlatin.art", "https://pli.palladiumlatin.art:444", "https://sub.pli.palladiumlatin.art", origin + "/"] {
            XCTAssertFalse(policy.acceptsMessage(sourceOrigin: source, isMainFrame: true, currentURL: terminal), source ?? "nil")
        }
        XCTAssertEqual(OriginPolicy.serializedOrigin(scheme: "HTTPS", host: "PLI.palladiumlatin.art", port: 443), origin)
        XCTAssertEqual(OriginPolicy.serializedOrigin(scheme: "https", host: "pli.palladiumlatin.art", port: 0), origin)
        XCTAssertEqual(OriginPolicy.serializedOrigin(scheme: "http", host: "pli.palladiumlatin.art", port: 443), "http://pli.palladiumlatin.art:443")
        XCTAssertNil(OriginPolicy.serializedOrigin(scheme: "https", host: "", port: 0))
    }

    func testConfigurationNeedsTheExactOriginAndValidPinsForTheReader() {
        let pins = [KioskConfiguration.originKey: origin, KioskConfiguration.serialKey: Fixtures.serial, KioskConfiguration.locationKey: Fixtures.location]
        XCTAssertEqual(KioskConfiguration(info: pins)?.readerPolicy, Fixtures.policy)
        XCTAssertNil(KioskConfiguration(info: pins.merging([KioskConfiguration.originKey: origin + "/"]) { $1 }))
        XCTAssertNil(KioskConfiguration(info: pins.merging([KioskConfiguration.originKey: "HTTPS://PLI.palladiumlatin.art"]) { $1 }))
        for (key, placeholder) in [(KioskConfiguration.serialKey, "REPLACE_WITH_M2_SERIAL"), (KioskConfiguration.locationKey, "REPLACE_WITH_STRIPE_LOCATION")] {
            let configuration = KioskConfiguration(info: pins.merging([key: placeholder]) { $1 })
            XCTAssertNotNil(configuration, "the web kiosk still runs")
            XCTAssertNil(configuration?.readerPolicy)
        }
    }

    func testOnlyOneSecureHttpOnlyHostOnlySessionCookieIsEverUsed() throws {
        func cookie(name: String = StaffSession.cookieName, value: String = "abc", domain: String = "pli.palladiumlatin.art", secure: Bool = true, httpOnly: Bool = true) -> HTTPCookie {
            var properties: [HTTPCookiePropertyKey: Any] = [.name: name, .value: value, .domain: domain, .path: "/"]
            if secure { properties[.secure] = "TRUE" }
            if httpOnly { properties[HTTPCookiePropertyKey("HttpOnly")] = "TRUE" }
            return HTTPCookie(properties: properties)!
        }
        XCTAssertEqual(StaffSession.cookieValue(in: [cookie(), cookie(name: "other")], origin: origin), "abc")
        for rejected in [[], [cookie(), cookie(value: "def")], [cookie(secure: false)], [cookie(httpOnly: false)], [cookie(domain: ".palladiumlatin.art")], [cookie(value: "a,b")]] {
            XCTAssertNil(StaffSession.cookieValue(in: rejected, origin: origin))
        }
        XCTAssertFalse("\(StaffSession(origin: origin, cookie: "secret-cookie", expiresAt: 1))".contains("secret-cookie"))
    }
}
