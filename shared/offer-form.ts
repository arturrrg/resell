import type { OfferTransfer, TransferReport } from "./offer-draft";
import {
  settleMarketplaceNotices,
  visibleMarketplaceControl,
} from "./marketplace-notices";

export function marketplaceTextRetained(name: string, expected: string, actual?: string) {
  if (name === "2.value") {
    return actual !== undefined && Number(actual.replace(/[\s\u00a0\u202f]/g, "").replace(",", ".")) === Number(expected);
  }
  if (actual === expected) return true;
  // The live creator uppercases the first title letter on blur (iPhone → IPhone).
  // Accept that observed normalization while preserving every other character.
  return /^12\.(?:ro|ru)$/.test(name) && actual === expected.charAt(0).toLocaleUpperCase() + expected.slice(1);
}

export function normalizedOption(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase()
    .replace(/\bmun\.?(?=\s|$)/g, "")
    .replace(/[^\p{L}\p{N}€$]/gu, "");
}
export function mobilePicker(root: ParentNode, id: string) {
  const exact = root.querySelector<HTMLElement>(
    `[data-testid="modal-wrapper-${id}"][role="dialog"][aria-modal="true"]`,
  );
  if (exact && visibleMarketplaceControl(exact)) return exact;
  // The actual mobile offer-type modal has no id/data-testid. Match its
  // inspected heading instead of taking the first (possibly unrelated) dialog.
  if (id !== "1") return null;
  const matches = Array.from(
    root.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]'),
  ).filter(
    (dialog) =>
      visibleMarketplaceControl(dialog) &&
      normalizedOption(
        dialog.querySelector('[class*="modal__wrapper__header__text"]')
          ?.textContent || "",
      ) === "tipulofertei",
  );
  return matches.length === 1 ? matches[0] : null;
}
export function accountOnForm(root: ParentNode = document): string {
  const link = root.querySelector<HTMLAnchorElement>(
    'a[href*="/cabinet/items/"]',
  );
  try {
    return decodeURIComponent(
      new URL(link?.href || "").pathname.match(
        /\/cabinet\/items\/([^/]+)/,
      )?.[1] || "",
    );
  } catch {
    return "";
  }
}
export function mobilePriceEditor(root: ParentNode) {
  const matches = Array.from(
    root.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]'),
  ).filter(
    (dialog) =>
      visibleMarketplaceControl(dialog) &&
      !!dialog.querySelector('input[name="2.value"]'),
  );
  return matches.length === 1 ? matches[0] : null;
}
function waitFor<T>(
  read: () => T | null | undefined | false,
  root: ParentNode,
  signal?: AbortSignal,
  timeout = 4000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let observer: MutationObserver | undefined,
      timer: ReturnType<typeof setTimeout> | undefined;
    const clean = () => {
      observer?.disconnect();
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
    };
    const cancel = () => {
      clean();
      reject(new DOMException("Preparation cancelled", "AbortError"));
    };
    const check = () => {
      if (signal?.aborted) {
        cancel();
        return;
      }
      const value = read();
      if (value) {
        clean();
        resolve(value);
      }
    };
    observer = new MutationObserver(check);
    observer.observe(root instanceof Document ? root.documentElement : root, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    timer = setTimeout(() => {
      clean();
      reject(
        Error("The marketplace form did not expose the expected control."),
      );
    }, timeout);
    signal?.addEventListener("abort", cancel, { once: true });
    check();
  });
}
export async function fillOfferForm(
  draft: OfferTransfer,
  root: ParentNode,
  options: {
    signal?: AbortSignal;
    account?: string;
    onStage?: (stage: string) => void;
  } = {},
): Promise<TransferReport> {
  const report: TransferReport = {
    status: "partial",
    filled: [],
    missing: [],
    photos: 0,
    message: "Review the form before publishing.",
  };
  const byName = (name: string) =>
    root.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      `input[name="${name}"],textarea[name="${name}"]`,
    );
  const guard = () => {
    if (options.signal?.aborted)
      throw new DOMException("Preparation cancelled", "AbortError");
    if (options.account && accountOnForm(root) !== options.account)
      throw Error(
        "The signed-in account changed. Preparation stopped; check the account and retry.",
      );
  };
  if (
    ["12.ro", "12.ru"].some((name) => !!byName(name)?.value.trim()) ||
    root.querySelector('[data-testid="ad_form_open_image_button"]')
  )
    return {
      ...report,
      status: "blocked",
      message:
        "This creator already has a title or photos. Open a fresh creator so existing work is not overwritten.",
    };
  const expected: [string, string][] = [];
  const expectedSelections: [string, string, string][] = [];
  const selection = (id: string) =>
    root.querySelector<
      HTMLInputElement | HTMLButtonElement | HTMLSelectElement
    >(
      `[data-testid="${id}-input"],button[data-testid="${id}"],button[data-testid="modal-trigger-${id}"],select[name="${id}"],select[data-testid="${id}"]`,
    );
  const selectedText = (
    node: HTMLInputElement | HTMLButtonElement | HTMLSelectElement,
  ) =>
    node.tagName === "INPUT"
      ? (node as HTMLInputElement).value
      : node.tagName === "SELECT"
        ? (node as HTMLSelectElement).selectedOptions[0]?.textContent || ""
        : node.querySelector('[class*="mobile__button__end"]')?.textContent ||
          node.textContent ||
          "";
  async function text(name: string, label: string, value: string) {
    if (!value) return;
    guard();
    let node = byName(name);
    let priceDialog: HTMLElement | null = null;
    if (!node && name === "2.value") {
      const trigger = root.querySelector<HTMLButtonElement>(
        'button.mobile__option__selector[name="2.value"]',
      );
      if (trigger) {
        trigger.click();
        priceDialog = await waitFor(
          () => mobilePriceEditor(root),
          root,
          options.signal,
        );
        node = await waitFor(() => byName(name), root, options.signal);
      }
    }
    if (
      !node ||
      node.disabled ||
      node.readOnly ||
      (node.maxLength > -1 && value.length > node.maxLength)
    ) {
      report.missing.push(label);
      return;
    }
    const prototype =
      node.tagName === "TEXTAREA"
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
    if (priceDialog) {
      const unit = priceDialog.querySelector<HTMLButtonElement>(
        `[data-testid="button-select-UNIT_${draft.currency}"]`,
      );
      if (unit) {
        guard();
        unit.click();
        await waitFor(
          () => unit.dataset.active === "true",
          root,
          options.signal,
        );
        expectedSelections.push([
          "2.unit",
          normalizedOption(unit.textContent || ""),
          "Currency",
        ]);
        report.filled.push("Currency");
      } else {
        await select(
          "2.unit",
          "Currency",
          draft.currency === "EUR"
            ? ["€", "EUR"]
            : draft.currency === "USD"
              ? ["$", "USD"]
              : ["MDL"],
        );
      }
      const apply = await waitFor(
        () => {
          const control = priceDialog!.querySelector<HTMLButtonElement>(
            '[data-testid="modal-controls-apply"]',
          );
          return control &&
            !control.disabled &&
            visibleMarketplaceControl(control)
            ? control
            : null;
        },
        root,
        options.signal,
      );
      guard();
      apply.click();
      await waitFor(() => !priceDialog!.isConnected, root, options.signal);
    }
    expected.push([name, value]);
    report.filled.push(label);
  }
  async function select(id: string, label: string, candidates: string[]) {
    if (!candidates.filter(Boolean).length) return;
    guard();
    let openedDialog: HTMLElement | null = null;
    let phase = "finding the selector";
    try {
      const nativeSelect = root.querySelector<HTMLSelectElement>(
        `select[name="${id}"],select[data-testid="${id}"]`,
      );
      if (nativeSelect) {
        const names = new Set(candidates.filter(Boolean).map(normalizedOption));
        const choices = Array.from(nativeSelect.options).filter(
          (option) =>
            !option.disabled &&
            names.has(normalizedOption(option.textContent || "")),
        );
        if (choices.length !== 1)
          throw Error("The requested option is unavailable.");
        Object.getOwnPropertyDescriptor(
          HTMLSelectElement.prototype,
          "value",
        )!.set!.call(nativeSelect, choices[0].value);
        nativeSelect.dispatchEvent(new Event("input", { bubbles: true }));
        nativeSelect.dispatchEvent(new Event("change", { bubbles: true }));
        expectedSelections.push([
          id,
          normalizedOption(choices[0].textContent || ""),
          label,
        ]);
        report.filled.push(label);
        return;
      }
      const mobile = root.querySelector<HTMLButtonElement>(
        `button[data-testid="modal-trigger-${id}"]`,
      );
      if (mobile) {
        await settleMarketplaceNotices(root, options.signal);
        phase = "waiting for the field to become available";
        await waitFor(
          () => {
            const node = root.querySelector<HTMLButtonElement>(
              `button[data-testid="modal-trigger-${id}"]`,
            );
            return node && !node.disabled && node;
          },
          root,
          options.signal,
          8000,
        );
        const current = root.querySelector<HTMLButtonElement>(
          `button[data-testid="modal-trigger-${id}"]`,
        );
        if (!current || current.disabled || !current.isConnected)
          throw Error("The dependent field is still loading.");
        current.focus({ preventScroll: true });
        current.click();
        phase = "opening the choices";
        let attempts = 0;
        const retryOpen = setInterval(() => {
          if (
            options.signal?.aborted ||
            (options.account && accountOnForm(root) !== options.account) ||
            mobilePicker(root, id) ||
            attempts++ >= 10
          )
            return;
          const button = root.querySelector<HTMLButtonElement>(
            `button[data-testid="modal-trigger-${id}"]`,
          );
          if (button?.isConnected && !button.disabled) {
            button.focus({ preventScroll: true });
            button.click();
          }
        }, 400);
        let dialog: HTMLElement;
        try {
          dialog = await waitFor(
            () => mobilePicker(root, id),
            root,
            options.signal,
            8000,
          );
        } finally {
          clearInterval(retryOpen);
        }
        guard();
        openedDialog = dialog;
        const names = new Set(candidates.filter(Boolean).map(normalizedOption));
        const optionText = (node: HTMLElement) =>
          node.querySelector('[class*="select__item__label"]')?.textContent ||
          node.textContent ||
          "";
        const matches = () =>
          Array.from(
            dialog.querySelectorAll<HTMLButtonElement>(
              'button[class*="select__item"]',
            ),
          ).filter((node) => names.has(normalizedOption(optionText(node))));
        let choices = matches();
        if (!choices.length) {
          const search = Array.from(
            dialog.querySelectorAll<HTMLInputElement>("input"),
          ).find(
            (node) =>
              !node.readOnly &&
              !node.disabled &&
              (node.type === "search" ||
                /caut|поиск|search/i.test(normalizedOption(node.placeholder))),
          );
          if (search) {
            Object.getOwnPropertyDescriptor(
              HTMLInputElement.prototype,
              "value",
            )!.set!.call(search, candidates[0]);
            search.dispatchEvent(
              new InputEvent("input", {
                bubbles: true,
                inputType: "insertText",
                data: candidates[0],
              }),
            );
            search.dispatchEvent(new Event("change", { bubbles: true }));
            search.dispatchEvent(new Event("search", { bubbles: true }));
          }
          try {
            choices = await waitFor(
              () => matches().length === 1 && matches(),
              dialog,
              options.signal,
            );
          } catch {
            choices = [];
          }
        }
        if (choices.length !== 1) {
          dialog
            .querySelector<HTMLButtonElement>(
              '[data-testid="modal-close-button"]',
            )
            ?.click();
          await waitFor(
            () => !dialog.isConnected || !dialog.getClientRects().length,
            root,
            options.signal,
          );
          report.missing.push(`${label}: choose ${candidates[0]} manually`);
          return;
        }
        const chosen = normalizedOption(optionText(choices[0]));
        choices[0].click();
        phase = "closing the choices";
        await waitFor(
          () => !dialog.isConnected || !dialog.getClientRects().length,
          root,
          options.signal,
        );
        phase = "checking the selected value";
        await waitFor(
          () => {
            const node = selection(id);
            return node && normalizedOption(selectedText(node)) === chosen;
          },
          root,
          options.signal,
        );
        expectedSelections.push([id, chosen, label]);
        report.filled.push(label);
        return;
      }
      const trigger = await waitFor(
        () => {
          const node = root.querySelector<HTMLInputElement | HTMLButtonElement>(
            `[data-testid="${id}-input"],button[data-testid="${id}"]`,
          );
          return node && !node.disabled && node;
        },
        root,
        options.signal,
      );
      trigger.click();
      const list = await waitFor(
        () => {
          const node = root.querySelector<HTMLElement>(`[id="${id}"]`);
          return node?.querySelector('[role="option"]') && node;
        },
        root,
        options.signal,
      );
      const names = new Set(candidates.map(normalizedOption));
      const matches = Array.from(
        list.querySelectorAll<HTMLElement>('[role="option"]'),
      ).filter((node) => names.has(normalizedOption(node.textContent || "")));
      if (matches.length !== 1) {
        trigger.click();
        report.missing.push(`${label}: choose ${candidates[0]} manually`);
        return;
      }
      matches[0].click();
      const chosen = normalizedOption(matches[0].textContent || "");
      await waitFor(
        () => {
          const node = selection(id);
          return (
            node &&
            node.getAttribute("aria-expanded") !== "true" &&
            normalizedOption(selectedText(node)) === chosen
          );
        },
        root,
        options.signal,
      );
      expectedSelections.push([id, chosen, label]);
      report.filled.push(label);
    } catch (error) {
      if (options.signal?.aborted) throw error;
      openedDialog
        ?.querySelector<HTMLButtonElement>('[data-testid="modal-close-button"]')
        ?.click();
      console.warn(
        "Resell field preparation failed",
        label,
        phase,
        error instanceof Error ? error.stack : String(error),
      );
      report.missing.push(`${label}: ${phase}: ${(error as Error).message}`);
    }
  }
  guard();
  options.onStage?.("Clearing marketplace notices");
  await settleMarketplaceNotices(root, options.signal);
  options.onStage?.("Choosing device type");
  const sell = root.querySelector<HTMLInputElement>("#radio-776");
  const mobileOffer = root.querySelector('[data-testid="modal-trigger-1"]');
  if (!sell && !mobileOffer)
    return {
      ...report,
      status: "blocked",
      message: "Open the mobile-phones advert creator first.",
    };
  if (mobileOffer) await select("1", "Offer type", ["Vând", "Продаю"]);
  else if (sell && !sell.checked) sell.click();
  await select(
    "2245",
    "Device type",
    [draft.deviceType, "Smartphone-uri", "Смартфоны"].filter(
      (v, i) =>
        i === 0 || normalizedOption(draft.deviceType) === "smartphoneuri",
    ),
  );
  try {
    await waitFor(
      () =>
        byName("2.value") ||
        root.querySelector('button.mobile__option__selector[name="2.value"]'),
      root,
      options.signal,
    );
  } catch {
    return {
      ...report,
      status: "blocked",
      message:
        "Device type was not accepted. Finish the first step manually, then retry.",
    };
  }
  guard();
  options.onStage?.("Filling specifications");
  await select("589", "Brand", [draft.brand]);
  await select("590", "Model", [draft.model]);
  await select(
    "795",
    "Seller type",
    draft.sellerType === "shop"
      ? ["Magazin", "Магазин"]
      : ["Persoană fizică", "Частное лицо"],
  );
  await select(
    "593",
    "Condition",
    draft.condition === "new"
      ? ["Nou", "Новый"]
      : ["Uzat", "Б/у", "Бывший в употреблении"],
  );
  await select("591", "Operating system", [draft.operatingSystem]);
  await select("1265", "Storage", [draft.storage]);
  await select("1266", "RAM", [draft.ram]);
  await select("1422", "Color", [draft.color]);
  await select("7", "Location", [draft.location]);
  if (!root.querySelector('button.mobile__option__selector[name="2.value"]'))
    await select(
      "2.unit",
      "Currency",
      draft.currency === "EUR"
        ? ["€", "EUR"]
        : draft.currency === "USD"
          ? ["$", "USD"]
          : ["MDL"],
    );
  await text("2.value", "Price", draft.price.replace(",", "."));
  await text("2279", "Battery capacity", draft.batteryCapacity);
  await text("2107", "Battery health", draft.batteryHealth);
  await text(`12.${draft.language}`, "Title", draft.title);
  const secondaryLanguage = draft.language === "ro" ? "ru" : "ro";
  const secondaryTitleLabel =
    secondaryLanguage === "ru" ? "Russian title" : "Romanian title";
  await text(
    `12.${secondaryLanguage}`,
    secondaryTitleLabel,
    draft.secondaryTitle || "",
  );
  const secondaryTitle = byName(`12.${secondaryLanguage}`);
  if (secondaryTitle?.required && !secondaryTitle.value.trim())
    report.missing.push(
      `${secondaryTitleLabel}: 999.md requires this title too. Add it in Resell or complete it on the form.`,
    );
  await text(`13.${draft.language}`, "Description", draft.description);
  if (draft.phone)
    report.missing.push(
      "Phone: select or verify this number on 999.md manually",
    );
  guard();
  options.onStage?.("Uploading photos");
  const input = root.querySelector<HTMLInputElement>(
    '#upload-photo[type="file"][name="14"]',
  );
  if (!input) report.missing.push("Photos: upload control unavailable");
  else {
    const files = new DataTransfer();
    for (const photo of draft.photos) {
      const binary = atob(photo.base64),
        bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      if (bytes.length !== photo.bytes)
        throw Error("A photo was truncated during transfer.");
      files.items.add(new File([bytes], photo.name, { type: photo.type }));
    }
    input.files = files.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    try {
      await waitFor(
        () => {
          const photos = Array.from(
            root.querySelectorAll<HTMLImageElement>(
              '[data-testid="ad_form_open_image_button"] img',
            ),
          );
          return (
            photos.length === draft.photos.length &&
            photos.every((photo) =>
              /^(?:https:\/\/i\.simpalsmedia\.com\/|blob:)/.test(photo.src),
            ) &&
            photos
          );
        },
        root,
        options.signal,
        45000,
      );
      report.photos = draft.photos.length;
      report.filled.push("Photos");
    } catch (error) {
      if (options.signal?.aborted) throw error;
      report.missing.push("Photos: upload acceptance was not confirmed");
    }
  }
  guard();
  let mobilePrice: string | undefined;
  let mobileCurrency: string | undefined;
  const priceTrigger = root.querySelector<HTMLButtonElement>(
    'button.mobile__option__selector[name="2.value"]',
  );
  if (priceTrigger && expected.some(([name]) => name === "2.value")) {
    const displayedUnits = Array.from(
      new Set(
        (priceTrigger.textContent || "").match(/\b(?:MDL|EUR|USD)\b|[€$]/gi) ||
          [],
      ),
    );
    priceTrigger.click();
    const dialog = await waitFor(
      () => mobilePriceEditor(root),
      root,
      options.signal,
    );
    mobilePrice = (await waitFor(() => byName("2.value"), root, options.signal))
      .value;
    const currency =
      dialog.querySelector<HTMLButtonElement>(
        '[data-testid^="button-select-UNIT_"][data-active="true"]',
      ) || selection("2.unit");
    mobileCurrency = currency
      ? normalizedOption(selectedText(currency))
      : undefined;
    dialog
      .querySelector<HTMLButtonElement>('[data-testid="modal-close-button"]')
      ?.click();
    await waitFor(() => !dialog.isConnected, root, options.signal);
    const unit =
      displayedUnits.length === 1
        ? (
            {
              MDL: "MDL",
              EUR: "EUR",
              USD: "USD",
              "€": "EUR",
              $: "USD",
            } as Record<string, string>
          )[displayedUnits[0].toUpperCase()]
        : undefined;
    if (unit === draft.currency) {
      report.missing = report.missing.filter(
        (item) => !item.startsWith("Currency:"),
      );
      if (!report.filled.includes("Currency")) report.filled.push("Currency");
    }
  }
  for (const [id, value, label] of expectedSelections) {
    const node = selection(id);
    const retained =
      id === "2.unit" && mobileCurrency !== undefined
        ? mobileCurrency
        : node
          ? normalizedOption(selectedText(node))
          : undefined;
    if (retained !== value)
      report.missing.push(`${label}: the form did not retain the choice`);
  }
  for (const [name, value] of expected) {
    const retained =
      name === "2.value" && mobilePrice !== undefined
        ? mobilePrice
        : byName(name)?.value;
    const same = marketplaceTextRetained(name, value, retained);
    if (!same)
      report.missing.push(`${name}: the form did not retain the value`);
  }
  report.status = report.missing.length ? "partial" : "ready";
  report.message =
    report.status === "ready"
      ? "Draft transferred. Review the account, specifications, photos and contact details before you publish."
      : "Some fields need your attention. Nothing has been published.";
  return report;
}
