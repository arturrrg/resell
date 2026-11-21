package md.maison.reseller.offersandbox

import android.os.Bundle
import android.net.Uri
import android.graphics.Color
import android.webkit.CookieManager
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.activity.SystemBarStyle
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.activity.result.contract.ActivityResultContracts
import md.resell.photos.OfferCameraHost
import md.resell.photos.OfferPhotoCapture

class MainActivity : TauriActivity(), OfferCameraHost {
  private var appWebView: WebView? = null
  private val offerCameraLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
    OfferPhotoCapture.finish(this, result.resultCode == RESULT_OK)
  }
  override fun openOfferCamera(owner: String, draftId: String) {
    val intent = OfferPhotoCapture.begin(this, owner, draftId)
    try { offerCameraLauncher.launch(intent) }
    catch (error: Exception) { OfferPhotoCapture.finish(this, false); throw error }
  }
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge(
      statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
      navigationBarStyle = SystemBarStyle.dark(Color.TRANSPARENT)
    )
    super.onCreate(savedInstanceState)
    window.setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
    // Transparent system bars reveal the same surface as the app, not the
    // Material theme's tinted window background or Android contrast scrims.
    val surface = Color.rgb(11, 11, 13)
    window.decorView.setBackgroundColor(surface)
    if (android.os.Build.VERSION.SDK_INT >= 29) {
      window.isStatusBarContrastEnforced = false
      window.isNavigationBarContrastEnforced = false
    }
    // Keep every page, including the external creator, clear of system controls.
    val content = findViewById<android.view.View>(android.R.id.content)
    content.setBackgroundColor(surface)
    ViewCompat.setOnApplyWindowInsetsListener(content) { container, received ->
      val chrome = WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
      val safe = received.getInsets(chrome)
      val keyboard = received.getInsets(WindowInsetsCompat.Type.ime())
      val keyboardVisible = received.isVisible(WindowInsetsCompat.Type.ime())
      appWebView?.let { view ->
        view.post {
          // Editable pages still resize; local navigation can stay covered.
          view.evaluateJavascript("""
            document.documentElement.toggleAttribute('data-keyboard-visible', $keyboardVisible);
          """.trimIndent(), null)
        }
      }
      container.setPadding(safe.left, safe.top, safe.right, maxOf(safe.bottom, keyboard.bottom))
      WindowInsetsCompat.Builder(received)
        .setInsets(chrome or WindowInsetsCompat.Type.ime(), Insets.NONE).build()
    }
    ViewCompat.requestApplyInsets(content)
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    appWebView = webView
    webView.setBackgroundColor(Color.rgb(11, 11, 13))
    webView.overScrollMode = android.view.View.OVER_SCROLL_NEVER
    // 999.md authenticates through the separate Simpals ID domain.
    // Keep that normal browser session in this isolated sandbox WebView.
    CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)
  }

  private fun notifyActivityVisibility(foreground: Boolean) {
    val view = appWebView ?: return
    val url = Uri.parse(view.url ?: return)
    if (url.host != "tauri.localhost" || url.scheme !in listOf("http", "https")) return
    view.evaluateJavascript("""
      document.documentElement.toggleAttribute('data-resell-background', ${!foreground});
      window.dispatchEvent(new Event('resell:activity-visibility'));
    """.trimIndent(), null)
  }

  override fun onResume() {
    super.onResume()
    notifyActivityVisibility(true)
  }

  override fun onPause() {
    notifyActivityVisibility(false)
    CookieManager.getInstance().flush()
    super.onPause()
  }
}
