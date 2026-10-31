import Foundation
@testable import KioskNative

enum Fixtures {
    static let origin = "https://pli.palladiumlatin.art"
}

struct FakeFailure: Error {}

final class ClosureWebEventTarget: NativeWebEventTarget {
    private let deliver: (String) throws -> Void
    init(_ deliver: @escaping (String) throws -> Void) { self.deliver = deliver }
    func post(_ message: String) throws { try deliver(message) }
}
