use serde_json::{json, Value};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{Manager, Webview, WebviewWindow};
use url::Url;

const CREATOR: &str = "https://999.md/ro/add?category=phone-and-communication&subcategory=phone-and-communication/mobile-phones&offerType=776";
const MARKETPLACE_ENTRY: &str = "https://999.md/ro";
const SCRIPT: &str = include_str!("../offer-sandbox-assets/prepare.js");
const SESSION_SCRIPT: &str = include_str!("../offer-sandbox-assets/session.js");
const MAX_BYTES: usize = 25 * 1024 * 1024;

struct Preparation {
    draft: Value,
    login: String,
    return_url: Url,
    started: Instant,
    redirects: u8,
    owner: String,
    account_id: String,
    request_id: String,
    auto_publish: bool,
}
#[derive(Default)]
struct PreparationState {
    pending: Option<Preparation>,
    result: Option<Value>,
}
#[derive(Default)]
pub struct OfferState(Mutex<PreparationState>);

fn publication_result(job: &Preparation, url: &Url) -> Value {
    let fallback = json!({"requestId":job.request_id,"owner":job.owner,"draftId":job.draft["id"],"accountId":job.account_id,"status":"cancelled"});
    let values: Vec<_> = url
        .query_pairs()
        .filter(|(key, _)| key == "resell_submission")
        .collect();
    if values.len() != 1 || values[0].1.len() > 2048 {
        return fallback;
    }
    let Ok(proof) = serde_json::from_str::<Value>(&values[0].1) else {
        return fallback;
    };
    let id = proof["advertId"].as_str().unwrap_or("");
    let state = proof["state"].as_str().unwrap_or("");
    let normalize = |s: &str| {
        s.split_whitespace()
            .collect::<Vec<_>>()
            .join(" ")
            .to_lowercase()
    };
    let title = proof["title"].as_str().unwrap_or("");
    if proof["requestId"] != job.request_id
        || !(6..=12).contains(&id.len())
        || !id.bytes().all(|c| c.is_ascii_digit())
        || id.starts_with('0')
        || !["AD_STATE_PUBLIC", "AD_STATE_PRE_MODERATION"].contains(&state)
        || !["title", "secondaryTitle"].iter().any(|key| {
            !title.is_empty()
                && normalize(title) == normalize(job.draft[*key].as_str().unwrap_or(""))
        })
    {
        return fallback;
    }
    let lang = if job.draft["language"] == "ru" {
        "ru"
    } else {
        "ro"
    };
    json!({"requestId":job.request_id,"owner":job.owner,"draftId":job.draft["id"],"accountId":job.account_id,
        "status":if state=="AD_STATE_PUBLIC" {"published"} else {"submitted"},
        "advertId":id,"state":state,"url":format!("https://999.md/{}/{}",lang,id)})
}
#[tauri::command]
pub fn offer_preparation_result(
    window: WebviewWindow,
    state: tauri::State<'_, OfferState>,
    owner: String,
    request_id: String,
) -> Result<Option<Value>, String> {
    if window.label() != "main" || !local_app(&window.url().map_err(|_| "Origin unavailable")?) {
        return Err("Available only inside Resell.".into());
    }
    let status = state
        .0
        .lock()
        .map_err(|_| "Preparation result unavailable.")?;
    Ok(status
        .result
        .as_ref()
        .filter(|result| result["owner"] == owner && result["requestId"] == request_id)
        .cloned())
}

