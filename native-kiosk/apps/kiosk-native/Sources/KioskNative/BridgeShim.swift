import Foundation

/// Generates the document-start script that gives the page the same `window.pliNativeBridge` surface the
/// Android WebMessageListener exposes, and the script native code evaluates to push a message to the page.
/// All dynamic values enter scripts only as escaped JSON string literals, never by raw interpolation.
public enum BridgeShim {
    /// Defines a non-replaceable `window.pliNativeBridge { postMessage(string), onmessage, addEventListener }`
    /// forwarding strings to `webkit.messageHandlers[handlerName]`, plus a non-enumerable `deliver(string)`.
    public static func script(handlerName: String) -> String {
        """
        (function () {
          'use strict';
          if (Object.prototype.hasOwnProperty.call(window, 'pliNativeBridge')) { return; }
          var handlers = window.webkit && window.webkit.messageHandlers;
          var handler = handlers && handlers[\(javaScriptLiteral(handlerName))];
          var send = handler && typeof handler.postMessage === 'function' ? handler.postMessage.bind(handler) : null;
          var onmessage = null;
          var listeners = [];
          var bridge = {};
          Object.defineProperty(bridge, 'postMessage', { enumerable: true, value: function (message) {
            if (typeof message === 'string' && send) { send(message); }
          } });
          Object.defineProperty(bridge, 'onmessage', { enumerable: true,
            get: function () { return onmessage; },
            set: function (value) { if (value === null || typeof value === 'function') { onmessage = value; } } });
          Object.defineProperty(bridge, 'addEventListener', { enumerable: true, value: function (type, listener) {
            if (type === 'message' && typeof listener === 'function' && listeners.indexOf(listener) < 0) { listeners.push(listener); }
          } });
          Object.defineProperty(bridge, 'removeEventListener', { enumerable: true, value: function (type, listener) {
            var index = listeners.indexOf(listener);
            if (type === 'message' && index >= 0) { listeners.splice(index, 1); }
          } });
          Object.defineProperty(bridge, 'deliver', { enumerable: false, value: function (data) {
            var event = { data: data };
            var targets = (onmessage ? [onmessage] : []).concat(listeners);
            for (var i = 0; i < targets.length; i += 1) { try { targets[i].call(bridge, event); } catch (ignored) {} }
          } });
          Object.preventExtensions(bridge);
          Object.defineProperty(window, 'pliNativeBridge', { value: bridge, enumerable: true, writable: false, configurable: false });
        })();
        """
    }

    /// Script for `evaluateJavaScript`: delivers `message` (already a JSON string) as `event.data` to the page, if the shim exists.
    public static func deliveryScript(message: String) -> String {
        "(function(){var b=window.pliNativeBridge;if(b&&typeof b.deliver==='function'){b.deliver(\(javaScriptLiteral(message)));}})();"
    }

    /// A double-quoted JavaScript string literal that cannot terminate early or inject code, including in
    /// legacy engines (U+2028/U+2029) and HTML contexts (`<`).
    public static func javaScriptLiteral(_ value: String) -> String {
        var result = "\""
        for scalar in value.unicodeScalars {
            switch scalar {
            case "\\": result += "\\\\"
            case "\"": result += "\\\""
            case "\n": result += "\\n"
            case "\r": result += "\\r"
            case "\t": result += "\\t"
            case "\u{08}": result += "\\b"
            case "\u{0C}": result += "\\f"
            case "<", "\u{2028}", "\u{2029}", "\u{7F}": result += String(format: "\\u%04x", scalar.value)
            default:
                if scalar.value < 0x20 { result += String(format: "\\u%04x", scalar.value) } else { result.unicodeScalars.append(scalar) }
            }
        }
        return result + "\""
    }
}
