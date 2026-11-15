import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X, Play, ImageOff } from "lucide-react";
import type { Video } from "./storage";
import { NativeCarousel, type NativeCarouselHandle } from "./native-carousel";
import { GalleryPhoto } from "./gallery-photo";
import { prepareImage } from "./media-cache";
import { useNearViewport } from "./near-viewport";
import { VideoPlayer, warmVideoConnections } from "./video-player";
import { useVideoWarmup } from "./video-preload";
import { useBackAction } from "./back-navigation";
const EMPTY: never[] = [];
type Media = { kind: "image"; url: string } | Video;
export function Gallery({
  photos = EMPTY,
  videos = EMPTY,
  title,
  active = true,
}: {
  photos?: string[];
  videos?: Video[];
  title: string;
  active?: boolean;
}) {
  const items: Media[] = useMemo(
    () => [
      ...photos.map((url) => ({ kind: "image" as const, url })),
      ...videos,
    ],
    [photos, videos],
  );
  const [index, setIndex] = useState(0),
    [open, setOpen] = useState(false),
    [failed, setFailed] = useState<Set<string>>(new Set());
  const viewport = useRef<HTMLDivElement>(null),
    cardCarousel = useRef<NativeCarouselHandle>(null),
    viewerCarousel = useRef<NativeCarouselHandle>(null),
    cardCounter = useRef<HTMLSpanElement>(null),
    viewerCounter = useRef<HTMLSpanElement>(null),
    dialog = useRef<HTMLDialogElement>(null),
    requested = useRef(new Set<string>()),
    previews = useRef(new Set<string>());
  const near = useNearViewport(viewport),
    count = items.length;
  useBackAction(open, () => setOpen(false));
  const selected = Math.min(index, Math.max(0, count - 1));
  const select = useCallback((next: number) => {
    setIndex(next);
  }, []);
  const showVisibleIndex = useCallback((next: number) => {
    const text = String(next + 1);
    for (const node of [cardCounter.current, viewerCounter.current])
      if (node && node.textContent !== text) node.textContent = text;
  }, []);
  const move = useCallback(
    (step: number) => {
      if (count < 2) return;
      (open ? viewerCarousel : cardCarousel).current?.move(step);
    },
    [count, open],
  );
  useEffect(() => {
    if (!near || !count) return;
    const controller = new AbortController();
    for (const offset of [0, 1, -1]) {
      const media = items[(selected + offset + count) % count],
        url = media.kind === "image" ? media.url : media.poster;
      if (url)
        void prepareImage(
          url,
          offset === 0 ? "high" : "auto",
          controller.signal,
        ).catch(() => {});
    }
    return () => controller.abort();
  }, [near, selected, items, count]);
  useEffect(() => {
    if (!open) return;
    dialog.current?.showModal();
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.current?.close();
      document.body.style.overflow = before;
      viewport.current
        ?.querySelector<HTMLElement>('[tabindex="0"]')
        ?.focus({ preventScroll: true });
    };
  }, [open]);
  const warmAllowed = useVideoWarmup(near && videos.length > 0);
  useEffect(() => {
    if (warmAllowed) warmVideoConnections();
  }, [warmAllowed]);
  function keys(event: React.KeyboardEvent) {
    if ((event.target as Element).closest(".video-player")) return;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      move(event.key === "ArrowRight" ? 1 : -1);
    }
  }
  function content(at: number, enlarged: boolean, clone: boolean) {
    const media = items[at],
      active = at === selected && !clone;
    if (!media || failed.has(media.url))
      return (
        <div className="media-empty">
          <ImageOff />
          <span>{media ? "Media unavailable" : "No media available"}</span>
        </div>
      );
    const distance = Math.min(
      Math.abs(at - selected),
      count - Math.abs(at - selected),
    );
    const url = media.kind === "image" ? media.url : media.poster;
    if (url && (near || open) && distance <= 2) requested.current.add(url);
    if (url && (near || open) && (count <= 18 || distance <= 4))
      previews.current.add(url);
    if (media.kind === "image")
      return (
        <GalleryPhoto
          key={media.url}
          url={media.url}
          loadPreview={previews.current.has(media.url)}
          loadOriginal={requested.current.has(media.url)}
          alt={title + ` — photo ${at + 1}`}
          onFailed={() => setFailed((old) => new Set(old).add(media.url))}
        />
      );
    if (
      enlarged &&
      !clone &&
      (active || (warmAllowed && videos.indexOf(media) < 3))
    )
      return (
        <VideoPlayer
          video={media}
          active={open && active}
          prewarm={warmAllowed}
        />
      );
    return (
      <>
        {url ? (
          <img
            src={requested.current.has(url) ? url : undefined}
            alt={title + " — video preview"}
            decoding="async"
            draggable={false}
          />
        ) : (
          <div className="video-placeholder" />
        )}
        <span className="video-play">
          <Play fill="currentColor" />
          <span>Watch video</span>
        </span>
      </>
    );
  }
  function controls(enlarged = false) {
    return count > 1 ? (
      <div className="media-controls">
        <button aria-label="Previous media" onClick={() => move(-1)}>
          <ChevronLeft />
        </button>
        <span aria-live="polite">
          <span ref={enlarged ? viewerCounter : cardCounter}>1</span>
          <span className="count-separator"> / </span>
          {count}
        </span>
        <button aria-label="Next media" onClick={() => move(1)}>
          <ChevronRight />
        </button>
      </div>
    ) : null;
  }
  return (
    <>
      <div className="gallery-wrap" onKeyDown={keys}>
        <div className="media-viewport" ref={viewport}>
          <NativeCarousel
            ref={cardCarousel}
            count={count}
            index={selected}
            direction={1}
            active={active && !open}
            onIndex={select}
            onVisibleIndex={showVisibleIndex}
            renderPage={(at, clone) => (
              <button
                className="media-open"
                tabIndex={at === selected && !clone ? 0 : -1}
                aria-label={
                  items[at]?.kind === "image" ? "Enlarge photo" : "Open video"
                }
                disabled={!count}
                onClick={() => {
                  select(at);
                  setOpen(true);
                }}
              >
                {content(at, false, clone)}
              </button>
            )}
          />
        </div>
        {controls()}
      </div>
      {(open || (warmAllowed && videos.length > 0)) &&
        createPortal(
          <dialog
            ref={dialog}
            className="media-dialog"
            style={{ width: "min(1120px, calc(100vw - 24px))" }}
            aria-label={title + " media viewer"}
            onCancel={() => setOpen(false)}
            onClick={(event) => {
              if (event.target === event.currentTarget) setOpen(false);
            }}
            onKeyDown={keys}
          >
            <div className="viewer-shell">
              <header className="viewer-header">
                <span>{title}</span>
                <button
                  className="icon-button"
                  aria-label="Close viewer"
                  onClick={() => setOpen(false)}
                >
                  <X />
                </button>
              </header>
              <div
                className="viewer-media"
                style={{ height: "clamp(160px, calc(100dvh - 150px), 720px)" }}
              >
                <NativeCarousel
                  ref={viewerCarousel}
                  className="viewer-swipe"
                  count={count}
                  index={selected}
                  direction={1}
                  active={open}
                  onIndex={select}
                  onVisibleIndex={showVisibleIndex}
                  renderPage={(at, clone) => (
                    <>
                      {items[at]?.kind === "image" &&
                        requested.current.has(items[at].url) && (
                          <img
                            className="media-backdrop"
                            src={items[at].url}
                            alt=""
                            aria-hidden="true"
                          />
                        )}
                      {content(at, true, clone)}
                    </>
                  )}
                />
              </div>
              <div className="viewer-footer">{controls(true)}</div>
            </div>
          </dialog>,
          document.body,
        )}
    </>
  );
}
