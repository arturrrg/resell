import { useLanguage, localeFor } from "./i18n";
import { useState } from "react";
import { LoaderCircle, RotateCw, Clock3 } from "lucide-react";
import type { Device } from "./storage";
import { Sheet } from "./sheet";
import { SOURCE_REFRESH_INTERVAL } from "../shared/refresh";
const date = (value?: string) =>
  value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString(localeFor())
    : "Not checked yet";
export function SourceStatus({
  device,
  refreshing,
  onRetry,
}: {
  device: Device;
  refreshing: boolean;
  onRetry: (device: Device) => void;
}) {
  useLanguage();
  const [open, setOpen] = useState(false);
  if (!refreshing && !device.sourceRefreshError) return null;
  const checkedTime = Date.parse(device.sourceCheckedAt || "");
  const next =
    device.sourceRefreshRetryAt ||
    (Number.isFinite(checkedTime)
      ? new Date(checkedTime + SOURCE_REFRESH_INTERVAL).toISOString()
      : undefined);
  return (
    <>
      <button
        className={refreshing ? "source-status" : "source-status needs-retry"}
        aria-label={refreshing ? "Updating listing" : "Listing update details"}
        title={refreshing ? "Updating from 999.md" : device.sourceRefreshError}
        onClick={() => setOpen(true)}
      >
        {refreshing ? <LoaderCircle className="spinning" /> : <RotateCw />}
      </button>
      {open && (
        <Sheet
          title="Listing update"
          onClose={() => setOpen(false)}
          className="source-diagnostics"
        >
          <p className="source-diagnostic-title">
            {device.model || device.title}
          </p>
          <p className="source-diagnostic-error">
            {refreshing
              ? "Checking the public listing…"
              : device.sourceRefreshError}
          </p>
          <dl>
            {device.sourceLastFailureAt && (
              <div>
                <dt>Last failed attempt</dt>
                <dd>{date(device.sourceLastFailureAt)}</dd>
              </div>
            )}
            <div>
              <dt>Last successful check</dt>
              <dd>{date(device.sourceCheckedAt)}</dd>
            </div>
            <div>
              <dt>Next automatic attempt</dt>
              <dd>{date(next)}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{device.listingUrl || "No source link"}</dd>
            </div>
          </dl>
          <p className="sheet-note">
            <Clock3 />
            Automatic checks run while Resell is open and online. Saved details
            stay available if the source refuses the request.
          </p>
          <button
            className="account-primary"
            disabled={refreshing}
            onClick={() => {
              onRetry(device);
              setOpen(false);
            }}
          >
            <RotateCw />
            Try again
          </button>
        </Sheet>
      )}
    </>
  );
}
