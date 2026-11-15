import { memo, useMemo, useRef, useEffect, type PointerEvent } from "react";
import { profitChartPosition, profitChartY } from "./profit-chart-position";
import type { profitDashboard } from "./profit-dashboard";
const money = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
export const ProfitChart = memo(function ProfitChart({
  view,
}: {
  view: ReturnType<typeof profitDashboard>;
}) {
  const svg = useRef<SVGSVGElement>(null),
    guide = useRef<SVGGElement>(null),
    dot = useRef<SVGCircleElement>(null);
  const date = useRef<HTMLSpanElement>(null),
    amount = useRef<HTMLElement>(null);
  const frame = useRef(0),
    pointer = useRef<number | null>(null),
    latestX = useRef(0),
    selected = useRef(-1);
  const formatDate = (value: string) =>
    new Date(
      value.length === 7 ? value + "-15T12:00:00Z" : value + "T12:00:00Z",
    ).toLocaleDateString("en-GB", {
      day: view.monthly ? undefined : "numeric",
      month: "short",
      year: view.monthly ? "2-digit" : undefined,
    });
  const chart = useMemo(() => {
    const ys = profitChartY(view.points.map((p) => p.value));
    const points = view.points.map((p, i) => ({
      x:
        view.points.length === 1
          ? 320
          : 20 + (i / (view.points.length - 1)) * 600,
      y: ys[i],
    }));
    const line = points
      .map((p) => p.x.toFixed(2) + "," + p.y.toFixed(2))
      .join(" ");
    return { points, line, dates: view.points.map((p) => formatDate(p.date)) };
  }, [view]);
  const defaultDate = view.monthly
    ? "Monthly · up to 24 months"
    : "Daily · MDL";
  const reset = () => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    selected.current = -1;
    if (guide.current) guide.current.style.visibility = "hidden";
    if (date.current) date.current.textContent = defaultDate;
    if (amount.current)
      amount.current.textContent = money.format(view.total) + " MDL";
  };
  const paint = () => {
    frame.current = 0;
    const node = svg.current;
    if (!node) return;
    const bounds = node.getBoundingClientRect(),
      at = profitChartPosition(
        latestX.current,
        bounds.left,
        bounds.width,
        chart.points.length,
      );
    if (!at || !guide.current) return;
    const lo = Math.floor(at.position),
      hi = Math.min(chart.points.length - 1, lo + 1),
      fraction = at.position - lo;
    const y =
      chart.points[lo].y + (chart.points[hi].y - chart.points[lo].y) * fraction;
    guide.current.style.visibility = "visible";
    guide.current.setAttribute("transform", "translate(" + at.x + ",0)");
    dot.current?.setAttribute("cy", String(y));
    if (selected.current !== at.index) {
      selected.current = at.index;
      if (date.current) date.current.textContent = chart.dates[at.index];
      if (amount.current)
        amount.current.textContent =
          money.format(view.points[at.index].value) + " MDL";
    }
  };
  const track = (event: PointerEvent<SVGSVGElement>) => {
    if (event.pointerType !== "mouse" && pointer.current !== event.pointerId)
      return;
    latestX.current = event.clientX;
    if (!frame.current) frame.current = requestAnimationFrame(paint);
  };
  useEffect(() => {
    reset();
    return () => cancelAnimationFrame(frame.current);
  }, [view]);
  return (
    <section className="sales-trend" aria-label="Recorded profit over time">
      <header>
        <div>
          <h3>Profit over time</h3>
          <span ref={date}>{defaultDate}</span>
        </div>
        <strong ref={amount}>{money.format(view.total)} MDL</strong>
      </header>
      <div className="sales-plot">
        <svg
          ref={svg}
          viewBox="0 0 640 212"
          preserveAspectRatio="none"
          role="img"
          tabIndex={0}
          aria-label={
            view.total +
            " MDL recorded profit from " +
            view.known +
            " sales with recorded amounts"
          }
          aria-describedby="profit-chart-help"
          style={{ touchAction: "none" }}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            pointer.current = event.pointerId;
            event.currentTarget.setPointerCapture(event.pointerId);
            track(event);
          }}
          onPointerMove={track}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.releasePointerCapture(event.pointerId);
            pointer.current = null;
            if (event.pointerType !== "mouse") reset();
          }}
          onPointerCancel={() => {
            pointer.current = null;
            reset();
          }}
          onLostPointerCapture={() => {
            pointer.current = null;
            reset();
          }}
          onPointerLeave={() => {
            if (pointer.current === null) reset();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              reset();
              return;
            }
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
              return;
            event.preventDefault();
            const i =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? chart.points.length - 1
                  : Math.max(
                      0,
                      Math.min(
                        chart.points.length - 1,
                        (selected.current < 0 ? 0 : selected.current) +
                          (event.key === "ArrowRight" ? 1 : -1),
                      ),
                    );
            const b = event.currentTarget.getBoundingClientRect();
            latestX.current = b.left + (chart.points[i].x / 640) * b.width;
            paint();
          }}
          onBlur={reset}
        >
          <defs>
            <linearGradient id="resell-profit-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#75cda4" stopOpacity=".24" />
              <stop offset="100%" stopColor="#75cda4" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[34, 86, 138, 190].map((y) => (
            <line
              key={y}
              x1="20"
              x2="620"
              y1={y}
              y2={y}
              stroke="#ffffff0b"
              strokeDasharray="3 5"
            />
          ))}
          {chart.points.length > 1 && (
            <path
              d={"M20,190 L" + chart.line.replaceAll(" ", " L") + " L620,190 Z"}
              fill="url(#resell-profit-fill)"
            />
          )}
          <polyline
            points={chart.line}
            fill="none"
            stroke="#91d4b1"
            strokeWidth="2.5"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
          {chart.points.length === 1 && (
            <circle cx={320} cy={chart.points[0].y} r="4" fill="#b1ddc4" />
          )}
          <g
            ref={guide}
            className="profit-crosshair"
            style={{ visibility: "hidden", pointerEvents: "none" }}
          >
            <line
              x1="0"
              x2="0"
              y1="20"
              y2="190"
              stroke="#ffffff50"
              vectorEffect="non-scaling-stroke"
            />
            <circle ref={dot} cx="0" cy="0" r="4" fill="#d5f0df" />
          </g>
        </svg>
        {!view.sold.length && (
          <div className="sales-plot-empty">
            <span>No completed sales in this period</span>
          </div>
        )}
      </div>
      <p id="profit-chart-help" className="sr-only">
        Hold and drag to inspect profit. With a keyboard, use the arrow keys.
      </p>
      <div className="sales-chart-labels">
        {[
          ...new Set([
            0,
            Math.floor((view.points.length - 1) / 2),
            view.points.length - 1,
          ]),
        ].map((at, i) => (
          <span key={i}>{chart.dates[at] || ""}</span>
        ))}
      </div>
    </section>
  );
});
