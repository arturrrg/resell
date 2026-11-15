import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  FlaskConical,
  ImagePlus,
  LoaderCircle,
  Plus,
  SquarePen,
  Trash2,
  X,
} from "lucide-react";
import {
  newOffer,
  offerProblems,
  transferOffer,
  MAX_OFFER_PHOTOS,
  type OfferDraft,
  type OfferPhoto,
  type OfferTransfer,
} from "../../shared/offer-draft";
import { savedDrafts, saveDraft } from "./draft-store";
import { inNativeApp, prepareNativeOffer } from "./native";
import { Sheet } from "../sheet";
import { TransferFixture } from "./transfer-fixture";
import "./offers.css";

function Choice({
  label,
  value,
  choices,
  onChange,
}: {
  label: string;
  value: string;
  choices: string[][];
  onChange: (value: string) => void;
}) {
  return (
    <details className="offer-choice">
      <summary>
        <span>{label}</span>
        <strong>
          {choices.find(([id]) => id === value)?.[1] || value || "Choose"}
        </strong>
        <ChevronDown />
      </summary>
      <div>
        {choices.map(([id, text]) => (
          <button
            type="button"
            key={id}
            aria-pressed={id === value}
            onClick={(event) => {
              onChange(id);
              event.currentTarget.closest("details")!.open = false;
            }}
          >
            {text}
            {id === value && <Check />}
          </button>
        ))}
      </div>
    </details>
  );
}
function Photo({ photo }: { photo: OfferPhoto }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const next = URL.createObjectURL(photo.blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [photo.blob]);
  return <img src={url || undefined} alt={photo.name} draggable={false} />;
}
async function importPhoto(file: File): Promise<OfferPhoto> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw Error("Choose JPEG, PNG or WebP photographs.");
  if (file.size > 12 * 1024 * 1024)
    throw Error(`${file.name} is larger than 12 MB.`);
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  try {
    if (
      !bitmap.width ||
      !bitmap.height ||
      bitmap.width * bitmap.height > 80_000_000
    )
      throw Error(
        "This photo is too large to prepare safely. Export a smaller copy first.",
      );
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("Photo preparation is unavailable in this browser.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(Error("Photo could not be prepared.")),
        "image/jpeg",
        0.92,
      ),
    );
    return {
      id: crypto.randomUUID(),
      name: file.name.replace(/\.[^.]+$/, "") + ".jpg",
      type: "image/jpeg",
      blob,
    };
  } finally {
    bitmap.close();
  }
}
export function OfferLab() {
  const [draft, setDraft] = useState<OfferDraft>(newOffer),
    [drafts, setDrafts] = useState<OfferDraft[]>([]),
    [loaded, setLoaded] = useState(false),
    [saved, setSaved] = useState(false),
    [working, setWorking] = useState(false),
    [notice, setNotice] = useState(""),
    [setup, setSetup] = useState(false),
    [fixture, setFixture] = useState<OfferTransfer | null>(null);
  const latest = useRef(draft),
    upload = useRef<HTMLInputElement>(null),
    mounted = useRef(true);
  latest.current = draft;
  useEffect(() => {
    mounted.current = true;
    void savedDrafts()
      .then((items) => {
        if (!mounted.current) return;
        setDrafts(items);
        if (items[0]) setDraft(items[0]);
        setLoaded(true);
      })
      .catch((error) => {
        setNotice(error.message);
        setLoaded(true);
      });
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    setSaved(false);
    const timer = setTimeout(() => {
      void saveDraft(draft)
        .then(() => {
          if (!mounted.current) return;
          setDrafts((previous) => [
            draft,
            ...previous.filter((item) => item.id !== draft.id),
          ]);
          if (
            latest.current.updatedAt === draft.updatedAt &&
            latest.current.id === draft.id
          )
            setSaved(true);
        })
        .catch((error) => {
          if (mounted.current)
            setNotice(`Could not save this draft: ${error.message}`);
        });
    }, 400);
    return () => clearTimeout(timer);
  }, [draft, loaded]);
  function set<K extends keyof OfferDraft>(key: K, value: OfferDraft[K]) {
    setSaved(false);
    setDraft((previous) => ({
      ...previous,
      [key]: value,
      updatedAt: new Date().toISOString(),
    }));
  }
  const field = (
    key: keyof OfferDraft,
    label: string,
    placeholder = "",
    inputMode?: "decimal" | "tel" | "numeric",
  ) => (
    <label className="offer-field">
      <span>{label}</span>
      <input
        value={String(draft[key] || "")}
        onChange={(event) => set(key, event.target.value as never)}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete="off"
      />
    </label>
  );
  async function addPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    setWorking(true);
    setNotice("");
    try {
      if (draft.photos.length + files.length > MAX_OFFER_PHOTOS)
        throw Error(`Use at most ${MAX_OFFER_PHOTOS} photographs.`);
      const additions: OfferPhoto[] = [];
      for (const file of files) additions.push(await importPhoto(file));
      set("photos", [...draft.photos, ...additions]);
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setWorking(false);
    }
  }
  function reorder(from: number, to: number) {
    const photos = [...draft.photos];
    const [photo] = photos.splice(from, 1);
    photos.splice(to, 0, photo);
    set("photos", photos);
  }
  async function prepare(test: boolean) {
    setNotice("");
    const issues = offerProblems(draft);
    if (issues.length) {
      setNotice(issues.join(" "));
      return;
    }
    if (!test && !inNativeApp()) {
      setSetup(true);
      return;
    }
    setWorking(true);
    try {
      await saveDraft(draft);
      setSaved(true);
      const transfer = await transferOffer(draft);
      if (test) setFixture(transfer);
      else {
        await prepareNativeOffer(transfer);
      }
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setWorking(false);
    }
  }
  async function loadTestDraft(count = 2) {
    setWorking(true);
    setNotice("");
    try {
      await saveDraft(draft);
      const image = await fetch("/icons/resell.png");
      if (!image.ok) throw Error("The bundled test image is unavailable.");
      const blob = await image.blob();
      const photo = await importPhoto(
        new File([blob], "resell-test.png", { type: "image/png" }),
      );
      const secondImage = await fetch(
        new URL("../../src-tauri/icons/128x128.png", import.meta.url).href,
      );
      if (!secondImage.ok) throw Error("The second test image is unavailable.");
      const secondPhoto = await importPhoto(
        new File([await secondImage.blob()], "resell-test-second.png", {
          type: "image/png",
        }),
      );
      const photos = count === 10
        ? await Promise.all((await (await import('./test-photos')).numberedTestPhotos(10)).map(importPhoto))
        : [photo, secondPhoto];
      setDraft({
        ...newOffer(),
        title: "Sandbox test — iPhone 15 Pro",
        secondaryTitle: "Тест Resell — iPhone 15 Pro",
        description:
          "Test de pregătire Resell. Nu este un anunț de vânzare.\nVerificare foto, memorie și baterie.\nТест переноса без публикации.",
        price: "13000",
        brand: "Apple",
        model: "iPhone 15 Pro",
        storage: "256 GB",
        ram: "8 GB",
        operatingSystem: "IOS",
        batteryHealth: "94",
        batteryCapacity: "3274",
        location: "Chișinău",
        photos,
      });
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setWorking(false);
    }
  }
  return (
    <div className="offer-lab">
      <div className="offer-nav">
        <a className="wordmark" href="/">
          Resell.
        </a>
        <span className="offer-sandbox-badge">
          <FlaskConical /> Offer sandbox
        </span>
        <span className="offer-save" role="status">
          {saved ? <CircleCheck /> : <span className="offer-saving-dot" />}
          {saved ? "Saved on this device" : "Saving draft"}
        </span>
      </div>
      <div className="offer-intro">
        <div>
          <span className="offer-eyebrow">OFFER STUDIO</span>
          <h1>Create an offer.</h1>
          <p>Create a draft here. Review and publish it on 999.md.</p>
        </div>
        <button
          className="offer-new"
          disabled={working || !loaded}
          onClick={async () => {
            try {
              await saveDraft(draft);
              setDraft(newOffer());
            } catch (error) {
              setNotice((error as Error).message);
            }
          }}
        >
          <Plus /> New draft
        </button>
      </div>
      <div className="offer-draft-tabs" aria-label="Saved offer drafts">
        <button
          disabled={working || !loaded}
          onClick={() => void loadTestDraft()}
        >
          <FlaskConical /> Load test draft
        </button>
        <button disabled={working || !loaded} onClick={() => void loadTestDraft(10)}><FlaskConical />10-photo test</button>
        {drafts.map((item) => (
          <button
            key={item.id}
            className={item.id === draft.id ? "is-selected" : ""}
            onClick={async () => {
              if (working) return;
              try {
                await saveDraft(draft);
                setDraft(item);
              } catch (error) {
                setNotice((error as Error).message);
              }
            }}
          >
            {item.title || "Untitled offer"}
          </button>
        ))}
      </div>
      <div className="offer-layout">
        <div className="offer-editor" aria-busy={working}>
          <section className="offer-section">
            <div className="offer-section-title">
              <h2>Photos</h2>
              <span>First photo is the cover</span>
            </div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              ref={upload}
              onChange={addPhotos}
              aria-label="Add offer photos"
              className="offer-file"
            />
            <div className="offer-photos">
              {draft.photos.map((photo, index) => (
                <div className="offer-photo" key={photo.id}>
                  <Photo photo={photo} />
                  {index === 0 && <span className="offer-cover">Cover</span>}
                  <div className="offer-photo-actions">
                    <button
                      aria-label={`Move photo ${index + 1} left`}
                      disabled={working || !index}
                      onClick={() => reorder(index, index - 1)}
                    >
                      <ChevronLeft />
                    </button>
                    <button
                      aria-label={`Move photo ${index + 1} right`}
                      disabled={working || index === draft.photos.length - 1}
                      onClick={() => reorder(index, index + 1)}
                    >
                      <ChevronRight />
                    </button>
                    <button
                      aria-label={`Remove photo ${index + 1}`}
                      disabled={working}
                      onClick={() =>
                        set(
                          "photos",
                          draft.photos.filter((p) => p.id !== photo.id),
                        )
                      }
                    >
                      <X />
                    </button>
                  </div>
                </div>
              ))}
              <button
                className="offer-add-photo"
                disabled={working || !loaded}
                onClick={() => upload.current?.click()}
              >
                {working ? <LoaderCircle className="spin" /> : <ImagePlus />}
                <span>Add photos</span>
              </button>
            </div>
          </section>
          <section className="offer-section">
            <h2>The offer</h2>
            {field(
              "title",
              draft.language === "ro" ? "Romanian title" : "Russian title",
              "iPhone 15 Pro · 256 GB · Natural Titanium",
            )}
            {field(
              "secondaryTitle",
              draft.language === "ro" ? "Russian title" : "Romanian title",
              "Second title for 999.md",
            )}
            <div className="offer-fields">
              <label className="offer-field">
                <span>Asking price</span>
                <input
                  inputMode="decimal"
                  value={draft.price}
                  onChange={(event) => set("price", event.target.value)}
                  placeholder="0"
                />
              </label>
              <Choice
                label="Currency"
                value={draft.currency}
                choices={[
                  ["MDL", "MDL"],
                  ["EUR", "EUR"],
                  ["USD", "USD"],
                ]}
                onChange={(value) =>
                  set("currency", value as OfferDraft["currency"])
                }
              />
            </div>
            <label className="offer-field offer-description">
              <span>Description · {draft.description.length}/2,000</span>
              <textarea
                value={draft.description}
                onChange={(event) => set("description", event.target.value)}
                placeholder="Condition, included accessories, warranty and delivery…"
              />
            </label>
            <Choice
              label="Listing language"
              value={draft.language}
              choices={[
                ["ro", "Romanian"],
                ["ru", "Russian"],
              ]}
              onChange={(value) =>
                set("language", value as OfferDraft["language"])
              }
            />
          </section>
          <section className="offer-section">
            <h2>Specifications</h2>
            <div className="offer-fields">
              {field("brand", "Brand", "Apple")}
              {field("model", "Model", "iPhone 15 Pro")}
              {field("storage", "Storage", "256 GB")}
              {field("ram", "RAM", "8 GB")}
              <Choice
                label="Condition"
                value={draft.condition}
                choices={[
                  ["used", "Used"],
                  ["new", "New"],
                ]}
                onChange={(value) =>
                  set("condition", value as OfferDraft["condition"])
                }
              />
              {field("color", "Color", "Natural Titanium")}
              {field("deviceType", "Device type", "Smartphone-uri")}
              {field("operatingSystem", "Operating system", "iOS")}
              {field("batteryHealth", "Battery health · %", "100", "numeric")}
              {field(
                "batteryCapacity",
                "Battery capacity · mAh",
                "Optional",
                "numeric",
              )}
            </div>
          </section>
          <section className="offer-section">
            <h2>Contact & location</h2>
            <div className="offer-fields">
              <Choice
                label="Seller type"
                value={draft.sellerType || "private"}
                choices={[
                  ["private", "Private seller"],
                  ["shop", "Shop"],
                ]}
                onChange={(value) =>
                  set("sellerType", value as OfferDraft["sellerType"])
                }
              />
              {field("location", "Location", "Chișinău")}
              {field("phone", "Phone · optional", "+373…", "tel")}
            </div>
            <p className="offer-private-note">
              Without a phone number, the advert keeps 999.md chat contact.
              Phone verification stays on 999.md.
            </p>
          </section>
        </div>
        <aside className="offer-preview-area">
          <span className="offer-eyebrow">LIVE PREVIEW</span>
          <div className="offer-preview">
            <div className="offer-preview-image">
              {draft.photos[0] ? (
                <Photo photo={draft.photos[0]} />
              ) : (
                <ImagePlus />
              )}
              {draft.photos.length > 0 && (
                <span>{draft.photos.length} photos</span>
              )}
            </div>
            <div className="offer-preview-body">
              <span className="offer-eyebrow">{draft.brand || "BRAND"}</span>
              <div className="offer-preview-heading">
                <h2>{draft.title || "Your next offer"}</h2>
                <strong>
                  {draft.price || "—"} <small>{draft.currency}</small>
                </strong>
              </div>
              <p className="offer-preview-specs">
                {[
                  draft.model,
                  draft.storage,
                  draft.condition === "new" ? "New" : "Used",
                  draft.batteryHealth ? `${draft.batteryHealth}% battery` : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <div className="offer-preview-description">
                {draft.description || "The description will appear here."}
              </div>
            </div>
          </div>
          <button
            className="offer-prepare"
            disabled={working || !loaded}
            onClick={() => prepare(false)}
          >
            {working ? <LoaderCircle className="spin" /> : <SquarePen />}Prepare
            on 999.md
            <ArrowUpRight />
          </button>
          <button
            className="offer-test"
            disabled={working || !loaded}
            onClick={() => prepare(true)}
          >
            <FlaskConical /> Test transfer locally
          </button>
          <p className="offer-private-note">
            Sandbox drafts stay on this device, separate from your inventory.
            Nothing is published automatically.
          </p>
          {notice && (
            <p className="offer-notice" role="status">
              {notice}
            </p>
          )}
        </aside>
      </div>
      {setup && (
        <Sheet title="Prepare on your phone" onClose={() => setSetup(false)}>
          <div className="offer-helper-setup">
            <SquarePen />
            <h3>The draft is ready.</h3>
            <p>
              Automatic transfer runs inside the native Resell sandbox for
              iPhone and Android. It opens 999.md inside the app, checks the
              account, then fills the creator with your chosen photos and
              details.
            </p>
            <p>
              This browser preview can create, save and locally test drafts. It
              cannot fill a separate 999.md browser tab.
            </p>
            <button
              className="account-primary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    draft.title + "\n\n" + draft.description,
                  );
                  setNotice(
                    "Offer text copied. Photos and specifications still need transfer from the native sandbox.",
                  );
                  setSetup(false);
                } catch {
                  setNotice("Clipboard access is unavailable in this browser.");
                }
              }}
            >
              Copy offer text
            </button>
            <p className="offer-private-note">
              The native handoff still needs a device test before it is enabled
              in your main inventory.
            </p>
          </div>
        </Sheet>
      )}
      {fixture && (
        <Sheet
          title="Local transfer test"
          wide
          onClose={() => setFixture(null)}
        >
          <TransferFixture draft={fixture} />
        </Sheet>
      )}
    </div>
  );
}
