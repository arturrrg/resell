import { memo } from "react";
import { ArrowUpRight, Trash2, RotateCw, LoaderCircle } from "lucide-react";
import type { Device } from "./storage";
import { identity } from "./storage";
import { Gallery } from "./gallery";
import { Price, Characteristics } from "./card-info";
import type { ExchangeRates } from "../shared/exchange";
import { ProfitEditor } from "./profit-editor";
import { SourceStatus } from "./source-status";
function profileUrl(value?: string) {
  try {
    const url = new URL(value || "");
    return url.protocol === "https:" &&
      url.hostname === "999.md" &&
      !url.username &&
      !url.password &&
      !url.port &&
      /^\/(?:ro|ru|en)\/profile\/[^/]+\/?$/.test(url.pathname)
      ? url.href
      : "";
  } catch {
    return "";
  }
}
export const DeviceCard = memo(function DeviceCard({
  device: d,
  rates,
  refreshing,
  onRetry,
  onDelete,
  onError,
  onSaved,
  readOnly = false,
}: {
  readOnly?: boolean;
  device: Device;
  rates: ExchangeRates | null;
  refreshing: boolean;
  onRetry: (d: Device) => void;
  onDelete: (d: Device) => void;
  onError: (message: string) => void;
  onSaved: () => Promise<void>;
}) {
  async function openSource(e: React.MouseEvent<HTMLAnchorElement>) {
    if (!(window as any).__TAURI_INTERNALS__) return;
    e.preventDefault();
    const href = e.currentTarget.href;
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(href);
    } catch {
      onError("Could not open your browser.");
    }
  }
  return (
    <article id={d.id} aria-busy={refreshing}>
      <Gallery
        photos={d.photos}
        videos={d.videos}
        title={d.model || d.title || "Device"}
      />
      <div className="card-body">
        <small>{d.brand || "Device"}</small>
        <h2>{d.model || d.title || "Imported device"}</h2>
        <p className="metadata">
          {[
            d.storage,
            d.color,
            d.condition,
            d.batteryHealth ? `${d.batteryHealth}% battery` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Specifications not provided"}
        </p>
        <Price amount={d.sourcePrice} currency={d.currency} rates={rates} />
        <Characteristics device={d} />
        {d.listingDescription && (
          <section className="description-block">
            <h3>Description</h3>
            <p className="description">{d.listingDescription}</p>
          </section>
        )}
        <footer>
          {identity(d.listingUrl || "") && (
            <>
              <div className="source-meta">
                <a
                  href={d.listingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={openSource}
                >
                  999.md <ArrowUpRight />
                </a>
                {d.sellerName && (
                  <>
                    <span className="source-dot">·</span>
                    {profileUrl(d.sellerUrl) ? (
                      <a
                        className="seller-name"
                        href={profileUrl(d.sellerUrl)}
                        title={d.sellerName}
                        aria-label={`Seller: ${d.sellerName}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={openSource}
                      >
                        {d.sellerName}
                      </a>
                    ) : (
                      <span className="seller-name" title={d.sellerName}>
                        {d.sellerName}
                      </span>
                    )}
                  </>
                )}
              </div>
            </>
          )}
          {!readOnly && (
            <SourceStatus
              device={d}
              refreshing={refreshing}
              onRetry={onRetry}
            />
          )}
        </footer>
      </div>
    </article>
  );
});
