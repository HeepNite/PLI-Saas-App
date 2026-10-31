import JavaScriptCore
import XCTest
@testable import KioskNative

/// Executes the generated shim in JavaScriptCore against a fake `webkit.messageHandlers`.
final class BridgeShimTests: XCTestCase {
    private func makeContext(handler: String = "pliNative") throws -> (JSContext, () -> [String]) {
        let context = try XCTUnwrap(JSContext())
        var errors = [String]()
        context.exceptionHandler = { _, exception in errors.append(exception?.toString() ?? "?") }
        context.evaluateScript("""
        var window = this; var posted = [];
        window.webkit = { messageHandlers: {} };
        window.webkit.messageHandlers[\(BridgeShim.javaScriptLiteral(handler))] = { postMessage: function (m) { posted.push(m); } };
        """)
        context.evaluateScript(BridgeShim.script(handlerName: handler))
        XCTAssertEqual(errors, [])
        return (context, { errors })
    }

    private func posted(_ context: JSContext) -> [String] { (context.evaluateScript("posted")?.toArray() as? [String]) ?? [] }

    func testPostMessageForwardsOnlyStringsToTheNamedHandler() throws {
        let (context, _) = try makeContext()
        context.evaluateScript(#"window.pliNativeBridge.postMessage('{"a":1}'); window.pliNativeBridge.postMessage(5); window.pliNativeBridge.postMessage({}); window.pliNativeBridge.postMessage(null); window.pliNativeBridge.postMessage();"#)
        XCTAssertEqual(posted(context), [#"{"a":1}"#])
    }

    func testBridgeIsAFixedNonReplaceableSurface() throws {
        let (context, errors) = try makeContext()
        context.evaluateScript("'use strict'; try { window.pliNativeBridge = {}; } catch (e) {}; window.pliNativeBridge.extra = 1;")
        XCTAssertTrue(context.evaluateScript("typeof window.pliNativeBridge.postMessage === 'function'")!.toBool())
        XCTAssertTrue(context.evaluateScript("window.pliNativeBridge.extra === undefined")!.toBool())
        XCTAssertTrue(context.evaluateScript("window.pliNativeBridge.onmessage === null")!.toBool())
        context.evaluateScript("window.pliNativeBridge.onmessage = function () {}; window.pliNativeBridge.postMessage = null;")
        XCTAssertTrue(context.evaluateScript("typeof window.pliNativeBridge.postMessage === 'function'")!.toBool())
        XCTAssertTrue(context.evaluateScript("typeof window.pliNativeBridge.onmessage === 'function'")!.toBool())
        _ = errors
    }

    func testDeliveryScriptCallsOnmessageWithTheExactStringAndListeners() throws {
        let (context, errors) = try makeContext()
        context.evaluateScript("var got = []; var heard = []; window.pliNativeBridge.onmessage = function (e) { got.push(e.data); }; window.pliNativeBridge.addEventListener('message', function (e) { heard.push(e.data); });")
        let message = #"{"version":1,"event":"readerStatus","payload":{"status":"connected"}}"#
        context.evaluateScript(BridgeShim.deliveryScript(message: message))
        XCTAssertEqual(context.evaluateScript("got")?.toArray() as? [String], [message])
        XCTAssertEqual(context.evaluateScript("heard")?.toArray() as? [String], [message])
        XCTAssertEqual(errors(), [])
    }

    func testDeliveryWithoutHandlersOrWithThrowingHandlersIsSilent() throws {
        let (context, errors) = try makeContext()
        context.evaluateScript(BridgeShim.deliveryScript(message: "{}"))
        context.evaluateScript("window.pliNativeBridge.onmessage = function () { throw new Error('page bug'); }; window.pliNativeBridge.addEventListener('message', function () { throw 1; });")
        context.evaluateScript(BridgeShim.deliveryScript(message: "{}"))
        XCTAssertEqual(errors(), [])
        let bare = try XCTUnwrap(JSContext())
        bare.evaluateScript("var window = this;")
        var bareErrors = [String]()
        bare.exceptionHandler = { _, e in bareErrors.append(e?.toString() ?? "?") }
        bare.evaluateScript(BridgeShim.deliveryScript(message: "{}"))
        XCTAssertEqual(bareErrors, [])
    }

    func testHostileMessagesRoundTripAsDataNeverAsCode() throws {
        let (context, errors) = try makeContext()
        context.evaluateScript("var got = []; window.pliNativeBridge.onmessage = function (e) { got.push(e.data); }; var pwned = false;")
        let hostile = [
            "'; pwned = true; //", "\"; pwned = true; //", "\\", "\\\"", "</script><script>pwned=true</script>",
            "line\nbreak\r\t", "\u{2028}\u{2029}", "\u{0}\u{1}\u{1F}", "`${pwned = true}`", "😀 é ü \u{7F}", "*/ pwned = true; /*",
            #"{"k":"v\"with quotes"}"#, "", "\\u0027; pwned = true; //",
        ]
        hostile.forEach { context.evaluateScript(BridgeShim.deliveryScript(message: $0)) }
        XCTAssertFalse(context.evaluateScript("pwned")!.toBool())
        XCTAssertEqual(context.evaluateScript("got")?.toArray() as? [String], hostile)
        XCTAssertEqual(errors(), [])
    }

    func testHostileHandlerNamesStayInsideTheStringLiteral() throws {
        let name = "x']; window.pwned = true; ['y"
        let context = try XCTUnwrap(JSContext())
        context.evaluateScript("var window = this; window.webkit = { messageHandlers: {} };")
        context.evaluateScript(BridgeShim.script(handlerName: name))
        XCTAssertFalse(context.evaluateScript("window.pwned === true")!.toBool())
        XCTAssertTrue(context.evaluateScript("typeof window.pliNativeBridge.postMessage === 'function'")!.toBool())
        context.evaluateScript("window.pliNativeBridge.postMessage('x')")
    }

    func testScriptTextNeverContainsDeliveredMessages() {
        XCTAssertFalse(BridgeShim.script(handlerName: "pliNative").contains("connected"))
        XCTAssertTrue(BridgeShim.script(handlerName: "pliNative").contains("\"pliNative\""))
    }

    func testLiteralEscapesTheCharactersThatBreakScripts() {
        XCTAssertEqual(BridgeShim.javaScriptLiteral("a\"b\\c\n"), #""a\"b\\c\n""#)
        XCTAssertEqual(BridgeShim.javaScriptLiteral("\u{2028}\u{2029}<"), #""\u2028\u2029\u003c""#)
        XCTAssertEqual(BridgeShim.javaScriptLiteral("\u{0}\u{1F}\u{7F}"), #""\u0000\u001f\u007f""#)
        XCTAssertEqual(BridgeShim.javaScriptLiteral("😀"), "\"😀\"")
    }
}
