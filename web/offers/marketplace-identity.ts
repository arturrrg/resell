/** A display nickname is never substituted for the credential used to sign in. */
export function marketplaceNickname(login: string) {
  return login.trim().replace(/^@/, "").split("@")[0] || "Account";
}
export function marketplaceAccountName(account: { login: string; username?: string }) {
  return account.username || marketplaceNickname(account.login);
}
export function marketplaceAvatarUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    if (
      url.origin !== "https://i.simpalsmedia.com" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return "";
    const file = url.pathname.match(
      /^\/forum\.md\/avatars\/200x200\/((?:[a-f\d]{32}|[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12})\.(?:png|jpe?g|webp))$/i,
    )?.[1];
    return file && !file.startsWith("00000000-0000-0000-0000-000000000000.")
      ? url.href
      : "";
  } catch {
    return "";
  }
}
