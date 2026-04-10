import UIKit
import WebKit
import Capacitor

class ViewController: CAPBridgeViewController {

    // Enable Safari Web Inspector (iOS 16.4+)
    override func webView(with frame: CGRect, configuration: WKWebViewConfiguration) -> WKWebView {
        let wv = WKWebView(frame: frame, configuration: configuration)
        if #available(iOS 16.4, *) {
            wv.isInspectable = true
        }
        // Set background color to avoid black flash during WebView reload
        wv.backgroundColor = UIColor(red: 0.949, green: 0.949, blue: 0.965, alpha: 1.0) // #F2F2F7
        wv.scrollView.backgroundColor = UIColor(red: 0.949, green: 0.949, blue: 0.965, alpha: 1.0)
        wv.isOpaque = false
        return wv
    }

    override func capacitorDidLoad() {
        // Set WebView background color after load to prevent black screen on WKWebView resume
        self.webView?.backgroundColor = UIColor(red: 0.949, green: 0.949, blue: 0.965, alpha: 1.0)
        self.webView?.scrollView.backgroundColor = UIColor(red: 0.949, green: 0.949, blue: 0.965, alpha: 1.0)
        self.webView?.isOpaque = false
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        // Set view background to avoid black flash
        self.view.backgroundColor = UIColor(red: 0.949, green: 0.949, blue: 0.965, alpha: 1.0)
    }
}
