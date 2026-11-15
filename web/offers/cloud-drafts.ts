import {
  newOffer,
  type OfferDraft,
  type OfferPhoto,
} from "../../shared/offer-draft";
import { getSupabase } from "../supabase";
import { offerState, templateFields } from "../../shared/offer-state";
import {
  acceptCloudDraft,
  clearOfferCleanup,
  offerSyncMetadata,
  savedDrafts,
  saveDraft,
  type OfferSyncMeta,
} from "./draft-store";
const BUCKET = "resell-offer-photos";
const UUID = /^[a-f0-9-]{36}$/;
type StoredPhoto = {
  id: string;
  name: string;
  type: string;
  bytes: number;
  sha: string;
  path: string;
};
export type StoredOffer = Omit<OfferDraft, "photos"> & {
  photos: StoredPhoto[];
};
type CloudOffer = {
  draft_id: string;
  payload: StoredOffer | null;
  deleted: boolean;
  content_hash: string;
  version: number;
};
const hashes = new WeakMap<Blob, Promise<string>>();
type SyncResult = {
  conflict: string;
  copies: { original: string; copy: string }[];
};
const running = new Map<string, Promise<SyncResult>>();
function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map(
          (key) =>
            JSON.stringify(key) +
            ":" +
            canonical((value as Record<string, unknown>)[key]),
        )
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
async function hash(bytes: BufferSource) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (n) => n.toString(16).padStart(2, "0"),
  ).join("");
}
export async function offerFingerprint(payload: unknown) {
  return hash(new TextEncoder().encode(canonical(payload)));
}
export async function storedOffer(
  draft: OfferDraft,
  owner: string,
): Promise<StoredOffer> {
  draft = templateFields(draft);
  const photos: StoredPhoto[] = [];
  for (const photo of draft.photos) {
    let pending = hashes.get(photo.blob);
    if (!pending) {
      pending = photo.blob.arrayBuffer().then(hash);
      hashes.set(photo.blob, pending);
    }
    const sha = await pending;
    photos.push({
      id: photo.id,
      name: photo.name,
      type: photo.type,
      bytes: photo.blob.size,
      sha,
      path: `${owner}/${draft.id}/${photo.id}-${sha.slice(0, 16)}.${photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg"}`,
    });
  }
  const fields = newOffer();
  for (const key of Object.keys(fields).filter((key) => key !== "photos"))
    (fields as unknown as Record<string, unknown>)[key] = (
      draft as unknown as Record<string, unknown>
    )[key];
  return { ...fields, ...offerState(draft), photos };
}
export function validateStoredOffer(
  input: unknown,
  owner: string,
  id: string,
): StoredOffer {
  if (
    !input ||
    typeof input !== "object" ||
    !UUID.test(owner) ||
    !UUID.test(id)
  )
    throw Error("Invalid cloud offer.");
  const source = input as Record<string, unknown>,
    draft = newOffer();
  if (
    source.id !== id ||
    source.version !== 1 ||
    !Array.isArray(source.photos) ||
    source.photos.length > 10
  )
    throw Error("Invalid cloud offer metadata.");
  for (const key of Object.keys(draft).filter(
    (key) => key !== "photos" && key !== "version",
  )) {
    if (key === "secondaryTitle" && source[key] === undefined) continue;
    const value = source[key],
      limit =
        key === "description"
          ? 2000
          : key === "title" || key === "secondaryTitle"
            ? 100
            : 150;
    if (typeof value !== "string" || value.length > limit)
      throw Error("Invalid cloud offer field.");
    (draft as unknown as Record<string, unknown>)[key] = value;
  }
  if (
    !["MDL", "EUR", "USD"].includes(draft.currency) ||
    !["ro", "ru"].includes(draft.language) ||
    !["new", "used"].includes(draft.condition) ||
    !["private", "shop"].includes(draft.sellerType)
  )
    throw Error("Invalid cloud offer choices.");
  let total = 0;
  const ids = new Set<string>();
  const photos = source.photos.map((raw) => {
    const photo = raw as StoredPhoto;
    if (
      !photo ||
      !UUID.test(photo.id) ||
      ids.has(photo.id) ||
      !["image/jpeg", "image/png", "image/webp"].includes(photo.type) ||
      !Number.isInteger(photo.bytes) ||
      photo.bytes <= 0 ||
      photo.bytes > 12 * 1024 * 1024 ||
      typeof photo.sha !== "string" ||
      !/^[a-f0-9]{64}$/.test(photo.sha) ||
      typeof photo.name !== "string" ||
      photo.name.length > 100 ||
      /[\\/\x00-\x1f]/.test(photo.name)
    )
      throw Error("Invalid cloud photo metadata.");
    ids.add(photo.id);
    total += photo.bytes;
    const extension =
      photo.type === "image/png"
        ? "png"
        : photo.type === "image/webp"
          ? "webp"
          : "jpg";
    if (
      photo.path !==
        `${owner}/${id}/${photo.id}-${photo.sha.slice(0, 16)}.${extension}` ||
      total > 25 * 1024 * 1024
    )
      throw Error("Invalid private photo path or size.");
    return {
      id: photo.id,
      name: photo.name,
      type: photo.type,
      bytes: photo.bytes,
      sha: photo.sha,
      path: photo.path,
    };
  });
  return { ...draft, ...offerState(source), photos };
}
export function syncPrivateOffers(owner: string): Promise<SyncResult> {
  const existing = running.get(owner);
  if (existing) return existing;
  const pending = sync(owner).finally(() => running.delete(owner));
  running.set(owner, pending);
  return pending;
}
async function sync(owner: string) {
  const client = await getSupabase(),
    session = await client.auth.getSession();
  if (session.error) throw session.error;
  if (
    !session.data.session ||
    session.data.session.user.is_anonymous ||
    session.data.session.user.id !== owner
  )
    throw Error("Offer sync requires the workspace account.");
  const rows: CloudOffer[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client
      .from("resell_offer_drafts")
      .select("draft_id,payload,deleted,content_hash,version")
      .eq("user_id", owner)
      .order("draft_id")
      .range(offset, offset + 99);
    if (error) throw error;
    rows.push(...(data as CloudOffer[]));
    if ((data || []).length < 100) break;
  }
  const drafts = new Map(
      (await savedDrafts(owner, true)).map((draft) => [draft.id, draft]),
    ),
    metadata = new Map(
      (await offerSyncMetadata(owner)).map((meta) => [meta.id, meta]),
    ),
    remote = new Map(rows.map((row) => [row.draft_id, row]));
  let conflict = "";
  const copies: SyncResult["copies"] = [];
  async function restore(row: CloudOffer, local: OfferDraft | undefined) {
    const expected = local?.updatedAt || null;
    if (row.deleted) {
      await acceptCloudDraft(
        owner,
        null,
        {
          id: row.draft_id,
          revision: row.version,
          fingerprint: row.content_hash,
          dirty: false,
          deleted: true,
          paths: [],
        },
        expected,
      );
      return;
    }
    const payload = validateStoredOffer(row.payload, owner, row.draft_id),
      photos: OfferPhoto[] = [];
    if ((await offerFingerprint(payload)) !== row.content_hash)
      throw Error("Cloud offer verification failed. Local drafts were kept.");
    for (const item of payload.kind === "template" ? [] : payload.photos) {
      const cached = local?.photos.find(
        (photo) => photo.id === item.id && photo.blob.size === item.bytes,
      );
      if (cached && (await cached.blob.arrayBuffer().then(hash)) === item.sha) {
        photos.push(cached);
        continue;
      }
      const { data, error } = await client.storage
        .from(BUCKET)
        .download(item.path);
      if (error || !data)
        throw error || Error("A private photo could not be downloaded.");
      if (
        data.size !== item.bytes ||
        (await data.arrayBuffer().then(hash)) !== item.sha
      )
        throw Error("A synced photo is incomplete. Local drafts were kept.");
      photos.push({
        id: item.id,
        name: item.name,
        type: item.type,
        blob: new Blob([data], { type: item.type }),
      });
    }
    await acceptCloudDraft(
      owner,
      { ...payload, photos },
      {
        id: row.draft_id,
        revision: row.version,
        fingerprint: row.content_hash,
        dirty: payload.kind === "template" && payload.photos.length > 0,
        deleted: false,
        paths: payload.photos.map((photo) => photo.path),
      },
      expected,
    );
  }
  for (const id of new Set([
    ...drafts.keys(),
    ...metadata.keys(),
    ...remote.keys(),
  ])) {
    const local = drafts.get(id),
      row = remote.get(id),
      meta: OfferSyncMeta = metadata.get(id) || {
        id,
        revision: 0,
        dirty: !!local,
      };
    let serialized = local ? await storedOffer(local, owner) : null;
    const localHash = serialized
      ? await offerFingerprint(serialized)
      : "deleted";
    if (
      row &&
      (!Number.isSafeInteger(row.version) ||
        row.version < 1 ||
        typeof row.deleted !== "boolean")
    )
      throw Error("Invalid cloud offer revision.");
    if (row && row.version !== meta.revision) {
      const changed = meta.dirty && localHash !== meta.fingerprint;
      if (changed && local && localHash !== row.content_hash) {
        const copy = {
          ...local,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await saveDraft(copy, owner);
        conflict =
          "This draft changed on another device. A separate copy of these edits was kept.";
        copies.push({ original: id, copy: copy.id });
      } else if (changed && meta.deleted && !row.deleted)
        conflict =
          "A draft changed on another device before deletion. The newer draft was kept.";
      await restore(row, local);
      continue;
    }
    if (meta.cleanup?.length) {
      const { error } = await client.storage.from(BUCKET).remove(meta.cleanup);
      if (!error) await clearOfferCleanup(owner, id, meta.cleanup);
    }
    if (!meta.dirty) continue;
    if (
      row &&
      localHash === row.content_hash &&
      !!meta.deleted === row.deleted
    ) {
      await acceptCloudDraft(
        owner,
        null,
        { ...meta, dirty: false },
        local?.updatedAt || null,
      );
      continue;
    }
    if (!local && !meta.deleted) continue;
    const oldPaths = new Set(meta.paths || []);
    if (serialized && !meta.deleted) {
      for (const photo of serialized.photos) {
        if (oldPaths.has(photo.path)) continue;
        const file = local!.photos.find((item) => item.id === photo.id)!;
        const { error } = await client.storage
          .from(BUCKET)
          .upload(photo.path, file.blob, {
            contentType: photo.type,
            cacheControl: "3600",
            upsert: false,
          });
        if (error && !/already exists|duplicate/i.test(error.message))
          throw error;
      }
    } else serialized = null;
    const { data, error } = await client.rpc("resell_save_offer", {
      p_id: id,
      p_payload: serialized,
      p_hash: localHash,
      p_deleted: !!meta.deleted,
      p_expected_version: meta.revision,
    });
    if (error) throw error;
    if (!data || !Number.isSafeInteger(data.version))
      throw Error("The cloud did not confirm this offer.");
    const paths = serialized?.photos.map((photo) => photo.path) || [],
      cleanup = [...new Set([...(meta.cleanup || []), ...oldPaths])].filter(
        (path) => !paths.includes(path),
      );
    await acceptCloudDraft(
      owner,
      meta.deleted ? null : local!,
      {
        id,
        revision: data.version,
        fingerprint: localHash,
        dirty: false,
        deleted: !!meta.deleted,
        paths,
        cleanup,
      },
      local?.updatedAt || null,
    );
    if (cleanup.length) {
      const { error: cleanupError } = await client.storage
        .from(BUCKET)
        .remove(cleanup);
      if (!cleanupError) await clearOfferCleanup(owner, id, cleanup);
    }
  }
  return { conflict, copies };
}
