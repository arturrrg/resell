import { accountOnForm, fillOfferForm } from "./offer-form";
import type { OfferTransfer, TransferReport } from "./offer-draft";

export function preparationAccountMatches(login: string, account: string) {
  const normalize = (value: string) => value.trim().replace(/^@/, "").normalize("NFC").toLowerCase();
  const expected = normalize(login), actual = normalize(account);
  return !!actual && (!expected || expected.includes("@") || expected === actual);
}

export function mountOfferPanel(
  draft: OfferTransfer,
  returnUrl: string,
  sandboxRoot?: HTMLElement,
  options: {
    automatic?: boolean;
    autoPublish?: boolean;
    expectedLogin?: string;
    onPrepared?: () => void | Promise<void>;
    onClose?: () => void;
  } = {},
) {
  const root: ParentNode = sandboxRoot || document;
  if (!sandboxRoot && (location.origin !== "https://999.md" || !/^\/(?:ro|ru)\/add$/.test(location.pathname)))
    throw Error("Preparation is restricted to the 999.md creator.");
  if (root.querySelector("#resell-native-prepare")) return;
  const host = document.createElement("div");
  host.id = "resell-native-prepare";
  (sandboxRoot || document.documentElement).append(host);
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = ':host{position:fixed;left:max(12px,env(safe-area-inset-left));top:max(12px,env(safe-area-inset-top));width:max-content;max-width:min(330px,calc(100vw - 24px));z-index:2147483646;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#eeeef4}*{box-sizing:border-box}.panel{display:flex;align-items:center;gap:10px;border:1px solid #ffffff1a;background:#202023f5;padding:9px 10px 9px 13px;border-radius:14px;box-shadow:0 5px 24px #0003}.status{min-width:0}.brand{display:block;font-size:11px;font-weight:650;line-height:15px}p{font-size:12px;line-height:17px;margin:0;color:#c3c3cd;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}button{flex:none;font:inherit;border:0;border-radius:9px;min-width:30px;height:30px;padding:0 7px;background:#ffffff0b;color:#dedee5;cursor:pointer}button:focus-visible{outline:2px solid #aaa;outline-offset:2px}button:disabled{display:none}.fill{font-size:11px}.back{font-size:19px}';
  shadow.append(style);
  const panel = document.createElement("section");
  panel.className = "panel";
  panel.setAttribute("aria-label", "Resell preparation status");
  shadow.append(panel);
  const status = document.createElement("div");
  status.className = "status";
  const brand = document.createElement("span");
  brand.className = "brand";
  brand.textContent = "Resell";
  const text = document.createElement("p");
  text.setAttribute("role", "status");
  text.textContent = "Connecting to 999.md…";
  status.append(brand, text);
  panel.append(status);
  const fill = document.createElement("button");
  fill.className = "fill";
  fill.textContent = "Prepare";
  fill.disabled = true;
  panel.append(fill);
  const back = document.createElement("button");
  back.className = "back";
  back.textContent = "↩";
  back.setAttribute("aria-label", sandboxRoot ? "Close native preview" : "Back to Resell");
  back.title = "Back to Resell";
  panel.append(back);
  const controller = new AbortController();
  let active = false;
  const observer = new MutationObserver(check);
  observer.observe(sandboxRoot || document.documentElement, { childList: true, subtree: true });
  const deadline = setTimeout(() => {
    observer.disconnect();
    if (!active) text.textContent = "Sign in to continue.";
  }, 20000);
  const stop = () => {
    options.onClose?.();
    controller.abort();
    observer.disconnect();
    clearTimeout(deadline);
  };
  back.onclick = () => {
    stop();
    if (sandboxRoot) host.remove();
    else location.href = returnUrl;
  };
  function check() {
    if (active || controller.signal.aborted) return;
    const account = accountOnForm(root);
    if (!account || !root.querySelector('#radio-776, [data-testid="modal-trigger-1"]')) return;
    if (!preparationAccountMatches(options.expectedLogin || "", account)) {
      const message = "Switch to the connected account.";
      if (text.textContent !== message) text.textContent = message;
      return;
    }
    observer.disconnect();
    clearTimeout(deadline);
    brand.textContent = "Resell · @" + account;
    text.textContent = options.automatic ? "Preparing…" : "Ready to prepare";
    fill.disabled = false;
    const run = async () => {
      if (active || controller.signal.aborted) return;
      active = true;
      fill.disabled = true;
      text.textContent = "Preparing…";
      try {
        const report: TransferReport = await fillOfferForm(draft, root, {
          account, signal: controller.signal,
          onStage: stage => { text.textContent = stage + "…"; },
        });
        text.textContent = report.status === "ready"
          ? options.autoPublish ? "Publishing…" : "Ready · " + report.photos + " photos"
          : "Needs attention on 999.md";
        text.title = report.missing.join(". ");
        host.dataset.result = report.status;
        host.dataset.photos = String(report.photos);
        if (report.status === "ready") await options.onPrepared?.();
        if (sandboxRoot) sandboxRoot.dispatchEvent(new CustomEvent("resell-native-result", { detail: report }));
      } catch (error) {
        console.error("Resell offer preparation failed", error instanceof Error ? error.stack : String(error));
        text.textContent = (error as Error).message;
        text.title = (error as Error).message;
        host.dataset.result = "blocked";
      }
    };
    fill.onclick = () => void run();
    if (options.automatic) void run();
  }
  check();
  return () => { stop(); host.remove(); };
}
