import type { OfferTransfer } from "../../shared/offer-draft";
type NativeWindow = Window & {
  __TAURI__?: {
    core?: {
      invoke: <T>(
        command: string,
        args?: Record<string, unknown>,
      ) => Promise<T>;
    };
  };
};
export function inNativeApp() {
  return typeof (window as NativeWindow).__TAURI__?.core?.invoke === "function";
}
export type MarketplaceProfile = {
  available: boolean;
  saved: boolean;
  login: string;
  selectedId: string;
  accounts: { id: string; login: string; username?: string }[];
};
const profiles = new Map<
  string,
  {
    value?: MarketplaceProfile;
    expires: number;
    pending?: Promise<MarketplaceProfile>;
  }
>();
export const cachedMarketplaceProfile = (owner: string, allowStale = false) => {
  const item = profiles.get(owner);
  return item && (allowStale || item.expires > Date.now()) ? item.value : null;
};
export function rememberMarketplaceProfile(
  owner: string,
  value: MarketplaceProfile,
) {
  if (profiles.size >= 16 && !profiles.has(owner))
    profiles.delete(profiles.keys().next().value!);
  profiles.set(owner, { value, expires: Date.now() + 30000 });
}
export async function marketplaceProfile(
  owner: string,
  force = false,
): Promise<MarketplaceProfile> {
  if (!inNativeApp())
    return {
      available: false,
      saved: false,
      login: "",
      selectedId: "",
      accounts: [],
    };
  if (!force) {
    const cached = cachedMarketplaceProfile(owner);
    if (cached) return cached;
    const pending = profiles.get(owner)?.pending;
    if (pending) return pending;
  }
  const entry: {
    value?: MarketplaceProfile;
    expires: number;
    pending?: Promise<MarketplaceProfile>;
  } = { value: profiles.get(owner)?.value, expires: profiles.get(owner)?.expires || 0 };
  entry.pending = (window as NativeWindow)
    .__TAURI__!.core!.invoke<MarketplaceProfile>("marketplace_login_status", {
      owner,
    })
    .then((raw) => {
      const value: MarketplaceProfile = {
        available: raw.available === true,
        saved: raw.saved === true,
        login: typeof raw.login === "string" ? raw.login : "",
        selectedId: typeof raw.selectedId === "string" ? raw.selectedId : "",
        accounts: Array.isArray(raw.accounts)
          ? raw.accounts.map((a) => ({ id: a.id, login: a.login, username: typeof a.username === "string" ? a.username : "" }))
          : [],
      };
      if (profiles.get(owner) === entry)
        rememberMarketplaceProfile(owner, value);
      return value;
    })
    .catch((error) => {
      if (profiles.get(owner) === entry) profiles.delete(owner);
      throw error;
    });
  if (profiles.size >= 16 && !profiles.has(owner))
    profiles.delete(profiles.keys().next().value!);
  profiles.set(owner, entry);
  return entry.pending;
}
export async function marketplaceAccountAvatar(
  owner: string,
  id: string,
): Promise<string> {
  if (!inNativeApp()) return "";
  const result = await (window as NativeWindow).__TAURI__!.core!.invoke<{
    url?: string;
  }>("marketplace_account_avatar", { owner, id });
  const { marketplaceAvatarUrl } = await import("./marketplace-identity");
  return marketplaceAvatarUrl(result?.url);
}
export async function prepareNativeOffer(
  draft: OfferTransfer,
  owner?: string,
  accountId?: string,
  requestId: string = crypto.randomUUID(),
  autoPublish = false,
) {
  const native = (window as NativeWindow).__TAURI__?.core;
  if (!native)
    throw Error(
      "Open this draft in the installed Resell app to prepare it on 999.md.",
    );
  await native.invoke("prepare_native_offer", {
    draft,
    owner: owner || null,
    accountId: accountId || null,
    requestId,
    autoPublish,
  });
}
export async function preparationResult(owner: string, requestId: string) {
  if (!inNativeApp()) return null;
  return (window as NativeWindow).__TAURI__!.core!.invoke<
    import("./preparation-queue").QueueResult | null
  >("offer_preparation_result", { owner, requestId });
}
