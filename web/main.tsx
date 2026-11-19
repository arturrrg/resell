import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  lazy,
  Suspense,
  useMemo,
  useDeferredValue,
} from "react";
import { createRoot } from "react-dom/client";
import "./resell.css";
import "./mobile-app.css";
import "./interaction-refinements.css";
import "./auth-layout.css";
const OfferStudio = lazy(() => import("./offers/offer-studio"));
import { newOffer, type OfferDraft } from "../shared/offer-draft";
import { CollectionEmpty } from "./collection-empty";
import { SalesPage } from "./profit-history";
import { SharedInventory } from "./share-inventory";
import { NavIcon } from "./nav-icon";
import { InventoryGrid } from "./inventory-grid";
import { useTabSwipe } from "./tab-swipe";
import { installPointerIntentGuard } from "./pointer-intent";
import { installBackNavigation, useBackAction } from "./back-navigation";
import {
  WorkspacePager,
  useMobileWorkspace,
  type WorkspacePage,
  workspaceIndex,
  workspacePages,
} from "./workspace-pager";
import { viewingCode } from "./sharing";
import { archivedSale } from "./sales";
import { useFloatingHeader } from "./floating-header";
import { Startup } from "./startup";
import { prepareImage } from "./media-cache";
import { Filters } from "./filter-bar";
import { filterInventory, emptyFilters } from "./filters";
import { DeviceCard } from "./device-card";
import { useOfferInventory } from "./offers/offer-inventory";
import { DeleteDialog } from "./confirm-dialog";
import { Account, AuthGate, hasAccount, needsPassword } from "./account";
import { LanguagePicker } from "./language-picker";
import { useCloudSync } from "./cloud";
import { useAutoRefresh } from "./auto-refresh";
import { reconcileDevices } from "./sync-store";
import { useExchangeRates } from "./exchange";

