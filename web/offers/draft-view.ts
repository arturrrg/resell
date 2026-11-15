import type { OfferDraft, OfferPhoto } from "../../shared/offer-draft";

// Photo ids are immutable: editing/replacing a photo creates a new id. IDB
// clones blobs on every read; preserve their live references for unchanged ids.
export function retainOfferPhotos(
  before: OfferPhoto[],
  incoming: OfferPhoto[],
) {
  const byId = new Map(before.map((photo) => [photo.id, photo]));
  const next = incoming.map((photo) => {
    const old = byId.get(photo.id);
    return old &&
      old.name === photo.name &&
      old.type === photo.type &&
      old.blob.size === photo.blob.size
      ? old
      : photo;
  });
  return before.length === next.length &&
    next.every((photo, i) => photo === before[i])
    ? before
    : next;
}
export function reconcileOfferDrafts(
  before: OfferDraft[],
  incoming: OfferDraft[],
) {
  const byId = new Map(before.map((draft) => [draft.id, draft]));
  const next = incoming.map((draft) => {
    const old = byId.get(draft.id);
    if (!old) return draft;
    const photos = retainOfferPhotos(old.photos, draft.photos);
    const same =
      photos === old.photos &&
      [...new Set([...Object.keys(draft), ...Object.keys(old)])].every(
        (key) =>
          key === "photos" ||
          draft[key as keyof OfferDraft] === old[key as keyof OfferDraft] ||
          (["sale", "publications", "accountPrices"].includes(key) && JSON.stringify(draft[key as keyof OfferDraft]) === JSON.stringify(old[key as keyof OfferDraft])),
      );
    return same ? old : { ...draft, photos };
  });
  return before.length === next.length &&
    next.every((draft, i) => draft === before[i])
    ? before
    : next;
}

export function moveOfferPhoto<T>(photos: T[], from: number, to: number) {
  if (
    from < 0 ||
    from >= photos.length ||
    to < 0 ||
    to >= photos.length ||
    from === to
  )
    return photos;
  const next = [...photos],
    [photo] = next.splice(from, 1);
  next.splice(to, 0, photo);
  return next;
}
