/** Known non-binding marketplace notices. Never selects generic dialog actions. */
export function visibleMarketplaceControl(node: HTMLElement) {
  const style = getComputedStyle(node);
  return (
    node.getClientRects().length > 0 &&
    style.visibility !== "hidden" &&
    style.display !== "none" &&
    style.opacity !== "0" &&
    !node.closest('[aria-hidden="true"], [hidden]')
  );
}

export function cookieAcceptButtons(root: ParentNode) {
  return Array.from(
    root.querySelectorAll<HTMLButtonElement>(
      'section[role="dialog"][aria-labelledby="cc-banner-title"] button[class*="banner__accept"], #cc-main .cm__btn[data-role="all"]',
    ),
  ).filter((button) => !button.disabled && visibleMarketplaceControl(button));
}

export function acceptKnownCookieBanner(root: ParentNode) {
  const buttons = cookieAcceptButtons(root);
  // The newer banner can coexist with the old consent library. Use its own
  // action first; it coordinates the old library and React state together.
  const preferred = buttons.filter((button) =>
    button.closest('section[aria-labelledby="cc-banner-title"]'),
  );
  const candidates = preferred.length ? preferred : buttons;
  if (candidates.length !== 1) return false;
  candidates[0].click();
  return true;
}

export async function settleCookieNotices(
  root: ParentNode,
  signal?: AbortSignal,
) {
  // A hydrated React banner may ignore an early click. Retry the same known
  // action, never move on while it remains visible, and stop after 8 seconds.
  const start = Date.now();
  while (cookieAcceptButtons(root).length) {
    if (signal?.aborted)
      throw new DOMException("Preparation cancelled", "AbortError");
    if (Date.now() - start > 8000)
      throw Error(
        "The cookie notice is still open. Accept it on 999.md, then prepare again.",
      );
    acceptKnownCookieBanner(root);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(done, 200);
      function done() {
        signal?.removeEventListener("abort", cancel);
        resolve();
      }
      function cancel() {
        clearTimeout(timer);
        signal?.removeEventListener("abort", cancel);
        reject(new DOMException("Preparation cancelled", "AbortError"));
      }
      signal?.addEventListener("abort", cancel, { once: true });
    });
  }
}

export function firstSetupGuide(root: ParentNode) {
  const guides = Array.from(
    root.querySelectorAll<HTMLElement>(".introjs-tour"),
  ).filter(
    (guide) =>
      visibleMarketplaceControl(guide) &&
      guide.querySelector(".introjs-tooltip-title")?.textContent?.trim() ===
        "Completează primii pași",
  );
  return guides.length === 1 ? guides[0] : null;
}
export function progressSetupGuide(root: ParentNode) {
  const guides = Array.from(
    root.querySelectorAll<HTMLElement>('#add-form-progress[role="tooltip"]'),
  ).filter(
    (guide) =>
      visibleMarketplaceControl(guide) &&
      (guide.querySelector('[class*="tooltip__content"]')?.textContent || "")
        .normalize("NFKD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .startsWith(
          "indicatorul de progres arata cat de completate sunt campurile principale.",
        ),
  );
  return guides.length === 1 ? guides[0] : null;
}

export async function settleMarketplaceNotices(
  root: ParentNode,
  signal?: AbortSignal,
) {
  await settleCookieNotices(root, signal);
  const guides = [firstSetupGuide(root), progressSetupGuide(root)].filter(
    (guide): guide is HTMLElement => !!guide,
  );
  for (const guide of guides) {
    const close = guide.querySelector<HTMLElement>(
      guide.id === "add-form-progress"
        ? 'button[class*="tooltip__close__button"]'
        : 'a.introjs-skipbutton[role="button"]',
    );
    if (!close || !visibleMarketplaceControl(close))
      throw Error(
        "The marketplace first-step guide has no recognized close control.",
      );
    const start = Date.now();
    while (guide.isConnected && visibleMarketplaceControl(guide)) {
      if (signal?.aborted)
        throw new DOMException("Preparation cancelled", "AbortError");
      if (Date.now() - start > 4000)
        throw Error(
          "The marketplace first-step guide is still open. Close it, then prepare again.",
        );
      close.click();
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
    }
  }
}
