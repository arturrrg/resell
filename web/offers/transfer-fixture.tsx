import { useEffect, useRef, useState } from "react";
import type { OfferTransfer, TransferReport } from "../../shared/offer-draft";
import { fillOfferForm } from "../../shared/offer-form";
import { mountOfferPanel } from "../../shared/offer-panel";
function Combo({
  id,
  label,
  values,
  disabled = false,
  onSelect,
}: {
  id: string;
  label: string;
  values: string[];
  disabled?: boolean;
  onSelect?: (value: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [value, setValue] = useState("");
  return (
    <label>
      {label}
      <input
        readOnly
        value={value}
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        disabled={disabled}
        data-testid={`${id}-input`}
        onClick={() => setOpen(!open)}
      />
      {open && (
        <div role="listbox" id={id}>
          {values.map((text) => (
            <div
              key={text}
              role="option"
              aria-selected={value === text}
              onClick={() => {
                setValue(text);
                setOpen(false);
                onSelect?.(text);
              }}
            >
              {text}
            </div>
          ))}
        </div>
      )}
    </label>
  );
}
export function TransferFixture({ draft }: { draft: OfferTransfer }) {
  const root = useRef<HTMLDivElement>(null),
    [stage, setStage] = useState(""),
    [report, setReport] = useState<TransferReport | null>(null),
    [busy, setBusy] = useState(false),
    [files, setFiles] = useState<File[]>([]),
    [urls, setUrls] = useState<string[]>([]);
  const [selectedBrand, setSelectedBrand] = useState(""),
    [selectedDevice, setSelectedDevice] = useState(""),
    [testAccount, setTestAccount] = useState("sandbox-account");
  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setUrls(urls);
    return () => urls.forEach(URL.revokeObjectURL);
  }, [files]);
  useEffect(() => {
    const node = root.current!;
    const received = (event: Event) =>
      setReport((event as CustomEvent<TransferReport>).detail);
    node.addEventListener("resell-native-result", received);
    return () => {
      node.removeEventListener("resell-native-result", received);
      node.querySelector("#resell-native-prepare")?.remove();
    };
  }, []);
  return (
    <div className="offer-fixture" ref={root}>
      <p className="offer-private-note">
        Local fixture using the field IDs and control types inspected on 999.md.
        This test uploads no files to the marketplace and cannot publish an
        advert.
      </p>
      <a
        href={`https://999.md/ro/cabinet/items/${testAccount}`}
        onClick={(event) => event.preventDefault()}
      >
        Sandbox account · test only
      </a>
      <button
        className="offer-test"
        onClick={() =>
          setTestAccount((previous) =>
            previous === "sandbox-account"
              ? "other-sandbox-account"
              : "sandbox-account",
          )
        }
      >
        Switch sandbox account
      </button>
      <button
        className="offer-test"
        onClick={() => mountOfferPanel(draft, location.href, root.current!)}
      >
        Preview native handoff
      </button>
      <button
        className="offer-prepare"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            setReport(
              await fillOfferForm(draft, root.current!, { onStage: setStage }),
            );
          } catch (error) {
            setStage((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Fill sandbox form
      </button>
      <p role="status" className="offer-fixture-report">
        {busy
          ? stage
          : report
            ? `${report.status === "ready" ? "Transfer passed" : "Needs attention"} · ${report.photos} photos accepted. ${report.message} ${report.missing.join("; ")}`
            : stage}
      </p>
      <fieldset>
        <legend>Category</legend>
        <label>
          <input type="radio" id="radio-776" name="1-option-776" />
          Sell
        </label>
        <Combo
          id="2245"
          label="Device type"
          values={["Smartphone-uri", "Telefoane cu butoane"]}
          onSelect={setSelectedDevice}
        />
      </fieldset>
      {selectedDevice && (
        <>
          <fieldset>
            <legend>Specifications</legend>
            <Combo
              id="589"
              label="Brand"
              values={["Apple", "Samsung", "Xiaomi", "Google", "Nothing"]}
              onSelect={setSelectedBrand}
            />
            <Combo
              id="590"
              key={selectedBrand}
              label="Model"
              disabled={!selectedBrand}
              values={
                selectedBrand === "Apple"
                  ? ["iPhone 13 Pro", "iPhone 15 Pro", "iPhone 16 Plus"]
                  : ["Pixel 9", "Galaxy S24", "Redmi Note 13"]
              }
            />
            <Combo
              id="795"
              label="Seller type"
              values={["Persoană fizică", "Magazin"]}
            />
            <Combo
              id="593"
              label="Condition"
              values={["Nou", "Uzat", "Pentru piese"]}
            />
            <Combo
              id="591"
              label="Operating system"
              values={["IOS", "Android", "HyperOS"]}
            />
            <Combo
              id="1265"
              label="Storage"
              values={["64 GB", "128 GB", "256 GB", "512 GB", "1 TB"]}
            />
            <Combo
              id="1266"
              label="RAM"
              values={["4 GB", "6 GB", "8 GB", "12 GB", "16 GB"]}
            />
            <Combo
              id="1422"
              label="Color"
              values={["Negru", "Alb", "Albastru", "Gri"]}
            />
            <Combo
              id="7"
              label="Location"
              values={["Chișinău mun.", "Bălți mun.", "Cahul"]}
            />
            <Combo id="2.unit" label="Currency" values={["MDL", "€", "$"]} />
            <label>
              Price
              <input name="2.value" />
            </label>
            <label>
              Battery capacity
              <input name="2279" />
            </label>
            <label>
              Battery health
              <input name="2107" />
            </label>
          </fieldset>
          <fieldset>
            <legend>Title & description</legend>
            <label>
              Romanian title
              <input name="12.ro" maxLength={100} required />
            </label>
            <label>
              Romanian description
              <textarea name="13.ro" />
            </label>
            <label>
              Russian title
              <input name="12.ru" maxLength={100} required />
            </label>
            <label>
              Russian description
              <textarea name="13.ru" />
            </label>
          </fieldset>
          <fieldset>
            <legend>Photos</legend>
            <input
              type="file"
              id="upload-photo"
              name="14"
              multiple
              onChange={(event) =>
                setFiles(Array.from(event.target.files || []))
              }
            />
            <div className="offer-fixture-photos">
              {urls.map((url) => (
                <button
                  key={url}
                  type="button"
                  data-testid="ad_form_open_image_button"
                >
                  <img src={url} alt="Transferred sandbox photo" />
                </button>
              ))}
            </div>
          </fieldset>
          <button disabled type="button">
            Publish is deliberately unavailable in this sandbox
          </button>
        </>
      )}
    </div>
  );
}
