import { readOfferTransfer } from "../shared/offer-draft";
import { mountOfferPanel } from "../shared/offer-panel";
import { watchPublication, resumePublicationReturn } from "./publication-watch";
export function nativeReturnUrl(returnUrl: string) {
  const returning = new URL(returnUrl);
  const local =
    (returning.protocol === "tauri:" &&
      returning.hostname === "localhost" &&
      !returning.port) ||
    (["http:", "https:"].includes(returning.protocol) &&
      returning.hostname === "tauri.localhost" &&
      !returning.port) ||
    (returning.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(returning.hostname) &&
      returning.port === "1420");
  if (
    !local ||
    returning.username ||
    returning.password ||
    !["/", "/index.html", "/offer-sandbox.html"].includes(returning.pathname)
  )
    throw Error("Invalid native return destination.");
  return returning.href;
}
export function start(
  draft: unknown,
  returnUrl: string,
  expectedLogin = "",
  requestId = "",
  autoPublish = false,
) {
  const transfer = readOfferTransfer(draft);
  const returning = nativeReturnUrl(returnUrl);
  if (document.querySelector("#resell-native-prepare")) return;
  const watcher = watchPublication(returning, requestId, [
    transfer.title,
    transfer.secondaryTitle || "",
  ], expectedLogin);
  mountOfferPanel(transfer, returning, undefined, {
    automatic: true,
    expectedLogin,
    autoPublish,
    onPrepared: () => { watcher.ready(); if (autoPublish) return watcher.publish(); },
    onClose: () => watcher.stop(),
  });
}
export function resume(returnUrl: string, requestId: string, titles: string[]) {
  resumePublicationReturn(nativeReturnUrl(returnUrl), requestId, titles);
}
