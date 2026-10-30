package expo.modules.ondevicefaceanalysis

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class OnDeviceFaceAnalysisModule : Module() {
  private val detector by lazy {
    val options = FaceDetectorOptions.Builder()
      .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
      .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL)
      .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_ALL)
      .setMinFaceSize(0.2f)
      .build()
    FaceDetection.getClient(options)
  }

  override fun definition() = ModuleDefinition {
    Name("OnDeviceFaceAnalysis")

    AsyncFunction("analyzeImageAsync") { uri: String, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("ERR_FACE_CONTEXT", "The native face analyser is not available.", null)
        return@AsyncFunction
      }

      try {
        val imageUri = Uri.parse(uri)
        val image = InputImage.fromFilePath(context, imageUri)
        val bitmap = context.contentResolver.openInputStream(imageUri).use { stream ->
          BitmapFactory.decodeStream(stream)
        } ?: throw IllegalArgumentException("The captured image could not be decoded.")
        val brightness = averageBrightness(bitmap)
        bitmap.recycle()

        detector.process(image)
          .addOnSuccessListener { faces ->
            val face = faces.firstOrNull()
            val facePayload = face?.let {
              mapOf(
                "x" to it.boundingBox.left.toDouble() / image.width,
                "y" to it.boundingBox.top.toDouble() / image.height,
                "width" to it.boundingBox.width().toDouble() / image.width,
                "height" to it.boundingBox.height().toDouble() / image.height,
                "headEulerAngleX" to it.headEulerAngleX.toDouble(),
                "headEulerAngleY" to it.headEulerAngleY.toDouble(),
                "headEulerAngleZ" to it.headEulerAngleZ.toDouble(),
                "leftEyeOpenProbability" to (it.leftEyeOpenProbability.takeIf { value -> value >= 0f }?.toDouble() ?: -1.0),
                "rightEyeOpenProbability" to (it.rightEyeOpenProbability.takeIf { value -> value >= 0f }?.toDouble() ?: -1.0),
                "smilingProbability" to (it.smilingProbability.takeIf { value -> value >= 0f }?.toDouble() ?: -1.0)
              )
            }
            promise.resolve(
              mapOf(
                "faceCount" to faces.size,
                "brightness" to brightness,
                "isWellLit" to (brightness in 55.0..235.0),
                "imageWidth" to image.width,
                "imageHeight" to image.height,
                "face" to facePayload
              )
            )
          }
          .addOnFailureListener { error ->
            promise.reject("ERR_FACE_ANALYSIS", error.message ?: "Face analysis failed.", error)
          }
      } catch (error: Exception) {
        promise.reject("ERR_FACE_IMAGE", error.message ?: "The captured image could not be analysed.", error)
      }
    }
  }

  private fun averageBrightness(bitmap: Bitmap): Double {
    val stepX = maxOf(1, bitmap.width / 64)
    val stepY = maxOf(1, bitmap.height / 64)
    var luminance = 0.0
    var samples = 0
    var y = 0
    while (y < bitmap.height) {
      var x = 0
      while (x < bitmap.width) {
        val pixel = bitmap.getPixel(x, y)
        val red = (pixel shr 16) and 0xff
        val green = (pixel shr 8) and 0xff
        val blue = pixel and 0xff
        luminance += (0.2126 * red) + (0.7152 * green) + (0.0722 * blue)
        samples += 1
        x += stepX
      }
      y += stepY
    }
    return if (samples == 0) 0.0 else luminance / samples
  }
}
