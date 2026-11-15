import { nativeReturnUrl } from "./prepare";
import {
  acceptKnownCookieBanner,
  cookieAcceptButtons,
  firstSetupGuide,
  progressSetupGuide,
  settleMarketplaceNotices,
  visibleMarketplaceControl,
} from "../shared/marketplace-notices";
export { acceptKnownCookieBanner } from "../shared/marketplace-notices";

const PROJECT = "999a46c6-e6a6-11e1-a45f-28376188709b";
export function marketplacePage(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.port &&
      !url.username &&
      !url.password &&
      ["999.md", "v2.simpalsid.com"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}
function marketplaceAuthPage(value: string, route: "login" | "auth-confirm") {
  try {
    const url = new URL(value),
      redirect = new URL(url.searchParams.get("redirectUrl") || "");
    return (
      marketplacePage(value) &&
      url.hostname === "v2.simpalsid.com" &&
      new RegExp(`^/sid/(?:ro|ru|en)/user/${route}/?$`).test(url.pathname) &&
      (url.searchParams.get("projectId") === PROJECT ||
        (route === "auth-confirm" && !url.searchParams.has("projectId"))) &&
      redirect.origin === "https://999.md" &&
      !redirect.username &&
      !redirect.password &&
      redirect.pathname === "/__sid-auth"
    );
  } catch {
    return false;
  }
}
export function marketplaceLoginPage(value: string) {
  return marketplaceAuthPage(value, "login");
}
export function marketplaceConfirmationPage(value: string) {
  return marketplaceAuthPage(value, "auth-confirm");
}
export function continueKnownSignIn(root: ParentNode) {
  const buttons = Array.from(
    root.querySelectorAll<HTMLButtonElement>("button, a"),
  ).filter(
    (button) =>
      !button.disabled &&
      button.getClientRects().length > 0 &&
      button.textContent
        ?.normalize("NFKD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "") === "accesatisiteul999md",
  );
  // Simpals renders an anchor around a button with the same label. Treat that
  // nested pair as one action; distinct matching controls remain ambiguous.
  const actions = buttons.filter(
    (node) =>
      !buttons.some((parent) => parent !== node && parent.contains?.(node)),
  );
  if (actions.length !== 1) return false;
  const action = actions[0];
  if (action.tagName === "A") {
    try {
      const target = new URL((action as unknown as HTMLAnchorElement).href);
      if (
        target.protocol !== "https:" ||
        target.hostname !== "999.md" ||
        target.port ||
        target.username ||
        target.password ||
        !/^\/(?:ro\/|ru\/)?__sid-auth$/.test(target.pathname)
      )
        return false;
    } catch {
      return false;
    }
  }
  action.click();
  return true;
}
export function signInContinuation() {
  let arrived: number | null = null,
    lastAttempt = -Infinity,
    attempts = 0;
  return (onConfirmation: boolean, now: number, click: () => boolean) => {
    if (!onConfirmation) {
      arrived = null;
      lastAttempt = -Infinity;
      attempts = 0;
      return false;
    }
    arrived ??= now;
    if (now - arrived < 1500 || now - lastAttempt < 2000 || attempts >= 4)
      return false;
    lastAttempt = now;
    const clicked = click();
    if (clicked) attempts++;
    return clicked;
  };
}
export function inspectMarketplacePage(root: ParentNode, href: string) {
  const state = {
    kind: "unsupported" as
      | "unsupported"
      | "challenge"
      | "sign-in"
      | "confirmation"
      | "creator"
      | "loading"
      | "marketplace",
    consent: false,
    guide: false,
    signedIn: false,
  };
  if (!marketplacePage(href)) return state;
  state.consent = cookieAcceptButtons(root).length > 0;
  state.guide = !!firstSetupGuide(root) || !!progressSetupGuide(root);
  state.signedIn = !!root.querySelector('a[href*="/cabinet/items/"]');
  const challenge = Array.from(
    root.querySelectorAll<HTMLElement>(
      '#challenge-running, iframe[src*="/bframe"]',
    ),
  ).some(
    (node) =>
      visibleMarketplaceControl(node) &&
      node.getBoundingClientRect().height > 100,
  );
  if (challenge) state.kind = "challenge";
  else if (marketplaceLoginPage(href)) state.kind = "sign-in";
  else if (marketplaceConfirmationPage(href)) state.kind = "confirmation";
  else if (/^\/(?:ro|ru)\/add$/.test(new URL(href).pathname))
    state.kind =
      state.signedIn &&
      !!root.querySelector('#radio-776, [data-testid="modal-trigger-1"]')
        ? "creator"
        : "loading";
  else state.kind = "marketplace";
  return state;
}

export function startPageChecks() {
  if (!marketplacePage(location.href)) return;
  const host = window as Window & { __resellPageChecks?: () => void };
  host.__resellPageChecks?.();
  const continuation = signInContinuation();
  let handlingGuide = false,
    lastConsent = 0,
    queued: ReturnType<typeof setTimeout> | undefined;
  const check = () => {
    if (!marketplacePage(location.href)) {
      stop();
      return;
    }
    const state = inspectMarketplacePage(document, location.href);
    document.documentElement.dataset.resellPageState = state.kind;
    if (state.kind === "challenge") return;
    if (state.consent && Date.now() - lastConsent > 400) {
      lastConsent = Date.now();
      acceptKnownCookieBanner(document);
      return;
    }
    if (state.kind === "creator" && state.guide && !handlingGuide) {
      handlingGuide = true;
      void settleMarketplaceNotices(document)
        .catch(() => {})
        .finally(() => {
          handlingGuide = false;
        });
    }
    continuation(state.kind === "confirmation", Date.now(), () =>
      continueKnownSignIn(document),
    );
  };
  const observer = new MutationObserver(() => {
    clearTimeout(queued);
    queued = setTimeout(check, 100);
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style", "disabled", "aria-hidden"],
  });
  const heartbeat = setInterval(check, 750),
    deadline = setTimeout(() => stop(), 600000);
  function stop() {
    observer.disconnect();
    clearInterval(heartbeat);
    clearTimeout(deadline);
    clearTimeout(queued);
    delete host.__resellPageChecks;
  }
  host.__resellPageChecks = stop;
  check();
}
export function continueSignIn() {
  if (!marketplaceConfirmationPage(location.href)) return;
  if (continueKnownSignIn(document)) return;
  const observer = new MutationObserver(() => {
    if (
      !marketplaceConfirmationPage(location.href) ||
      continueKnownSignIn(document)
    ) {
      observer.disconnect();
      clearTimeout(deadline);
    }
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
  });
  const deadline = setTimeout(() => observer.disconnect(), 15000);
}
export function acceptCookies() {
  if (!marketplacePage(location.href)) return;
  let clicked = false;
  let lastClick = 0;
  const attempt = () => {
    if (!marketplacePage(location.href)) return;
    if (cookieAcceptButtons(document).length && Date.now() - lastClick > 300) {
      lastClick = Date.now();
      clicked = acceptKnownCookieBanner(document) || clicked;
    }
  };
  attempt();
  const observer = new MutationObserver(() => {
    if (clicked && !cookieAcceptButtons(document).length) {
      observer.disconnect();
      clearTimeout(deadline);
      clearInterval(retry);
    } else attempt();
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
  });
  const retry = setInterval(attempt, 400);
  const deadline = setTimeout(() => {
    observer.disconnect();
    clearInterval(retry);
  }, 20000);
}
export function attachReturn(returnUrl: string) {
  if (
    !marketplacePage(location.href) ||
    location.hostname !== "v2.simpalsid.com" ||
    document.getElementById("resell-marketplace-return")
  )
    return;
  const returning = nativeReturnUrl(returnUrl),
    link = document.createElement("a");
  link.id = "resell-marketplace-return";
  link.href = returning;
  link.setAttribute("aria-label", "Back to Resell");
  link.textContent = "‹  Resell";
  link.style.cssText =
    "position:fixed;top:12px;left:12px;z-index:2147483645;display:flex;align-items:center;justify-content:center;height:36px;padding:0 14px;border-radius:100px;border:1px solid #ffffff20;background:#202024e8;color:#eeeef4;text-decoration:none;font:500 12px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;box-shadow:0 3px 12px #0002;";
  document.documentElement.append(link);
}
export function fillKnownSignInForm(
  root: ParentNode,
  login: string,
  password: string,
) {
  const forms = Array.from(
    root.querySelectorAll<HTMLFormElement>('form[class*="Login_login__form"]'),
  );
  if (forms.length !== 1) return false;
  const form = forms[0],
    users = form.querySelectorAll<HTMLInputElement>('input[type="text"]'),
    passwords = form.querySelectorAll<HTMLInputElement>(
      'input[type="password"]',
    ),
    submits = form.querySelectorAll<HTMLButtonElement>('button[type="submit"]');
  if (users.length !== 1 || passwords.length !== 1 || submits.length !== 1)
    return false;
  const user = users[0],
    secret = passwords[0],
    submit = submits[0];
  if (
    form.dataset.resellSignInAttempted ||
    user.value ||
    secret.value ||
    user.disabled ||
    secret.disabled ||
    user.readOnly ||
    secret.readOnly ||
    submit.disabled ||
    (user.maxLength > 0 && login.length > user.maxLength) ||
    (secret.maxLength > 0 && password.length > secret.maxLength)
  )
    return false;
  form.dataset.resellSignInAttempted = "true";
  const set = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )!.set!;
  const fill = (input: HTMLInputElement, value: string) => {
    set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };
  // Let the mobile form finish hydration before writing, then give each
  // controlled field a full second to commit before the next action.
  form.dataset.resellSignInStage = "waiting";
  setTimeout(() => {
    if (!form.isConnected || user.value || secret.value) return;
    fill(user, login);
    form.dataset.resellSignInStage = "login-filled";
    setTimeout(() => {
      if (!form.isConnected || user.value !== login || secret.value) return;
      fill(secret, password);
      form.dataset.resellSignInStage = "password-filled";
      setTimeout(() => {
        if (
          form.isConnected &&
          user.value === login &&
          secret.value === password &&
          !submit.disabled
        ) {
          form.dataset.resellSignInStage = "submitted";
          form.requestSubmit(submit);
        } else form.dataset.resellSignInStage = "fields-changed";
      }, 1000);
    }, 1000);
  }, 2000);
  return true;
}
export function signIn(login: string, password: string) {
  if (!marketplaceLoginPage(location.href)) return;
  startPageChecks();
  const check = () => {
    if (
      !marketplaceLoginPage(location.href) ||
      document.querySelector('form[data-resell-sign-in-stage="submitted"]')
    ) {
      observer.disconnect();
      clearTimeout(deadline);
      return;
    }
    // Keep observing while the sequence is pending: hydration can replace the
    // entire form after an early match. Its replacement gets one fresh attempt.
    fillKnownSignInForm(document, login, password);
  };
  const observer = new MutationObserver(check);
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
  });
  const deadline = setTimeout(() => observer.disconnect(), 30000);
  check();
}
