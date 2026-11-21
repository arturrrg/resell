import { useLanguage, localeFor, translate } from "../i18n";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Copy,
  ImagePlus,
  Layers3,
  LoaderCircle,
  Plus,
  Search,
  ShieldCheck,
  Smartphone,
  SquarePen,
  Trash2,
  Upload,
  X,
  Eye,
  MoreHorizontal,
} from "lucide-react";
import {
  newOffer,
  offerProblems,
  readOfferTransfer,
  transferOffer,
  MAX_OFFER_PHOTOS,
  type OfferDraft,
  type OfferPhoto,
} from "../../shared/offer-draft";
import { savedDrafts, saveDraft, removeDraft, closeDisappearedDraft, watchOfferChanges } from "./draft-store";
import { asTemplate, fromTemplate } from "../../shared/offer-state";
import { MissingOfferReminders } from "./missing-offer-reminders";
import { missingPublications } from "./missing-publications";
import { CurrencyPicker } from "./currency-picker";
import { TemplateLibrary } from "./template-library";
import { TemplateNameDialog } from "./template-name-dialog";
import { CollectionEmpty } from "../collection-empty";
import { OfferPhotoImage, prepareOfferPhoto } from "./photo";
import { inNativeApp, marketplaceProfile } from "./native";
import { usePreparationQueue } from "./use-preparation-queue";
import { PreparationProgress } from "./preparation-progress";
import { AccountPrices } from "./account-prices";
import { AddOfferPhotos } from "./add-offer-photos";
import { useOfferCamera } from "./use-offer-camera";
import { useBackAction } from "../back-navigation";
import { Sheet } from "../sheet";
import { Gallery } from "../gallery";
import { MarketplaceSignInSheet } from "./marketplace-connection";
import { PhotoGrid } from "./photo-grid";
import { reconcileOfferDrafts, moveOfferPhoto } from "./draft-view";
import { useHoldAction } from "./hold-actions";
import { SwipeDraft } from "./draft-swipe";
import { devicePresets, presetChoices } from "./device-presets";
import { SectionPager } from "../section-pager";
import { warmOfferThumbnail } from "./photo";
import type { Device } from "../storage";
import "./studio.css";
import "./studio-refinement.css";
import "./templates.css";

type Step = "details" | "photos" | "review";
const steps: [Step, string][] = [
  ["details", "Details"],
  ["photos", "Photos"],
  ["review", "Review"],
];
function OfferGallery({
  photos,
  title,
  active = true,
}: {
  photos: OfferPhoto[];
  title: string;
  active?: boolean;
}) {
  useLanguage();
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const next = photos.map((photo) => URL.createObjectURL(photo.blob));
    setUrls(next);
    return () => next.forEach((url) => URL.revokeObjectURL(url));
  }, [photos]);
  return (
    <div className="studio-preview-gallery">
      <Gallery photos={urls} title={title} active={active} />
    </div>
  );
}
const date = (value: string) =>
  new Date(value).toLocaleDateString(localeFor(), {
    month: "short",
    day: "numeric",
  });
const money = (draft: OfferDraft) =>
  `${draft.price ? Number(draft.price.replace(",", ".")).toLocaleString(localeFor()) : "—"} ${draft.currency}`;
function selectedId() {
  return /^#offers\/([a-f0-9-]{36})$/.exec(location.hash)?.[1] || "";
}
function route(id = "") {
  history.replaceState(
    history.state,
    "",
    location.pathname + location.search + "#offers" + (id ? "/" + id : ""),
  );
}

