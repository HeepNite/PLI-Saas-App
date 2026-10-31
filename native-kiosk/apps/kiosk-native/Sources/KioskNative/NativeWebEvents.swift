import Foundation

/// Coarse reader status shown to the page (wire values match Kotlin `ReaderStatus.name.lowercase()`).
public enum NativeReaderStatus: String, CaseIterable, Equatable {
    case connected, connecting, disconnected
}

/// Customer-facing collection moments. They carry no payment, reader, or card data.
public enum CollectionPrompt: String, CaseIterable, Equatable {
    case none
    case awaitingCard = "awaiting_card"
    case processing
}

/// Delivers one serialized event to the admitted page; the host owns its thread and validity.
public protocol NativeWebEventTarget: AnyObject {
    func post(_ message: String) throws
}

/// Native-to-page push channel for one bridge context. It emits only the two closed event shapes, only on change,
/// never identifiers, and nothing before a page binds. A `getReaderStatus` request is answered at the next bind.
public final class NativeWebEvents {
    private let lock = NSRecursiveLock()
    private var target: NativeWebEventTarget?
    private var status: NativeReaderStatus?
    private var prompt = CollectionPrompt.none
    private var statusRequested = false
    private var invalidated = false

    public func bind(_ target: NativeWebEventTarget) {
        locked {
            guard !invalidated else { return }
            self.target = target
            if statusRequested, let status { post("readerStatus", "status", status.rawValue) }
            statusRequested = false
        }
    }

    /// Clears the binding only when it is still `target`, so an older document never clears a newer one.
    public func unbind(_ target: NativeWebEventTarget) {
        locked { if self.target === target { self.target = nil } }
    }

    public func requestStatus() {
        locked { if !invalidated { statusRequested = true } }
    }

    public func readerStatus(_ next: NativeReaderStatus) {
        locked {
            guard !invalidated, next != status else { return }
            status = next
            pushed("readerStatus", next.rawValue)
            post("readerStatus", "status", next.rawValue)
        }
    }

    public func collectionPrompt(_ next: CollectionPrompt) {
        locked {
            guard !invalidated else { return }
            guard next != prompt else { return KioskDiagnostics.log("event skipped type=collectionPrompt value=\(next.rawValue) reason=unchanged") }
            prompt = next
            pushed("collectionPrompt", next.rawValue)
            post("collectionPrompt", "prompt", next.rawValue)
        }
    }

    public func invalidate() {
        locked {
            invalidated = true
            target = nil
        }
    }

    private func locked(_ body: () -> Void) {
        lock.lock()
        defer { lock.unlock() }
        body()
    }

    private func pushed(_ type: String, _ value: String) {
        KioskDiagnostics.log("event pushed type=\(type) value=\(value) bound=\(target != nil)")
    }

    /// Values are closed enum raw values, so no escaping is needed.
    private func post(_ event: String, _ key: String, _ value: String) {
        try? target?.post("{\"version\":1,\"event\":\"\(event)\",\"payload\":{\"\(key)\":\"\(value)\"}}")
    }
}
