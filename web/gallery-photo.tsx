import { useEffect, useState } from "react";
export function marketplaceThumbnail(value: string) {
  try {
    const url = new URL(value);
    if (
      url.protocol === "https:" &&
      url.hostname === "i.simpalsmedia.com" &&
      !url.username &&
      !url.password &&
      !url.port &&
      /^\/999\.md\/BoardImages\/\d+x\d+\/[a-f0-9-]+\.(jpg|jpeg|png|webp)$/i.test(
        url.pathname,
      )
    ) {
      url.pathname = url.pathname.replace(/\/\d+x\d+\//, "/320x240/");
      return url.href;
    }
  } catch {}
  return value;
}
export function GalleryPhoto({
  url,
  loadPreview,
  loadOriginal,
  alt,
  onFailed,
}: {
  url: string;
  loadPreview: boolean;
  loadOriginal: boolean;
  alt: string;
  onFailed: () => void;
}) {
  const preview = marketplaceThumbnail(url),
    same = preview === url;
  const [ready, setReady] = useState(false),
    [bad, setBad] = useState({ preview: false, original: false });
  useEffect(() => {
    if (bad.original && (same || bad.preview)) onFailed();
  }, [bad.original, bad.preview, same, onFailed]);
  if (same)
    return (
      <img
        src={loadPreview || loadOriginal ? url : undefined}
        alt={alt}
        decoding="async"
        loading="lazy"
        draggable={false}
        onError={onFailed}
      />
    );
  return (
    <span className="gallery-photo">
      {!bad.preview && (
        <img
          className="gallery-thumbnail"
          src={loadPreview ? preview : undefined}
          alt={ready ? "" : alt}
          aria-hidden={ready}
          fetchPriority="low"
          decoding="async"
          draggable={false}
          onError={() => setBad((old) => ({ ...old, preview: true }))}
        />
      )}
      {!bad.original && (
        <img
          className="gallery-original"
          style={{ opacity: ready ? 1 : 0 }}
          src={loadOriginal ? url : undefined}
          alt={ready ? alt : ""}
          aria-hidden={!ready}
          fetchPriority="high"
          decoding="async"
          draggable={false}
          onLoad={() => setReady(true)}
          onError={() => setBad((old) => ({ ...old, original: true }))}
        />
      )}
    </span>
  );
}
