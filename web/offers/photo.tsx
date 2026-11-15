import { useEffect, useState } from "react";
import type { OfferPhoto } from "../../shared/offer-draft";
const thumbnails = new WeakMap<Blob, Promise<Blob>>();
let thumbnailWork = 0;
const thumbnailQueue: (() => void)[] = [];
export function warmOfferThumbnail(blob: Blob) {
  let pending = thumbnails.get(blob);
  if (pending) return pending;
  pending = (async () => {
    if (thumbnailWork >= 2)
      await new Promise<void>((resolve) => thumbnailQueue.push(resolve));
    thumbnailWork++;
    try {
      const bitmap = await createImageBitmap(blob, {
        resizeWidth: 340,
        resizeQuality: "low",
        imageOrientation: "from-image",
      });
      try {
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
        return await canvas.convertToBlob({
          type: "image/jpeg",
          quality: 0.82,
        });
      } finally {
        bitmap.close();
      }
    } catch {
      return blob;
    } finally {
      thumbnailWork--;
      thumbnailQueue.shift()?.();
    }
  })();
  thumbnails.set(blob, pending);
  return pending;
}

export function OfferPhotoImage({
  photo,
  className = "",
  full = false,
}: {
  photo: OfferPhoto;
  className?: string;
  full?: boolean;
}) {
  const [url, setUrl] = useState(""),
    [original, setOriginal] = useState(false);
  useEffect(() => {
    let cancelled = false,
      source = "";
    const fallback = setTimeout(() => {
      if (!cancelled && !source) { source = URL.createObjectURL(photo.blob); setUrl(source); }
    }, 1000);
    void (
      full || original ? Promise.resolve(photo.blob) : warmOfferThumbnail(photo.blob)
    ).then((blob) => {
      if (cancelled) return;
      clearTimeout(fallback);
      // Keep an already displayed original rather than replacing it after a slow decode.
      if (source) return;
      source = URL.createObjectURL(blob);
      setUrl(source);
    });
    return () => {
      cancelled = true;
      clearTimeout(fallback);
      if (source) URL.revokeObjectURL(source);
    };
  }, [photo.blob, full, original]);
  return (
    <img
      className={className}
      src={url || undefined}
      style={url ? undefined : { visibility: "hidden" }}
      onError={() => { if (!original) setOriginal(true); }}
      alt={photo.name}
      draggable={false}
      decoding="async"
    />
  );
}

export async function prepareOfferPhoto(file: File): Promise<OfferPhoto> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw Error("Choose JPEG, PNG or WebP photos.");
  if (file.size > 12 * 1024 * 1024)
    throw Error(`${file.name} is larger than 12 MB.`);
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  try {
    if (
      !bitmap.width ||
      !bitmap.height ||
      bitmap.width * bitmap.height > 80_000_000
    )
      throw Error("Choose a photo smaller than 80 megapixels.");
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context)
      throw Error("Photo preparation is unavailable on this device.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(Error("The photo could not be prepared.")),
        "image/jpeg",
        0.92,
      ),
    );
    canvas.width = canvas.height = 1;
    return {
      id: crypto.randomUUID(),
      name: file.name.replace(/\.[^.]+$/, "") + ".jpg",
      type: "image/jpeg",
      blob,
    };
  } finally {
    bitmap.close();
  }
}
