import { useState, useMemo, memo } from "react";
import { Undo2, ArrowUpRight, Package, TrendingUp } from "lucide-react";
import type { Device } from "./storage";
import { saveSaleDetails } from "./storage";
import { saleTime } from "./sales";
import { profitDashboard, type ProfitRange } from "./profit-dashboard";
import { ProfitChart } from "./profit-chart";
import "./sales-page.css";
const moneyFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});
const money = (n: number) => moneyFormat.format(n);
export const SalesPage = memo(function SalesPage({
  devices,
  onSaved,
  onError,
  onUndoOffer,
}: {
  devices: Device[];
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
  onUndoOffer?: (device: Device) => Promise<void>;
}) {
  const [working, setWorking] = useState(""),
    [range, setRange] = useState<ProfitRange>("30d");
  const view = useMemo(() => profitDashboard(devices, range), [devices, range]);
  return (
    <section
      className="sales-dashboard sales-workspace"
      aria-label="Sales and profit"
    >
      <h1 className="sales-page-title">
        Sales<span>.</span>
      </h1>
      <div className="sales-period" aria-label="Sales period">
        {(
          [
            ["30d", "30 days"],
            ["90d", "90 days"],
            ["all", "All time"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            aria-pressed={range === id}
            onClick={() => {
              setRange(id);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <section className="sales-hero">
        <div className="sales-eyebrow">
          <span className="sales-live-dot" />
          Recorded profit
        </div>
        <div className="sales-total">
          {money(view.total)}
          <span>MDL</span>
        </div>
        <div className="sales-hero-note">
          <TrendingUp />
          <span>
            {range === "all"
              ? "Across completed sales"
              : `Over the last ${range === "30d" ? "30" : "90"} days`}
          </span>
        </div>
      </section>
      <div className="sales-metrics">
        <div>
          <span>Devices sold</span>
          <strong>
            {view.sold.length}
            <Package />
          </strong>
        </div>
        <div>
          <span>Average profit</span>
          <strong>
            {money(view.average)}
            <small>MDL</small>
          </strong>
        </div>
        <div>
          <span>Best sale</span>
          <strong>
            {money(view.best)}
            <small>MDL</small>
          </strong>
        </div>
      </div>
      <ProfitChart view={view} />
      <div className="sales-ledger-title">
        <h3>Recent sales</h3>
        <span>
          {view.missing
            ? `${view.missing} missing profit`
            : view.sold.length + " completed"}
        </span>
      </div>
      <div className="sales-ledger">
        {view.sold.length ? (
          view.sold.map((d) => (
            <div className="sales-ledger-row" key={d.id}>
              <div className="sales-device-icon">
                <ArrowUpRight />
              </div>
              <div className="sales-device-name">
                <strong>{d.model || d.title || "Device"}</strong>
                <span>
                  {new Date(saleTime(d)).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
              <strong className="sales-ledger-profit">
                {Number.isFinite(d.soldProfit ?? d.expectedProfit)
                  ? money(d.soldProfit ?? d.expectedProfit ?? 0)
                  : "—"}
                <small>MDL</small>
              </strong>
              {!d.closedOffer && <button
                className="sales-return"
                aria-label={`Return ${d.model || d.title || "device"} to ${d.offerDraftId ? "offers" : "inventory"}`}
                title={d.offerDraftId ? "Undo sale" : "Return to inventory"}
                disabled={!!working}
                onClick={async () => {
                  setWorking(d.id);
                  try {
                    if (d.offerDraftId && onUndoOffer) await onUndoOffer(d);
                    else await saveSaleDetails(
                      d.id,
                      "in_progress",
                      d.expectedProfit,
                    );
                    await onSaved();
                  } catch (error) {
                    onError((error as Error).message);
                  } finally {
                    setWorking("");
                  }
                }}
              >
                <Undo2 />
              </button>}
            </div>
          ))
        ) : (
          <p className="sales-ledger-empty">
            Completed devices and their recorded profit appear here.
          </p>
        )}
      </div>
    </section>
  );
});
