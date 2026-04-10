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
        return wv
    }

    override func capacitorDidLoad() {
        print("CAP_DIAG: capacitorDidLoad fired, webView=\(String(describing: self.webView))")
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
            print("CAP_DIAG: injecting JS...")
            self.webView?.evaluateJavaScript("""
                JSON.stringify({
                    rootChildren: (document.getElementById('root') || {childElementCount: -1}).childElementCount,
                    bodyBg: getComputedStyle(document.body).backgroundColor,
                    title: document.title,
                    url: location.href
                });
            """) { result, error in
                if let error = error {
                    print("CAP_DIAG JS error: \(error)")
                } else {
                    print("CAP_DIAG result: \(String(describing: result))")
                }
            }
        }
    }

    override func viewDidLoad() {
        super.viewDidLoad()
    }
}
