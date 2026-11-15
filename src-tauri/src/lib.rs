use serde::Serialize;
use tauri::Manager;
use url::Url;
mod marketplace;
mod offer_sandbox;

#[derive(Serialize)]
struct RuntimeInfo {
    app_name: &'static str,
    app_version: &'static str,
    platform: &'static str,
    native: bool,
}

#[tauri::command]
fn runtime_info() -> RuntimeInfo {
    RuntimeInfo {
        app_name: "Resell",
        app_version: env!("CARGO_PKG_VERSION"),
        platform: if cfg!(target_os = "android") {
            "android"
        } else if cfg!(target_os = "ios") {
            "ios"
        } else if cfg!(target_os = "windows") {
            "windows"
        } else if cfg!(target_os = "macos") {
            "macos"
        } else {
            "linux"
        },
        native: true,
    }
}

#[tauri::command]
fn validate_999_url(url: String) -> Result<String, String> {
    if url.len() > 2048 {
        return Err("The advert URL is too long.".into());
    }
    let parsed = Url::parse(&url).map_err(|_| "Enter a valid public 999.md URL.")?;
    let host = parsed.host_str().unwrap_or_default().to_ascii_lowercase();
    let allowed = ["999.md", "www.999.md", "new.999.md"];
    if parsed.scheme() != "https"
        || !allowed.contains(&host.as_str())
        || parsed.port().is_some()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
    {
        return Err("Only public HTTPS advert links hosted on 999.md are supported.".into());
    }
    let path = parsed.path();
    if path == "/"
        || ["/ro", "/ru", "/en"].contains(&path.trim_end_matches('/'))
        || path.contains("/list/")
        || path.contains("search")
    {
        return Err("Paste an individual advert URL, not a category or search page.".into());
    }
    Ok(parsed.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(marketplace::init())
        .setup(|app| {
            // Resolve the app data directory at startup so native builds fail early
            // if the platform has not granted a writable application container.
            let _ = app.path().app_data_dir()?;
            Ok(())
        });
    let builder = builder
        .manage(offer_sandbox::OfferState::default())
        .invoke_handler(tauri::generate_handler![
            runtime_info,
            validate_999_url,
            offer_sandbox::prepare_native_offer,
            offer_sandbox::offer_preparation_result,
            marketplace::marketplace_login_status,
            marketplace::marketplace_account_avatar,
            marketplace::connect_marketplace_account,
            marketplace::save_marketplace_login,
            marketplace::forget_marketplace_login,
            marketplace::select_marketplace_login,
            marketplace::capture_offer_photo,
            marketplace::pending_offer_photo,
            marketplace::acknowledge_offer_photo,
            marketplace::offer_haptic
        ])
        .on_page_load(offer_sandbox::page_loaded);
    builder
        .run(tauri::generate_context!())
        .expect("error while running Resell");
}