function Picker({
  label,
  value,
  items,
  onChange,
  allowCustom = false,
}: {
  label: string;
  value: string;
  items: [string, string][];
  onChange: (v: string) => void;
  allowCustom?: boolean;
}) {
  const language = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(""),
    [custom, setCustom] = useState(false),
    [customValue, setCustomValue] = useState(value);
  useBackAction(open && custom, () => setCustom(false), 110);
  const choose = (value: string) => {
    onChange(value);
    setOpen(false);
  };
  return (
    <>
      <button
        type="button"
        className="studio-picker"
        onClick={() => {
          setQuery("");
          setCustom(false);
          setCustomValue(value);
          setOpen(true);
        }}
        aria-haspopup="dialog"
      >
        <span>{label}</span>
        <strong>
          {items.find(([id]) => id === value)?.[1] || value || "Choose"}
        </strong>
        <ChevronRight />
      </button>
      {open && (
        <Sheet title={label} onClose={() => setOpen(false)}>
          {(items.length > 8 || custom) && !custom && (
            <label className="studio-picker-search">
              <Search />
              <input
                aria-label={`Search ${label.toLowerCase()}`}
                placeholder="Search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          )}
          {custom ? (
            <form
              className="studio-custom-choice"
              onSubmit={(event) => {
                event.preventDefault();
                if (customValue.trim()) choose(customValue.trim());
              }}
            >
              <label className="studio-field">
                <span>{label}</span>
                <input
                  autoFocus
                  aria-label={label}
                  value={customValue}
                  onChange={(event) => setCustomValue(event.target.value)}
                  autoComplete="off"
                />
              </label>
              <button className="studio-primary" disabled={!customValue.trim()}>
                Use this value
              </button>
            </form>
          ) : (
            <div className="studio-picker-options">
              {items
                .filter(([, text]) =>
                  [text, translate(text, language)].some(value => value.toLocaleLowerCase().includes(query.toLocaleLowerCase())),
                )
                .map(([id, text]) => (
                  <button
                    key={id}
                    aria-pressed={value === id}
                    onClick={() => {
                      choose(id);
                    }}
                  >
                    <span>{text}</span>
                    {value === id && <Check />}
                  </button>
                ))}
              {allowCustom && (
                <button
                  className="studio-custom-option"
                  onClick={() => setCustom(true)}
                >
                  <span>Other…</span>
                  <Plus />
                </button>
              )}
            </div>
          )}
        </Sheet>
      )}
    </>
  );
}

function DraftCard({
  draft,
  onEdit,
  onActions,
  onDelete,
}: {
  draft: OfferDraft;
  onEdit: () => void;
  onActions: () => void;
  onDelete: () => void;
}) {
  useLanguage();
  const { consumeClick, cancelHold, ...hold } = useHoldAction(onActions);
  return (
    <SwipeDraft onDelete={onDelete} onGesture={cancelHold}>
      <div className="studio-draft-card">
        <button
          className="studio-draft-open"
          {...hold}
          onClick={() => {
            if (!consumeClick()) onEdit();
          }}
        >
          <div className="studio-draft-image">
            {draft.photos[0] ? (
              <OfferPhotoImage photo={draft.photos[0]} />
            ) : (
              <SquarePen />
            )}
          </div>
          <div className="studio-draft-summary">
            <span className="studio-draft-state">
              Draft · {date(draft.updatedAt)}
            </span>
            <h2 translate={draft.title ? "no" : "yes"}>{draft.title || "Untitled offer"}</h2>
            <p>
              {[
                draft.brand,
                draft.storage,
                draft.photos.length
                  ? `${draft.photos.length} photos`
                  : "Add photos",
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <strong>{money(draft)}</strong>
          </div>
        </button>
        <button
          className="studio-draft-menu"
          aria-label={`Actions for ${draft.title || "untitled offer"}`}
          onClick={onActions}
        >
          <MoreHorizontal />
        </button>
      </div>
    </SwipeDraft>
  );
}

export default function OfferStudio({
  scope,
  accountId,
  devices = [],
  missingDevices = [],
  onInventorySaved,
  isVisible = true,
  toolbarHost,
  creationDraft = null,
  onCreateHandled,
  onPublished,
}: {
  scope: string;
  accountId?: string;
  devices?: Device[];
  missingDevices?: Device[];
  onInventorySaved?: () => Promise<void>;
  isVisible?: boolean;
  toolbarHost?: HTMLElement | null;
  creationDraft?: OfferDraft | null;
  onCreateHandled?: () => void;
  onPublished?: (urls: string[], destination?: "inventory" | "offers") => void;
}) {
  useLanguage();
  const [cloudState, setCloudState] = useState<
    "local" | "syncing" | "synced" | "offline"
  >(accountId ? "syncing" : "local");
  const syncSoon = useRef<() => void>(() => {});
  const deleted = useRef(new Set<string>());
  const [drafts, setDrafts] = useState<OfferDraft[]>([]),
    [storedDraft, setDraft] = useState<OfferDraft | null>(null),
    [step, setStep] = useState<Step>("details"),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false),
    [notice, setNotice] = useState(""),
    [errors, setErrors] = useState<string[]>([]),
    [photoId, setPhotoId] = useState(""),
    [deleteTarget, setDeleteTarget] = useState<OfferDraft | null>(null),
    [deleting, setDeleting] = useState(false),
    [handoff, setHandoff] = useState(false);
  // The destination renders the editor in the same commit as navigation.
  // Adoption happens before paint; no Offers list or loading frame is exposed.
  const draft = creationDraft || storedDraft;
  const deleteId = deleteTarget?.id || "";
  function setDeleteId(id: string) { setDeleteTarget(id ? drafts.find(item => item.id === id) || (draft?.id === id ? draft : null) : null); }
  const [actionDraft, setActionDraft] = useState<OfferDraft | null>(null),
    [connectRequired, setConnectRequired] = useState(false);
  const [actionOrigin, setActionOrigin] = useState<"offers" | "library" | "editor">("offers");
  const templateSaveOrigin = useRef<"offers" | "library" | "editor">("offers");
  const [templatesOpen, setTemplatesOpen] = useState(false),
    [templateName, setTemplateName] = useState<string | null>(null),
    [templateSource, setTemplateSource] = useState<OfferDraft | null>(null);
  const persisted = useRef(new Map<string, string>());
  const returnToTemplates = useRef(false), closingEditor = useRef(false);
  const importInput = useRef<HTMLInputElement>(null),
    latest = useRef<OfferDraft | null>(null),
    active = useRef(true);
  latest.current = draft;
  const preparation = usePreparationQueue(scope, draft, setNotice, value => {
    latest.current = value;
    persisted.current.set(value.id, value.updatedAt);
    setDraft(value);
    syncSoon.current();
  }, (urls, multiple) => {
    if (multiple) { selectStep("review"); if (latest.current) route(latest.current.id); }
    else { setDraft(null); route(""); }
    onPublished?.(urls, multiple ? "offers" : "inventory");
  });
  const [cameraPreview, setCameraPreview] = useState<{ draftId: string; photo: OfferPhoto } | null>(null);
  const capturePhoto = useOfferCamera(scope, loaded, recovered => {
    latest.current = recovered;
    persisted.current.set(recovered.id, recovered.updatedAt);
    setDraft(recovered);
    setStep("photos");
    route(recovered.id);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    syncSoon.current();
  }, setNotice, (draftId, photo) => {
    setCameraPreview(photo ? { draftId, photo } : null);
    if (photo) setStep("photos");
  });
  useEffect(() => watchOfferChanges(scope, change => {
    if (change.draft) {
      setDrafts(previous => reconcileOfferDrafts(previous, [change.draft!, ...previous.filter(d => d.id !== change.draft!.id)].sort((a,b) => b.updatedAt.localeCompare(a.updatedAt))));
      return;
    }
    if (change.removedId) {
      deleted.current.add(change.removedId);
      setDrafts(previous => previous.filter(d => d.id !== change.removedId));
      if (latest.current?.id === change.removedId) { setDraft(null); latest.current = null; route(); }
      return;
    }
    void savedDrafts(scope).then(items => {
      if (active.current) setDrafts(previous => reconcileOfferDrafts(previous, items));
    }).catch(() => {});
  }), [scope]);
  useBackAction(!!draft && isVisible, () => void close(), 10);
  useLayoutEffect(() => {
    if (!creationDraft) return;
    returnToTemplates.current = false;
    edit(creationDraft);
    onCreateHandled?.();
  }, [creationDraft]);
  function selectStep(next: Step) {
    const track = document.querySelector<HTMLElement>(
      ".studio-editor-screen>.studio-tab-track",
    );
    track?.scrollTo({
      left:
        steps.findIndex(([id]) => id === next) *
        track.getBoundingClientRect().width,
      behavior: "instant",
    });
    setStep(next);
  }
  useEffect(() => {
    for (const photo of draft?.photos || [])
      void warmOfferThumbnail(photo.blob).catch(() => {});
  }, [draft?.photos]);
  useEffect(() => {
    if (!accountId || accountId !== scope) {
      setCloudState("local");
      return;
    }
    let stopped = false,
      timer: ReturnType<typeof setTimeout> | undefined,
      pending = false,
      again = false;
    async function sync() {
      if (stopped || document.visibilityState === "hidden") return;
      if (pending) {
        again = true;
        return;
      }
      pending = true;
      setCloudState("syncing");
      try {
        const { syncPrivateOffers } = await import("./cloud-drafts");
        const result = await syncPrivateOffers(scope);
        if (stopped) return;
        const items = await savedDrafts(scope);
        if (stopped) return;
        setDrafts((previous) => reconcileOfferDrafts(previous, items));
        setCloudState("synced");
        if (result.conflict) setNotice(result.conflict);
        const current = latest.current,
          copy = result.copies.find((item) => item.original === current?.id);
        if (current && copy) {
          const recovered = {
            ...current,
            id: copy.copy,
            updatedAt: new Date().toISOString(),
          };
          await saveDraft(recovered, scope);
          setDraft(recovered);
          route(recovered.id);
          again = true;
        }
      } catch (error) {
        if (!stopped) setCloudState("offline");
      } finally {
        pending = false;
        if (again && !stopped) {
          again = false;
          schedule();
        }
      }
    }
    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(() => void sync(), 1200);
    }
    syncSoon.current = schedule;
    const visible = () => {
      if (document.visibilityState === "visible") void sync();
    };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("online", visible);
    window.addEventListener("focus", visible);
    const interval = setInterval(() => void sync(), 30000);
    void sync();
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearInterval(interval);
      syncSoon.current = () => {};
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("online", visible);
      window.removeEventListener("focus", visible);
    };
  }, [scope, accountId]);
  useEffect(() => {
    active.current = true;
    void savedDrafts(scope)
      .then((items) => {
        if (!active.current) return;
        setDrafts((previous) => reconcileOfferDrafts(previous, items));
        items.forEach((item) => persisted.current.set(item.id, item.updatedAt));
        const resume = items.find((item) => item.id === selectedId());
        if (resume) {
          setDraft(resume);
          if (preparation.queue?.draftId === resume.id) setStep("review");
        }
        setLoaded(true);
      })
      .catch((error) => {
        if (active.current) {
          setNotice(error.message);
          setLoaded(true);
        }
      });
    return () => {
      active.current = false;
      const pending = latest.current;
      if (
        pending &&
        !deleted.current.has(pending.id) &&
        persisted.current.get(pending.id) !== pending.updatedAt
      )
        void saveDraft(pending, scope).catch(() => {});
    };
  }, [scope]);
  useEffect(() => {
    if (!draft || !loaded) return;
    setSaved(false);
    const timer = setTimeout(() => {
      void persist(draft)
        .then(() => {
          if (active.current && latest.current?.updatedAt === draft.updatedAt)
            setSaved(true);
        })
        .catch((error) => {
          if (active.current)
            setNotice("Could not save this draft. " + error.message);
        });
    }, 350);
    return () => clearTimeout(timer);
  }, [draft, loaded]);
  useLayoutEffect(() => {
    document.body.classList.toggle("offer-editor-open", !!draft && isVisible);
    return () => document.body.classList.remove("offer-editor-open");
  }, [!!draft, isVisible]);
  useEffect(() => {
    if (!draft || !isVisible || !window.visualViewport) return;
    const viewport = window.visualViewport;
    let frame = 0;
    const resize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        document.documentElement.style.setProperty(
          "--studio-height",
          viewport.height + "px",
        );
        document.documentElement.style.setProperty(
          "--studio-top",
          viewport.offsetTop + "px",
        );
      });
    };
    resize();
    viewport.addEventListener("resize", resize);
    viewport.addEventListener("scroll", resize);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", resize);
      viewport.removeEventListener("scroll", resize);
      document.documentElement.style.removeProperty("--studio-height");
      document.documentElement.style.removeProperty("--studio-top");
    };
  }, [!!draft, isVisible]);
  async function persist(value: OfferDraft) {
    if (deleted.current.has(value.id)) return;
    if (persisted.current.get(value.id) === value.updatedAt) return;
    await saveDraft(value, scope);
    persisted.current.set(value.id, value.updatedAt);
    syncSoon.current();
    if (active.current)
      setDrafts((items) => [
        value,
        ...items.filter((item) => item.id !== value.id),
      ]);
  }
  function update<K extends keyof OfferDraft>(key: K, value: OfferDraft[K]) {
    setDraft((current) =>
      current
        ? { ...current, [key]: value, updatedAt: new Date().toISOString() }
        : current,
    );
    setNotice("");
    setErrors([]);
  }
  function edit(value: OfferDraft) {
    deleted.current.delete(value.id);
    setDraft(value);
    setStep("details");
    setNotice("");
    setErrors([]);
    route(value.id);
  }
  function editTemplate(value: OfferDraft) {
    returnToTemplates.current = true;
    setTemplatesOpen(false);
    edit(value);
  }
  function openActions(value: OfferDraft, origin: "offers" | "library" | "editor") {
    setActionOrigin(origin);
    if (origin === "library") returnToTemplates.current = true;
    setActionDraft(value);
  }
  function closeActions() {
    if (actionOrigin === "library") { setTemplatesOpen(true); returnToTemplates.current = false; }
    setActionDraft(null);
  }
  function closeTemplateSave() {
    setTemplateName(null); setTemplateSource(null);
    if (templateSaveOrigin.current === "library") { setTemplatesOpen(true); returnToTemplates.current = false; }
  }
  function useTemplate(value: OfferDraft) {
    returnToTemplates.current = false;
    setTemplatesOpen(false);
    edit(fromTemplate(value));
  }
  async function close() {
    if (busy || closingEditor.current) return;
    closingEditor.current = true;
    try {
      if (draft) await persist(draft);
      setDraft(null);
      setPhotoId("");
      setErrors([]);
      setNotice("");
      route();
      if (returnToTemplates.current || draft?.kind === "template") setTemplatesOpen(true);
      returnToTemplates.current = false;
    } catch (error) {
      setNotice((error as Error).message);
    } finally { closingEditor.current = false; }
  }
  function closeDelete() {
    if (deleting) return;
    setDeleteId("");
    if (returnToTemplates.current && !draft) { setTemplatesOpen(true); returnToTemplates.current = false; }
  }
  async function addPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!draft || draft.kind === "template" || !files.length) return;
    setBusy(true);
    setNotice("");
    try {
      if (draft.photos.length + files.length > MAX_OFFER_PHOTOS)
        throw Error("Choose up to 10 photos. Remove a photo to make room.");
      const added: OfferPhoto[] = [];
      for (const file of files) added.push(await prepareOfferPhoto(file));
      if (
        draft.photos.reduce((size, p) => size + p.blob.size, 0) +
          added.reduce((size, p) => size + p.blob.size, 0) >
        25 * 1024 * 1024
      )
        throw Error("Keep the prepared photos below 25 MB in total.");
      update("photos", [...draft.photos, ...added]);
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function reorder(from: number, to: number) {
    if (!draft || to < 0 || to >= draft.photos.length) return;
    update("photos", moveOfferPhoto(draft.photos, from, to));
  }
  async function prepare(accounts?: { id: string; login: string }[]) {
    if (!draft) return;
    const problems = offerProblems(draft);
    if (!draft.secondaryTitle.trim())
      problems.push("Add the second title required by 999.md.");
    setErrors(problems);
    if (problems.length) {
      selectStep("review");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      await persist(draft);
      if (!inNativeApp()) {
        setHandoff(true);
        return;
      }
      const connection = await marketplaceProfile(scope);
      if (
        !connection.available ||
        !connection.saved ||
        (!accounts && connection.accounts.length > 1)
      ) {
        setConnectRequired(true);
        return;
      }
      await preparation.start(
        accounts ||
          connection.accounts.filter((a) => a.id === connection.selectedId),
      );
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function importDraft(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setNotice("");
    try {
      if (file.size > 36 * 1024 * 1024)
        throw Error("This offer file is too large.");
      const source = readOfferTransfer(JSON.parse(await file.text()));
      const value: OfferDraft = {
        ...source,
        ...newOffer(),
        title: source.title,
        secondaryTitle: source.secondaryTitle,
        description: source.description,
        price: source.price,
        currency: source.currency,
        language: source.language,
        brand: source.brand,
        model: source.model,
        storage: source.storage,
        ram: source.ram,
        condition: source.condition,
        sellerType: source.sellerType,
        deviceType: source.deviceType,
        operatingSystem: source.operatingSystem,
        batteryHealth: source.batteryHealth,
        batteryCapacity: source.batteryCapacity,
        color: source.color,
        phone: source.phone,
        location: source.location,
        photos: source.photos.map((photo) => ({
          id: crypto.randomUUID(),
          name: photo.name,
          type: photo.type,
          blob: new Blob(
            [Uint8Array.from(atob(photo.base64), (c) => c.charCodeAt(0))],
            { type: photo.type },
          ),
        })),
      };
      await persist(value);
      edit(value);
      setNotice("Imported as a new draft.");
    } catch (error) {
      setNotice("Could not import this offer. " + (error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function download(blob: Blob, name: string) {
    const href = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = href;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 60000);
  }
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("Copied.");
    } catch {
      setNotice(
        "Copy is unavailable. Select the text from the review instead.",
      );
    }
  }
  const field = (
    key: keyof OfferDraft,
    label: string,
    placeholder = "",
    mode?: "decimal" | "numeric" | "tel",
  ) => (
    <label className="studio-field">
      <span>{label}</span>
      <input
        value={String(draft?.[key] || "")}
        onChange={(event) => update(key, event.target.value as never)}
        placeholder={placeholder}
        inputMode={mode}
        autoComplete="off"
        maxLength={
          key === "title" || key === "secondaryTitle" ? 100 : undefined
        }
      />
    </label>
  );
  const knownValues = (key: string) =>
    devices.map((device) => String((device as any)[key] || "")).filter(Boolean);
  const choice = (
    key: keyof typeof devicePresets & keyof OfferDraft,
    label: string,
  ) => (
    <Picker
      label={label}
      value={String(draft?.[key] || "")}
      items={presetChoices(devicePresets[key] as string[], knownValues(key))}
      allowCustom
      onChange={(value) => update(key, value as never)}
    />
  );
  const models = draft
    ? presetChoices(
        devicePresets.models[draft.brand] || [],
        devices
          .filter(
            (device) =>
              String((device as any).brand || "").toLowerCase() ===
              draft.brand.toLowerCase(),
          )
          .map((device) => String((device as any).model || ""))
          .filter(Boolean),
      )
    : [];
  const photo = draft?.photos.find((item) => item.id === photoId),
    photoIndex = draft?.photos.findIndex((item) => item.id === photoId) ?? -1;
  const list = drafts.filter(item => item.kind !== "template" && !item.sale);
  const templates = drafts.filter(item => item.kind === "template" && !item.sale);
  async function closeMissingOffer(item: OfferDraft, profit: number) {
    if (!missingPublications(item, devices).length) throw Error("This offer is public again. Its draft was kept.");
    deleted.current.add(item.id);
    try {
      await closeDisappearedDraft(item.id, scope, profit);
      if (preparation.queue?.draftId === item.id) preparation.stop();
      syncSoon.current();
      if (draft?.id === item.id) { setDraft(null); latest.current = null; route(); }
    } catch (e) { deleted.current.delete(item.id); throw e; }
  }
  const draftActions = actionDraft && (
          <div className="studio-draft-actions">
            {actionDraft.kind === "template" && actionOrigin === "library" && <button onClick={() => { editTemplate(actionDraft); setActionDraft(null); }}><SquarePen /><span>Edit template</span><ChevronRight /></button>}
            <button
              onClick={() => { if (actionOrigin === "library") setTemplatesOpen(false); templateSaveOrigin.current = actionOrigin; setTemplateSource(actionDraft); setTemplateName(actionDraft.templateName || actionDraft.title || "Phone template"); setActionDraft(null); }}
            ><Layers3 /><span>{actionDraft.kind === "template" ? "Duplicate template" : "Save as template"}</span><ChevronRight /></button>
            <button
              className="is-destructive"
              onClick={() => {
                setDeleteId(actionDraft.id);
                setActionDraft(null);
              }}
            >
              <Trash2 />
              <span>{actionDraft.kind === "template" ? "Delete template" : "Delete draft"}</span>
            </button>
          </div>
  );
  const deleteConfirmation = deleteTarget && (
          <div className="studio-confirm">
            <div>
              <Trash2 />
            </div>
            <p>
              The {deleteTarget?.kind === "template" ? "template" : "draft"} and its saved photos will be removed from this
              workspace.
            </p>
            <button
              className="studio-danger"
              disabled={deleting}
              onClick={async () => {
                if (deleting) return;
                setDeleting(true);
                try {
                  deleted.current.add(deleteId);
                  await removeDraft(deleteId, scope);
                  syncSoon.current();
                  setDrafts((items) =>
                    items.filter((item) => item.id !== deleteId),
                  );
                  setDeleteId("");
                  if (deleteTarget?.kind === "template") { setTemplatesOpen(true); returnToTemplates.current = false; }
                  if (draft?.id === deleteId) {
                    setDraft(null);
                    route();
                  }
                } catch (error) {
                  deleted.current.delete(deleteId);
                  setNotice((error as Error).message);
                } finally { setDeleting(false); }
              }}
            >
              {deleteTarget?.kind === "template" ? "Delete template" : "Delete draft"}
            </button>
            <button onClick={closeDelete} disabled={deleting}>{deleteTarget?.kind === "template" ? "Keep template" : "Keep draft"}</button>
          </div>
  );
  // The retained header rides the same compositor scroller as the Offers page.
  const toolbar = (
    <div
      className="studio-browser-toolbar"
      data-editor-hidden={draft ? "true" : undefined}
      aria-hidden={draft ? true : undefined}
      inert={!!draft}
    >
      <div className="studio-page-title">
        <div>
          <h1>
            Offers<span>.</span>
          </h1>
        </div>
        <div className="studio-title-actions">
          <button
            className="studio-new"
            aria-label="New offer"
            onClick={() => edit(newOffer())}
            disabled={!loaded || busy}
          >
            <Plus />
            <span>New offer</span>
          </button>
        </div>
      </div>
      <div className="studio-list-toolbar">
        <button
          className="studio-import"
          aria-label="Offer templates"
          onClick={() => setTemplatesOpen(true)}
          disabled={!loaded || busy}
        >
          <Layers3 />
          <span>Templates</span>
        </button>
      </div>
    </div>
  );
  return (
    <section className="offer-studio" aria-label="Offers">
      {toolbarHost ? createPortal(toolbar, toolbarHost) : toolbar}
      {preparation.queue && !draft && (
        <PreparationProgress
          visible={isVisible}
          queue={preparation.queue}
          busy={preparation.busy}
          onResume={() => void preparation.resume()}
          onStop={preparation.stop}
          onOpen={() => {
            const item = drafts.find(
              (d) => d.id === preparation.queue!.draftId,
            );
            if (item) edit(item);
            else setNotice("The queued draft is not available on this device.");
          }}
        />
      )}
      <input
        ref={importInput}
        type="file"
        accept="application/json,.json,.resell"
        hidden
        onChange={importDraft}
        aria-label="Import offer file"
      />
      {!draft ? (
        <>
          <MissingOfferReminders
            drafts={list}
            devices={devices}
            missingDevices={missingDevices}
            onConfirm={closeMissingOffer}
            onSaved={onInventorySaved}
            excludedDraftId={preparation.queue && ["ready", "waiting"].includes(preparation.queue.phase) ? preparation.queue.draftId : undefined}
            separate={loaded && list.length > 0}
          />
          {notice && (
            <p className="studio-notice" role="status">
              {notice}
            </p>
          )}
          {!loaded ? (
            <div className="studio-loading">
              <LoaderCircle className="spinning" />
              <span>Opening drafts</span>
            </div>
          ) : list.length ? (
            <div className="studio-draft-list">
              {list.map((item) => (
                <DraftCard
                  key={item.id}
                  draft={item}
                  onEdit={() => edit(item)}
                  onActions={() => openActions(item, "offers")}
                  onDelete={() => setDeleteId(item.id)}
                />
              ))}
            </div>
          ) : (
            <CollectionEmpty title="No drafts yet." description="Create an offer to prepare it on 999.md." onCreate={() => edit(newOffer())} illustration={<div className="studio-empty-art"><SquarePen /><span><Plus /></span></div>} />
          )}
        </>
      ) : (
        <div className="studio-editor-screen">
          <header className="studio-editor-nav">
            <button
              className="studio-back"
              aria-label={draft.kind === "template" ? "Back to templates" : "Back to offers"}
              onClick={() => void close()}
              disabled={busy}
            >
              <ArrowLeft />
            </button>
            <nav
              className="studio-steps"
              aria-label="Offer sections"
              role="tablist"
              data-step={step}
            >
              <span className="studio-step-selection" aria-hidden="true" />
              {steps.map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  id={`offer-tab-${id}`}
                  aria-controls={`offer-panel-${id}`}
                  aria-selected={step === id}
                  tabIndex={step === id ? 0 : -1}
                  onKeyDown={(event) => {
                    const current = steps.findIndex(([name]) => name === id);
                    const next =
                      event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? 2
                          : event.key === "ArrowRight"
                            ? (current + 1) % 3
                            : event.key === "ArrowLeft"
                              ? (current + 2) % 3
                              : -1;
                    if (next < 0) return;
                    event.preventDefault();
                    selectStep(steps[next][0]);
                    document
                      .getElementById(`offer-tab-${steps[next][0]}`)
                      ?.focus();
                  }}
                  aria-current={step === id ? "step" : undefined}
                  onClick={() => {
                    selectStep(id);
                  }}
                >
                  {label}
                  {id === "photos" && draft.photos.length > 0 && (
                    <span>{draft.photos.length}</span>
                  )}
                </button>
              ))}
            </nav>
            <button
              className="studio-icon"
              aria-label="Offer actions"
              onClick={() => openActions(draft, "editor")}
              disabled={busy}
            >
              <MoreHorizontal />
            </button>
          </header>

          <SectionPager
            index={steps.findIndex(([id]) => id === step)}
            count={3}
            active={isVisible}
            disabled={busy}
            onIndex={(index) => setStep(steps[index][0])}
          >
            <div
              className="studio-tab-panel studio-scroll"
              id="offer-panel-details"
              role="tabpanel"
              aria-labelledby="offer-tab-details"
              aria-hidden={step !== "details" ? true : undefined}
              inert={step !== "details"}
            >
              {notice && (
                <p className="studio-notice" role="status">
                  {notice}
                </p>
              )}
              <div className="studio-section-intro">
                <h2>{draft.kind === "template" ? "Template details." : "Offer details."}</h2>
              </div>
              <section className="studio-group">
                <h3>The offer</h3>
                <div className="studio-fields">
                  {draft.kind === "template" && field("templateName", "Template name", "iPhone · New · Store")}
                  {field(
                    "title",
                    draft.language === "ro"
                      ? "Romanian title"
                      : "Russian title",
                    "iPhone 15 Pro, 256 GB",
                  )}
                  {field(
                    "secondaryTitle",
                    draft.language === "ro"
                      ? "Russian title"
                      : "Romanian title",
                    "Title in the second language",
                  )}
                  <div className="studio-price-row">
                    {field("price", "Asking price", "0", "decimal")}
                    <CurrencyPicker value={draft.currency} onChange={value => update("currency", value)} />
                  </div>
                </div>
                <AccountPrices owner={scope} draft={draft} onChange={prices => update("accountPrices", prices)} />
                <p className="studio-group-note">
                  999.md requires a title in both languages.
                </p>
              </section>
              <section className="studio-group">
                <h3>Description</h3>
                <div className="studio-fields">
                  <Picker
                    label="Description language"
                    value={draft.language}
                    items={[
                      ["ro", "Romanian"],
                      ["ru", "Russian"],
                    ]}
                    onChange={(value) => {
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              language: value as "ro" | "ru",
                              title: current.secondaryTitle,
                              secondaryTitle: current.title,
                              updatedAt: new Date().toISOString(),
                            }
                          : current,
                      );
                    }}
                  />
                  <label className="studio-description">
                    <textarea
                      value={draft.description}
                      onChange={(event) =>
                        update("description", event.target.value)
                      }
                      maxLength={2000}
                      placeholder="Condition, accessories, warranty and delivery. Keep it clear and personal."
                      aria-label="Offer description"
                    />
                    <span>
                      {draft.description.length.toLocaleString(localeFor())} / 2,000
                    </span>
                  </label>
                </div>
              </section>
              <section className="studio-group">
                <h3>Device</h3>
                <div className="studio-fields">
                  <Picker
                    label="Brand"
                    value={draft.brand}
                    items={presetChoices(
                      devicePresets.brand,
                      knownValues("brand"),
                    )}
                    allowCustom
                    onChange={(value) =>
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              brand: value,
                              model:
                                current.brand === value ? current.model : "",
                              operatingSystem:
                                value === "Apple"
                                  ? "IOS"
                                  : value !== current.brand &&
                                      current.operatingSystem === "IOS"
                                    ? ""
                                    : current.operatingSystem,
                              updatedAt: new Date().toISOString(),
                            }
                          : current,
                      )
                    }
                  />
                  <Picker
                    label="Model"
                    value={draft.model}
                    items={models}
                    allowCustom
                    onChange={(value) => update("model", value)}
                  />
                  <Picker
                    label="Condition"
                    value={draft.condition}
                    items={[
                      ["used", "Used"],
                      ["new", "New"],
                    ]}
                    onChange={(v) => update("condition", v as "new" | "used")}
                  />
                  {choice("storage", "Storage")}
                  {choice("ram", "RAM")}
                  {choice("operatingSystem", "Operating system")}
                  {choice("deviceType", "Device type")}
                  {choice("color", "Color")}
                  <Picker
                    label="Battery health"
                    value={draft.batteryHealth}
                    items={Array.from(
                      { length: 101 },
                      (_, i) =>
                        [String(100 - i), `${100 - i}%`] as [string, string],
                    )}
                    onChange={(value) => update("batteryHealth", value)}
                  />
                  {field(
                    "batteryCapacity",
                    "Battery capacity · mAh",
                    "Optional",
                    "numeric",
                  )}
                </div>
                <p className="studio-group-note">
                  Use the specification names shown on 999.md. Unknown values
                  stay empty.
                </p>
              </section>
              <section className="studio-group">
                <h3>Location & contact</h3>
                <div className="studio-fields">
                  {choice("location", "City")}
                  <Picker
                    label="Seller"
                    value={draft.sellerType}
                    items={[
                      ["private", "Private seller"],
                      ["shop", "Shop"],
                    ]}
                    onChange={(v) =>
                      update("sellerType", v as "private" | "shop")
                    }
                  />
                  {field("phone", "Phone", "Optional · use 999.md chat", "tel")}
                </div>
                <p className="studio-group-note">
                  Phone verification is completed on 999.md.
                </p>
              </section>
            </div>
            <div
              className="studio-tab-panel studio-scroll"
              id="offer-panel-photos"
              role="tabpanel"
              aria-labelledby="offer-tab-photos"
              aria-hidden={step !== "photos" ? true : undefined}
              inert={step !== "photos"}
            >
              {notice && (
                <p className="studio-notice" role="status">
                  {notice}
                </p>
              )}
              {draft.kind === "template" ? <div className="studio-section-intro"><h2>Photos stay with each offer.</h2><p>Templates save text and specifications only. Add fresh photos after using this template.</p></div> : <>
              <div className="studio-section-intro">
                <h2>Photos.</h2>
                <p>
                  The first photo is the cover. Tap a photo to move it or make
                  it the cover.
                </p>
              </div>
              <div className="studio-photo-count">
                <strong>
                  {draft.photos.length}
                  <span> / 10 photos</span>
                </strong>
                <span>
                  {(
                    draft.photos.reduce((total, p) => total + p.blob.size, 0) /
                    1024 /
                    1024
                  ).toFixed(1)}{" "}
                  MB
                </span>
              </div>
              <PhotoGrid
                photos={draft.photos}
                onOpen={setPhotoId}
                onReorder={reorder}
              >
                {cameraPreview?.draftId === draft.id && !draft.photos.some(photo => photo.id === cameraPreview.photo.id) && (
                  <div className="studio-camera-preview" role="status" aria-label="Preparing photo">
                    <OfferPhotoImage photo={cameraPreview.photo} full />
                    <span><LoaderCircle size={18} /> Preparing photo</span>
                  </div>
                )}
                {draft.photos.length < 10 && (
                  <AddOfferPhotos disabled={busy || !!cameraPreview} onChange={addPhotos} onCamera={capturePhoto ? () => void capturePhoto(draft) : undefined} />
                )}
              </PhotoGrid>
              </>}
            </div>
            <div
              className="studio-tab-panel studio-scroll"
              id="offer-panel-review"
              role="tabpanel"
              aria-labelledby="offer-tab-review"
              aria-hidden={step !== "review" ? true : undefined}
              inert={step !== "review"}
            >
              {notice && (
                <p className="studio-notice" role="status">
                  {notice}
                </p>
              )}
              <div className="studio-section-intro">
                <h2>Review offer.</h2>
              </div>
              {errors.length > 0 && (
                <div className="studio-validation" role="alert">
                  <strong>A few details to finish</strong>
                  <ul>
                    {errors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                  <button
                    onClick={() =>
                      selectStep(draft.photos.length ? "details" : "photos")
                    }
                  >
                    Finish the details
                    <ArrowRight />
                  </button>
                </div>
              )}
              <section className="studio-review-card">
                {draft.photos.length ? (
                  <OfferGallery
                    photos={draft.photos}
                    title={draft.title || "Offer photos"}
                    active={isVisible && step === "review"}
                  />
                ) : draft.kind === "template" ? null : (
                  <div className="studio-review-photos">
                    <button onClick={() => selectStep("photos")}>
                      <ImagePlus />
                      Add photos
                    </button>
                  </div>
                )}
                <div className="studio-review-body">
                  <span className="studio-kicker">
                    {draft.brand || "DEVICE"}
                  </span>
                  <h2 translate={draft.title ? "no" : "yes"}>{draft.title || "Offer title"}</h2>
                  <strong className="studio-review-price">
                    {money(draft)}
                  </strong>
                  <p className="studio-review-specs">
                    {[
                      draft.model,
                      draft.storage,
                      draft.condition === "new" ? "New" : "Used",
                      draft.batteryHealth
                        ? draft.batteryHealth + "% battery"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <dl>
                    <div>
                      <dt>
                        {draft.language === "ro"
                          ? "Russian title"
                          : "Romanian title"}
                      </dt>
                      <dd translate={draft.secondaryTitle ? "no" : "yes"}>{draft.secondaryTitle || "Add a second title"}</dd>
                    </div>
                    <div>
                      <dt>Location</dt>
                      <dd>{draft.location || "Add a city"}</dd>
                    </div>
                    <div>
                      <dt>Contact</dt>
                      <dd>{draft.phone || "999.md chat"}</dd>
                    </div>
                  </dl>
                  <p className="studio-review-description" translate={draft.description ? "no" : "yes"}>
                    {draft.description || "Add a description."}
                  </p>
                  {preparation.queue?.draftId === draft.id && (
                    <PreparationProgress
                      visible={isVisible && step === "review"}
                      queue={preparation.queue}
                      busy={preparation.busy}
                      onResume={() => void preparation.resume()}
                      onStop={preparation.stop}
                    />
                  )}
                </div>
              </section>
            </div>
          </SectionPager>
          <footer className="studio-editor-footer">
            {draft.kind === "template" ? (
              <button className="studio-primary" disabled={busy} onClick={() => void close()}><Check />Save template</button>
            ) : step === "review" ? (
              <button
                className="studio-primary"
                onClick={() =>
                  preparation.queue?.draftId === draft.id &&
                  preparation.queue.phase !== "completed"
                    ? void preparation.resume()
                    : void prepare()
                }
                disabled={
                  busy ||
                  preparation.busy ||
                  preparation.queue?.phase === "waiting"
                }
              >
                {busy ? (
                  <LoaderCircle className="spinning" />
                ) : (
                  <ArrowUpRight />
                )}
                {preparation.queue?.draftId === draft.id &&
                preparation.queue.phase !== "completed"
                  ? "Resume preparation"
                  : "Publish on 999.md"}
              </button>
            ) : (
              <button
                className="studio-primary"
                disabled={busy}
                onClick={() => {
                  selectStep(step === "details" ? "photos" : "review");
                }}
              >
                {step === "details" ? "Choose photos" : "Review offer"}
                <ArrowRight />
              </button>
            )}
          </footer>
        </div>
      )}
      {connectRequired && (
        <MarketplaceSignInSheet
          owner={scope}
          pricing={draft || undefined}
          required
          onClose={() => setConnectRequired(false)}
          onSaved={(accountId) => {
            setConnectRequired(false);
            void prepare(accountId);
          }}
        />
      )}
      {actionDraft && !templatesOpen && (
        <Sheet
          title={actionDraft.kind === "template" ? actionDraft.templateName || "Template actions" : actionDraft.title || "Offer actions"}
          onClose={closeActions}
          className="draft-action-sheet"
        >
          {draftActions}
        </Sheet>
      )}
      {templatesOpen && <TemplateLibrary templates={templates} title={deleteTarget ? "Delete this template?" : actionDraft ? actionDraft.templateName || actionDraft.title || "Template actions" : undefined} onClose={() => { if (deleteTarget) closeDelete(); else if (actionDraft) closeActions(); else setTemplatesOpen(false); }}
        onCreate={() => editTemplate({ ...newOffer(), kind: "template", templateName: "Phone template" })}
        onUse={useTemplate} onActions={value => openActions(value, "library")}>{deleteTarget ? deleteConfirmation : actionDraft ? draftActions : null}</TemplateLibrary>}
      {templateName !== null && templateSource && <TemplateNameDialog initialName={templateName}
        onClose={closeTemplateSave}
        onSave={async name => { await persist(asTemplate(templateSource, name)); closeTemplateSave(); }} />}
      {photo && draft && (
        <Sheet title={`Photo ${photoIndex + 1}`} onClose={() => setPhotoId("")}>
          <div className="studio-photo-edit">
            <OfferPhotoImage photo={photo} full />
            <button
              className="studio-primary"
              disabled={photoIndex === 0}
              onClick={() => reorder(photoIndex, 0)}
            >
              <Check />
              {photoIndex === 0 ? "Cover photo" : "Make cover"}
            </button>
            <div className="studio-photo-move">
              <button
                disabled={!photoIndex}
                onClick={() => reorder(photoIndex, photoIndex - 1)}
              >
                <ArrowLeft />
                Move earlier
              </button>
              <button
                disabled={photoIndex === draft.photos.length - 1}
                onClick={() => reorder(photoIndex, photoIndex + 1)}
              >
                Move later
                <ArrowRight />
              </button>
            </div>
            <button
              className="studio-danger"
              onClick={() => {
                update(
                  "photos",
                  draft.photos.filter((item) => item.id !== photoId),
                );
                setPhotoId("");
              }}
            >
              <Trash2 />
              Remove photo
            </button>
          </div>
        </Sheet>
      )}
      {deleteId && !templatesOpen && (
        <Sheet title={deleteTarget?.kind === "template" ? "Delete this template?" : "Delete this draft?"} onClose={closeDelete}>
          {deleteConfirmation}
        </Sheet>
      )}
      {handoff && draft && (
        <Sheet title="Prepare on 999.md" onClose={() => setHandoff(false)}>
          <div className="studio-web-handoff">
            <div className="studio-handoff-icon">
              <Smartphone />
            </div>
            <h3>
              Take the next step
              <br />
              in the Resell mobile app.
            </h3>
            <p>
              The mobile app can fill 999.md with these photos and details. In
              a browser, copy the text and save the photos below, then complete
              the form on 999.md.
            </p>
            <div className="studio-fields">
              <button
                onClick={() =>
                  void copy(draft.title + "\n" + draft.secondaryTitle)
                }
              >
                <Copy />
                Copy titles
              </button>
              <button onClick={() => void copy(draft.description)}>
                <Copy />
                Copy description
              </button>
              <button
                onClick={async () => {
                  try {
                    const { photoArchive } = await import("./photo-export");
                    download(
                      await photoArchive(draft.photos),
                      "Resell-photos.zip",
                    );
                  } catch (error) {
                    setNotice((error as Error).message);
                  }
                }}
              >
                <ArrowDownToLine />
                Save all photos
              </button>
              <button
                onClick={async () => {
                  try {
                    download(
                      new Blob([JSON.stringify(await transferOffer(draft))], {
                        type: "application/json",
                      }),
                      "Resell-offer.resell.json",
                    );
                  } catch (error) {
                    setNotice((error as Error).message);
                  }
                }}
              >
                <Upload />
                Export offer for the app
              </button>
              <a
                href="https://999.md/ro/add?category=phone-and-communication&subcategory=phone-and-communication/mobile-phones&offerType=776"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ArrowUpRight />
                Open 999.md
              </a>
            </div>
            <p className="studio-group-note">
              Camera capture and marketplace transfer require the Android app.
            </p>
          </div>
        </Sheet>
      )}
    </section>
  );
}
