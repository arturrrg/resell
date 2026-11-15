import type { SupabaseClient, Session } from "@supabase/supabase-js";
import { databaseForOwner } from "./storage";
import { seedAccount } from "./sync-store";
const TOKEN = /^[a-f0-9]{64}$/;
export function parsePrivateToken(value: string) {
  try {
    const url = new URL(value);
    const token = new URLSearchParams(url.hash.slice(1)).get("workspace") || "";
    return TOKEN.test(token) ? token : "";
  } catch {
    return "";
  }
}
export function takePrivateToken() {
  const token = parsePrivateToken(window.location.href);
  if (token) {
    const url = new URL(window.location.href);
    url.hash = "";
    window.history.replaceState(window.history.state, "", url.href);
  }
  return token;
}
export function privateLink(token: string, origin: string) {
  if (!TOKEN.test(token)) throw Error("Invalid private link.");
  const url = new URL(origin);
  if (
    url.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(url.hostname)
  )
    throw Error("A private link must use HTTPS.");
  url.pathname = "/";
  url.search = "";
  url.hash = "workspace=" + token;
  return url.href;
}
export async function automaticSession(
  client: SupabaseClient,
): Promise<Session> {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (data.session) return data.session;
  const result = await client.auth.signInAnonymously();
  if (result.error) throw result.error;
  if (!result.data.session)
    throw Error(
      "Could not establish private storage. Your records remain on this device.",
    );
  return result.data.session;
}
export async function resolveWorkspace(client: SupabaseClient, token = "") {
  const { data, error } = token
    ? await client.rpc("resell_connect_link", { token })
    : await client.rpc("resell_current_workspace");
  if (error) throw Error(error.message);
  if (typeof data !== "string" || !/^[a-f0-9-]{36}$/.test(data))
    throw Error("Private storage did not return a valid workspace.");
  return data;
}
export function openWorkspace(workspace: string, sessionUser: string) {
  // An invitation only opens its cloud workspace. It must never upload a
  // visitor's pre-existing local inventory to the person who sent the link.
  return workspace === sessionUser
    ? seedAccount(workspace)
    : databaseForOwner(workspace);
}
