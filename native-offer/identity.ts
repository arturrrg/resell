// A cabinet link belongs to the authenticated header. Profile links in adverts
// and recommendations are deliberately excluded.
export function signedInUsername(root: ParentNode, href: string): string {
  try {
    const origin = new URL(href);
    if (origin.origin !== "https://999.md" || origin.username || origin.password) return "";
    const names = new Set<string>();
    for (const anchor of Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href*="/cabinet/items/"]'))) {
      const url = new URL(anchor.getAttribute("href") || "", origin);
      if (url.origin !== origin.origin || url.username || url.password) continue;
      const match = /^\/(?:ro|ru|en)\/cabinet\/items\/([^/]+)\/?$/.exec(url.pathname);
      if (!match) continue;
      const name = decodeURIComponent(match[1]);
      if (/^[\p{L}\p{N}_.+-]{1,60}$/u.test(name)) names.add(name);
    }
    return names.size === 1 ? [...names][0] : "";
  } catch { return ""; }
}
