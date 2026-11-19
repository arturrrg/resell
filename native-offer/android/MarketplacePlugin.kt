package md.resell.marketplace

import android.app.Activity
import android.content.Context
import android.net.Uri
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.webkit.CookieManager
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import android.view.HapticFeedbackConstants
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import org.json.JSONObject
import org.json.JSONArray
import java.util.UUID
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import java.util.concurrent.Executors
import java.util.concurrent.ConcurrentHashMap
import java.net.URL
import javax.net.ssl.HttpsURLConnection
import java.io.ByteArrayOutputStream
import md.resell.photos.OfferCameraHost
import md.resell.photos.OfferPhotoCapture

@InvokeArg
class ProfileArgs {
  lateinit var owner: String
  var login: String = ""
  var password: String = ""
  var id: String = ""
  var returnToAccounts: Boolean = false
}

@TauriPlugin
class MarketplacePlugin(private val host: Activity) : Plugin(host) {
  private var view: WebView? = null
  private var activeOwner: String? = null
  private var activeAccountId: String? = null
  private var attempted = false
  private val handler = Handler(Looper.getMainLooper())
  private var preparationGeneration = 0
  private var connectReturnUrl: String? = null
  private var boundSession = false
  private var capturingIdentity = false
  private var capturedGeneration = -1
  private val identityScript by lazy { host.assets.open("resell-marketplace-identity.js").bufferedReader().use { it.readText() } }
  private val storageWorker = Executors.newSingleThreadExecutor()
  private val avatarWorker = Executors.newFixedThreadPool(2)
  private data class PublicAvatar(val url: String, val expires: Long)
  private val avatarCache = ConcurrentHashMap<String, PublicAvatar>()

  private fun watchSignInRoute(generation: Int, deadline: Long, departed: Boolean = false) {
    handler.postDelayed({
      if (generation != preparationGeneration || SystemClock.elapsedRealtime() > deadline || activeOwner == null) return@postDelayed
      val left = departed || !localPage()
      if (left && localPage()) { preparationGeneration++; activeOwner = null; connectReturnUrl = null; return@postDelayed }
      if (!attempted && loginPage()) {
        try { injectSavedLogin() } catch (_: Exception) { attempted = true }
      }
      if (left && (attempted || boundSession)) captureIdentity(generation)
      watchSignInRoute(generation, deadline, left)
    }, 750)
  }
  private fun captureIdentity(generation: Int) {
    val browser = view ?: return
    val uri = Uri.parse(browser.url ?: return)
    if (uri.scheme != "https" || uri.host != "999.md" || uri.port != -1 || uri.userInfo != null || capturingIdentity || capturedGeneration == generation) return
    val owner = activeOwner ?: return
    val id = activeAccountId ?: return
    capturingIdentity = true
    browser.evaluateJavascript("(()=>{$identityScript;return ResellIdentity.signedInUsername(document,location.href);})()") { encoded ->
      capturingIdentity = false
      if (generation != preparationGeneration) return@evaluateJavascript
      val username = try { JSONArray("[$encoded]").optString(0) } catch (_: Exception) { "" }
      if (username.isEmpty() || username.length > 60 || username.contains("@") || username.any { it == '/' || it == '\\' || it.isWhitespace() }) return@evaluateJavascript
      storageWorker.execute {
        try {
          synchronized(this) {
            if (generation != preparationGeneration) return@synchronized
            val bundle = accounts(owner)
            val item = account(bundle, id) ?: return@synchronized
            val previous = item.optString("username")
            if (!attempted && previous.isNotEmpty() && !previous.equals(username, true)) return@synchronized
            item.put("username", username).put("identityVerifiedAt", System.currentTimeMillis())
            writeAccounts(owner, bundle)
            capturedGeneration = generation
          }
          host.runOnUiThread {
            if (generation == preparationGeneration && capturedGeneration == generation) {
              connectReturnUrl?.let { target -> connectReturnUrl = null; browser.loadUrl(target) }
            }
          }
        } catch (_: Exception) { /* Keep the previous encrypted identity on storage failure. */ }
      }
    }
  }
  private val preferences get() = host.getSharedPreferences("resell_marketplace_credentials", Context.MODE_PRIVATE)
  private val ownerPattern = Regex("^[a-f0-9-]{36}$")
  private val project = "999a46c6-e6a6-11e1-a45f-28376188709b"

