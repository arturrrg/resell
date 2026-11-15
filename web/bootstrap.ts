const native = typeof (window as any).__TAURI__?.core?.invoke === "function";
document.documentElement.style.backgroundColor = "#0b0b0d";
document.documentElement.style.colorScheme = "dark";
if (native) void import("./main");
else {
  const hash = new URLSearchParams(location.hash.slice(1));
  const callback = hash.has("access_token") || hash.has("error_description") || location.pathname === "/auth/callback" || new URLSearchParams(location.search).has("code");
  if (callback) void import("./auth-callback");
  else void import("./viewer-entry");
}

