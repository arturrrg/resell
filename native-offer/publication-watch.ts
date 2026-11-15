import {
  marketplaceGraphql,
  PublicationTracker,
  publicAdvertId,
  publishControl,
  type PublicationProof,
} from "../shared/publication";
import { automaticPublisher, publicationProblem } from "./publish";
const receiptKey = (id: string) => "resell-publication:" + id;
const creator = () =>
  location.origin === "https://999.md" &&
  /^\/(?:ro|ru)\/add$/.test(location.pathname);
export function returnAfterPublication(
  returnUrl: string,
  proof: PublicationProof,
) {
  const target = new URL(returnUrl);
  target.searchParams.set("resell_submission", JSON.stringify(proof));
  location.assign(target.href);
}
export function resumePublicationReturn(
  returnUrl: string,
  requestId: string,
  titles: string[],
) {
  if (location.origin !== "https://999.md") return;
  try {
    const record = JSON.parse(
      sessionStorage.getItem(receiptKey(requestId)) || "null",
    );
    const proof = record?.proof as PublicationProof;
    if (
      !proof ||
      record.expires < Date.now() ||
      proof.requestId !== requestId ||
      !publicAdvertId(proof.advertId) ||
      !["AD_STATE_PUBLIC", "AD_STATE_PRE_MODERATION"].includes(proof.state) ||
      !titles.some(
        (t) =>
          t.trim().replace(/\s+/g, " ").toLowerCase() ===
          proof.title?.trim().replace(/\s+/g, " ").toLowerCase(),
      )
    )
      return;
    sessionStorage.removeItem(receiptKey(requestId));
    returnAfterPublication(returnUrl, proof);
  } catch {
    /* Missing proof always leaves the marketplace open. */
  }
}
async function boundedBody(response: Response, limit: number) {
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > limit) {
      void reader.cancel();
      return null;
    }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.length;
  }
  return new TextDecoder().decode(bytes);
}
/** Binds a creator submission to its exact returned advert ID. */
export function watchPublication(
  returnUrl: string,
  requestId: string,
  titles: string[],
  expectedLogin = "",
) {
  const tracker = new PublicationTracker(requestId, titles);
  if (!creator()) throw Error("Open the official marketplace creator.");
  let stopped = false,
    returnTimer: ReturnType<typeof setTimeout> | undefined;
  let submission: { resolve: () => void; reject: (error: Error) => void } | undefined;
  let issueObserver: MutationObserver | undefined, issueTimer: ReturnType<typeof setTimeout> | undefined;
  const clearIssues = () => { issueObserver?.disconnect(); clearTimeout(issueTimer); };
  const process = (body: string | null, value: any) => {
    if (stopped || !body || body.length > 256_000) return;
    try {
      const request = JSON.parse(body);
      const requests = Array.isArray(request) ? request : [request],
        responses = Array.isArray(value) ? value : [value];
      if (requests.length > 10 || requests.length !== responses.length) return;
      for (let i = 0; i < requests.length; i++) {
        const proof = tracker.observe(
          requests[i],
          responses[i],
          performance.now(),
        );
        if (!proof) continue;
        clearIssues();
        submission?.resolve();
        try {
          sessionStorage.setItem(
            receiptKey(requestId),
            JSON.stringify({ proof, expires: Date.now() + 15 * 60_000 }),
          );
        } catch {}
        // Let the site's own response handler finish before leaving the page.
        returnTimer = setTimeout(() => {
          if (!stopped) returnAfterPublication(returnUrl, proof);
        }, 200);
      }
    } catch {
      /* Unknown/error response is not successful publication. */
    }
  };
  const intent = (event: Event) => {
    if (!event.isTrusted || !creator()) return;
    const element =
      event instanceof SubmitEvent ? event.submitter : event.target;
    const button =
      element instanceof Element
        ? element.closest("button,input[type=submit],[role=button]")
        : null;
    const label =
      button instanceof HTMLInputElement
        ? button.value
        : button?.textContent || button?.getAttribute("aria-label") || "";
    if (publishControl(label)) tracker.userPublish(performance.now());
  };
  document.addEventListener("click", intent, true);
  document.addEventListener("submit", intent, true);
  const originalFetch = window.fetch;
  const wrappedFetch: typeof fetch = function (this: Window, input, init) {
    let body: Promise<string | null> | null = null;
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (creator() && marketplaceGraphql(url)) {
      if (typeof init?.body === "string")
        body = Promise.resolve(init.body.length <= 256_000 ? init.body : null);
      else if (
        input instanceof Request &&
        !input.bodyUsed &&
        input.method === "POST"
      ) {
        try {
          body = boundedBody(new Response(input.clone().body), 256_000);
        } catch {}
      }
    }
    const pending = originalFetch.call(this, input, init);
    if (body)
      void pending
        .then(async (response) => {
          if (
            !response.ok ||
            (response.url && !marketplaceGraphql(response.url))
          )
            return;
          const text = await boundedBody(response.clone(), 512_000);
          if (text) process(await body, JSON.parse(text));
        })
        .catch(() => {});
    return pending;
  };
  window.fetch = wrappedFetch;
  const originalOpen = XMLHttpRequest.prototype.open,
    originalSend = XMLHttpRequest.prototype.send;
  const requests = new WeakMap<
    XMLHttpRequest,
    { url: string; method: string }
  >();
  const open = function (
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    ...rest: any[]
  ) {
    requests.set(this, { url: String(url), method });
    return Reflect.apply(originalOpen, this, [method, url, ...rest]);
  } as typeof originalOpen;
  const send = function (
    this: XMLHttpRequest,
    body?: Document | XMLHttpRequestBodyInit | null,
  ) {
    const request = requests.get(this);
    if (
      creator() &&
      request?.method.toUpperCase() === "POST" &&
      marketplaceGraphql(request.url) &&
      typeof body === "string" &&
      body.length <= 256_000
    ) {
      this.addEventListener(
        "load",
        () => {
          if (
            this.status < 200 ||
            this.status >= 300 ||
            (this.responseURL && !marketplaceGraphql(this.responseURL))
          )
            return;
          try {
            const text =
              this.responseType === "json"
                ? JSON.stringify(this.response)
                : this.responseText;
            if (text.length <= 512_000) process(body, JSON.parse(text));
          } catch {}
        },
        { once: true },
      );
    }
    return originalSend.call(this, body);
  } as typeof originalSend;
  XMLHttpRequest.prototype.open = open;
  XMLHttpRequest.prototype.send = send;
  const stop = () => {
    stopped = true;
    clearIssues();
    submission?.reject(Error("Publication tracking stopped. Check 999.md before submitting again."));
    clearTimeout(returnTimer);
    document.removeEventListener("click", intent, true);
    document.removeEventListener("submit", intent, true);
    if (window.fetch === wrappedFetch) window.fetch = originalFetch;
    if (XMLHttpRequest.prototype.open === open)
      XMLHttpRequest.prototype.open = originalOpen;
    if (XMLHttpRequest.prototype.send === send)
      XMLHttpRequest.prototype.send = originalSend;
  };
  const clickPublish = automaticPublisher(document, expectedLogin, () => {
    if (stopped) throw Error("Publication tracking has stopped.");
    tracker.userPublish(performance.now());
  });
  const publish = () => {
    clickPublish();
    return new Promise<void>((resolve, reject) => {
      submission = { resolve, reject };
      const check = () => {
        const problem = publicationProblem(document);
        if (problem) { clearIssues(); reject(Error(problem)); }
      };
      issueObserver = new MutationObserver(check);
      issueObserver.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
      issueTimer = setTimeout(() => {
        clearIssues();
        reject(Error("999.md has not confirmed publication. Check this page and your account before trying again; Resell will not submit twice."));
      }, 45000);
      check();
    });
  };
  return { ready: () => tracker.ready(), publish, stop };
}
