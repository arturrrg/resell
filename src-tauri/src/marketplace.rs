use serde_json::{json, Value};
#[cfg(target_os = "android")]
use tauri::Manager;
use tauri::{WebviewWindow, Wry};
#[cfg(any(target_os = "android", target_os = "ios"))]
use tauri::Manager;
#[cfg(any(target_os = "android", target_os = "ios"))]
pub struct MarketplaceHandle(tauri::plugin::PluginHandle<Wry>);

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_marketplace);

pub fn init() -> tauri::plugin::TauriPlugin<Wry> {
    tauri::plugin::Builder::new("marketplace")
        .setup(|app, api| {
            #[cfg(target_os = "android")]
            app.manage(MarketplaceHandle(api.register_android_plugin(
                "md.resell.marketplace",
                "MarketplacePlugin",
            )?));
            #[cfg(target_os = "ios")]
            app.manage(MarketplaceHandle(api.register_ios_plugin(init_plugin_marketplace)?));
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            let _ = (app, api);
            Ok(())
        })
        .build()
}
async fn camera_command(window: WebviewWindow, owner: String, id: String, command: &str) -> Result<Value, String> {
    if window.label() != "main" || !crate::offer_sandbox::local_app(&window.url().map_err(|_| "Origin unavailable")?) {
        return Err("Camera access is available only inside Resell.".into());
    }
    if owner != "local" && (owner.len() != 36 || !owner.bytes().all(|c| c.is_ascii_hexdigit() || c == b'-')) {
        return Err("Invalid camera workspace.".into());
    }
    #[cfg(target_os = "android")]
    return window.state::<MarketplaceHandle>().0.run_mobile_plugin(command, json!({"owner":owner,"id":id})).map_err(|error| error.to_string());
    #[cfg(target_os = "ios")]
    return window.state::<MarketplaceHandle>().0.run_mobile_plugin(command, json!({"owner":owner,"id":id})).map_err(|error| error.to_string());
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    { let _ = (owner, id, command); Err("Native camera recovery requires the installed mobile app.".into()) }
}
#[tauri::command]
pub async fn capture_offer_photo(window: WebviewWindow, owner: String, id: String) -> Result<Value, String> {
    camera_command(window, owner, id, "capturePhoto").await
}
#[tauri::command]
pub async fn pending_offer_photo(window: WebviewWindow, owner: String, id: Option<String>) -> Result<Value, String> {
    camera_command(window, owner, id.unwrap_or_default(), "pendingPhoto").await
}
#[tauri::command]
pub async fn acknowledge_offer_photo(window: WebviewWindow, owner: String, id: String) -> Result<Value, String> {
    camera_command(window, owner, id, "acknowledgePhoto").await
}
fn guard(window: &WebviewWindow, owner: &str) -> Result<(), String> {
    if window.label() != "main"
        || !crate::offer_sandbox::local_app(&window.url().map_err(|_| "Origin unavailable")?)
    {
        return Err("Marketplace settings are available only inside Resell.".into());
    }
    if owner.len() != 36 || !owner.bytes().all(|c| c.is_ascii_hexdigit() || c == b'-') {
        return Err("Invalid workspace.".into());
    }
    Ok(())
}
#[tauri::command]
pub async fn marketplace_login_status(
    window: WebviewWindow,
    owner: String,
) -> Result<Value, String> {
    guard(&window, &owner)?;
    #[cfg(target_os = "android")]
    return window
        .state::<MarketplaceHandle>()
        .0
        .run_mobile_plugin("status", json!({"owner":owner}))
        .map_err(|_| {
            "The saved sign-in is unavailable. Save it again or sign in on 999.md.".into()
        });
    #[cfg(target_os = "ios")]
    return window.state::<MarketplaceHandle>().0.run_mobile_plugin("status", json!({"owner":owner})).map_err(|_| "The saved sign-in could not be unlocked. Forget it and save the login again.".into());
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    Ok(json!({"available":false,"saved":false,"login":""}))
}
#[tauri::command]
pub async fn connect_marketplace_account(window:WebviewWindow,owner:String,id:String)->Result<(),String>{
    guard(&window,&owner)?;
    #[cfg(target_os="android")]
    {let _:Value=window.state::<MarketplaceHandle>().0.run_mobile_plugin("connect",json!({"owner":owner,"id":id})).map_err(|_|"Could not open account sign-in.".to_string())?;return Ok(());}
    #[cfg(target_os="ios")]
    {let _:Value=window.state::<MarketplaceHandle>().0.run_mobile_plugin("connect",json!({"owner":owner,"id":id})).map_err(|_|"Could not open account sign-in.".to_string())?;return Ok(());}
    #[cfg(not(any(target_os="android", target_os="ios")))]
    {let _=id;Err("Account verification is available on Android.".into())}
}
#[tauri::command]
pub async fn marketplace_account_avatar(window:WebviewWindow,owner:String,id:String)->Result<Value,String>{
    guard(&window,&owner)?;
    #[cfg(target_os="android")]
    return window.state::<MarketplaceHandle>().0.run_mobile_plugin("avatar",json!({"owner":owner,"id":id})).map_err(|_|"Profile photo unavailable.".into());
    #[cfg(target_os="ios")]
    return window.state::<MarketplaceHandle>().0.run_mobile_plugin("avatar",json!({"owner":owner,"id":id})).map_err(|_|"Profile photo unavailable.".into());
    #[cfg(not(any(target_os="android", target_os="ios")))]
    {let _=id;Ok(json!({"url":""}))}
}
#[tauri::command]
pub async fn save_marketplace_login(
    window: WebviewWindow,
    owner: String,
    login: String,
    password: String,
    id: Option<String>,
) -> Result<(), String> {
    guard(&window, &owner)?;
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    let _ = &id;
    if login.trim().is_empty()
        || login.chars().count() > 60
        || password.is_empty()
        || password.chars().count() > 150
    {
        return Err("Enter a valid login and password.".into());
    }
    #[cfg(target_os = "android")]
    {
        let _: Value = window
            .state::<MarketplaceHandle>()
            .0
            .run_mobile_plugin(
                "save",
                json!({"owner":owner,"login":login,"password":password,"id":id.unwrap_or_default()}),
            )
            .map_err(|_| "The sign-in could not be saved securely.".to_string())?;
        return Ok(());
    }
    #[cfg(target_os = "ios")]
    { let _: Value = window.state::<MarketplaceHandle>().0.run_mobile_plugin("save", json!({"owner":owner,"login":login,"password":password,"id":id.unwrap_or_default()})).map_err(|_| "The sign-in could not be saved securely.".to_string())?; return Ok(()); }
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    Err("Saved marketplace sign-in is available in the installed mobile app.".into())
}
#[tauri::command]
pub async fn forget_marketplace_login(
    window: WebviewWindow,
    owner: String,
    id: Option<String>,
) -> Result<(), String> {
    guard(&window, &owner)?;
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    let _ = &id;
    #[cfg(target_os = "android")]
    {
        let _: Value = window
            .state::<MarketplaceHandle>()
            .0
            .run_mobile_plugin("forget", json!({"owner":owner,"id":id.unwrap_or_default()}))
            .map_err(|_| "Could not forget the saved sign-in.".to_string())?;
        return Ok(());
    }
    #[cfg(target_os = "ios")]
    { let _: Value = window.state::<MarketplaceHandle>().0.run_mobile_plugin("forget", json!({"owner":owner,"id":id.unwrap_or_default()})).map_err(|_| "Could not forget the saved login.".to_string())?; return Ok(()); }
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    Ok(())
}
#[tauri::command]
pub async fn select_marketplace_login(
    window: WebviewWindow,
    owner: String,
    id: String,
) -> Result<(), String> {
    guard(&window, &owner)?;
    #[cfg(target_os = "android")]
    {
        let _: Value = window
            .state::<MarketplaceHandle>()
            .0
            .run_mobile_plugin("select", json!({"owner":owner,"id":id}))
            .map_err(|_| "Could not select this account.".to_string())?;
        return Ok(());
    }
    #[cfg(target_os = "ios")]
    { let _: Value = window.state::<MarketplaceHandle>().0.run_mobile_plugin("select", json!({"owner":owner,"id":id})).map_err(|_| "Could not select this account.".to_string())?; return Ok(()); }
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        let _ = id;
        Err("Marketplace accounts are available in the installed mobile app.".into())
    }
}
pub fn begin(
    window: &WebviewWindow,
    owner: Option<String>,
    account_id: Option<String>,
) -> Result<String, String> {
    #[cfg(target_os = "android")]
    {
        let result: Value = window
            .state::<MarketplaceHandle>()
            .0
            .run_mobile_plugin(
                "beginPreparation",
                json!({"owner":owner.unwrap_or_default(),"id":account_id.unwrap_or_default()}),
            )
            .map_err(|_| "Could not start the marketplace session.".to_string())?;
        return result["login"]
            .as_str()
            .filter(|value| !value.is_empty())
            .map(str::to_owned)
            .ok_or_else(|| "Reconnect the 999.md account before preparing.".into());
    }
    #[cfg(target_os = "ios")]
    {
        let result: Value = window.state::<MarketplaceHandle>().0.run_mobile_plugin("beginPreparation", json!({"owner":owner.unwrap_or_default(),"id":account_id.unwrap_or_default()})).map_err(|_| "Could not start the marketplace session.".to_string())?;
        return result["login"].as_str().filter(|value| !value.is_empty()).map(str::to_owned).ok_or_else(|| "Reconnect the 999.md account before preparing.".into());
    }
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        let _ = (window, owner, account_id);
        Ok(String::new())
    }
}
#[tauri::command]
pub async fn offer_haptic(window: WebviewWindow) -> Result<(), String> {
    if window.label() != "main"
        || !crate::offer_sandbox::local_app(&window.url().map_err(|_| "Origin unavailable")?)
    {
        return Err("Available only inside Resell.".into());
    }
    #[cfg(target_os = "android")]
    {
        let _: Value = window
            .state::<MarketplaceHandle>()
            .0
            .run_mobile_plugin("haptic", json!({}))
            .map_err(|_| "Haptic feedback is unavailable.".to_string())?;
    }
    #[cfg(target_os = "ios")]
    {
        let _: Value = window.state::<MarketplaceHandle>().0.run_mobile_plugin("haptic", json!({})).map_err(|_| "Haptic feedback is unavailable.".to_string())?;
    }
    Ok(())
}
pub fn auto_sign_in(app: tauri::AppHandle) {
    #[cfg(target_os = "android")]
    tauri::async_runtime::spawn(async move {
        let _: Result<Value, _> = app
            .state::<MarketplaceHandle>()
            .0
            .run_mobile_plugin("autoSignIn", json!({}));
    });
    #[cfg(target_os = "ios")]
    tauri::async_runtime::spawn(async move {
        let _: Result<Value, _> = app.state::<MarketplaceHandle>().0.run_mobile_plugin("autoSignIn", json!({}));
    });
    #[cfg(not(target_os = "android"))]
    let _ = app;
}
