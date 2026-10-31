import SwiftUI

/// SwiftUI lifecycle host; all behavior lives in `KioskViewController`. No Guided Access or other OS lockdown API.
@main
struct KioskApp: App {
    var body: some Scene {
        WindowGroup {
            KioskRootView().ignoresSafeArea().statusBarHidden(true).persistentSystemOverlays(.hidden)
        }
    }
}

struct KioskRootView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> KioskViewController { KioskViewController() }
    func updateUIViewController(_ controller: KioskViewController, context: Context) {}
}
