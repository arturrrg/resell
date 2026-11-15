import { useEffect, useState } from "react";
import { marketplaceAccountAvatar } from "./native";
import { marketplaceAccountName } from "./marketplace-identity";
const photos = new Map<
  string,
  { url: string; expires: number; pending?: Promise<string> }
>();
export function loadMarketplaceAvatar(
  owner: string,
  id: string,
  login: string,
) {
  const key = owner + ":" + id + ":" + login,
    cached = photos.get(key);
  if (cached && cached.expires > Date.now())
    return cached.pending || Promise.resolve(cached.url);
  if (photos.size >= 128) photos.delete(photos.keys().next().value!);
  const entry = {
    url: "",
    expires: Date.now() + 6 * 3600000,
    pending: undefined as Promise<string> | undefined,
  };
  entry.pending = marketplaceAccountAvatar(owner, id)
    .then((url) => {
      entry.url = url;
      entry.expires = Date.now() + (url ? 15 * 60000 : 60000);
      entry.pending = undefined;
      return url;
    })
    .catch(() => {
      entry.expires = Date.now() + 60000;
      entry.pending = undefined;
      return "";
    });
  photos.set(key, entry);
  return entry.pending;
}
export function MarketplaceAvatar({
  owner,
  account,
}: {
  owner: string;
  account: { id: string; login: string; username?: string };
}) {
  const identity = account.username || account.login;
  const cached = photos.get(owner + ":" + account.id + ":" + identity);
  const [url, setUrl] = useState(
    cached && cached.expires > Date.now() ? cached.url : "",
  );
  useEffect(() => {
    let alive = true;
    const cached = photos.get(owner + ":" + account.id + ":" + identity);
    setUrl(cached && cached.expires > Date.now() ? cached.url : "");
    // The part before @ is a display label, not proof of a public 999 username.
    if (account.username || !account.login.includes("@"))
      void loadMarketplaceAvatar(owner, account.id, identity).then(
        (value) => {
          if (alive) setUrl(value);
        },
      );
    return () => {
      alive = false;
    };
  }, [owner, account.id, identity]);
  return (
    <span className="marketplace-account-avatar" aria-hidden="true">
      {url ? (
        <img
          src={url}
          width="36"
          height="36"
          alt=""
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setUrl("")}
        />
      ) : (
        marketplaceAccountName(account).slice(0, 1).toUpperCase()
      )}
    </span>
  );
}
