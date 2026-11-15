package md.resell.photos

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.widget.Button
import android.widget.FrameLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import java.util.concurrent.Executors

/** A capture is committed before returning. There is no second confirmation UI. */
class OfferCameraActivity : ComponentActivity() {
  private lateinit var preview: PreviewView
  private lateinit var shutter: Button
  private lateinit var message: TextView
  private var capture: ImageCapture? = null
  private var saving = false
  private var completed = false
  private val photoWorker = Executors.newSingleThreadExecutor()
  private val permission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
    if (granted) startCamera() else { message.text = "Allow camera access to take a photo. You can also choose one from your gallery." }
  }
  private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setResult(RESULT_CANCELED)
    val root = FrameLayout(this).apply { setBackgroundColor(Color.BLACK) }
    preview = PreviewView(this).apply { scaleType = PreviewView.ScaleType.FILL_CENTER }
    root.addView(preview, FrameLayout.LayoutParams(-1, -1))
    message = TextView(this).apply { setTextColor(Color.WHITE); gravity = Gravity.CENTER; text = "Opening camera…"; textSize = 14f }
    root.addView(message, FrameLayout.LayoutParams(-1, dp(72), Gravity.TOP).apply { topMargin = dp(64) })
    val close = Button(this).apply {
      text = "✕"; contentDescription = "Cancel photo"; textSize = 24f; setTextColor(Color.WHITE)
      background = GradientDrawable().apply { setColor(0x88000000.toInt()); cornerRadius = dp(28).toFloat() }
      setOnClickListener { if (!saving) finish() }
    }
    root.addView(close, FrameLayout.LayoutParams(dp(56), dp(56), Gravity.TOP or Gravity.START).apply { topMargin = dp(12); leftMargin = dp(16) })
    shutter = Button(this).apply {
      contentDescription = "Take photo"; isEnabled = false
      background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(Color.WHITE); setStroke(dp(5), 0xFF777777.toInt()) }
      setOnClickListener { takePhoto() }
    }
    root.addView(shutter, FrameLayout.LayoutParams(dp(80), dp(80), Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL).apply { bottomMargin = dp(28) })
    ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
      val safe = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
      view.setPadding(safe.left, safe.top, safe.right, safe.bottom)
      insets
    }
    setContentView(root)
    ViewCompat.requestApplyInsets(root)
    if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) startCamera()
    else permission.launch(Manifest.permission.CAMERA)
  }
  private fun startCamera() {
    val future = ProcessCameraProvider.getInstance(this)
    future.addListener({
      if (isFinishing || isDestroyed) return@addListener
      try {
        val provider = future.get()
        val finder = Preview.Builder().build().also { it.setSurfaceProvider(preview.surfaceProvider) }
        val shot = ImageCapture.Builder().setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
          .setJpegQuality(90).build()
        val selector = if (provider.hasCamera(CameraSelector.DEFAULT_BACK_CAMERA)) CameraSelector.DEFAULT_BACK_CAMERA else CameraSelector.DEFAULT_FRONT_CAMERA
        provider.unbindAll()
        provider.bindToLifecycle(this, selector, finder, shot)
        capture = shot
        shutter.isEnabled = true
        message.text = ""
      } catch (_: Exception) { message.text = "Camera unavailable. Go back and choose a photo from your gallery." }
    }, ContextCompat.getMainExecutor(this))
  }
  private fun takePhoto() {
    val shot = capture ?: return
    if (saving) return
    try {
      val file = OfferPhotoCapture.destination(this, intent.getStringExtra("capture_id") ?: error("Missing capture destination"))
      saving = true; shutter.isEnabled = false; message.text = "Saving photo…"
      shot.targetRotation = preview.display.rotation
      shot.takePicture(ImageCapture.OutputFileOptions.Builder(file).build(), photoWorker, object : ImageCapture.OnImageSavedCallback {
        override fun onImageSaved(output: ImageCapture.OutputFileResults) {
          try {
            try { OfferPhotoCapture.preparePreview(this@OfferCameraActivity, intent.getStringExtra("capture_id")!!) } catch (_: Exception) { /* Full local JPEG remains available. */ }
            OfferPhotoCapture.finish(this@OfferCameraActivity, true)
            runOnUiThread { completed = true; setResult(RESULT_OK); finish() }
          } catch (_: Exception) { runOnUiThread { saving = false; shutter.isEnabled = true; message.text = "Could not save the photo. Try again." } }
        }
        override fun onError(error: ImageCaptureException) {
          runOnUiThread { saving = false; shutter.isEnabled = true; message.text = "Could not take the photo. Try again." }
        }
      })
    } catch (_: Exception) { saving = false; shutter.isEnabled = true; message.text = "Could not save the photo. Try again." }
  }
  override fun finish() {
    if (saving && !completed) return
    super.finish()
  }
  override fun onDestroy() { super.onDestroy(); photoWorker.shutdown() }
}
