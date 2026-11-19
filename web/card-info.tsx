import type { Device } from "./storage";
import { specificationLabel } from "./inventory-fields";
import { useLanguage, translate, localeFor } from "./i18n";
import { convertMdl, freshRates, type ExchangeRates } from "../shared/exchange";
export function Price({
  amount,
  currency,
  rates,
}: {
  amount?: number;
  currency?: string;
  rates: ExchangeRates | null;
}) {
  const language = useLanguage();
  const number = new Intl.NumberFormat(localeFor(language), { maximumFractionDigits: 2 });
  const rounded = new Intl.NumberFormat(localeFor(language), { maximumFractionDigits: 0 });
  const rateDate = new Intl.DateTimeFormat(localeFor(language), { timeZone: "Europe/Chisinau", dateStyle: "medium", timeStyle: "short" });
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
  const language = useLanguage();
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
      <h3>{translate("Specifications", language)}</h3>
      <dl className="characteristics-list">
        {fields.map(({ label, value }, i) => (
          <div key={label + i}>
            <dt title={translate(specificationLabel(label), language)}>{translate(specificationLabel(label), language)}</dt>
            <dd title={value}>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
