import Foundation
import Capacitor
import AVFoundation
import UIKit

@objc(BarcodePlugin)
public class BarcodePlugin: CAPPlugin {

    @objc func scan(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let status = AVCaptureDevice.authorizationStatus(for: .video)

            switch status {
            case .authorized:
                self.presentScanner(call)
            case .notDetermined:
                AVCaptureDevice.requestAccess(for: .video) { granted in
                    DispatchQueue.main.async {
                        if granted {
                            self.presentScanner(call)
                        } else {
                            call.reject("ERR_PERMISSION_DENIED", "Kamera-Zugriff wurde verweigert")
                        }
                    }
                }
            default:
                self.showPermissionAlert(call)
            }
        }
    }

    private func showPermissionAlert(_ call: CAPPluginCall) {
        guard let vc = self.bridge?.viewController else {
            call.reject("ERR_PERMISSION_DENIED", "Kamera-Zugriff wurde verweigert")
            return
        }
        let alert = UIAlertController(
            title: "Kamera-Zugriff benötigt",
            message: "Bitte erlaube der TrainQ-App den Kamera-Zugriff in den Einstellungen, um Barcodes zu scannen.",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "Einstellungen öffnen", style: .default) { _ in
            if let url = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(url)
            }
            call.reject("ERR_PERMISSION_DENIED", "Kamera-Zugriff wurde verweigert")
        })
        alert.addAction(UIAlertAction(title: "Abbrechen", style: .cancel) { _ in
            call.reject("ERR_PERMISSION_DENIED", "Kamera-Zugriff wurde verweigert")
        })
        vc.present(alert, animated: true)
    }

    private func presentScanner(_ call: CAPPluginCall) {
        guard AVCaptureDevice.default(for: .video) != nil else {
            call.reject("ERR_NO_CAMERA", "Kein Kameragerät verfügbar")
            return
        }
        guard let vc = self.bridge?.viewController else {
            call.resolve(["barcode": NSNull()])
            return
        }

        let scanner = BarcodeScannerViewController()
        scanner.modalPresentationStyle = .fullScreen
        scanner.onResult = { barcode in
            if let code = barcode {
                call.resolve(["barcode": code])
            } else {
                call.resolve(["barcode": NSNull()])
            }
        }

        vc.present(scanner, animated: true)
    }
}
