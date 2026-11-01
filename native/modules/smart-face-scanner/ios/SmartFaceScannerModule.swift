import ExpoModulesCore
import AVFoundation
import MediaPipeTasksVision
import UIKit

public class SmartFaceScannerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SmartFaceScanner")
    View(SmartFaceScannerView.self) {
      Events("onFrame", "onError")
      Prop("active") { (view: SmartFaceScannerView, active: Bool) in view.setActive(active) }
      AsyncFunction("capture") { (view: SmartFaceScannerView) -> [String: String] in try view.capture() }
    }
  }
}

final class SmartFaceScannerView: ExpoView, AVCaptureVideoDataOutputSampleBufferDelegate {
  let onFrame = EventDispatcher()
  let onError = EventDispatcher()
  private let session = AVCaptureSession()
  private let queue = DispatchQueue(label: "scp.face.camera")
  private var preview: AVCaptureVideoPreviewLayer!
  private var landmarker: FaceLandmarker?
  private var configured = false
  private var desiredActive = false
  private var observers: [NSObjectProtocol] = []
  private var lastTick = 0
  private var lastImage: UIImage?
  private var lastCaptureAt: TimeInterval = 0
  private let lock = NSLock()
  private let ciContext = CIContext()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    preview = AVCaptureVideoPreviewLayer(session: session)
    preview.videoGravity = .resizeAspectFill
    layer.addSublayer(preview)
    observers.append(NotificationCenter.default.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: nil) { [weak self] _ in self?.pause() })
  }
  override func layoutSubviews() { super.layoutSubviews(); preview.frame = bounds }
  override func didMoveToWindow() { super.didMoveToWindow(); if window == nil { pause() } else if desiredActive { start() } }
  func setActive(_ value: Bool) { desiredActive = value; if value && window != nil { start() } else { pause() } }
  private func fail(_ message: String) { DispatchQueue.main.async { [weak self] in self?.onError(["message": message]) } }
  private func start() {
    queue.async { [weak self] in
      guard let self, self.desiredActive else { return }
      do {
        if !self.configured {
          guard AVCaptureDevice.authorizationStatus(for: .video) == .authorized,
            let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front) else { throw ScannerError.camera }
          let input = try AVCaptureDeviceInput(device: camera)
          let output = AVCaptureVideoDataOutput()
          output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
          output.alwaysDiscardsLateVideoFrames = true
          output.setSampleBufferDelegate(self, queue: self.queue)
          self.session.beginConfiguration()
          self.session.inputs.forEach { self.session.removeInput($0) }
          self.session.outputs.forEach { self.session.removeOutput($0) }
          self.session.sessionPreset = .vga640x480
          guard self.session.canAddInput(input), self.session.canAddOutput(output) else { self.session.commitConfiguration(); throw ScannerError.camera }
          self.session.addInput(input); self.session.addOutput(output)
          if let connection = output.connection(with: .video) {
            connection.videoOrientation = .portrait
            if connection.isVideoMirroringSupported { connection.isVideoMirrored = false }
          }
          self.session.commitConfiguration()
          let bundle = Bundle(for: SmartFaceScannerView.self)
          let resources = bundle.url(forResource: "SmartFaceScanner", withExtension: "bundle").flatMap { Bundle(url: $0) }
          guard let path = resources?.path(forResource: "face_landmarker", ofType: "task") else { throw ScannerError.model }
          let options = FaceLandmarkerOptions()
          options.baseOptions.modelAssetPath = path
          options.runningMode = .video
          options.numFaces = 2
          options.minFaceDetectionConfidence = 0.5
          options.minFacePresenceConfidence = 0.5
          options.minTrackingConfidence = 0.5
          options.outputFaceBlendshapes = true
          options.outputFacialTransformationMatrixes = true
          self.landmarker = try FaceLandmarker(options: options)
          self.configured = true
        }
        if !self.session.isRunning { self.session.startRunning() }
      } catch { self.fail("The native front camera or face model could not start. Check permissions and retry.") }
    }
  }
  private func pause() { queue.async { [weak self] in guard let self else { return }; if self.session.isRunning { self.session.stopRunning() }; self.lock.lock(); self.lastImage = nil; self.lastCaptureAt = 0; self.lock.unlock() } }
  func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
    guard desiredActive, session.isRunning else { return }
    let tick = Int(ProcessInfo.processInfo.systemUptime * 1000)
    guard tick - lastTick >= 120 else { return }; lastTick = tick
    do {
      let image = try MPImage(sampleBuffer: sampleBuffer)
      guard let result = try landmarker?.detect(videoFrame: image, timestampInMilliseconds: tick),
        let buffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
      let points = result.faceLandmarks.first ?? []
      let matrix = result.facialTransformationMatrixes.first
      let yaw = matrix.map { atan2(Double($0.data[2]), Double($0.data[10])) * 180 / .pi } ?? .nan
      let pitch = matrix.map { atan2(-Double($0.data[6]), sqrt(pow(Double($0.data[4]),2)+pow(Double($0.data[5]),2))) * 180 / .pi } ?? .nan
      let shapes = Dictionary((result.faceBlendshapes.first?.categories ?? []).map { ($0.categoryName ?? "", Double($0.score)) }, uniquingKeysWith: {a,_ in a})
      let width = Double((points.map(\.x).max() ?? 0) - (points.map(\.x).min() ?? 0))
      let offset = abs(Double((points.map(\.x).max() ?? 0) + (points.map(\.x).min() ?? 0)) / 2 - 0.5)
      CVPixelBufferLockBaseAddress(buffer, .readOnly)
      var light = 0.0; var count = 0
      if let base = CVPixelBufferGetBaseAddress(buffer)?.assumingMemoryBound(to: UInt8.self) {
        let strideBytes = CVPixelBufferGetBytesPerRow(buffer)
        for y in stride(from: 0, to: CVPixelBufferGetHeight(buffer), by: 32) {
          for x in stride(from: 0, to: CVPixelBufferGetWidth(buffer), by: 32) {
            let at = y * strideBytes + x * 4
            light += 0.114 * Double(base[at]) + 0.587 * Double(base[at+1]) + 0.299 * Double(base[at+2]); count += 1
          }
        }
      }
      CVPixelBufferUnlockBaseAddress(buffer, .readOnly)
      light = light / Double(max(count,1)) / 255 * 100
      let ci = CIImage(cvPixelBuffer: buffer)
      let cg = ciContext.createCGImage(ci, from: ci.extent)
      lock.lock()
      lastImage = result.faceLandmarks.count == 1 ? cg.map { UIImage(cgImage: $0) } : nil
      lastCaptureAt = lastImage == nil ? 0 : Date().timeIntervalSince1970
      lock.unlock()
      let event: [String: Any] = ["timestampMs": Date().timeIntervalSince1970*1000,"faceCount": result.faceLandmarks.count,
        "yawDegrees": yaw.isFinite ? yaw : 0,"pitchDegrees":pitch.isFinite ? pitch : 0,"runtimeError": !points.isEmpty && (!yaw.isFinite || !pitch.isFinite),
        "blinkLeft":shapes["eyeBlinkLeft"] as Any? ?? NSNull(),"blinkRight":shapes["eyeBlinkRight"] as Any? ?? NSNull(),
        "faceWidthRatio":width,"faceCenterOffsetRatio":offset,"lightingStatus":light<32 ? "too_dark" : light>92 ? "too_bright" : "good"]
      DispatchQueue.main.async { [weak self] in if self?.desiredActive == true { self?.onFrame(event) } }
    } catch { fail("The native face model could not process the camera frame. Retry the scanner.") }
  }
  func capture() throws -> [String: String] {
    lock.lock(); defer { lock.unlock() }
    guard desiredActive, Date().timeIntervalSince1970-lastCaptureAt<=1, let data=lastImage?.jpegData(compressionQuality:0.9) else { throw ScannerError.capture }
    let url = FileManager.default.temporaryDirectory.appendingPathComponent("scp-face-\(UUID().uuidString).jpg")
    try data.write(to: url, options:.atomic)
    return ["uri":url.absoluteString]
  }
  deinit { observers.forEach(NotificationCenter.default.removeObserver); session.stopRunning() }
  enum ScannerError: Error { case camera, model, capture }
}