  private var backInstalled = false
  override fun load(webView: WebView) {
    view = webView
    if (backInstalled) return
    val activity = host as? AppCompatActivity ?: return
    backInstalled = true
    activity.onBackPressedDispatcher.addCallback(activity, object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() {
        val browser = view ?: return
        val uri = Uri.parse(browser.url ?: "")
        val local = ((uri.scheme == "tauri" && uri.host == "localhost" && uri.port == -1) ||
          (uri.scheme in listOf("http", "https") && uri.host == "tauri.localhost" && uri.port == -1) ||
          (uri.scheme == "http" && uri.host in listOf("localhost", "127.0.0.1") && uri.port == 1420)) &&
          uri.path in listOf("/", "/index.html", "/offer-sandbox.html")
        if (local) {
          browser.evaluateJavascript("(()=>{const e=new Event('resell:back',{cancelable:true});return !window.dispatchEvent(e);})()") { consumed ->
            if (consumed != "true") host.moveTaskToBack(true)
          }
        } else if (connectReturnUrl != null) {
          val target = connectReturnUrl!!
          connectReturnUrl = null
          preparationGeneration++
          activeOwner = null
          browser.loadUrl(target)
        } else if (browser.canGoBack()) browser.goBack()
        else host.moveTaskToBack(true)
      }
    })
  }

  private fun localPage(): Boolean {
    val url = Uri.parse(view?.url ?: return false)
    val local = (url.scheme == "tauri" && url.host == "localhost" && url.port == -1) ||
      (url.scheme in listOf("http", "https") && url.host == "tauri.localhost" && url.port == -1) ||
      (url.scheme == "http" && url.host in listOf("localhost", "127.0.0.1") && url.port == 1420)
    return local && url.userInfo == null && url.path in listOf("/", "/index.html", "/offer-sandbox.html")
  }

  private fun loginPage(): Boolean {
    val url = Uri.parse(view?.url ?: return false)
    if (url.scheme != "https" || url.host != "v2.simpalsid.com" || url.port != -1 || url.userInfo != null ||
      !Regex("^/sid/(ro|ru|en)/user/login/?$").matches(url.path ?: "") || url.getQueryParameter("projectId") != project) return false
    val redirect = Uri.parse(url.getQueryParameter("redirectUrl") ?: return false)
    return redirect.scheme == "https" && redirect.host == "999.md" && redirect.port == -1 && redirect.userInfo == null && redirect.path == "/__sid-auth"
  }

  private fun alias(owner: String, legacy: Boolean = false) = "resell.marketplace.$owner." + if (legacy) "primary.v1" else "accounts.v2"
  private fun store() = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
  private fun key(owner: String): SecretKey {
    val existing = store().getKey(alias(owner), null) as? SecretKey
    if (existing != null) return existing
    return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
      init(KeyGenParameterSpec.Builder(alias(owner), KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setKeySize(256).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setRandomizedEncryptionRequired(true).build())
    }.generateKey()
  }
  private fun readEncrypted(owner: String, legacy: Boolean = false): JSONObject? {
    val slot = if (legacy) "primary" else "accounts"
    val encoded = preferences.getString("$owner.$slot.cipher", null) ?: return null
    val nonce = preferences.getString("$owner.$slot.iv", null) ?: throw IllegalStateException("Missing nonce")
    val secret = store().getKey(alias(owner, legacy), null) as? SecretKey ?: throw IllegalStateException("Missing key")
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.DECRYPT_MODE, secret, GCMParameterSpec(128, Base64.decode(nonce, Base64.NO_WRAP)))
    cipher.updateAAD(alias(owner, legacy).toByteArray(Charsets.UTF_8))
    val decoded = cipher.doFinal(Base64.decode(encoded, Base64.NO_WRAP))
    return try { JSONObject(String(decoded, Charsets.UTF_8)) } finally { decoded.fill(0) }
  }

  @Synchronized private fun writeAccounts(owner: String, bundle: JSONObject) {
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, key(owner))
    cipher.updateAAD(alias(owner).toByteArray(Charsets.UTF_8))
    val plain = bundle.toString().toByteArray(Charsets.UTF_8)
    val encoded = try { cipher.doFinal(plain) } finally { plain.fill(0) }
    // The new encrypted record and removal of the old record commit together.
    // A failed transaction leaves the existing credentials recoverable.
    if (!preferences.edit().putString("$owner.accounts.cipher", Base64.encodeToString(encoded, Base64.NO_WRAP))
        .putString("$owner.accounts.iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
        .remove("$owner.primary.cipher").remove("$owner.primary.iv").commit()) throw IllegalStateException("Save failed")
    try { store().deleteEntry(alias(owner, true)) } catch (_: Exception) { }
  }
  @Synchronized private fun accounts(owner: String): JSONObject {
    readEncrypted(owner)?.let { return it }
    val bundle = JSONObject().put("version", 2).put("selectedId", "").put("accounts", JSONArray())
    val legacy = readEncrypted(owner, true) ?: return bundle
    legacy.put("id", "primary")
    bundle.getJSONArray("accounts").put(legacy)
    bundle.put("selectedId", "primary")
    writeAccounts(owner, bundle)
    return bundle
  }
  private fun account(bundle: JSONObject, id: String): JSONObject? {
    val items = bundle.getJSONArray("accounts")
    for (i in 0 until items.length()) if (items.getJSONObject(i).optString("id") == id) return items.getJSONObject(i)
    return null
  }
  private fun selected(bundle: JSONObject): JSONObject? = account(bundle, bundle.optString("selectedId"))

  @Command
  fun status(invoke: Invoke) {
    if (!localPage()) { invoke.reject("Available only inside Resell."); return }
    val owner = invoke.parseArgs(ProfileArgs::class.java).owner
    if (!ownerPattern.matches(owner)) { invoke.reject("Invalid workspace."); return }
    storageWorker.execute { try {
      val bundle = accounts(owner)
      val saved = selected(bundle)
      val publicAccounts = JSONArray()
      val items = bundle.getJSONArray("accounts")
      for (i in 0 until items.length()) {
        val item = items.getJSONObject(i)
        publicAccounts.put(JSONObject().put("id", item.getString("id")).put("login", item.getString("login")).put("username",item.optString("username")))
      }
      val response=JSObject().put("available", true).put("saved", saved != null).put("login", saved?.optString("login") ?: "")
        .put("selectedId", saved?.optString("id") ?: "").put("accounts", publicAccounts) as JSObject
      host.runOnUiThread { invoke.resolve(response) }
    } catch (_: Exception) { host.runOnUiThread { invoke.reject("The saved sign-in could not be unlocked. Forget it and save the login again.") } } }
  }

  @Command
  fun avatar(invoke: Invoke) {
    if (!localPage()) { invoke.reject("Available only inside Resell."); return }
    val args=invoke.parseArgs(ProfileArgs::class.java)
    if(!ownerPattern.matches(args.owner)){invoke.reject("Invalid workspace.");return}
    avatarWorker.execute {
      var result=""
      try {
        val item=account(accounts(args.owner),args.id)
        val login=item?.optString("username")?.ifEmpty { item.optString("login") } ?: ""
        // An email prefix is not a verified public handle. Never query a different person's profile.
        if(login.isNotEmpty() && !login.contains("@")) {
          val cached=avatarCache[login]
          if(cached!=null && cached.expires>SystemClock.elapsedRealtime()) result=cached.url
          else {
            result=publicAvatar(login)
            if(avatarCache.size>=128)avatarCache.clear()
            avatarCache[login]=PublicAvatar(result,SystemClock.elapsedRealtime()+(if(result.isEmpty())60000 else 15*60*1000))
          }
        }
      } catch (_: Exception) { /* A profile image failure never blocks accounts or preparation. */ }
      val response=JSObject().put("url",result) as JSObject
      host.runOnUiThread { invoke.resolve(response) }
    }
  }
  private fun publicAvatar(login:String):String {
    val connection=URL("https://999.md/graphql").openConnection() as HttpsURLConnection
    try {
      connection.instanceFollowRedirects=false;connection.requestMethod="POST"
      connection.connectTimeout=3000;connection.readTimeout=3000;connection.doOutput=true
      connection.setRequestProperty("Content-Type","application/json")
      connection.setRequestProperty("Accept","application/json")
      val query="query ResellPublicProfile(\$input: String!) { getAccountByLogin(input: \$input) { login avatar } }"
      val payload=JSONObject().put("operationName","ResellPublicProfile").put("query",query).put("variables",JSONObject().put("input",login))
      connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
      if(connection.responseCode!=200)return ""
      val bytes=ByteArrayOutputStream();val buffer=ByteArray(4096);val deadline=SystemClock.elapsedRealtime()+6000
      connection.inputStream.use { stream ->
        while(true){val count=stream.read(buffer);if(count<0)break
          if(bytes.size()+count>32768||SystemClock.elapsedRealtime()>deadline)return ""
          bytes.write(buffer,0,count)
        }
      }
      val body=JSONObject(bytes.toString("UTF-8"))
      if((body.optJSONArray("errors")?.length()?:0)>0)return ""
      val profile=body.optJSONObject("data")?.optJSONObject("getAccountByLogin")?:return ""
      if(!profile.optString("login").equals(login,true))return ""
      val file=profile.optString("avatar")
      if(!Regex("^(?:[a-fA-F0-9]{32}|[a-fA-F0-9]{8}(?:-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12})\\.(png|jpg|jpeg|webp)$",RegexOption.IGNORE_CASE).matches(file)||file.startsWith("00000000-0000-0000-0000-000000000000."))return ""
      return "https://i.simpalsmedia.com/forum.md/avatars/200x200/$file"
    } finally { connection.disconnect() }
  }

  @Command
  fun save(invoke: Invoke) {
    if (!localPage()) { invoke.reject("Available only inside Resell."); return }
    try {
      val args = invoke.parseArgs(ProfileArgs::class.java)
      val login = args.login.trim()
      if (!ownerPattern.matches(args.owner) || login.isEmpty() || login.length > 60 || login.any { it == '\n' || it == '\r' || it == '\u0000' } || args.password.isEmpty() || args.password.length > 150) {
        invoke.reject("Enter a valid login and password."); return
      }
      val bundle = accounts(args.owner)
      val items = bundle.getJSONArray("accounts")
      val existing = if (args.id.isEmpty()) null else account(bundle, args.id)
      if (args.id.isNotEmpty() && existing == null) { invoke.reject("Account not found."); return }
      if (existing == null && items.length() >= 20) { invoke.reject("Up to 20 accounts can be saved."); return }
      for (i in 0 until items.length()) {
        val item = items.getJSONObject(i)
        if (item.getString("id") != args.id && item.getString("login").equals(login, true)) { invoke.reject("This login is already saved."); return }
      }
      val item = existing ?: JSONObject().put("id", UUID.randomUUID().toString())
      if(existing != null && existing.optString("login") != login) { item.remove("username");item.remove("identityVerifiedAt") }
      item.put("login", login).put("password", args.password)
      args.password = ""
      if (existing == null) items.put(item)
      if (bundle.optString("selectedId").isEmpty()) bundle.put("selectedId", item.getString("id"))
      writeAccounts(args.owner, bundle)
      invoke.resolve()
    } catch (_: Exception) { invoke.reject("The sign-in could not be saved securely. No password was sent to Resell cloud storage.") }
  }

  @Command
  fun forget(invoke: Invoke) {
    if (!localPage()) { invoke.reject("Available only inside Resell."); return }
    try {
      val args = invoke.parseArgs(ProfileArgs::class.java)
      val owner = args.owner
      if (!ownerPattern.matches(owner)) { invoke.reject("Invalid workspace."); return }
      val bundle = accounts(owner)
      val id = args.id.ifEmpty { bundle.optString("selectedId") }
      val items = bundle.getJSONArray("accounts")
      val kept = JSONArray()
      for (i in 0 until items.length()) if (items.getJSONObject(i).getString("id") != id) kept.put(items.getJSONObject(i))
      bundle.put("accounts", kept)
      if (bundle.optString("selectedId") == id) bundle.put("selectedId", if (kept.length() > 0) kept.getJSONObject(0).getString("id") else "")
      writeAccounts(owner, bundle)
      invoke.resolve()
    } catch (_: Exception) { invoke.reject("Could not forget the saved login.") }
  }

  @Command
  fun select(invoke: Invoke) {
    if (!localPage()) { invoke.reject("Available only inside Resell."); return }
    try {
      val args = invoke.parseArgs(ProfileArgs::class.java)
      if (!ownerPattern.matches(args.owner)) { invoke.reject("Invalid workspace."); return }
      val bundle = accounts(args.owner)
      if (account(bundle, args.id) == null) { invoke.reject("Account not found."); return }
      bundle.put("selectedId", args.id)
      writeAccounts(args.owner, bundle)
      invoke.resolve()
    } catch (_: Exception) { invoke.reject("Could not select this account.") }
  }

  @Command
  fun connect(invoke: Invoke) = begin(invoke, connecting = true)

  @Command
  fun beginPreparation(invoke: Invoke) = begin(invoke, connecting = false)

  private fun begin(invoke: Invoke, connecting: Boolean) {
    if (!localPage()) { invoke.reject("Start preparation inside Resell."); return }
    val args = invoke.parseArgs(ProfileArgs::class.java)
    val owner = args.owner
    if (!ownerPattern.matches(owner)) { activeOwner = null; attempted = true; invoke.reject("Connect a 999.md account before preparing an offer."); return }
    val connected: JSONObject
    try {
      val bundle = accounts(owner)
      connected = (if (args.id.isNotEmpty()) account(bundle, args.id) else selected(bundle)) ?: run { activeOwner = null; attempted = true; invoke.reject("Connect a 999.md account before preparing an offer."); return }
      activeAccountId = connected.getString("id")
    } catch (_: Exception) { invoke.reject("Reconnect the saved 999.md account before preparing."); return }
    connectReturnUrl = if (connecting) view?.url?.let { url ->
      if (args.returnToAccounts) Uri.parse(url).buildUpon().appendQueryParameter("marketplaceReturn", "accounts").build().toString()
      else url
    } else null
    activeOwner = owner; attempted = false
    preparationGeneration++
    watchSignInRoute(preparationGeneration, SystemClock.elapsedRealtime() + 600000)
    val previous = preferences.getString("lastOwner", null)
    val login = connected.getString("login")
    val previousLogin = preferences.getString("lastLogin", null)
    boundSession = !connecting && previous == owner && previousLogin == login
    preferences.edit().putString("lastOwner", owner).putString("lastLogin", login).apply()
    val result = JSObject().put("login", connected.optString("username").ifEmpty { login }) as JSObject
    fun ready() {
      invoke.resolve(result)
      if(connectReturnUrl != null) {
        val redirect=Uri.encode("https://999.md/__sid-auth")
        view?.loadUrl("https://v2.simpalsid.com/sid/ro/user/login?projectId=$project&redirectUrl=$redirect")
      }
    }
    if (!boundSession) {
      CookieManager.getInstance().removeAllCookies { CookieManager.getInstance().flush(); ready() }
    } else ready()
  }

  @Command
  fun capturePhoto(invoke: Invoke) {
    if (!localPage()) { invoke.reject("Take photos inside Resell."); return }
    val args = invoke.parseArgs(ProfileArgs::class.java)
    if (!(args.owner == "local" || ownerPattern.matches(args.owner)) || !ownerPattern.matches(args.id)) { invoke.reject("Invalid camera destination."); return }
    host.runOnUiThread {
      try {
        (host as? OfferCameraHost ?: throw IllegalStateException("Camera capture is unavailable.")).openOfferCamera(args.owner, args.id)
        invoke.resolve()
      } catch (error: Exception) { invoke.reject(error.message ?: "The camera could not be opened.") }
    }
  }

  @Command
  fun pendingPhoto(invoke: Invoke) {
    if (!localPage()) { invoke.reject("Read captured photos inside Resell."); return }
    val args = invoke.parseArgs(ProfileArgs::class.java)
    storageWorker.execute {
      try {
        val result = OfferPhotoCapture.pending(host, args.owner, args.id)
        val response = JSObject()
        result.keys().forEach { key -> response.put(key, result.get(key)) }
        host.runOnUiThread { invoke.resolve(response) }
      } catch (error: Exception) { host.runOnUiThread { invoke.reject(error.message ?: "Could not recover the camera photo.") } }
    }
  }

  @Command
  fun acknowledgePhoto(invoke: Invoke) {
    if (!localPage()) { invoke.reject("Confirm captured photos inside Resell."); return }
    try {
      val args = invoke.parseArgs(ProfileArgs::class.java)
      OfferPhotoCapture.acknowledge(host, args.owner, args.id)
      invoke.resolve()
    } catch (_: Exception) { invoke.reject("Could not finish camera recovery.") }
  }

  @Command
  fun haptic(invoke: Invoke) {
    if (!localPage()) { invoke.reject("Available only inside Resell."); return }
    view?.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
    invoke.resolve()
  }

  @Command
  fun autoSignIn(invoke: Invoke) {
    if (!loginPage() || attempted) { invoke.resolve(); return }
    try {
      injectSavedLogin()
      invoke.resolve()
    } catch (_: Exception) { attempted = true; invoke.reject("Automatic sign-in is unavailable. Sign in on the official page.") }
  }

  private fun injectSavedLogin() {
    if (!loginPage() || attempted) return
    val owner = activeOwner ?: return
    val saved = account(accounts(owner), activeAccountId ?: return) ?: return
    val script = host.assets.open("resell-marketplace-session.js").bufferedReader().use { it.readText() }
    fun quoted(value: String) = JSONObject.quote(value).replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    attempted = true
    view?.evaluateJavascript("(()=>{$script;ResellMarketplace.signIn(${quoted(saved.getString("login"))},${quoted(saved.getString("password"))});})()", null)
  }
}