pub(crate) fn local_app(url: &Url) -> bool {
    let local =
        (url.scheme() == "tauri" && url.host_str() == Some("localhost") && url.port().is_none())
            || (["http", "https"].contains(&url.scheme())
                && url.host_str() == Some("tauri.localhost")
                && url.port().is_none())
            || (url.scheme() == "http"
                && ["localhost", "127.0.0.1"].contains(&url.host_str().unwrap_or(""))
                && url.port() == Some(1420));
    local
        && (["/", "/index.html"].contains(&url.path())
            || (cfg!(feature = "offer-sandbox") && url.path() == "/offer-sandbox.html"))
        && url.username().is_empty()
        && url.password().is_none()
}
fn creator(url: &Url) -> bool {
    url.scheme() == "https"
        && url.host_str() == Some("999.md")
        && url.port().is_none()
        && ["/ro/add", "/ru/add"].contains(&url.path())
        && url.query_pairs().any(|(key, value)| {
            key == "subcategory" && value == "phone-and-communication/mobile-phones"
        })
}
fn validate(draft: &Value) -> Result<(), String> {
    if draft["protocol"] != 1 || draft["version"] != 1 {
        return Err("Unsupported offer transfer.".into());
    }
    for (name, limit) in [
        ("title", 100),
        ("description", 2000),
        ("brand", 150),
        ("model", 150),
        ("operatingSystem", 150),
        ("location", 150),
    ] {
        let value = draft[name].as_str().ok_or("Missing offer field.")?;
        if value.trim().is_empty() || value.encode_utf16().count() > limit {
            return Err(format!("Invalid {}.", name));
        }
    }
    if let Some(title) = draft.get("secondaryTitle") {
        if title
            .as_str()
            .is_none_or(|value| value.encode_utf16().count() > 100)
        {
            return Err("Invalid second title.".into());
        }
    }
    if !["MDL", "EUR", "USD"].contains(&draft["currency"].as_str().unwrap_or(""))
        || !["ro", "ru"].contains(&draft["language"].as_str().unwrap_or(""))
    {
        return Err("Invalid language or currency.".into());
    }
    let photos = draft["photos"].as_array().ok_or("Photos are required.")?;
    if photos.is_empty() || photos.len() > 10 {
        return Err("Use between one and ten photos in this sandbox.".into());
    }
    let mut total = 0usize;
    for photo in photos {
        let bytes = photo["bytes"].as_u64().ok_or("Invalid photo size.")?;
        if bytes == 0 || bytes > MAX_BYTES as u64 {
            return Err("Invalid photo size.".into());
        }
        total = total
            .checked_add(bytes as usize)
            .ok_or("Photo payload is too large.")?;
        let encoded = photo["base64"].as_str().ok_or("Missing photo data.")?;
        if total > MAX_BYTES
            || encoded.len() != 4 * ((bytes as usize + 2) / 3)
            || !encoded
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || b"+/=".contains(&c))
        {
            return Err("Photo payload is too large or incomplete.".into());
        }
        if !["image/jpeg", "image/png", "image/webp"]
            .contains(&photo["type"].as_str().unwrap_or(""))
        {
            return Err("Unsupported photo format.".into());
        }
    }
    if serde_json::to_vec(draft).map_err(|e| e.to_string())?.len() > 36 * 1024 * 1024 {
        return Err("Offer payload is too large.".into());
    }
    Ok(())
}

