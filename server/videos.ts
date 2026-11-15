export type ListingVideo = {
  url: string;
  embedUrl?: string;
  poster?: string;
  kind: "embed" | "video";
};
export function extractVideos(html: string): ListingVideo[] {
  const sources = [html];
  for (const match of html.matchAll(
    /self\.__next_f\.push\((\[[\s\S]*?\])\)/g,
  )) {
    try {
      const data = JSON.parse(match[1]);
      if (typeof data[1] === "string") sources.push(data[1]);
    } catch {}
  }
  const out: ListingVideo[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    for (const match of source.matchAll(
      /(?:https?:)(?:\\\/|\/){2}[^\s"<>\\]*(?:\\\/[^\s"<>\\]*)*/g,
    )) {
      const raw = match[0].replace(/\\\//g, "/").replace(/&amp;/g, "&");
      try {
        const u = new URL(raw);
        let video: ListingVideo | undefined;
        const vimeo =
          u.hostname === "vimeo.com" ? u.pathname.match(/^\/(\d+)$/) : null;
        const youtube = ["youtube.com", "www.youtube.com", "youtu.be"].includes(
          u.hostname,
        )
          ? u.hostname === "youtu.be"
            ? u.pathname.slice(1)
            : u.searchParams.get("v") ||
              u.pathname.match(/^\/embed\/([\w-]+)/)?.[1]
          : null;
        if (vimeo)
          video = {
            url: u.href,
            embedUrl: `https://player.vimeo.com/video/${vimeo[1]}`,
            poster: `https://vumbnail.com/${vimeo[1]}.jpg`,
            kind: "embed",
          };
        else if (youtube && /^[\w-]{11}$/.test(youtube))
          video = {
            url: u.href,
            embedUrl: `https://www.youtube-nocookie.com/embed/${youtube}`,
            poster: `https://i.ytimg.com/vi/${youtube}/hqdefault.jpg`,
            kind: "embed",
          };
        else if (
          u.protocol === "https:" &&
          ["i.simpalsmedia.com", "v.simpalsmedia.com", "999.md"].includes(
            u.hostname,
          ) &&
          /\.(mp4|webm|mov)$/i.test(u.pathname)
        )
          video = { url: u.href, kind: "video" };
        if (video && !seen.has(video.embedUrl || video.url)) {
          seen.add(video.embedUrl || video.url);
          out.push(video);
        }
      } catch {}
    }
  }
  return out;
}