import {
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  ArrowUpRight,
  RefreshCw,
  Trash2,
  X,
  Search,
  Link2,
  LoaderCircle,
} from "lucide-react";
import {
  type Device,
  all,
  transaction,
  identity,
  commitImport,
  database,
  recordSourceFailure,
} from "./storage";
function Icon({
  name,
}: {
  name:
    "left" | "right" | "filter" | "external" | "refresh" | "delete" | "close";
}) {
  const Symbol = {
    left: ChevronLeft,
    right: ChevronRight,
    filter: SlidersHorizontal,
    external: ArrowUpRight,
    refresh: RefreshCw,
    delete: Trash2,
    close: X,
  }[name];
  return <Symbol aria-hidden="true" />;
}
function App() {
  const mobileWorkspace = useMobileWorkspace();
  const [offersToolbarHost, setOffersToolbarHost] =
    useState<HTMLDivElement | null>(null);
  const [page, setPage] = useState<WorkspacePage>(() =>
    location.hash.startsWith("#offers")
      ? "offers"
      : location.hash === "#sales"
        ? "sales"
        : "inventory",
  );
  const [offersVisited, setOffersVisited] = useState(true);
  const [creationDraft, setCreationDraft] = useState<OfferDraft | null>(null);
  const pageScroll = useRef({ inventory: 0, offers: 0, sales: 0 });
  const currentPage = useRef(page);
  const pageTrail = useRef<WorkspacePage[]>([page]);
  currentPage.current = page;
  useEffect(() => {
    if (page === "offers") setOffersVisited(true);
  }, [page]);
  useEffect(() => {
    const changed = () =>
      setPage(
        location.hash.startsWith("#offers")
          ? "offers"
          : location.hash === "#sales"
            ? "sales"
            : "inventory",
      );
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  function navigate(next: WorkspacePage, record = true) {
    // A tab tap also cancels an unfinished pan when this tab is already selected.
    if (mobileWorkspace) {
      const track = document.querySelector<HTMLElement>(
        ".native-workspace>.workspace-pager",
      );
      track?.scrollTo({
        left: workspaceIndex(next) * track.getBoundingClientRect().width,
        behavior: "instant",
      });
    }
    if (next === page) return;
    if (!mobileWorkspace) pageScroll.current[page] = window.scrollY;
    if (next === "offers") setOffersVisited(true);
    if (record && pageTrail.current.at(-1) !== next)
      pageTrail.current.push(next);
    setPage(next);
    history.replaceState(
      history.state,
      "",
      location.pathname +
        location.search +
        (next === "inventory" ? "" : "#" + next),
    );
    if (!mobileWorkspace)
      requestAnimationFrame(() =>
        window.scrollTo({ top: pageScroll.current[next], behavior: "instant" }),
      );
  }
  function settleWorkspace(next: WorkspacePage) {
    if (pageTrail.current.at(-1) !== next) pageTrail.current.push(next);
    setPage(next);
    history.replaceState(
      null,
      "",
      location.pathname +
        location.search +
        (next === "inventory" ? "" : "#" + next),
    );
  }
  const pageSwipe = useTabSwipe((step) => {
    if (
      !document.body.classList.contains("offer-editor-open") &&
      !document.querySelector("dialog[open]")
    )
      navigate(
        workspacePages[
          Math.max(0, Math.min(2, workspaceIndex(currentPage.current) + step))
        ],
      );
  });
  const floatingHeader = useFloatingHeader();
  const commandBarRef = useCallback(
    (node: HTMLElement | null) => {
      floatingHeader(node);
      pageSwipe(node);
    },
    [floatingHeader, pageSwipe],
  );
  const [overlayTab, setOverlayTab] = useState<"account" | null>(null);
  const [restoreMarketplace, setRestoreMarketplace] = useState(false);
  const activeTab = overlayTab || page;
  useBackAction(
    page !== "inventory",
    () => {
      pageTrail.current.pop();
      navigate(pageTrail.current.at(-1) || "inventory", false);
    },
    0,
  );
  const [command, setCommand] = useState<"import" | "search">("import");
  const commandField = useRef<HTMLInputElement>(null);
  const switchCommand = (next: "import" | "search") => {
    setCommand(next);
    requestAnimationFrame(() =>
      commandField.current?.focus({
        preventScroll: true,
      }),
    );
  };
  useBackAction(
    command === "search" && page === "inventory",
    () => {
      setCommand("import");
      commandField.current?.blur();
    },
    5,
  );
  const [introDone, setIntroDone] = useState(false);
  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const timer = setTimeout(() => setIntroDone(true), reduced ? 0 : 1850);
    return () => clearTimeout(timer);
  }, []);
  const rates = useExchangeRates();
  const [devices, setDevices] = useState<Device[]>([]),
    [url, setUrl] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [refreshing, setRefreshing] = useState<Set<string>>(new Set()),
    [query, setQuery] = useState(""),
    [filters, setFilters] = useState({ ...emptyFilters }),
    [deleteTarget, setDeleteTarget] = useState<Device | null>(null);
  const devicesRef = useRef(devices);
  devicesRef.current = devices;
  const requests = useRef(new Map<string, AbortController>());
  const refreshInventory = useCallback(async () => {
    const ownerDb = await database();
    const incoming = await all();
    if (ownerDb === (await database()))
      setDevices((previous) => reconcileDevices(previous, incoming));
  }, []);
  const cloud = useCloudSync(refreshInventory);
  const [launchComplete, setLaunchComplete] = useState(false);
  useEffect(() => {
    // The intro timer finishing is not the end of startup: session recovery
    // can still be running. Keep the completed signature visible until ready.
    if (introDone && cloud.ready) setLaunchComplete(true);
  }, [introDone, cloud.ready]);
  const accountReady =
    !cloud.configured ||
    (cloud.ready && !!cloud.session?.user.is_anonymous && devices.length > 0) ||
    (cloud.ready && hasAccount(cloud) && !needsPassword(cloud));
  const offerInventory = useOfferInventory(cloud.workspace || (!cloud.configured ? "local" : null), devices, accountReady);
  const readyRef = useRef(cloud.ready);
  readyRef.current = accountReady;
  useEffect(() => {
    void refreshInventory().catch(() =>
      setMessage("Local storage could not be opened."),
    );
    document.documentElement.dataset.theme = "dark";
  }, [refreshInventory]);
  useEffect(() => {
    setDeleteTarget(null);
    setOverlayTab(null);
    setRestoreMarketplace(false);
    setQuery("");
    setFilters({ ...emptyFilters });
    for (const controller of requests.current.values()) controller.abort();
  }, [cloud.workspace]);
  useEffect(() => {
    if (!accountReady || !introDone) return;
    const url = new URL(location.href);
    if (url.searchParams.get("marketplaceReturn") !== "accounts") return;
    url.searchParams.delete("marketplaceReturn");
    history.replaceState(history.state, "", url.pathname + url.search + url.hash);
    setOverlayTab("account");
    setRestoreMarketplace(true);
  }, [accountReady, introDone, cloud.workspace]);
  const importListing = useCallback(
    async (
      value: string,
      refresh?: Device,
      options: { automatic?: boolean; signal?: AbortSignal } = {},
    ) => {
      if (!readyRef.current) return;
      const id = identity(value),
        key = refresh?.id || "$import";
      if (!id) {
        setMessage("Paste a public 999.md advert URL.");
        return;
      }
      if (requests.current.has(key)) return;
      const existing = devicesRef.current.find(
        (d) => identity(d.listingUrl || "") === id,
      );
      if (existing && !refresh) {
        setMessage("");
        setUrl("");
        document
          .getElementById(existing.id)
          ?.scrollIntoView({ behavior: "smooth" });
        return;
      }
      const controller = new AbortController();
      const cancel = () => controller.abort();
      options.signal?.addEventListener("abort", cancel, { once: true });
      if (options.signal?.aborted) controller.abort();
      requests.current.set(key, controller);
      if (refresh) setRefreshing((old) => new Set(old).add(key));
      else setBusy(true);
      if (!options.automatic) setMessage("");
      let savedDatabase: IDBDatabase | undefined;
      try {
        savedDatabase = await database();
        const base = (import.meta as any).env.VITE_API_BASE_URL || "";
        if (base && !base.startsWith("https://"))
          throw Error("The configured importer must use HTTPS.");
        const response = await fetch(base + "/api/import-999", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/x-ndjson",
          },
          body: JSON.stringify({ url: value, refresh: !!refresh }),
          signal: controller.signal,
        });
        let result: any;
        if (response.headers.get("content-type")?.includes("ndjson")) {
          const reader = response.body!.getReader(),
            decoder = new TextDecoder();
          let pending = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            pending += decoder.decode(value, { stream: true });
            let pos;
            while ((pos = pending.indexOf("\n")) >= 0) {
              const event = JSON.parse(pending.slice(0, pos));
              pending = pending.slice(pos + 1);
              if (event.ok !== undefined) result = event;
            }
          }
        } else result = await response.json();
        if (!result) throw Error("Import connection ended. Please retry.");
        if (!response.ok || !result.ok)
          throw Error(result.error || "Import failed.");
        if (controller.signal.aborted || savedDatabase !== (await database()))
          return;
        if (!refresh && result.listing.images?.[0])
          void prepareImage(result.listing.images[0], "high").catch(() => {});
        if (!(await commitImport(result.listing, refresh?.id))) return;
        await refreshInventory();
        if (!refresh) setUrl("");
      } catch (e) {
        if (!controller.signal.aborted && (e as Error).name !== "AbortError") {
          const detail =
            e instanceof TypeError && /fetch/i.test(e.message)
              ? "Could not reach the importer. Check your connection; updates will retry automatically."
              : (e as Error).message;
          if (refresh && savedDatabase === (await database())) {
            try {
              await recordSourceFailure(savedDatabase!, refresh.id, detail);
              await refreshInventory();
            } catch {}
          }
          if (!options.automatic) setMessage(detail);
        }
      } finally {
        options.signal?.removeEventListener("abort", cancel);
        requests.current.delete(key);
        if (refresh)
          setRefreshing((old) => {
            const next = new Set(old);
            next.delete(key);
            return next;
          });
        else setBusy(false);
      }
    },
    [refreshInventory],
  );
  useAutoRefresh({
    enabled: accountReady,
    workspace: cloud.workspace,
    accept: device => offerInventory.inventory.some(d => d.id === device.id),
    busy: () => new Set(requests.current.keys()),
    refresh: (device, signal) =>
      importListing(device.listingUrl!, device, { automatic: true, signal }),
  });
  const retrySource = useCallback(
    (device: Device) => {
      void importListing(device.listingUrl!, device, { automatic: true });
    },
    [importListing],
  );
  const removeDevice = useCallback(async () => {
    if (!deleteTarget) return;
    requests.current.get(deleteTarget.id)?.abort();
    await transaction("readwrite", (store) => store.delete(deleteTarget.id));
    setDevices((old) => old.filter((d) => d.id !== deleteTarget.id));
    setDeleteTarget(null);
  }, [deleteTarget]);
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    if (!devices.some((d) => d.saleStatus === "sold" && !archivedSale(d)))
      return;
    const timer = setInterval(() => setClock(Date.now()), 250);
    return () => clearInterval(timer);
  }, [devices]);
  const deferredQuery = useDeferredValue(query);
  const visible = useMemo(
    () =>
      filterInventory(
        offerInventory.inventory.filter(
          (d) =>
            filters.status === "sold" ||
            !archivedSale(d, Math.max(clock, Date.now())),
        ),
        filters,
        deferredQuery,
        rates,
      ),
    [offerInventory.inventory, filters, deferredQuery, rates, clock],
  );
  if (!introDone || !cloud.ready) return <Startup animate={!launchComplete} showSpinner={launchComplete && hasAccount(cloud)} error={introDone ? cloud.error : undefined} onRetry={cloud.requestSync} />;
  if (!accountReady)
    return (
      <main className="auth-shell">
        <header className="auth-header">
          <div className="wordmark">Resell<span className="brand-dot">.</span></div>
          <LanguagePicker iconOnly />
        </header>
        <AuthGate cloud={cloud} />
      </main>
    );
  return (
    <main
      className={`resell-app offer-monitoring${mobileWorkspace ? " native-workspace" : ""}`}
      data-page={page}
    >
      <header
        ref={commandBarRef}
        className="floating-nav"
        data-command="search"
      >
        <span className="wordmark">
          Resell<span className="brand-dot">.</span>
        </span>
        <form className="nav-import nav-command" onSubmit={event => event.preventDefault()}>
          <span className="command-leading" aria-hidden="true"><Search /></span>
          <input ref={commandField} aria-label="Search inventory" placeholder="Search" value={query} onChange={event => setQuery(event.target.value)} />
        </form>
        <Filters devices={offerInventory.inventory} value={filters} onChange={setFilters} />
        <nav
          className="workspace-tools app-tabbar"
          aria-label="Workspace"
          data-active={activeTab}
        >
          <span className="nav-selection" aria-hidden="true" />
          <button
            className="app-destination"
            aria-label="Inventory"
            aria-current={page === "inventory" ? "page" : undefined}
            onClick={() => navigate("inventory")}
          >
            <NavIcon name="inventory" selected={activeTab === "inventory"} />
            <span>Inventory</span>
          </button>
          <button
            className="app-destination"
            aria-label="Offers"
            aria-current={page === "offers" ? "page" : undefined}
            onClick={() => navigate("offers")}
            onPointerEnter={() => void import("./offers/offer-studio")}
            onTouchStart={() => void import("./offers/offer-studio")}
          >
            <NavIcon name="offers" selected={activeTab === "offers"} />
            <span>Offers</span>
          </button>
          <button
            className="app-destination"
            aria-label="Sales and profit"
            aria-current={page === "sales" ? "page" : undefined}
            onClick={() => navigate("sales")}
          >
            <NavIcon name="sales" selected={activeTab === "sales"} />
            <span>Sales</span>
          </button>
          <div className="app-destination-wrap">
            <Account
              monitorError={offerInventory.monitorError}
              cloud={cloud}
              restoreMarketplace={restoreMarketplace}
              onOpenChange={(open) => setOverlayTab(open ? "account" : null)}
              icon={
                <NavIcon name="account" selected={activeTab === "account"} />
              }
            />
            <span>Account</span>
          </div>
        </nav>
      </header>
      {message && (
        <div className="error-message" role="alert">
          {message}
          <button aria-label="Dismiss message" onClick={() => setMessage("")}>
            <X />
          </button>
        </div>
      )}
      <WorkspacePager
        page={page}
        mobile={mobileWorkspace}
        onPage={settleWorkspace}
      >
        <div
          className="workspace-page inventory-page"
          hidden={!mobileWorkspace && page !== "inventory"}
          aria-hidden={
            mobileWorkspace && page !== "inventory" ? true : undefined
          }
          inert={mobileWorkspace && page !== "inventory"}
        >
          <InventoryGrid
            retainPaint={mobileWorkspace}
            devices={visible}
            resetKey={JSON.stringify(filters) + deferredQuery}
            renderCard={(d) => (
              <DeviceCard
                key={d.id}
                device={d}
                rates={rates}
                refreshing={refreshing.has(d.id)}
                onRetry={retrySource}
                onDelete={setDeleteTarget}
                onError={setMessage}
                onSaved={refreshInventory}
              />
            )}
          />
          {!visible.length && (
            <CollectionEmpty
              title={offerInventory.inventory.length
                  ? "No matching offers"
                  : "Your offers, in view."}
              description={offerInventory.inventory.length
                  ? "Try another search or filter."
                  : "Published offers appear here automatically. Include other marketplace offers in Account."}
              onCreate={!offerInventory.inventory.length ? () => { setCreationDraft(newOffer()); navigate("offers"); } : undefined}
            />
          )}
        </div>
        {(offersVisited || mobileWorkspace) && (
          <div
            className="workspace-page offers-page"
            hidden={!mobileWorkspace && page !== "offers"}
            aria-hidden={
              mobileWorkspace && page !== "offers" ? true : undefined
            }
            inert={mobileWorkspace && page !== "offers"}
          >
            <Suspense
              fallback={
                <div className="app-page-loading">
                  <LoaderCircle className="spinning" />
                </div>
              }
            >
              <OfferStudio
                onPublished={(urls, destination = "inventory") => {
                  setQuery(""); setFilters({ ...emptyFilters });
                  navigate(destination);
                  // Fetch the exact returned IDs rather than guessing from the profile's newest offer.
                  for (const url of urls) void importListing(url, devicesRef.current.find(d => identity(d.listingUrl || "") === identity(url)));
                }}
                creationDraft={creationDraft}
                onCreateHandled={() => setCreationDraft(null)}
                toolbarHost={mobileWorkspace ? offersToolbarHost : null}
                devices={devices}
                key={cloud.workspace || "local"}
                scope={cloud.workspace || "local"}
                accountId={
                  hasAccount(cloud) ? cloud.session?.user.id : undefined
                }
                isVisible={page === "offers"}
              />
            </Suspense>
          </div>
        )}
        <div
          className="workspace-page sales-page"
          hidden={!mobileWorkspace && page !== "sales"}
          aria-hidden={mobileWorkspace && page !== "sales" ? true : undefined}
          inert={mobileWorkspace && page !== "sales"}
        >
          {mobileWorkspace && <div className="sales-toolbar-host"><h1>Sales<span>.</span></h1></div>}
          <SalesPage
            devices={offerInventory.sales}
            onUndoOffer={offerInventory.undoSale}
            onSaved={refreshInventory}
            onError={setMessage}
          />
        </div>
        {mobileWorkspace && (
          <div
            ref={setOffersToolbarHost}
            className="offers-toolbar-host"
            aria-hidden={page !== "offers" || undefined}
            inert={page !== "offers"}
          />
        )}
      </WorkspacePager>
      {deleteTarget && (
        <DeleteDialog
          name={deleteTarget.model || deleteTarget.title || "this device"}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={removeDevice}
        />
      )}
    </main>
  );
}
function AppRouter() {
  useEffect(() => installPointerIntentGuard(document), []);
  useEffect(() => installBackNavigation(window), []);
  const [code, setCode] = useState(() =>
    viewingCode(
      new URLSearchParams(window.location.hash.slice(1)).get("view") || "",
    ),
  );
  useEffect(() => {
    const changed = () =>
      setCode(
        viewingCode(
          new URLSearchParams(window.location.hash.slice(1)).get("view") || "",
        ),
      );
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  return code ? <SharedInventory code={code} /> : <App />;
}
createRoot(document.getElementById("root")!).render(<AppRouter />);

if ("serviceWorker" in navigator && (import.meta as any).env.PROD)
  navigator.serviceWorker.register("/sw.js").catch(() => {});