#[tauri::command]
pub async fn prepare_native_offer(
    window: WebviewWindow,
    state: tauri::State<'_, OfferState>,
    draft: Value,
    owner: Option<String>,
    account_id: Option<String>,
    request_id: String,
    auto_publish: Option<bool>,
) -> Result<(), String> {
    let origin = window.url().map_err(|e| e.to_string())?;
    if window.label() != "main" || !local_app(&origin) {
        return Err("Offer preparation is available only from the installed Resell app.".into());
    }
    validate(&draft)?;
    if request_id.len() != 36
        || !request_id
            .bytes()
            .all(|c| c.is_ascii_hexdigit() || c == b'-')
    {
        return Err("Invalid preparation request.".into());
    }
    let mut pending = state
        .0
        .lock()
        .map_err(|_| "Preparation state is unavailable.")?;
    if pending
        .pending
        .as_ref()
        .is_some_and(|job| job.started.elapsed() < Duration::from_secs(600))
    {
        return Err("Return from the current 999.md preparation before starting another.".into());
    }
    let login = crate::marketplace::begin(&window, owner.clone(), account_id.clone())?;
    let mut return_url = origin;
    return_url.set_query(None);
    if return_url.path() == "/offer-sandbox.html" {
        return_url.set_fragment(None);
    } else {
        let id = draft["id"].as_str().ok_or("The draft has no identifier.")?;
        if id.len() != 36 || !id.bytes().all(|c| c.is_ascii_hexdigit() || c == b'-') {
            return Err("Invalid draft identifier.".into());
        }
        return_url.set_fragment(Some(&format!("offers/{}", id)));
    }
    pending.result = None;
    pending.pending = Some(Preparation {
        draft,
        login,
        return_url,
        started: Instant::now(),
        redirects: 0,
        owner: owner.unwrap_or_default(),
        account_id: account_id.unwrap_or_default(),
        request_id,
        auto_publish: auto_publish.unwrap_or(false),
    });
    // Enter the marketplace before its login/creator redirect flow.
    if let Err(error) = window.navigate(Url::parse(MARKETPLACE_ENTRY).map_err(|e| e.to_string())?) {
        pending.pending = None;
        return Err(error.to_string());
    }
    Ok(())
}

