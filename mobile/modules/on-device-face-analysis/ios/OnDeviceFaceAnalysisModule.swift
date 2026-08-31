import ExpoModulesCore
import MLKitFaceDetection
import MLKitVision
import UIKit

public class OnDeviceFaceAnalysisModule: Module {
  public func definition() -> ModuleDefinition {
    Name("OnDeviceFaceAnalysis")

    AsyncFunction("analyzeImageAsync") { (uri: String, promise: Promise) in
      guard let url = URL(string: uri), let image = UIImage(contentsOfFile: url.path) else {
        promise.reject("ERR_FACE_IMAGE", "The captured image could not be decoded.")
        return
      }

      let options = FaceDetectorOptions()
      options.performanceMode = .fast
      options.landmarkMode = .all
      options.classificationMode = .all
      options.minFaceSize = 0.2
      let detector = FaceDetector.faceDetector(options: options)
      let visionImage = VisionImage(image: image)
      visionImage.orientation = image.imageOrientation
      let brightness = self.averageBrightness(image)

      detector.process(visionImage) { faces, error in
        if let error {
          promise.reject("ERR_FACE_ANALYSIS", error.localizedDescription)
          return
        }
        let detected = faces ?? []
        let first = detected.first
        var facePayload: [String: Any]? = nil
        if let face = first {
          facePayload = [
            "x": face.frame.minX / image.size.width,
            "y": face.frame.minY / image.size.height,
            "width": face.frame.width / image.size.width,
            "height": face.frame.height / image.size.height,
            "headEulerAngleX": face.hasHeadEulerAngleX ? face.headEulerAngleX : 0,
            "headEulerAngleY": face.hasHeadEulerAngleY ? face.headEulerAngleY : 0,
            "headEulerAngleZ": face.hasHeadEulerAngleZ ? face.headEulerAngleZ : 0,
            "leftEyeOpenProbability": face.hasLeftEyeOpenProbability ? face.leftEyeOpenProbability : -1,
            "rightEyeOpenProbability": face.hasRightEyeOpenProbability ? face.rightEyeOpenProbability : -1,
            "smilingProbability": face.hasSmilingProbability ? face.smilingProbability : -1
          ]
        }
        promise.resolve([
          "faceCount": detected.count,
          "brightness": brightness,
          "isWellLit": brightness >= 55 && brightness <= 235,
          "imageWidth": image.size.width,
          "imageHeight": image.size.height,
          "face": facePayload as Any
        ])
      }
    }
  }

  private func averageBrightness(_ image: UIImage) -> CGFloat {
    guard let ciImage = CIImage(image: image) else { return 0 }
    let extent = ciImage.extent
    let filter = CIFilter(name: "CIAreaAverage", parameters: [
      kCIInputImageKey: ciImage,
      kCIInputExtentKey: CIVector(cgRect: extent)
    ])
    guard let output = filter?.outputImage else { return 0 }
    var pixel = [UInt8](repeating: 0, count: 4)
    CIContext(options: [.workingColorSpace: NSNull()]).render(
      output,
      toBitmap: &pixel,
      rowBytes: 4,
      bounds: CGRect(x: 0, y: 0, width: 1, height: 1),
      format: .RGBA8,
      colorSpace: nil
    )
    return (0.2126 * CGFloat(pixel[0])) + (0.7152 * CGFloat(pixel[1])) + (0.0722 * CGFloat(pixel[2]))
  }
}
