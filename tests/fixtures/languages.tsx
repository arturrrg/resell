import { createRoot } from "react-dom/client";
import { useState } from "react";
import { Account } from "../../web/account";
import { DeviceCard } from "../../web/device-card";
import { SalesPage } from "../../web/profit-history";
import OfferStudio from "../../web/offers/offer-studio";
import { Filters } from "../../web/filter-bar";
import { emptyFilters } from "../../web/filters";
import { newOffer } from "../../shared/offer-draft";
import { useLanguage } from "../../web/i18n";
import type { Device } from "../../web/storage";
import "../../web/resell.css";
import "../../web/mobile-app.css";
const device: Device = { id: "localization-test", title: "New", model: "iPhone 15 Pro", brand: "Apple", photos: [], color: "Negru", condition: "Utilizat", storage: "256 GB", listingDescription: "New", sourcePrice: 12000, currency: "MDL", characteristics: [
  { label: "Tip dispozitiv", value: "Smartphone-uri" }, { label: "Culoare", value: "Negru" }, { label: "Stare", value: "Utilizat" }, { label: "Autorul anunțului", value: "Magazin" },
] };
const cloud = { configured: true, ready: false, session: { user: { id: "localization-fixture", email: "fixture@example.invalid", is_anonymous: false, user_metadata: {} } } } as any;
function Fixture() {
  useLanguage();
  const [tab, setTab] = useState("Inventory");
  const [draft, setDraft] = useState<ReturnType<typeof newOffer> | null>(() => ({ ...newOffer(), title: "New", description: "New", brand: "Apple", model: "iPhone 15 Pro", price: "12000" }));
  const [filters, setFilters] = useState(emptyFilters);
  return <main className="resell-app">
    <nav>{["Inventory", "Offers", "Sales"].map(value => <button key={value} onClick={() => setTab(value)}>{value}</button>)}<Account cloud={cloud} /></nav>
    {tab === "Inventory" ? <><Filters devices={[device]} value={filters} onChange={setFilters} /><DeviceCard device={device} rates={null} refreshing={false} onRetry={() => {}} onDelete={() => {}} onError={() => {}} onSaved={async () => {}} /></> : tab === "Offers" ? <OfferStudio scope="localization-fixture" creationDraft={draft} onCreateHandled={() => setDraft(null)} /> : <SalesPage devices={[]} onSaved={async () => {}} onError={() => {}} />}
  </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