pub fn page_loaded(webview: &Webview, payload: &tauri::webview::PageLoadPayload<'_>) {
    let url = payload.url();
    // Record the return before the app's JavaScript asks for its receipt.
    if local_app(url) {
        if let Ok(mut state) = webview.state::<OfferState>().0.lock() {
            if let Some(job) = state.pending.take() {
                state.result = Some(publication_result(&job, url));
            }
        }
        return;
    }
    if payload.event() != tauri::webview::PageLoadEvent::Finished {
        return;
    }
    if url.scheme() == "https"
        && ["999.md", "v2.simpalsid.com"].contains(&url.host_str().unwrap_or(""))
        && url.port().is_none()
        && url.username().is_empty()
        && url.password().is_none()
    {
        let _ = webview.eval(format!(
            "(()=>{{ {}; ResellMarketplace.startPageChecks(); }})()",
            SESSION_SCRIPT
        ));
    }
    let state = webview.state::<OfferState>();
    let mut pending = match state.0.lock() {
        Ok(value) => value,
        Err(_) => return,
    };
    let Some(job) = pending.pending.as_mut() else {
        return;
    };
    if job.started.elapsed() > Duration::from_secs(600) {
        pending.pending = None;
        return;
    }
    if url.scheme() == "https" && url.host_str() == Some("v2.simpalsid.com") && url.port().is_none()
    {
        if let Ok(returning) = serde_json::to_string(job.return_url.as_str()) {
            let _ = webview.eval(format!(
                "(()=>{{ {}; ResellMarketplace.attachReturn({}); }})()",
                SESSION_SCRIPT, returning
            ));
        }
        if url.path().trim_end_matches('/').ends_with("/user/login") {
            crate::marketplace::auto_sign_in(webview.app_handle().clone());
        }
    }
    if creator(url) {
        let draft = match serde_json::to_string(&job.draft) {
            Ok(value) => value,
            Err(_) => return,
        };
        let returning = match serde_json::to_string(job.return_url.as_str()) {
            Ok(value) => value,
            Err(_) => return,
        };
        let login = serde_json::to_string(&job.login).unwrap_or_else(|_| "\"\"".into());
        let request = serde_json::to_string(&job.request_id).unwrap_or_else(|_| "\"\"".into());
        let script = format!(
            "(()=>{{ {}; ResellNativePrepare.start({}, {}, {}, {}, {}); }})()",
            SCRIPT, draft, returning, login, request, job.auto_publish
        )
        .replace('\u{2028}', "\\u2028")
        .replace('\u{2029}', "\\u2029");
        let _ = webview.eval(script);
    } else if url.scheme() == "https" && url.host_str() == Some("999.md") {
        if let (Ok(returning), Ok(request), Ok(titles)) = (
            serde_json::to_string(job.return_url.as_str()),
            serde_json::to_string(&job.request_id),
            serde_json::to_string(&json!([
                job.draft["title"].as_str().unwrap_or(""),
                job.draft["secondaryTitle"].as_str().unwrap_or("")
            ])),
        ) {
            let _ = webview.eval(format!(
                "(()=>{{ {}; ResellNativePrepare.resume({}, {}, {}); }})()",
                SCRIPT, returning, request, titles
            ));
        }
        if ["/ro", "/ro/", "/ru", "/ru/"].contains(&url.path()) && job.redirects < 3 {
            job.redirects += 1;
            if let Ok(target) = Url::parse(CREATOR) {
                let _ = webview.navigate(target);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn publication_receipts_are_bound_to_the_pending_job_and_final_state() {
        let job = Preparation {
            draft: json!({"id":"draft","title":"Test iPhone","language":"ro"}),
            login: "test".into(),
            return_url: Url::parse("tauri://localhost/").unwrap(),
            started: Instant::now(),
            redirects: 0,
            owner: "owner".into(),
            account_id: "account".into(),
            request_id: "nonce".into(),
            auto_publish: false,
        };
        let proof = json!({"requestId":"nonce","advertId":"88610685","title":"Test iPhone","state":"AD_STATE_PUBLIC"});
        let destination = |p: &Value| {
            let mut u = job.return_url.clone();
            u.query_pairs_mut()
                .append_pair("resell_submission", &p.to_string());
            u
        };
        let result = publication_result(&job, &destination(&proof));
        assert_eq!(result["status"], "published");
        assert_eq!(result["owner"], "owner");
        assert_eq!(result["accountId"], "account");
        let mut moderation = proof.clone();
        moderation["state"] = json!("AD_STATE_PRE_MODERATION");
        assert_eq!(
            publication_result(&job, &destination(&moderation))["status"],
            "submitted"
        );
        for (key, value) in [
            ("requestId", "other"),
            ("title", "Other phone"),
            ("advertId", "00123456"),
            ("state", "AD_STATE_NEED_PAY"),
            ("state", "AD_STATE_DRAFT"),
        ] {
            let mut invalid = proof.clone();
            invalid[key] = json!(value);
            assert_eq!(
                publication_result(&job, &destination(&invalid))["status"],
                "cancelled"
            );
        }
        assert_eq!(
            publication_result(&job, &job.return_url)["status"],
            "cancelled"
        );
        let mut duplicated = destination(&proof);
        duplicated
            .query_pairs_mut()
            .append_pair("resell_submission", &proof.to_string());
        assert_eq!(publication_result(&job, &duplicated)["status"], "cancelled");
    }
    #[test]
    fn origins_are_exact_and_remote_pages_cannot_start_transfers() {
        for value in [
            "tauri://localhost/",
            "http://tauri.localhost/index.html",
            "http://localhost:1420/",
        ] {
            assert!(local_app(&Url::parse(value).unwrap()));
        }
        for value in [
            "https://resell-workspace.vercel.app/",
            "https://999.md/ro/add",
            "http://localhost:1421/offer-sandbox.html",
            "https://tauri.localhost.evil.test/offer-sandbox.html",
        ] {
            assert!(!local_app(&Url::parse(value).unwrap()));
        }
        assert_eq!(
            local_app(&Url::parse("tauri://localhost/offer-sandbox.html").unwrap()),
            cfg!(feature = "offer-sandbox")
        );
    }
    #[test]
    fn only_the_phone_creator_receives_the_injected_script() {
        assert!(creator(&Url::parse(CREATOR).unwrap()));
        assert!(!creator(&Url::parse("https://999.md/ro/88610685").unwrap()));
        assert!(!creator(
            &Url::parse(
                "https://v2.simpalsid.com/ro/add?subcategory=phone-and-communication/mobile-phones"
            )
            .unwrap()
        ));
    }
}
