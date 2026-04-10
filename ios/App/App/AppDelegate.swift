import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Reload WebView if WKWebView content process was terminated under memory pressure.
        // Capacitor 8 handles webViewWebContentProcessDidTerminate internally, but the reload
        // results in a blank screen. This ensures the root ViewController reloads if needed.
        if let rootVC = window?.rootViewController as? ViewController {
            if let webView = rootVC.webView, webView.url == nil {
                webView.reload()
            }
        }
    }

    func applicationDidReceiveMemoryWarning(_ application: UIApplication) {
        // On low memory: set a flag so that on next foreground entry we can detect
        // if the WKWebView process was killed and trigger a reload.
        UserDefaults.standard.set(Date(), forKey: "trainq_last_memory_warning")
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}
