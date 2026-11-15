import { MAX_OFFER_BYTES, MAX_OFFER_PHOTOS, type OfferPhoto } from "../../shared/offer-draft";
import { changeDraftState } from "./draft-store";

export async function saveCameraPhoto(owner: string, draftId: string, photo: OfferPhoto) {
  return changeDraftState(draftId, owner, draft => {
    if (draft.kind === "template" || draft.sale) throw Error("This draft no longer accepts photos.");
    if (draft.photos.some(existing => existing.id === photo.id)) return draft;
    if (draft.photos.length >= MAX_OFFER_PHOTOS) throw Error("Remove a photo before adding another camera photo.");
    if (draft.photos.reduce((size, existing) => size + existing.blob.size, photo.blob.size) > MAX_OFFER_BYTES) {
      throw Error("Keep the prepared photos below 25 MB in total.");
    }
    return { ...draft, photos: [...draft.photos, photo] };
  });
}
