import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type CSSProperties,
} from "react";
import {
  Play,
  Pause,
  RotateCcw,
  LoaderCircle,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
} from "lucide-react";
import type { Video } from "./storage";
import { useBackAction } from "./back-navigation";

export function warmVideoConnections() {
  for (const href of [
    "https://player.vimeo.com",
    "https://i.vimeocdn.com",
    "https://f.vimeocdn.com",
  ]) {
    if (document.head.querySelector(`link[rel="preconnect"][href="${href}"]`))
      continue;
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = href;
    link.crossOrigin = "anonymous";
    document.head.append(link);
  }
  void import("@vimeo/player").catch(() => {});
}
function clock(seconds: number) {
  const value = Math.floor(Math.max(0, seconds || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}
export function VideoPlayer({
  video,
  active,
  prewarm = false,
}: {
  video: Video;
  active: boolean;
  prewarm?: boolean;
}) {
  const frame = useRef<HTMLIFrameElement>(null),
    native = useRef<HTMLVideoElement>(null),
    player = useRef<import("@vimeo/player").default | null>(null),
    activeRef = useRef(active),
    container = useRef<HTMLDivElement>(null),
    metadataReady = useRef(false),
    prewarmRef = useRef(prewarm);
  activeRef.current = active;
  prewarmRef.current = prewarm;
  const isVimeo = !!video.embedUrl?.startsWith("https://player.vimeo.com/"),
    custom = isVimeo || video.kind === "video";
  const [box, setBox] = useState({ width: 1120, height: 720 }),
    [ratio, setRatio] = useState(16 / 9),
    [ready, setReady] = useState(false),
    [blocked, setBlocked] = useState(false),
    [failed, setFailed] = useState(false),
    [playing, setPlaying] = useState(false),
    [buffering, setBuffering] = useState(false),
    [ended, setEnded] = useState(false),
    [muted, setMuted] = useState(true),
    [seconds, setSeconds] = useState(0),
    [duration, setDuration] = useState(0),
    [fullscreen, setFullscreen] = useState(false),
    [expanded, setExpanded] = useState(false);
  useBackAction(
    expanded || fullscreen,
    () => {
      setExpanded(false);
      if (document.fullscreenElement) void document.exitFullscreen();
    },
    120,
  );
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width && entry.contentRect.height)
        setBox({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
    });
    observer.observe(container.current);
    const changed = () =>
      setFullscreen(document.fullscreenElement === container.current);
    document.addEventListener("fullscreenchange", changed);
    return () => {
      observer.disconnect();
      document.removeEventListener("fullscreenchange", changed);
    };
  }, []);
  const frameWidth = Math.min(box.width, box.height * ratio),
    frameHeight = frameWidth / ratio,
    frameStyle = { width: frameWidth, height: frameHeight };
  const start = useCallback(async () => {
    if (isVimeo && !metadataReady.current) return;
    setBlocked(false);
    try {
      if (player.current) await player.current.play();
      else if (native.current) await native.current.play();
    } catch {
      setBlocked(true);
    }
  }, [isVimeo]);
  const onPlaying = useCallback(() => {
    setReady(true);
    setPlaying(activeRef.current);
    setEnded(false);
    setBlocked(false);
    setBuffering(false);
    if (!activeRef.current) {
      const instance = player.current;
      if (instance)
        void instance
          .pause()
          .then(async () => {
            if (!activeRef.current) await instance.setCurrentTime(0);
            if (activeRef.current) await instance.play();
          })
          .catch(() => {});
      if (native.current) {
        native.current.pause();
        native.current.currentTime = 0;
      }
    }
  }, []);
  useEffect(() => {
    if (!isVimeo || !frame.current) return;
    let disposed = false;
    let instance: import("@vimeo/player").default | undefined;
    void import("@vimeo/player")
      .then(async ({ default: Player }) => {
        if (disposed || !frame.current) return;
        instance = new Player(frame.current);
        player.current = instance;
        instance.on("playing", () => {
          if (!disposed) onPlaying();
        });
        instance.on("pause", () => {
          if (!disposed) setPlaying(false);
        });
        instance.on("ended", () => {
          if (!disposed) {
            setEnded(true);
            setPlaying(false);
          }
        });
        instance.on("bufferstart", () => {
          if (!disposed) setBuffering(true);
        });
        instance.on("bufferend", () => {
          if (!disposed) setBuffering(false);
        });
        instance.on(
          "timeupdate",
          (event: { seconds: number; duration: number }) => {
            if (!disposed) {
              setSeconds(event.seconds);
              setDuration(event.duration);
            }
          },
        );
        instance.on("volumechange", () => {
          void instance
            ?.getMuted()
            .then((value) => {
              if (!disposed) setMuted(value);
            })
            .catch(() => {});
        });
        instance.on("error", () => {
          if (!disposed) setFailed(true);
        });
        try {
          await instance.ready();
          // Thumbnails can be landscape crops of portrait videos. Keep them blurred
          // and learn the real video shape before starting visible playback.
          const [width, height, length] = await Promise.all([
            instance.getVideoWidth(),
            instance.getVideoHeight(),
            instance.getDuration(),
          ]);
          if (disposed) return;
          if (width > 0 && height > 0) {
            setRatio(width / height);
          }
          setDuration(length);
          metadataReady.current = true;
          if (activeRef.current || prewarmRef.current) void start();
        } catch {
          if (!disposed) setFailed(true);
        }
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });
    return () => {
      disposed = true;
      player.current = null;
      void instance?.destroy().catch(() => {});
    };
  }, [isVimeo, video.url, start, onPlaying]);
  useEffect(() => {
    if (active) void start();
    else {
      void player.current?.pause().catch(() => {});
      native.current?.pause();
    }
  }, [active, start]);
  async function togglePlayback() {
    if (playing) {
      if (player.current) await player.current.pause().catch(() => {});
      else native.current?.pause();
    } else {
      if (ended) {
        if (player.current)
          await player.current.setCurrentTime(0).catch(() => {});
        else if (native.current) native.current.currentTime = 0;
      }
      setEnded(false);
      await start();
    }
  }
  function seek(value: number) {
    setSeconds(value);
    setEnded(false);
    if (player.current)
      void player.current.setCurrentTime(value).catch(() => {});
    else if (native.current) native.current.currentTime = value;
  }
  async function toggleSound() {
    const next = !muted;
    try {
      if (player.current) await player.current.setMuted(next);
      else if (native.current) native.current.muted = next;
      setMuted(next);
    } catch {
      /* Some mobile browsers require another gesture for sound. */
    }
  }
  async function toggleFullscreen() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (container.current?.requestFullscreen) {
        await container.current.requestFullscreen();
        if (!document.fullscreenElement) setExpanded(true);
      } else setExpanded(true);
    } catch {
      // Embedded browsers may disable the Fullscreen API; expand within the app.
      setExpanded(true);
    }
  }
  let src = video.embedUrl;
  if (src) {
    const url = new URL(src);
    url.searchParams.set("muted", "1");
    url.searchParams.set("playsinline", "1");
    if (isVimeo) {
      // The host applies its own account and embedding permissions to these options.
      url.searchParams.set("controls", "0");
      url.searchParams.set("autopause", "0");
      url.searchParams.set("title", "0");
      url.searchParams.set("byline", "0");
      url.searchParams.set("portrait", "0");
    } else if (url.hostname.includes("youtube")) {
      url.searchParams.set("autoplay", active ? "1" : "0");
      url.searchParams.set("mute", "1");
    }
    src = url.href;
  }
  return (
    <div
      ref={container}
      className={`video-player ${ready ? "is-ready" : ""} ${ended ? "has-ended" : ""} ${custom ? "has-custom-controls" : ""} ${expanded ? "is-expanded" : ""}`}
    >
      {video.poster && (
        <img
          className="video-background"
          src={video.poster}
          alt=""
          aria-hidden="true"
        />
      )}
      {video.kind === "embed" && src ? (
        <iframe
          ref={frame}
          style={frameStyle}
          src={src}
          title="Listing video"
          tabIndex={custom ? -1 : 0}
          aria-hidden={custom || undefined}
          inert={custom || undefined}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => {
            if (!isVimeo) setReady(true);
          }}
        />
      ) : (
        <video
          ref={native}
          style={frameStyle}
          src={video.url}
          autoPlay={active}
          muted
          playsInline
          preload="auto"
          onLoadedMetadata={(e) => {
            const media = e.currentTarget;
            if (media.videoWidth > 0 && media.videoHeight > 0) {
              setRatio(media.videoWidth / media.videoHeight);
            }
            setDuration(media.duration);
            if (prewarmRef.current) void start();
          }}
          onPlaying={onPlaying}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setSeconds(e.currentTarget.currentTime)}
          onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
          onWaiting={() => setBuffering(true)}
          onEnded={() => {
            setEnded(true);
            setPlaying(false);
          }}
          onError={() => setFailed(true)}
        />
      )}
      {custom && ready && !failed && (
        <button
          className="video-stage-toggle"
          aria-label="Toggle playback"
          onClick={() => void togglePlayback()}
          tabIndex={-1}
        />
      )}
      {active && (failed || blocked || ended || !ready || buffering) && (
        <div className="video-loading-cover">
          {failed ? (
            <a href={video.url} target="_blank" rel="noreferrer">
              Open video on source
            </a>
          ) : blocked || ended ? (
            <button
              aria-label={ended ? "Replay video" : "Start video"}
              onClick={() => void togglePlayback()}
            >
              {ended ? <RotateCcw /> : <Play fill="currentColor" />}
            </button>
          ) : (
            <LoaderCircle className="spinning" aria-label="Loading video" />
          )}
        </div>
      )}
      {custom && active && !failed && (
        <div
          className="playback-controls"
          role="group"
          aria-label="Video playback"
        >
          <button
            aria-label={ended ? "Replay" : playing ? "Pause" : "Play"}
            onClick={() => void togglePlayback()}
          >
            {ended ? (
              <RotateCcw />
            ) : playing ? (
              <Pause fill="currentColor" />
            ) : (
              <Play fill="currentColor" />
            )}
          </button>
          <span className="playback-time">{clock(seconds)}</span>
          <input
            className="playback-seek"
            type="range"
            min="0"
            max={duration || 1}
            step="0.1"
            value={seconds}
            aria-label="Video position"
            aria-valuetext={`${clock(seconds)} of ${clock(duration)}`}
            disabled={!duration}
            style={
              {
                "--played": `${duration ? (seconds / duration) * 100 : 0}%`,
              } as CSSProperties
            }
            onChange={(e) => seek(Number(e.target.value))}
          />
          <span className="playback-time">{clock(duration)}</span>
          <button
            aria-label={muted ? "Unmute" : "Mute"}
            onClick={() => void toggleSound()}
          >
            {muted ? <VolumeX /> : <Volume2 />}
          </button>
          <button
            aria-label={
              fullscreen || expanded ? "Exit fullscreen" : "Enter fullscreen"
            }
            onClick={() => void toggleFullscreen()}
          >
            {fullscreen || expanded ? <Minimize /> : <Maximize />}
          </button>
        </div>
      )}
    </div>
  );
}
