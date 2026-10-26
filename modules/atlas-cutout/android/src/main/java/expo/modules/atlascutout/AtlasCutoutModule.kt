package expo.modules.atlascutout

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffColorFilter
import android.graphics.Rect
import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.segmentation.subject.SubjectSegmentation
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenterOptions
import io.github.expo.modules.v2.ExpoModule
import io.github.expo.modules.v2.JS
import io.github.expo.modules.v2.Module
import io.github.expo.modules.v2.react.androidContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * Finds the foreground subject with ML Kit, cuts it out and adds a white
 * die-cut border, writing a transparent PNG. Runs fully on device.
 */
@ExpoModule("AtlasCutout")
class AtlasCutoutModule : Module() {
  @JS
  fun isSupported(): Boolean = true

  /** Returns the written file URI, or "" when no subject was found. */
  @JS
  suspend fun cutOutAsync(sourceUri: String, outputUri: String): String = withContext(Dispatchers.Default) {
    val image = InputImage.fromFilePath(androidContext, Uri.parse(sourceUri))
    val options = SubjectSegmenterOptions.Builder().enableForegroundBitmap().build()
    val segmenter = SubjectSegmentation.getClient(options)
    try {
      val result = suspendCancellableCoroutine { cont ->
        segmenter.process(image)
          .addOnSuccessListener { cont.resume(it) }
          .addOnFailureListener { cont.resumeWithException(it) }
      }
      val foreground = result.foregroundBitmap ?: return@withContext ""
      val sticker = withBorder(downscale(foreground, 1400)) ?: return@withContext ""
      val path = Uri.parse(outputUri).path ?: outputUri
      FileOutputStream(File(path)).use { sticker.compress(Bitmap.CompressFormat.PNG, 100, it) }
      Uri.fromFile(File(path)).toString()
    } finally {
      segmenter.close()
    }
  }

  private fun downscale(src: Bitmap, maxSide: Int): Bitmap {
    val longest = max(src.width, src.height)
    if (longest <= maxSide) return src
    val scale = maxSide.toFloat() / longest
    return Bitmap.createScaledBitmap(src, (src.width * scale).roundToInt(), (src.height * scale).roundToInt(), true)
  }

  /** Stamp the subject's silhouette in white around itself (a cheap dilation), then crop. */
  private fun withBorder(fg: Bitmap): Bitmap? {
    val bounds = opaqueBounds(fg) ?: return null
    val border = max(6f, fg.width * 0.014f)
    val pad = (border + 4).roundToInt()
    val out = Bitmap.createBitmap(bounds.width() + pad * 2, bounds.height() + pad * 2, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(out)
    val dx = (pad - bounds.left).toFloat()
    val dy = (pad - bounds.top).toFloat()
    val white = Paint(Paint.ANTI_ALIAS_FLAG).apply { colorFilter = PorterDuffColorFilter(Color.WHITE, PorterDuff.Mode.SRC_IN) }
    val steps = 24
    for (ring in listOf(border * 0.5f, border)) {
      for (i in 0 until steps) {
        val a = (2 * Math.PI * i / steps)
        canvas.drawBitmap(fg, dx + (cos(a) * ring).toFloat(), dy + (sin(a) * ring).toFloat(), white)
      }
    }
    canvas.drawBitmap(fg, dx, dy, null)
    return out
  }

  private fun opaqueBounds(bmp: Bitmap): Rect? {
    val w = bmp.width
    val h = bmp.height
    val row = IntArray(w)
    var minX = w
    var minY = h
    var maxX = -1
    var maxY = -1
    for (y in 0 until h step 2) {
      bmp.getPixels(row, 0, w, 0, y, w, 1)
      for (x in 0 until w step 2) {
        if ((row[x] ushr 24) > 127) {
          minX = min(minX, x); maxX = max(maxX, x)
          minY = min(minY, y); maxY = max(maxY, y)
        }
      }
    }
    if (maxX < minX || maxY < minY) return null
    return Rect(minX, minY, maxX + 1, maxY + 1)
  }
}
