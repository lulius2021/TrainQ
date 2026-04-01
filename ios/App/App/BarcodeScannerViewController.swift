import UIKit
import AVFoundation

class BarcodeScannerViewController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {

    var onResult: ((String?) -> Void)?

    private let captureSession = AVCaptureSession()
    private var previewLayer: AVCaptureVideoPreviewLayer!
    private var hasReturned = false
    private var overlaySetUp = false

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        setupCamera()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        previewLayer?.frame = view.bounds
        if !overlaySetUp && view.bounds.width > 0 {
            overlaySetUp = true
            setupOverlay()
        }
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            self?.captureSession.startRunning()
        }
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            self?.captureSession.stopRunning()
        }
    }

    override var prefersStatusBarHidden: Bool { true }

    // MARK: - Camera Setup

    private func setupCamera() {
        guard let device = AVCaptureDevice.default(for: .video),
              let input = try? AVCaptureDeviceInput(device: device) else {
            returnResult(nil)
            return
        }

        if captureSession.canAddInput(input) {
            captureSession.addInput(input)
        }

        let output = AVCaptureMetadataOutput()
        if captureSession.canAddOutput(output) {
            captureSession.addOutput(output)
            output.setMetadataObjectsDelegate(self, queue: .main)
            output.metadataObjectTypes = [.ean8, .ean13, .upce]
        }

        previewLayer = AVCaptureVideoPreviewLayer(session: captureSession)
        previewLayer.videoGravity = .resizeAspectFill
        previewLayer.frame = view.bounds
        view.layer.addSublayer(previewLayer)
    }

    // MARK: - Overlay

    private func setupOverlay() {
        // Semi-transparent overlay
        let overlay = UIView(frame: view.bounds)
        overlay.backgroundColor = UIColor.black.withAlphaComponent(0.5)
        overlay.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(overlay)

        // Cut out scan window
        let scanSize: CGFloat = 260
        let scanRect = CGRect(
            x: (view.bounds.width - scanSize) / 2,
            y: (view.bounds.height - scanSize) / 2 - 40,
            width: scanSize,
            height: scanSize
        )

        let path = UIBezierPath(rect: overlay.bounds)
        let cutout = UIBezierPath(roundedRect: scanRect, cornerRadius: 16)
        path.append(cutout)
        path.usesEvenOddFillRule = true

        let maskLayer = CAShapeLayer()
        maskLayer.path = path.cgPath
        maskLayer.fillRule = .evenOdd
        overlay.layer.mask = maskLayer

        // Corner brackets
        addCornerBrackets(around: scanRect)

        // Instruction label
        let label = UILabel()
        label.text = "Barcode in den Rahmen halten"
        label.textColor = .white
        label.font = .systemFont(ofSize: 15, weight: .medium)
        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(label)
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            label.topAnchor.constraint(equalTo: view.topAnchor, constant: scanRect.maxY + 24)
        ])

        // Close button
        let closeButton = UIButton(type: .system)
        closeButton.translatesAutoresizingMaskIntoConstraints = false
        let config = UIImage.SymbolConfiguration(pointSize: 18, weight: .semibold)
        closeButton.setImage(UIImage(systemName: "xmark", withConfiguration: config), for: .normal)
        closeButton.tintColor = .white
        closeButton.backgroundColor = UIColor.white.withAlphaComponent(0.2)
        closeButton.layer.cornerRadius = 18
        closeButton.addTarget(self, action: #selector(closeTapped), for: .touchUpInside)
        view.addSubview(closeButton)
        NSLayoutConstraint.activate([
            closeButton.widthAnchor.constraint(equalToConstant: 36),
            closeButton.heightAnchor.constraint(equalToConstant: 36),
            closeButton.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 16),
            closeButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 12)
        ])
    }

    private func addCornerBrackets(around rect: CGRect) {
        let length: CGFloat = 28
        let lineWidth: CGFloat = 3
        let color = UIColor.systemGreen.cgColor

        let corners: [(CGPoint, CGPoint, CGPoint)] = [
            // top-left
            (CGPoint(x: rect.minX, y: rect.minY + length),
             CGPoint(x: rect.minX, y: rect.minY),
             CGPoint(x: rect.minX + length, y: rect.minY)),
            // top-right
            (CGPoint(x: rect.maxX - length, y: rect.minY),
             CGPoint(x: rect.maxX, y: rect.minY),
             CGPoint(x: rect.maxX, y: rect.minY + length)),
            // bottom-left
            (CGPoint(x: rect.minX, y: rect.maxY - length),
             CGPoint(x: rect.minX, y: rect.maxY),
             CGPoint(x: rect.minX + length, y: rect.maxY)),
            // bottom-right
            (CGPoint(x: rect.maxX - length, y: rect.maxY),
             CGPoint(x: rect.maxX, y: rect.maxY),
             CGPoint(x: rect.maxX, y: rect.maxY - length))
        ]

        for (start, corner, end) in corners {
            let path = UIBezierPath()
            path.move(to: start)
            path.addLine(to: corner)
            path.addLine(to: end)

            let layer = CAShapeLayer()
            layer.path = path.cgPath
            layer.strokeColor = color
            layer.fillColor = UIColor.clear.cgColor
            layer.lineWidth = lineWidth
            layer.lineCap = .round
            layer.lineJoin = .round
            view.layer.addSublayer(layer)
        }
    }

    // MARK: - Actions

    @objc private func closeTapped() {
        returnResult(nil)
    }

    // MARK: - AVCaptureMetadataOutputObjectsDelegate

    func metadataOutput(_ output: AVCaptureMetadataOutput,
                        didOutput metadataObjects: [AVMetadataObject],
                        from connection: AVCaptureConnection) {
        guard let metadata = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
              let code = metadata.stringValue else { return }

        // Haptic feedback
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.success)

        returnResult(code)
    }

    // MARK: - Result

    private func returnResult(_ barcode: String?) {
        guard !hasReturned else { return }
        hasReturned = true
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            self?.captureSession.stopRunning()
            DispatchQueue.main.async {
                self?.dismiss(animated: true) {
                    self?.onResult?(barcode)
                }
            }
        }
    }
}
