export function viewingCode(value: string) {
  try {
    if (value.includes("://"))
      return viewingCode(
        new URLSearchParams(new URL(value).hash.slice(1)).get("view") || "",
      );
  } catch {
    return "";
  }
  const clean = value.replace(/[\s-]/g, "").toLowerCase();
  return /^[a-f0-9]{32}$/.test(clean) ? clean : "";
}
export function viewLink(code: string, origin: string) {
  if (!viewingCode(code)) throw Error("Invalid inventory code.");
  const url = new URL(origin);
  if (
    url.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(url.hostname)
  )
    throw Error("Use a secure sharing address.");
  url.pathname = "/";
  url.search = "";
  url.hash = "view=" + viewingCode(code);
  return url.href;
}
export const formatViewingCode = (code: string) =>
  code
    .toUpperCase()
    .match(/.{1,4}/g)
    ?.join("-") || "";
