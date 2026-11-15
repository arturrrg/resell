import { useCallback, useEffect, useRef, useState } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { activateOwner, watchInventoryChanges, type Device } from "./storage";
import {
  automaticSession,
  resolveWorkspace,
  takePrivateToken,
  openWorkspace,
  privateLink,
  parsePrivateToken,
} from "./workspace";
import { cloudConfigured, getSupabase } from "./supabase";
import {
  type CloudRow,
  type SyncState,
  hashedDevices,
  pendingChanges,
  readStore,
  mergeCloud,
} from "./sync-store";

export async function fetchCloud(client: SupabaseClient, owner: string) {
  const rows: CloudRow[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client
      .from("resell_records")
      .select("record_key,payload,deleted,content_hash,version")
      .eq("user_id", owner)
      .order("record_key")
      .range(offset, offset + 99);
    if (error)
      throw Error(
        error.code === "PGRST205"
          ? "The private inventory table has not been installed yet."
          : error.message,
      );
    for (const row of data || []) {
      if (
        typeof row.record_key !== "string" ||
        typeof row.content_hash !== "string" ||
        typeof row.deleted !== "boolean" ||
        (!row.deleted &&
          (!row.payload ||
            typeof row.payload.id !== "string" ||
            (row.payload.photos &&
              (!Array.isArray(row.payload.photos) ||
                row.payload.photos.some(
                  (p: unknown) => typeof p !== "string",
                )))))
      )
        throw Error(
          "A cloud record is invalid. Your local inventory is unchanged.",
        );
      rows.push(row as CloudRow);
    }
    if (!data || data.length < 100) break;
  }
  return rows;
}
const WORKSPACE_KEY = "resell.private-workspace.v1";
function cachedWorkspace() {
  try {
    const id = localStorage.getItem(WORKSPACE_KEY);
    return id && /^[a-f0-9-]{36}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
export function useCloudSync(onChanged: () => Promise<void>) {
  const [session, setSession] = useState<Session | null>(null),
    [workspace, setWorkspace] = useState<string | null>(cachedWorkspace),
    [ready, setReady] = useState(!cloudConfigured),
    [recovering, setRecovering] = useState(false),
    [syncing, setSyncing] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const request = useRef<() => void>(() => {}),
    connect = useRef<(token: string) => Promise<void>>(async () => {}),
    changed = useRef(onChanged);
  changed.current = onChanged;
  useEffect(() => {
    if (!cloudConfigured) return;
    let stopped = false,
      generation = 0,
      currentUser: string | undefined,
      currentSession: Session | null = null,
      activeWorkspace: string | null = null,
      accountDb: IDBDatabase | undefined,
      running = false,
      again = false,
      connecting = false,
      unsubscribe: (() => void) | undefined,
      pendingToken = takePrivateToken();
    async function sync() {
      if (running) {
        again = true;
        return;
      }
      if (
        stopped ||
        !currentSession ||
        !accountDb ||
        !activeWorkspace ||
        !navigator.onLine
      )
        return;
      running = true;
      setSyncing(true);
      const owner = activeWorkspace,
        db = accountDb,
        ticket = generation;
      try {
        const client = await getSupabase(),
          before = await hashedDevices(
            await readStore<Device[]>(db, "devices"),
          ),
          state = (await readStore<SyncState | undefined>(
            db,
            "meta",
            "cloud-state",
          )) || { id: "cloud-state", initialized: false, baseline: {} };
        const remote = await fetchCloud(client, owner);
        if (ticket !== generation || stopped) return;
        const changes = pendingChanges(before, state, remote);
        for (let offset = 0; offset < changes.length; offset += 20) {
          if (ticket !== generation || stopped) return;
          const { error } = await client.from("resell_records").upsert(
            changes
              .slice(offset, offset + 20)
              .map((row) => ({ ...row, user_id: owner })),
            { onConflict: "user_id,record_key" },
          );
          if (error) throw Error(error.message);
        }
        const latest = changes.length
          ? await fetchCloud(client, owner)
          : remote;
        if (ticket !== generation || stopped) return;
        await mergeCloud(db, before, latest);
        if (ticket === generation && !stopped) {
          setError("");
          await changed.current();
        }
      } catch (e) {
        if (ticket === generation && !stopped)
          setError(
            (e as Error).message + " Changes remain saved on this device.",
          );
      } finally {
        running = false;
        if (!stopped) setSyncing(false);
        if (again && !stopped) {
          again = false;
          void sync();
        }
      }
    }
    async function activate(next: Session, force = false) {
      if (stopped) return;
      currentSession = next;
      setSession(next);
      const userKey = next.user.id + ":" + !!next.user.is_anonymous;
      if (userKey === currentUser && !force) return;
      currentUser = userKey;
      const ticket = ++generation;
      setReady(false);
      setError("");
      accountDb = undefined;
      try {
        const client = await getSupabase();
        let owner: string;
        if (pendingToken && next.user.is_anonymous) {
          try {
            owner = await resolveWorkspace(client, pendingToken);
            setNotice(
              "Connected to the private inventory. Existing inventories on this browser were kept separately.",
            );
          } catch (e) {
            setNotice((e as Error).message);
            owner = await resolveWorkspace(client);
          }
          pendingToken = "";
        } else owner = await resolveWorkspace(client);
        const db = await openWorkspace(owner, next.user.id);
        if (stopped || ticket !== generation) return;
        activeWorkspace = owner;
        accountDb = db;
        activateOwner(owner);
        setWorkspace(owner);
        try {
          localStorage.setItem(WORKSPACE_KEY, owner);
        } catch {}
        await changed.current();
        setReady(true);
        if (running) again = true;
        else void sync();
      } catch (e) {
        if (!stopped && ticket === generation) {
          currentUser = undefined;
          setError((e as Error).message);
          // Never expose a previous account's cache when activation fails.
          setReady(false);
        }
      }
    }
    async function initialize() {
      if (connecting || stopped || !navigator.onLine) return;
      connecting = true;
      setError("");
      try {
        await activate(await automaticSession(await getSupabase()));
      } catch (e) {
        if (!stopped) {
          setError(
            (e as Error).message + " Records remain saved on this device.",
          );
          setReady(false);
        }
      } finally {
        connecting = false;
      }
    }
    request.current = () => {
      if (!currentSession || !accountDb) void initialize();
      else void sync();
    };
    connect.current = async (token: string) => {
      const client = await getSupabase(),
        next = await automaticSession(client);
      // Validate before changing anything, then activate with its resolved member
      // workspace. Never merge this browser's previous records into an invite.
      await resolveWorkspace(client, token);
      pendingToken = "";
      setNotice(
        "Connected to the private inventory. Previous inventories remain saved separately.",
      );
      await activate(next, true);
    };
    void getSupabase()
      .then((client) => {
        if (stopped) return;
        const subscription = client.auth.onAuthStateChange((event, next) => {
          if (event === "PASSWORD_RECOVERY") setRecovering(true);
          if (next) queueMicrotask(() => void activate(next));
          else if (event === "SIGNED_OUT") {
            generation++;
            currentSession = null;
            currentUser = undefined;
            accountDb = undefined;
            activeWorkspace = null;
            setSession(null);
            setWorkspace(null);
            setReady(false);
            setRecovering(false);
            activateOwner(null);
            queueMicrotask(() => void initialize());
          }
        });
        unsubscribe = () => subscription.data.subscription.unsubscribe();
        void initialize();
      })
      .catch((e) => {
        if (!stopped) {
          setError((e as Error).message);
          setReady(false);
        }
      });
    const wake = () => {
      if (document.visibilityState === "hidden") return;
      if (!currentSession || !accountDb) void initialize();
      else void sync();
    };
    const timer = setInterval(wake, 15000);
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    const stopWatching = watchInventoryChanges((name) => {
      if (name !== accountDb?.name) return;
      // Coalesce a burst of committed local edits. The transaction has already
      // completed before this event, so a failed request cannot lose the edits.
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        void changed.current().catch(() => {});
        request.current();
      }, 250);
    });
    window.addEventListener("online", wake);
    window.addEventListener("focus", wake);
    document.addEventListener("visibilitychange", wake);
    if (!navigator.onLine) { setReady(false); setError("You're offline. Connect to the internet to open your account."); }
    return () => {
      stopped = true;
      generation++;
      unsubscribe?.();
      clearInterval(timer);
      clearTimeout(saveTimer);
      stopWatching();
      window.removeEventListener("online", wake);
      window.removeEventListener("focus", wake);
      document.removeEventListener("visibilitychange", wake);
      request.current = () => {};
      connect.current = async () => {};
    };
  }, []);
  const requestSync = useCallback(() => request.current(), []);
  const connectLink = useCallback(async (value: string) => {
    const token = parsePrivateToken(value);
    if (!token) throw Error("Paste a valid private inventory link.");
    await connect.current(token);
  }, []);
  const createLink = useCallback(async () => {
    if (!workspace)
      throw Error("Connect to Supabase before creating a private link.");
    const key = "resell.private-link." + workspace;
    let token = "";
    try {
      token = localStorage.getItem(key) || "";
    } catch {}
    if (!/^[a-f0-9]{64}$/.test(token)) {
      const { data, error } = await (
        await getSupabase()
      ).rpc("resell_make_link");
      if (error) throw error;
      token = data;
      try {
        localStorage.setItem(key, token);
      } catch {}
    }
    const origin =
      (import.meta as any).env.VITE_PUBLIC_APP_URL || window.location.origin;
    return privateLink(token, origin);
  }, [workspace]);
  return {
    recovering,
    finishRecovery: () => setRecovering(false),
    session,
    workspace,
    ready,
    syncing,
    error,
    notice,
    requestSync,
    connectLink,
    createLink,
    configured: cloudConfigured,
  };
}
