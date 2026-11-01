package expo.modules.smartfacescanner

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Matrix
import android.os.SystemClock
import android.view.ViewGroup
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.google.mediapipe.framework.image.MPImage
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.io.File
import java.util.concurrent.Executors
import kotlin.math.*

class SmartFaceScannerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SmartFaceScanner")
    View(SmartFaceScannerView::class) {
      Events("onFrame", "onError")
      Prop("active") { view: SmartFaceScannerView, active: Boolean -> view.setActive(active) }
      AsyncFunction("capture") { view: SmartFaceScannerView -> view.capture() }
      OnViewDestroys { view: SmartFaceScannerView -> view.dispose() }
    }
  }
}

class SmartFaceScannerView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  val onFrame by EventDispatcher()
  val onError by EventDispatcher()
  private val previewView = PreviewView(context)
  private val worker = Executors.newSingleThreadExecutor()
  private var provider: ProcessCameraProvider? = null
  private var analysis: ImageAnalysis? = null
  private var preview: Preview? = null
  private var landmarker: FaceLandmarker? = null
  private var active = false
  private var generation = 0
  private var disposed = false
  private var lastTick = 0L
  private var lastBitmap: Bitmap? = null
  private var lastCaptureAt = 0L
  private val frameLock = Any()

  init { previewView.layoutParams = LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT); addView(previewView) }
  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) { previewView.layout(0,0,right-left,bottom-top) }
  override fun onAttachedToWindow() { super.onAttachedToWindow(); if(active) start() }
  override fun onDetachedFromWindow() { stop(); super.onDetachedFromWindow() }
  fun setActive(value: Boolean) { if(active==value) return; active=value; if(value && isAttachedToWindow) start() else stop() }
  private fun error(message: String) { post { onError(mapOf("message" to message)) } }

  private fun start() {
    if(disposed || analysis!=null) return
    val owner = appContext.currentActivity as? LifecycleOwner ?: return error("The native camera lifecycle is unavailable.")
    val run = ++generation
    val future = ProcessCameraProvider.getInstance(context)
    future.addListener({
      if(disposed || !active || !isAttachedToWindow || run!=generation) return@addListener
      try {
        provider=future.get()
        val cameraPreview=Preview.Builder().build().also { it.setSurfaceProvider(previewView.surfaceProvider) }
        val cameraAnalysis=ImageAnalysis.Builder().setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
          .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888).build()
        preview=cameraPreview; analysis=cameraAnalysis
        cameraAnalysis.setAnalyzer(worker) { image ->
          var frameImage: MPImage? = null
          try {
            if(!active || disposed || run!=generation || SystemClock.uptimeMillis()-lastTick<120) return@setAnalyzer
            lastTick=SystemClock.uptimeMillis()
            if(landmarker==null) {
              val options=FaceLandmarker.FaceLandmarkerOptions.builder()
                .setBaseOptions(BaseOptions.builder().setModelAssetPath("face_landmarker.task").build())
                .setRunningMode(RunningMode.VIDEO).setNumFaces(2).setMinFaceDetectionConfidence(0.5f)
                .setMinFacePresenceConfidence(0.5f).setMinTrackingConfidence(0.5f)
                .setOutputFaceBlendshapes(true).setOutputFacialTransformationMatrixes(true).build()
              landmarker=FaceLandmarker.createFromOptions(context,options)
            }
            val plane=image.planes[0]
            val padded=Bitmap.createBitmap(plane.rowStride/plane.pixelStride,image.height,Bitmap.Config.ARGB_8888)
            plane.buffer.rewind(); padded.copyPixelsFromBuffer(plane.buffer)
            val crop=Bitmap.createBitmap(padded,0,0,image.width,image.height)
            val matrix=Matrix().apply { postRotate(image.imageInfo.rotationDegrees.toFloat()) }
            val bitmap=Bitmap.createBitmap(crop,0,0,crop.width,crop.height,matrix,true)
            if(crop!==padded) padded.recycle()
            if(bitmap!==crop) crop.recycle()
            val mpImage=BitmapImageBuilder(bitmap).build()
            frameImage=mpImage
            val result=landmarker!!.detectForVideo(mpImage,lastTick)
            val faces=result.faceLandmarks()
            val points=faces.firstOrNull()
            val transform=result.facialTransformationMatrixes().orElse(emptyList()).firstOrNull()
            val shapes=result.faceBlendshapes().orElse(emptyList()).firstOrNull().orEmpty().associate { it.categoryName() to it.score().toDouble() }
            var luminance=0.0;var samples=0
            for(y in 0 until bitmap.height step 32) for(x in 0 until bitmap.width step 32) {
              val pixel=bitmap.getPixel(x,y)
              luminance+=0.299*((pixel shr 16) and 255)+0.587*((pixel shr 8) and 255)+0.114*(pixel and 255);samples++
            }
            val light=luminance/max(samples,1)/255.0*100
            val width=if(points.isNullOrEmpty()) 0.0 else (points.maxOf{it.x()}-points.minOf{it.x()}).toDouble()
            val offset=if(points.isNullOrEmpty()) 1.0 else abs((points.maxOf{it.x()}+points.minOf{it.x()})/2.0-0.5)
            val yaw=if(transform!=null && transform.size>=16) Math.toDegrees(atan2(transform[2].toDouble(),transform[10].toDouble())) else Double.NaN
            val pitch=if(transform!=null && transform.size>=16) Math.toDegrees(atan2(-transform[6].toDouble(),sqrt(transform[4].toDouble().pow(2)+transform[5].toDouble().pow(2)))) else Double.NaN
            val capturedAt=System.currentTimeMillis()
            synchronized(frameLock) {
              lastBitmap?.recycle();lastBitmap=if(faces.size==1)bitmap.copy(Bitmap.Config.ARGB_8888,false) else null
              lastCaptureAt=if(faces.size==1)capturedAt else 0L
            }
            val event=mapOf("timestampMs" to capturedAt.toDouble(),"faceCount" to faces.size,
              "yawDegrees" to (if(yaw.isFinite())yaw else 0.0),"pitchDegrees" to (if(pitch.isFinite())pitch else 0.0),
              "runtimeError" to (faces.isNotEmpty() && (!yaw.isFinite()||!pitch.isFinite())),"blinkLeft" to shapes["eyeBlinkLeft"],"blinkRight" to shapes["eyeBlinkRight"],
              "faceWidthRatio" to width,"faceCenterOffsetRatio" to offset,
              "lightingStatus" to if(light<32)"too_dark" else if(light>92)"too_bright" else "good")
            post { if(active && !disposed && run==generation) onFrame(event) }
          } catch(_: Exception) { error("The native face model could not process this camera frame. Retry the scanner.") }
          finally { frameImage?.close(); image.close() }
        }
        provider!!.bindToLifecycle(owner,CameraSelector.DEFAULT_FRONT_CAMERA,cameraPreview,cameraAnalysis)
      } catch(_: Exception) { stop(); error("The front camera could not start. Check camera permission and retry.") }
    },ContextCompat.getMainExecutor(context))
  }
  fun capture(): Map<String,String> = synchronized(frameLock) {
    val bitmap=lastBitmap ?: throw IllegalStateException("No valid face frame is available.")
    if(!active || System.currentTimeMillis()-lastCaptureAt>1000) throw IllegalStateException("The face frame expired. Retry the scanner.")
    val file=File.createTempFile("scp-face-",".jpg",context.cacheDir)
    file.outputStream().use { if(!bitmap.compress(Bitmap.CompressFormat.JPEG,90,it)) throw IllegalStateException("Face capture failed.") }
    mapOf("uri" to android.net.Uri.fromFile(file).toString())
  }
  private fun stop() {
    generation++; analysis?.clearAnalyzer()
    val uses=listOfNotNull(preview,analysis).toTypedArray()
    if(uses.isNotEmpty()) provider?.unbind(*uses)
    analysis=null;preview=null
    if(!worker.isShutdown) worker.execute { landmarker?.close();landmarker=null; synchronized(frameLock){lastBitmap?.recycle();lastBitmap=null;lastCaptureAt=0} }
  }
  fun dispose() { if(disposed)return;disposed=true;stop();worker.shutdown() }
}
