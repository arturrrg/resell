# Native plugin entry points are reached by name through the Tauri bridge.
-keep @app.tauri.annotation.TauriPlugin class * { *; }
-keep @app.tauri.annotation.InvokeArg class * { *; }
-keepclassmembers class * { @app.tauri.annotation.Command <methods>; }
-keepclassmembers class * { @android.webkit.JavascriptInterface <methods>; }
