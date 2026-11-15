import type { Device } from "./storage";
import { convertMdl, freshRates, type ExchangeRates } from "../shared/exchange";
const number = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const rounded = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const rateDate = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Chisinau", dateStyle: "medium", timeStyle: "short" });
export function Price({
  amount,
  currency,
  rates,
}: {
  amount?: number;
  currency?: string;
  rates: ExchangeRates | null;
}) {
  const mdl = ["MDL", "LEI"].includes((currency || "").toUpperCase());
  const converted =
    mdl && amount != null && freshRates(rates)
      ? convertMdl(amount, rates)
      : null;
  const info = rates
    ? `Approximate · maib cash selling rates · effective ${rates.date} · checked ${rateDate.format(new Date(rates.fetchedAt))} · 1 EUR = ${rates.mdlPerEur} MDL · 1 USD = ${rates.mdlPerUsd} MDL · before fees${rates.stale ? " · last available rates" : ""}`
    : undefined;
  return (
    <div className="prices">
      <strong>
        {amount != null ? `${number.format(amount)} ${currency || ""}` : "—"}
      </strong>
      {mdl && (
        <small
          className="converted-price"
          title={info}
          aria-label={
            converted
              ? `${info}. Approximately ${rounded.format(converted.eur)} euros and ${rounded.format(converted.usd)} US dollars.`
              : undefined
          }
        >
          {converted
            ? `≈ ${rounded.format(converted.eur)} € / ${rounded.format(converted.usd)} $`
            : ""}
        </small>
      )}
    </div>
  );
}
export function Characteristics({ device }: { device: Device }) {
  const fallback = [
    ["Brand", device.brand],
    ["Model", device.model],
    ["Device type", device.deviceType],
    ["Storage", device.storage],
    ["Colour", device.color],
    ["Condition", device.condition],
    [
      "Battery health",
      device.batteryHealth !== "" && device.batteryHealth != null
        ? `${device.batteryHealth}%`
        : null,
    ],
  ];
  const fields = device.characteristics?.length
    ? device.characteristics
    : fallback
        .filter(([, value]) => value != null && value !== "")
        .map(([label, value]) => ({
          label: String(label),
          value: String(value),
        }));
  if (!fields.length) return null;
  return (
    <section className="characteristics-block">
      <h3>Specifications</h3>
      <dl className="characteristics-list">
        {fields.map(({ label, value }, i) => (
          <div key={label + i}>
            <dt title={label}>{label}</dt>
            <dd title={value}>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
