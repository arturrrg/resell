import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { SlidersHorizontal, X, Check, ChevronDown } from "lucide-react";
import type { Device } from "./storage";
import {
  emptyFilters,
  hasActiveFilters,
  type InventoryFilters,
  type ScalarFilter,
} from "./filters";
import {
  extraSpecifications,
  inventoryOptions,
  fieldMatches,
  inventoryField,
  fieldKey,
} from "./inventory-fields";
import { devicePresets } from "./offers/device-presets";
import { restoreDialogFocus } from "./pointer-intent";
import { filterMenuPosition } from "./filter-layout";
import { useBackAction } from "./back-navigation";
import { useLanguage, translate } from "./i18n";

function FilterChoice({
  name,
  title,
  items,
  value,
  open,
  onOpen,
  onSelect,
}: {
  name: string;
  title: string;
  items: string[][];
  value: string;
  open: boolean;
  onOpen: (open: boolean) => void;
  onSelect: (value: string) => void;
}) {
  const language = useLanguage();
  const summary = useRef<HTMLElement>(null),
    menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<CSSProperties | null>(null);
  const keyboard = useRef(false);
  const [query, setQuery] = useState("");
  const searchable = items.length > 8;
  const shown = open
    ? items.filter(([, label]) => [label, translate(label, language)].some(value => fieldKey(value).includes(fieldKey(query))))
    : [];
  useLayoutEffect(() => {
    if (!open) setQuery("");
  }, [open]);
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      if (!summary.current) return;
      const bounds = summary.current.getBoundingClientRect();
      const boundary = summary.current
        .closest(".filter-fields")
        ?.getBoundingClientRect();
      if (
        boundary &&
        (bounds.bottom <= boundary.top || bounds.top >= boundary.bottom)
      ) {
        onOpen(false);
        return;
      }
      setPosition({
        position: "fixed",
        ...filterMenuPosition(
          bounds,
          {
            width: innerWidth,
            height: window.visualViewport?.height || innerHeight,
          },
          Math.max(1, shown.length) + (searchable ? 1 : 0),
        ),
        right: "auto",
        margin: 0,
        zIndex: 1001,
      });
    };
    const reposition = (event: Event) => {
      if (event.target instanceof Node && menu.current?.contains(event.target))
        return;
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("resize", reposition, { passive: true });
    document.addEventListener("scroll", reposition, {
      capture: true,
      passive: true,
    });
    window.visualViewport?.addEventListener("resize", reposition, {
      passive: true,
    });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", reposition);
      document.removeEventListener("scroll", reposition, true);
      window.visualViewport?.removeEventListener("resize", reposition);
    };
  }, [open, items.length, shown.length]);
  useLayoutEffect(() => {
    if (open && position && keyboard.current) {
      (
        menu.current?.querySelector<HTMLElement>("input") ||
        menu.current?.querySelector<HTMLElement>('[aria-pressed="true"]')
      )?.focus({ preventScroll: true });
      keyboard.current = false;
    }
  }, [open, position]);
  return (
    <details className="filter-choice" open={open}>
      <summary
        ref={summary}
        aria-controls={`filter-options-${name}`}
        onClick={(event) => {
          event.preventDefault();
          keyboard.current = event.detail === 0;
          onOpen(!open);
        }}
      >
        <span>{title}</span>
        <strong>{items.find(([id]) => id === value)?.[1] || "Any"}</strong>
        <ChevronDown aria-hidden="true" />
      </summary>
      {open &&
        position &&
        createPortal(
          <div
            className="filter-choice-options"
            data-filter-menu="inventory-filters"
            id={`filter-options-${name}`}
            ref={menu}
            role="group"
            aria-label={`${title} options`}
            style={position}
          >
            {searchable && (
              <input
                className="filter-options-search"
                aria-label={`Search ${title.toLowerCase()} options`}
                placeholder="Search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            )}
            {!shown.length && (
              <p className="filter-options-empty">No matches</p>
            )}
            {shown.map(([id, label]) => (
              <button
                key={id}
                aria-pressed={value === id}
                onClick={() => {
                  onSelect(id);
                  onOpen(false);
                  restoreDialogFocus(summary.current);
                }}
              >
                {label}
                {value === id && <Check />}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </details>
  );
}
export function Filters({
  devices,
  value,
  onChange,
}: {
  devices: Device[];
  value: InventoryFilters;
  onChange: (value: InventoryFilters) => void;
}) {
  const [open, setOpen] = useState(false),
    [choice, setChoice] = useState<string | null>(null),
    [position, setPosition] = useState<CSSProperties>({}),
    root = useRef<HTMLDivElement>(null),
    panel = useRef<HTMLDivElement>(null),
    keyboardPanel = useRef(false),
    trigger = useRef<HTMLButtonElement>(null);
  const close = () => {
    setChoice(null);
    setOpen(false);
  };
  useBackAction(open, () => {
    if (choice) setChoice(null);
    else close();
  });
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      if (!trigger.current) return;
      const bounds = trigger.current.getBoundingClientRect(),
        mobile = innerWidth <= 760;
      const height = window.visualViewport?.height || innerHeight;
      const top = mobile
        ? (trigger.current.closest("header")?.getBoundingClientRect().bottom ||
            bounds.bottom) + 20
        : bounds.bottom + 12;
      const width = Math.min(520, innerWidth - 28);
      setPosition({
        position: "fixed",
        top,
        left: mobile
          ? 14
          : Math.max(
              14,
              Math.min(bounds.right - width, innerWidth - width - 14),
            ),
        right: mobile ? 14 : "auto",
        width: mobile ? "auto" : width,
        maxHeight: Math.max(120, height - top - (mobile ? 100 : 16)),
        zIndex: 1000,
      });
    };
    update();
    if (keyboardPanel.current) {
      panel.current
        ?.querySelector<HTMLElement>("button")
        ?.focus({ preventScroll: true });
      keyboardPanel.current = false;
    }
    window.addEventListener("resize", update, { passive: true });
    window.visualViewport?.addEventListener("resize", update, {
      passive: true,
    });
    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, [open]);
  const active = hasActiveFilters(value);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        target instanceof Element &&
        target.closest('[data-filter-menu="inventory-filters"]')
      )
        return;
      if (panel.current?.contains(target)) {
        if (!(
          target instanceof Element && target.closest(".filter-choice[open]")
        ))
          setChoice(null);
        return;
      }
      if (root.current?.contains(target)) return;
      close();
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (choice) {
          const summary = panel.current?.querySelector<HTMLElement>(
            ".filter-choice[open] summary",
          );
          setChoice(null);
          restoreDialogFocus(summary || null);
        } else {
          close();
          restoreDialogFocus(trigger.current);
        }
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open, choice]);
  const set = (key: ScalarFilter, next: string) =>
    onChange({
      ...value,
      [key]: next,
      ...(key === "brand" ? { model: "" } : {}),
    });
  const options = useMemo(() => {
    const available = open ? devices : [];
    const brandKey = Object.keys(devicePresets.models).find((brand) =>
      fieldMatches("brand", brand, value.brand),
    );
    const modelDevices = value.brand
      ? available.filter((d) =>
          fieldMatches("brand", inventoryField(d, "brand"), value.brand),
        )
      : available;
    return {
      brand: inventoryOptions(available, "brand", devicePresets.brand),
      model: inventoryOptions(
        modelDevices,
        "model",
        value.brand
          ? devicePresets.models[brandKey || ""] || []
          : Object.values(devicePresets.models).flat(),
      ),
      storage: inventoryOptions(available, "storage", devicePresets.storage),
      ram: inventoryOptions(available, "ram", devicePresets.ram),
      operatingSystem: inventoryOptions(
        available,
        "operatingSystem",
        devicePresets.operatingSystem,
      ),
      deviceType: inventoryOptions(
        available,
        "deviceType",
        devicePresets.deviceType,
      ),
      color: inventoryOptions(available, "color", devicePresets.color),
      location: inventoryOptions(available, "location", devicePresets.location),
      sellerName: inventoryOptions(available, "sellerName"),
    };
  }, [devices, value.brand, open]);
  const specifications = useMemo(
    () => (open ? extraSpecifications(devices) : []),
    [devices, open],
  );
  const group = (key: ScalarFilter, title: string, items: string[][]) => (
    <FilterChoice
      name={key}
      key={key}
      title={title}
      items={items}
      value={value[key]}
      open={choice === key}
      onOpen={(next) => setChoice(next ? key : null)}
      onSelect={(next) => set(key, next)}
    />
  );
  const optionsGroup = (
    key: keyof typeof options,
    title: string,
    any: string,
  ) =>
    group(key, title, [["", any], ...options[key].map((item) => [item, item])]);
  const range = (
    title: string,
    min: ScalarFilter,
    max: ScalarFilter,
    negative = false,
    ceiling?: number,
  ) => (
    <fieldset>
      <legend>{title}</legend>
      <div className="filter-range">
        <label>
          Minimum
          <input
            aria-label={`${title} minimum`}
            type="number"
            min={negative ? undefined : 0}
            max={ceiling}
            step="any"
            inputMode="decimal"
            placeholder="Any"
            value={value[min]}
            onChange={(event) => set(min, event.target.value)}
          />
        </label>
        <label>
          Maximum
          <input
            aria-label={`${title} maximum`}
            type="number"
            min={negative ? undefined : 0}
            max={ceiling}
            step="any"
            inputMode="decimal"
            placeholder="Any"
            value={value[max]}
            onChange={(event) => set(max, event.target.value)}
          />
        </label>
      </div>
    </fieldset>
  );
  return (
    <div className="filter-wrap" ref={root}>
      <button
        ref={trigger}
        className={`filter-trigger${active ? " filters-active" : ""}`}
        aria-label={active ? "Filters, active" : "Filters"}
        aria-expanded={open}
        aria-controls="inventory-filters"
        onClick={(event) => {
          if (open) close();
          else {
            keyboardPanel.current = event.detail === 0;
            setOpen(true);
          }
        }}
      >
        <SlidersHorizontal />
        <span>Filters</span>
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            style={position}
            className="filter-popover"
            id="inventory-filters"
            role="dialog"
            aria-label="Inventory filters"
          >
            <div className="filter-heading">
              <strong>Filter & sort</strong>
              <button
                aria-label="Close filters"
                onClick={() => {
                  close();
                  restoreDialogFocus(trigger.current);
                }}
              >
                <X />
              </button>
            </div>
            <div className="filter-fields">
              <h3 className="filter-section-title">Device</h3>
              {optionsGroup("brand", "Brand", "All brands")}
              {optionsGroup("model", "Model", "All models")}
              {optionsGroup("storage", "Storage", "Any storage")}
              {optionsGroup("ram", "RAM", "Any RAM")}
              {group("condition", "Condition", [
                ["", "Any condition"],
                ["new", "New"],
                ["used", "Used"],
              ])}
              {optionsGroup(
                "operatingSystem",
                "Operating system",
                "Any system",
              )}
              {optionsGroup("deviceType", "Device type", "All types")}
              {optionsGroup("color", "Color", "Any color")}
              {range("Battery health · %", "battery", "batteryMax", false, 100)}
              {range("Battery capacity · mAh", "capacityMin", "capacityMax")}
              <h3 className="filter-section-title">Listing & inventory</h3>
              {optionsGroup("location", "City / location", "Any location")}
              {group("sellerType", "Seller type", [
                ["", "All sellers"],
                ["private", "Private seller"],
                ["shop", "Shop"],
              ])}
              {optionsGroup("sellerName", "Seller", "Any seller")}
              {group("currency", "Currency", [
                ["", "All currencies"],
                ["MDL", "MDL"],
                ["EUR", "EUR"],
                ["USD", "USD"],
              ])}
              {group("media", "Media", [
                ["", "All media"],
                ["video", "With video"],
                ["photos", "Photos only"],
              ])}
              {range("Asking price · MDL", "min", "max")}
              {group("sort", "Sort by", [
                ["recent", "Newest first"],
                ["price", "Price: low to high"],
                ["price-desc", "Price: high to low"],
              ])}
              {specifications.length > 0 && (
                <h3 className="filter-section-title">More specifications</h3>
              )}
              {specifications.map((spec) => (
                <FilterChoice
                  key={spec.key}
                  name={`spec-${spec.key}`}
                  title={spec.label}
                  items={[
                    ["", "Any"],
                    ...spec.values.map((item) => [item, item]),
                  ]}
                  value={
                    Object.hasOwn(value.specifications, spec.key)
                      ? value.specifications[spec.key]
                      : ""
                  }
                  open={choice === `spec-${spec.key}`}
                  onOpen={(next) => setChoice(next ? `spec-${spec.key}` : null)}
                  onSelect={(next) =>
                    onChange({
                      ...value,
                      specifications: {
                        ...value.specifications,
                        [spec.key]: next,
                      },
                    })
                  }
                />
              ))}
            </div>
            <div className="filter-bottom">
              <button
                className="filter-reset"
                onClick={() => {
                  setChoice(null);
                  onChange({ ...emptyFilters });
                }}
              >
                Reset
              </button>
              <button
                className="filter-done"
                onClick={() => {
                  close();
                  restoreDialogFocus(trigger.current);
                }}
              >
                Done
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
