package md.resell.photos

import android.content.Context
import android.content.Intent
import android.util.Base64
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import androidx.exifinterface.media.ExifInterface
import org.json.JSONObject
import java.io.File
import java.util.UUID

interface OfferCameraHost {
  fun openOfferCamera(owner: String, draftId: String)
}

/** Durable result storage: MIUI may kill Resell while the camera is in front. */
object OfferPhotoCapture {
  private fun preferences(context: Context) = context.getSharedPreferences("resell_offer_camera", Context.MODE_PRIVATE)
  private fun directory(context: Context) = File(context.cacheDir, "offer-camera").apply { mkdirs() }
  private fun job(context: Context): JSONObject? = preferences(context).getString("pending", null)?.let { JSONObject(it) }
  private fun write(context: Context, value: JSONObject) {
    check(preferences(context).edit().putString("pending", value.toString()).commit()) { "Could not save camera recovery details." }
  }
  private fun photo(context: Context, value: JSONObject): File {
    val id = value.getString("id")
    require(Regex("^[a-f0-9-]{36}$").matches(id))
    return File(directory(context), "$id.jpg")
  }
  fun begin(context: Context, owner: String, draftId: String): Intent {
    val prior = job(context)
    if (prior != null) {
      check(System.currentTimeMillis() - prior.optLong("createdAt") > 86400000) { "Finish the previous camera capture before taking another photo." }
      photo(context, prior).delete()
    }
    val value = JSONObject().put("id", UUID.randomUUID().toString()).put("owner", owner)
      .put("draftId", draftId).put("status", "waiting").put("createdAt", System.currentTimeMillis())
    val file = photo(context, value)
    file.createNewFile()
    write(context, value)
    return Intent(context, OfferCameraActivity::class.java).putExtra("capture_id", value.getString("id"))
  }
  fun destination(context: Context, id: String): File {
    val value = job(context) ?: error("The capture is no longer available.")
    check(value.getString("id") == id && value.optString("status") == "waiting")
    return photo(context, value)
  }
  fun preparePreview(context: Context, id: String) {
    val file = destination(context, id)
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(file.path, bounds)
    var sample = 1
    while (maxOf(bounds.outWidth, bounds.outHeight) / sample > 640) sample *= 2
    val bitmap = BitmapFactory.decodeFile(file.path, BitmapFactory.Options().apply { inSampleSize = sample }) ?: return
    var oriented: Bitmap? = null
    try {
      val degrees = ExifInterface(file).rotationDegrees
      val upright = if (degrees == 0) bitmap else Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, Matrix().apply { postRotate(degrees.toFloat()) }, true)
      oriented = upright
      File(file.parentFile, "$id-preview.jpg").outputStream().use { upright.compress(Bitmap.CompressFormat.JPEG, 80, it) }
    } finally { if (oriented != null && oriented !== bitmap) oriented.recycle(); bitmap.recycle() }
  }
  fun finish(context: Context, accepted: Boolean) {
    val value = job(context) ?: return
    // Capture commits before returning; a late cancelled activity result must
    // not discard that durable success after process recreation.
    if (value.optString("status") == "ready") return
    value.put("status", if (accepted && photo(context, value).length() > 0) "ready" else "cancelled")
    write(context, value)
  }
  fun pending(context: Context, owner: String, fullId: String = ""): JSONObject {
    val value = job(context) ?: return JSONObject().put("status", "none")
    if (value.optString("owner") != owner || value.optString("status") == "waiting") return JSONObject().put("status", "none")
    val result = JSONObject(value.toString())
    if (value.optString("status") == "ready") {
      val file = photo(context, value)
      check(file.length() in 1..(12L * 1024 * 1024)) { "The camera photo is missing or larger than 12 MB." }
      val id = value.getString("id")
      require(fullId.isEmpty() || fullId == id)
      val preview = File(file.parentFile, "$id-preview.jpg")
      if (fullId.isEmpty() && preview.exists()) result.put("previewBase64", Base64.encodeToString(preview.readBytes(), Base64.NO_WRAP))
      else result.put("base64", Base64.encodeToString(file.readBytes(), Base64.NO_WRAP))
      result.put("name", "Camera-$id.jpg")
    }
    return result
  }
  fun acknowledge(context: Context, owner: String, id: String) {
    val value = job(context) ?: return
    require(value.optString("owner") == owner && value.optString("id") == id && value.optString("status") != "waiting")
    check(preferences(context).edit().remove("pending").commit())
    photo(context, value).delete()
    File(directory(context), "$id-preview.jpg").delete()
  }
}
