export type PublicationProof = {
  requestId: string;
  advertId: string;
  title: string;
  state: "AD_STATE_PUBLIC" | "AD_STATE_PRE_MODERATION";
};
const normalized = (s: string) => s.trim().replace(/\s+/gu, " ").toLowerCase();
export const publicAdvertId = (value: unknown) => {
  const id =
    typeof value === "number" && Number.isSafeInteger(value)
      ? String(value)
      : value;
  return typeof id === "string" && /^[1-9]\d{5,11}$/.test(id) ? id : "";
};
export function publishControl(label: string) {
  if (/^(?:publică și continuă|опубликовать и продолжить|publish and continue)$/iu.test(label.trim().replace(/\s+/g, " "))) return true;
  return /^(?:public[aă](?:\s+anun[țt](?:ul)?)?|publicare|plaseaz[aă](?:\s+anun[țt](?:ul)?)?|опубликовать(?:\s+объявление)?|publish(?:\s+(?:ad|advert|offer))?)$/iu.test(
    label.trim().replace(/\s+/g, " "),
  );
}
export function marketplaceGraphql(value: string) {
  try {
    const u = new URL(value, "https://999.md");
    return (
      u.origin === "https://999.md" &&
      !u.username &&
      !u.password &&
      ["/graphql", "/lgraphql"].includes(u.pathname)
    );
  } catch {
    return false;
  }
}
/** Matches the public creator's actual UpsertAd / PublishAd response contract.
 * Drafts, updates to an unrelated title, payment and moderation rejection never
 * count as a successful submission. This class never submits a request. */
export class PublicationTracker {
  private prepared = false;
  private intentUntil = 0;
  private candidate = "";
  private candidateTitle = "";
  private done = false;
  constructor(
    private requestId: string,
    private titles: string[],
  ) {}
  ready() {
    this.prepared = true;
  }
  userPublish(now: number) {
    if (this.prepared) this.intentUntil = now + 10 * 60_000;
  }
  observe(request: any, response: any, now: number): PublicationProof | null {
    if (
      this.done ||
      !this.prepared ||
      now > this.intentUntil ||
      !this.intentUntil ||
      !request ||
      !response ||
      (Array.isArray(response.errors) && response.errors.length) ||
      !response.data
    )
      return null;
    const name =
      request.operationName ||
      /\bmutation\s+(\w+)/.exec(request.query || "")?.[1];
    let ad: any;
    if (name === "UpsertAd") {
      ad = response.data.upsertAd;
      const id = publicAdvertId(ad?.id);
      if (
        !id ||
        typeof ad?.title !== "string" ||
        !this.titles.some((t) => normalized(t) === normalized(ad.title))
      )
        return null;
      this.candidate = id;
      this.candidateTitle = ad.title;
    } else if (name === "PublishAd") {
      ad = response.data.publish?.adWithTransaction?.ad;
      if (
        !this.candidate ||
        publicAdvertId(request.variables?.input?.id) !== this.candidate ||
        publicAdvertId(ad?.id) !== this.candidate
      )
        return null;
    } else return null;
    if (!["AD_STATE_PUBLIC", "AD_STATE_PRE_MODERATION"].includes(ad?.state))
      return null;
    this.done = true;
    return {
      requestId: this.requestId,
      advertId: this.candidate,
      title: this.candidateTitle,
      state: ad.state,
    };
  }
}
