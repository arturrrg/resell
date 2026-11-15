import AVFoundation
import Foundation
import LocalAuthentication
import Security
import Tauri
import UIKit
import WebKit

private struct Args: Decodable {
  var owner: String = ""
  var login: String = ""
  var password: String = ""
  var id: String = ""
}

private struct SavedAccount: Codable {
  var id: String
  var login: String
  var password: String
  var username: String?
  var identityVerifiedAt: Double?
}
private struct AccountBundle: Codable {
  var version = 2
  var selectedId = ""
  var accounts: [SavedAccount] = []
}
private struct CameraJob: Codable {
  var id: String
  var owner: String
  var draftId: String
  var status: String
  var createdAt: Double
}

@objc public class MarketplacePlugin: Plugin, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
  private weak var webView: WKWebView?
  private var activeOwner = ""
  private var activeAccountId = ""
  private var attempted = false
  private var connectReturnURL: String?
  private var identityCheckPending = false
  private var picker: UIImagePickerController?
  private let project = "999a46c6-e6a6-11e1-a45f-28376188709b"
  private let ownerPattern = try! NSRegularExpression(pattern: "^[a-f0-9-]{36}$")
  private var isLocal: Bool {
    guard let u = webView?.url, let scheme = u.scheme, let host = u.host else { return false }
    return ((scheme == "tauri" && host == "localhost") ||
      ((scheme == "http" || scheme == "https") && host == "tauri.localhost") ||
      (scheme == "http" && (host == "localhost" || host == "127.0.0.1") && u.port == 1420)) &&
      ["", "/", "/index.html", "/offer-sandbox.html"].contains(u.path)
  }
  private func validOwner(_ value: String) -> Bool {
    ownerPattern.firstMatch(in: value, range: NSRange(value.startIndex..., in: value)) != nil
  }
  public override func load(webview: WKWebView) {
    self.webView = webview
    webview.allowsBackForwardNavigationGestures = true
    Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in self?.checkPage() }
  }

  private func key(_ owner: String) -> String { "md.resell.marketplace.\(owner).accounts.v2" }
  private func read(_ owner: String) throws -> AccountBundle {
    let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: "md.resell.marketplace", kSecAttrAccount as String: key(owner),
      kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)
    if status == errSecItemNotFound { return AccountBundle() }
    guard status == errSecSuccess, let data = item as? Data else { throw NSError(domain: "ResellKeychain", code: Int(status)) }
    return try JSONDecoder().decode(AccountBundle.self, from: data)
  }
  private func write(_ bundle: AccountBundle, owner: String) throws {
    let data = try JSONEncoder().encode(bundle)
    let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: "md.resell.marketplace", kSecAttrAccount as String: key(owner)]
    let attrs: [String: Any] = [kSecValueData as String: data,
      kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
    let status = SecItemUpdate(query as CFDictionary, attrs as CFDictionary)
    if status == errSecItemNotFound {
      var add = query; attrs.forEach { add[$0.key] = $0.value }
      let added = SecItemAdd(add as CFDictionary, nil)
      guard added == errSecSuccess else { throw NSError(domain: "ResellKeychain", code: Int(added)) }
    } else if status != errSecSuccess { throw NSError(domain: "ResellKeychain", code: Int(status)) }
  }
  private func selected(_ bundle: AccountBundle, _ id: String = "") -> SavedAccount? {
    bundle.accounts.first { $0.id == (id.isEmpty ? bundle.selectedId : id) }
  }
  private func reject(_ invoke: Invoke, _ message: String) { invoke.reject(message) }

  @objc public func status(_ invoke: Invoke) throws {
    guard isLocal else { reject(invoke, "Available only inside Resell."); return }
    let a = try invoke.parseArgs(Args.self)
    guard validOwner(a.owner) else { reject(invoke, "Invalid workspace."); return }
    do {
      let bundle = try read(a.owner), saved = selected(bundle)
      let accounts = bundle.accounts.map { ["id": $0.id, "login": $0.login, "username": $0.username ?? ""] }
      invoke.resolve(["available": true, "saved": saved != nil, "login": saved?.login ?? "",
        "selectedId": saved?.id ?? "", "accounts": accounts] as JsonObject)
    } catch { reject(invoke, "The saved sign-in could not be unlocked. Forget it and save the login again.") }
  }
  @objc public func save(_ invoke: Invoke) throws {
    guard isLocal else { reject(invoke, "Available only inside Resell."); return }
    let a = try invoke.parseArgs(Args.self), login = a.login.trimmingCharacters(in: .whitespacesAndNewlines)
    guard validOwner(a.owner), !login.isEmpty, login.count <= 60, !a.password.isEmpty, a.password.count <= 150 else { reject(invoke, "Enter a valid login and password."); return }
    do {
      var b = try read(a.owner)
      if !a.id.isEmpty && !b.accounts.contains(where: { $0.id == a.id }) {
        reject(invoke, "Account not found."); return
      }
      if b.accounts.contains(where: { $0.id != a.id && $0.login.caseInsensitiveCompare(login) == .orderedSame }) {
        reject(invoke, "This login is already saved."); return
      }
      if let i = b.accounts.firstIndex(where: { $0.id == a.id }), !a.id.isEmpty {
        if b.accounts[i].login != login { b.accounts[i].username = nil; b.accounts[i].identityVerifiedAt = nil }
        b.accounts[i].login = login; b.accounts[i].password = a.password
      } else {
        guard b.accounts.count < 20 else { reject(invoke, "Up to 20 accounts can be saved."); return }
        let item = SavedAccount(id: UUID().uuidString.lowercased(), login: login, password: a.password)
        b.accounts.append(item); if b.selectedId.isEmpty { b.selectedId = item.id }
      }
      try write(b, owner: a.owner); invoke.resolve()
    } catch { reject(invoke, "The sign-in could not be saved securely. No password was sent to Resell cloud storage.") }
  }
  @objc public func forget(_ invoke: Invoke) throws {
    guard isLocal else { reject(invoke, "Available only inside Resell."); return }
    let a = try invoke.parseArgs(Args.self)
    do {
      var b = try read(a.owner); let id = a.id.isEmpty ? b.selectedId : a.id
      b.accounts.removeAll { $0.id == id }
      if b.selectedId == id { b.selectedId = b.accounts.first?.id ?? "" }
      try write(b, owner: a.owner); invoke.resolve()
    } catch { reject(invoke, "Could not forget the saved login.") }
  }
  @objc public func select(_ invoke: Invoke) throws {
    guard isLocal else { reject(invoke, "Available only inside Resell."); return }
    let a = try invoke.parseArgs(Args.self)
    do {
      var b = try read(a.owner); guard b.accounts.contains(where: { $0.id == a.id }) else { reject(invoke, "Account not found."); return }
      b.selectedId = a.id; try write(b, owner: a.owner); invoke.resolve()
    } catch { reject(invoke, "Could not select this account.") }
  }
  @objc public func connect(_ invoke: Invoke) throws {
    guard isLocal else { reject(invoke, "Connect inside Resell."); return }
    connectReturnURL = webView?.url?.absoluteString
    beginPreparation(invoke)
  }
  @objc public func beginPreparation(_ invoke: Invoke) throws {
    guard isLocal else { reject(invoke, "Start preparation inside Resell."); return }
    let a = try invoke.parseArgs(Args.self)
    guard validOwner(a.owner) else { reject(invoke, "Connect a 999.md account before preparing an offer."); return }
    do {
      let b = try read(a.owner)
      guard let account = selected(b, a.id) else { reject(invoke, "Connect a 999.md account before preparing an offer."); return }
      activeOwner = a.owner; activeAccountId = account.id; attempted = false
      let lastOwner = UserDefaults.standard.string(forKey: "resell.marketplace.lastOwner") ?? ""
      let lastLogin = UserDefaults.standard.string(forKey: "resell.marketplace.lastLogin") ?? ""
      let changed = lastOwner != a.owner || lastLogin != account.login
      UserDefaults.standard.set(a.owner, forKey: "resell.marketplace.lastOwner")
      UserDefaults.standard.set(account.login, forKey: "resell.marketplace.lastLogin")
      let continueSetup = { [weak self] in
        guard let self else { return }
        invoke.resolve(["login": account.username ?? account.login] as JsonObject)
        if self.connectReturnURL != nil {
          let redirect = "https://v2.simpalsid.com/sid/ro/user/login?projectId=\(self.project)&redirectUrl=https%3A%2F%2F999.md%2F__sid-auth"
          self.webView?.load(URLRequest(url: URL(string: redirect)!))
        }
      }
      if changed, let view = webView {
        WKWebsiteDataStore.default().fetchDataRecords(ofTypes: [WKWebsiteDataTypeCookies]) { records in
          WKWebsiteDataStore.default().removeData(ofTypes: [WKWebsiteDataTypeCookies], for: records) { continueSetup() }
        }
        _ = view
      } else { continueSetup() }
    } catch { reject(invoke, "Reconnect the saved 999.md account before preparing.") }
  }
  private var loginPage: Bool {
    guard let u = webView?.url, u.scheme == "https", u.host == "v2.simpalsid.com", u.port == nil,
      u.path.range(of: #"^/sid/(ro|ru|en)/user/login/?$"#, options: .regularExpression) != nil,
      URLComponents(url: u, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "projectId" })?.value == project,
      let redirect = URLComponents(url: u, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "redirectUrl" })?.value,
      let r = URL(string: redirect), r.scheme == "https", r.host == "999.md", r.path == "/__sid-auth" else { return false }
    return true
  }
  @objc public func autoSignIn(_ invoke: Invoke) throws {
    guard loginPage else { invoke.resolve(); return }
    guard !attempted, let b = try? read(activeOwner), let account = selected(b, activeAccountId) else { invoke.resolve(); return }
    attempted = true
    let login = String(data: try JSONEncoder().encode(account.login), encoding: .utf8) ?? "\"\""
    let password = String(data: try JSONEncoder().encode(account.password), encoding: .utf8) ?? "\"\""
    let js = """
    (() => {
      const valid = () => {
        try {
          const u = new URL(location.href), r = new URL(u.searchParams.get('redirectUrl') || '');
          return u.origin === 'https://v2.simpalsid.com' && /^\\/sid\\/(ro|ru|en)\\/user\\/login\\/?$/.test(u.pathname) &&
            u.searchParams.get('projectId') === '\(project)' && r.origin === 'https://999.md' && r.pathname === '/__sid-auth';
        } catch { return false; }
      };
      const fill = () => {
        if (!valid()) { stop(); return; }
        const forms = document.querySelectorAll('form[class*=Login_login__form]');
        if (forms.length !== 1) return;
        const f = forms[0], a = f.querySelectorAll('input[type=text]'), b = f.querySelectorAll('input[type=password]'), s = f.querySelectorAll('button[type=submit]');
        if (a.length !== 1 || b.length !== 1 || s.length !== 1 || a[0].value || b[0].value || a[0].disabled || b[0].disabled || s[0].disabled) return;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(a[0], \(login)); a[0].dispatchEvent(new Event('input', {bubbles:true})); a[0].dispatchEvent(new Event('change', {bubbles:true}));
        setter.call(b[0], \(password)); b[0].dispatchEvent(new Event('input', {bubbles:true})); b[0].dispatchEvent(new Event('change', {bubbles:true}));
        window.clearInterval(timer); observer.disconnect();
        setTimeout(() => { if (valid() && f.isConnected && a[0].value === \(login) && b[0].value === \(password) && !s[0].disabled) f.requestSubmit(s[0]); }, 800);
      };
      const observer = new MutationObserver(fill);
      const timer = window.setInterval(fill, 500);
      const stop = () => { window.clearInterval(timer); observer.disconnect(); };
      observer.observe(document.documentElement, {childList:true, subtree:true});
      window.setTimeout(stop, 30000); fill();
    })();
    """
    webView?.evaluateJavaScript(js); invoke.resolve()
  }
  private func checkPage() {
    guard let view = webView, let u = view.url else { return }
    if u.scheme == "https", u.host == "999.md", u.path.range(of: #"^/(ro|ru|en)/cabinet/items/[^/]+/?$"#, options: .regularExpression) != nil,
       !activeOwner.isEmpty, !activeAccountId.isEmpty, !identityCheckPending {
      identityCheckPending = true
      let js = "(()=>{const a=[...document.querySelectorAll('a[href*=\"/cabinet/items/\"]')].map(x=>{try{return new URL(x.getAttribute('href'),location.href).pathname.match(/^\\/(?:ro|ru|en)\\/cabinet\\/items\\/([^/]+)\\/?$/)?.[1]}catch{return null}}).filter(Boolean);return [...new Set(a)].length===1?a[0]:''})()"
      view.evaluateJavaScript(js) { [weak self] value, _ in
        guard let self else { return }
        self.identityCheckPending = false
        guard let name = value as? String, !name.isEmpty, name.count <= 60, !name.contains("@"),
          var bundle = try? self.read(self.activeOwner), let index = bundle?.accounts.firstIndex(where: { $0.id == self.activeAccountId }) else { return }
        if let previous = bundle?.accounts[index].username, !previous.isEmpty {
          guard previous.caseInsensitiveCompare(name) == .orderedSame else { return }
        } else {
          bundle?.accounts[index].username = name
          bundle?.accounts[index].identityVerifiedAt = Date().timeIntervalSince1970 * 1000
          if let bundle { try? self.write(bundle, owner: self.activeOwner) }
        }
        if let target = self.connectReturnURL { self.connectReturnURL = nil; if let url = URL(string: target) { view.load(URLRequest(url: url)) } }
      }
    }
  }

  @objc public func avatar(_ invoke: Invoke) throws {
    guard isLocal else { reject(invoke, "Available only inside Resell."); return }
    let a = try invoke.parseArgs(Args.self)
    guard validOwner(a.owner), let b = try? read(a.owner), let account = selected(b, a.id) else {
      invoke.resolve(["url": ""] as JsonObject); return
    }
    let login = account.username?.isEmpty == false ? account.username! : account.login
    guard !login.contains("@"), let url = URL(string: "https://999.md/graphql") else {
      invoke.resolve(["url": ""] as JsonObject); return
    }
    var request = URLRequest(url: url); request.httpMethod = "POST"
    request.timeoutInterval = 6
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    let query = "query ResellPublicProfile($input: String!) { getAccountByLogin(input: $input) { login avatar } }"
    request.httpBody = try JSONSerialization.data(withJSONObject: ["operationName": "ResellPublicProfile", "query": query, "variables": ["input": login]])
    URLSession.shared.dataTask(with: request) { data, response, _ in
      var result = ""
      if let data, data.count <= 32768, (response as? HTTPURLResponse)?.statusCode == 200,
        let body = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
        (body["errors"] as? [Any] ?? []).isEmpty,
        let profile = (body["data"] as? [String: Any])?["getAccountByLogin"] as? [String: Any],
        (profile["login"] as? String)?.caseInsensitiveCompare(login) == .orderedSame,
        let file = profile["avatar"] as? String,
        file.range(of: #"^(?:[a-fA-F0-9]{32}|[a-fA-F0-9]{8}(?:-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12})\.(png|jpg|jpeg|webp)$"#, options: .regularExpression) != nil,
        !file.lowercased().hasPrefix("00000000-0000-0000-0000-000000000000.") {
        result = "https://i.simpalsmedia.com/forum.md/avatars/200x200/\(file)"
      }
      DispatchQueue.main.async { invoke.resolve(["url": result] as JsonObject) }
    }.resume()
  }
  @objc public func haptic(_ invoke: Invoke) throws { UIImpactFeedbackGenerator(style: .light).impactOccurred(); invoke.resolve() }
  @objc public func capturePhoto(_ invoke: Invoke) throws {
    guard isLocal, let controller = manager.viewController else { reject(invoke, "Take photos inside Resell."); return }
    let a = try invoke.parseArgs(Args.self)
    guard (a.owner == "local" || validOwner(a.owner)), validOwner(a.id), UIImagePickerController.isSourceTypeAvailable(.camera) else { reject(invoke, "Camera unavailable. Choose a photo from your library."); return }
    if let previous = readJob(), Date().timeIntervalSince1970 * 1000 - previous.createdAt < 86_400_000 {
      reject(invoke, "Finish the previous camera capture before taking another photo."); return
    }
    var job = CameraJob(id: UUID().uuidString.lowercased(), owner: a.owner, draftId: a.id, status: "waiting", createdAt: Date().timeIntervalSince1970 * 1000)
    guard saveJob(job) else { reject(invoke, "Could not prepare camera storage."); return }
    let imagePicker = UIImagePickerController(); imagePicker.sourceType = .camera; imagePicker.cameraCaptureMode = .photo
    imagePicker.delegate = self; imagePicker.modalPresentationStyle = .fullScreen
    picker = imagePicker
    // Picker delegate writes the durable photo before dismissing.
    controller.present(imagePicker, animated: true); invoke.resolve()
  }
  private func jobURL(_ id: String) -> URL {
    FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("resell-camera-\(id).jpg")
  }
  private func saveJob(_ job: CameraJob) -> Bool {
    guard let data = try? JSONEncoder().encode(job) else { return false }
    UserDefaults.standard.set(data, forKey: "resell.pendingPhoto")
    return true
  }
  private func readJob() -> CameraJob? { UserDefaults.standard.data(forKey: "resell.pendingPhoto").flatMap { try? JSONDecoder().decode(CameraJob.self, from: $0) } }
  public func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
    guard var job = readJob(), let image = info[.originalImage] as? UIImage, let data = image.jpegData(compressionQuality: 0.9) else { imagePickerControllerDidCancel(picker); return }
    do { try data.write(to: jobURL(job.id), options: .atomic); job.status = "ready"; _ = saveJob(job) }
    catch { job.status = "cancelled"; _ = saveJob(job) }
    picker.dismiss(animated: true); self.picker = nil
  }
  public func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
    if var job = readJob() { job.status = "cancelled"; _ = saveJob(job) }
    picker.dismiss(animated: true); self.picker = nil
  }
  @objc public func pendingPhoto(_ invoke: Invoke) throws {
    guard isLocal else { reject(invoke, "Read captured photos inside Resell."); return }
    let a = try invoke.parseArgs(Args.self)
    guard let job = readJob(), job.owner == a.owner, job.status != "waiting" else { invoke.resolve(["status": "none"] as JsonObject); return }
    var result: JsonObject = ["status": job.status, "id": job.id, "owner": job.owner, "draftId": job.draftId]
    if job.status == "ready", let data = try? Data(contentsOf: jobURL(job.id)), data.count <= 12 * 1024 * 1024 {
      result["name"] = "Camera-\(job.id).jpg"
      if a.id.isEmpty, let image = UIImage(data: data) {
        let scale = min(1, 640 / max(image.size.width, image.size.height))
        let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let preview = UIGraphicsImageRenderer(size: size).image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
        result["previewBase64"] = (preview.jpegData(compressionQuality: 0.8) ?? data).base64EncodedString()
      } else { result["base64"] = data.base64EncodedString() }
    }
    invoke.resolve(result)
  }
  @objc public func acknowledgePhoto(_ invoke: Invoke) throws {
    let a = try invoke.parseArgs(Args.self)
    guard let job = readJob(), job.owner == a.owner, job.id == a.id, job.status != "waiting" else { reject(invoke, "Camera result is not available."); return }
    try? FileManager.default.removeItem(at: jobURL(job.id)); UserDefaults.standard.removeObject(forKey: "resell.pendingPhoto"); invoke.resolve()
  }
}

@_cdecl("init_plugin_marketplace")
public func initPluginMarketplace() -> Plugin { MarketplacePlugin() }

