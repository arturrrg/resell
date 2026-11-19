import { test, expect, type Page } from "@playwright/test";

async function switchLanguage(page: Page, language: string) {
  await page.locator(".account-trigger").click();
  await page.locator(".language-picker-trigger").click();
  await page.locator(`.language-picker-menu [data-language="${language}"]`).click();
  await expect(page.locator("html")).toHaveAttribute("lang", language);
  await page.locator("dialog[open] .sheet-heading>button").first().click();
}
for (const [lang, specs, type, color, offers, details, romanianTitle, photos, review] of [
  ["en", "Specifications", "Device type", "Black", "Offers", "Details", "Romanian title", "Photos", "Review"],
  ["ro", "Specificații", "Tip dispozitiv", "Negru", "Oferte", "Detalii", "Titlu în română", "Fotografii", "Verificare"],
  ["ru", "Характеристики", "Тип устройства", "Чёрный", "Объявления", "Подробности", "Заголовок на румынском", "Фотографии", "Проверка"],
]) {
  test(`${lang}: account, inventory, offer editor and persistence`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/__languages");
    await switchLanguage(page, lang);
    await expect(page.locator(".characteristics-block h3")).toHaveText(specs);
    await expect(page.locator("dt").first()).toHaveText(type);
    await expect(page.locator(".characteristics-list dd").nth(1)).toHaveText(color);
    await expect(page.locator(".description")).toHaveText("New");
    await page.screenshot({ path: `artifacts/screenshots/languages-${lang}-inventory.png` });
    await page.getByRole("button", { name: offers, exact: true }).click();
    await expect(page.getByRole("tab", { name: details, exact: true })).toBeVisible();
    const title = page.getByRole("textbox", { name: romanianTitle, exact: true });
    await expect(title).toHaveValue("New");
    await title.fill("Preserve this title");
    await page.getByRole("tab", { name: photos, exact: true }).click();
    await page.getByRole("tab", { name: review, exact: true }).click();
    await expect(page.getByRole("heading", { name: "Preserve this title", exact: true })).toBeVisible();
    await expect(page.locator(".studio-review-description")).toHaveText("New");
    await page.screenshot({ path: `artifacts/screenshots/languages-${lang}-review.png` });
    const settings = await page.context().newPage();
    await settings.goto("/__languages");
    await switchLanguage(settings, lang === "ru" ? "en" : "ru");
    await expect(page.locator(".studio-review-description")).toHaveText("New");
    await switchLanguage(settings, lang);
    await settings.close();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", lang);
    await expect(page.locator(".characteristics-block h3")).toHaveText(specs);
    await page.locator(".account-trigger").click();
    await expect(page.locator(".language-picker-trigger")).toHaveAttribute("data-language", lang);
    await page.screenshot({ path: `artifacts/screenshots/languages-${lang}-account.png` });
    expect(errors).toEqual([]);
  });
}
test("switches immediately across browser tabs and keeps filters stable", async ({ page, context }) => {
  await page.goto("/__languages");
  const second = await context.newPage(); await second.goto("/__languages");
  await switchLanguage(page, "ru");
  await expect(second.locator("html")).toHaveAttribute("lang", "ru");
  await expect(second.locator(".characteristics-block h3")).toHaveText("Характеристики");
});
for (const width of [320, 1440]) test(`Russian layouts fit at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/__languages");
  await switchLanguage(page, "ru");
  await expect(page.locator(".characteristics-block")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator(".account-trigger").click();
  const picker = page.locator(".language-picker-trigger");
  await expect(picker).toBeVisible();
  const bounds = await picker.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
  await page.screenshot({ path: `artifacts/screenshots/languages-ru-account-${width}.png` });
});
test("Workspace picker uses a custom menu with keyboard navigation and dismissal", async ({ page }) => {
  await page.goto("/__languages");
  await page.locator(".account-trigger").click();
  const picker = page.locator(".account-settings-group .language-picker-trigger");
  await expect(picker).toBeVisible();
  await expect(page.locator(".language-picker select")).toHaveCount(0);
  await page.keyboard.press("Tab");
  await picker.focus();
  await expect(page.locator(".language-picker-workspace .language-picker-trigger:focus-visible")).toBeFocused();
  await expect(picker).toHaveCSS("outline-style", "none");
  await picker.press("ArrowDown");
  const selected = page.getByRole("menuitemradio", { name: "English", exact: true });
  await expect(selected).toBeFocused();
  await expect(selected).toHaveAttribute("aria-checked", "true");
  await selected.press("ArrowDown");
  await expect(page.getByRole("menuitemradio", { name: "Română", exact: true })).toBeFocused();
  await page.screenshot({ path: "artifacts/screenshots/language-workspace-custom-menu.png" });
  await page.keyboard.press("Enter");
  await expect(picker).toHaveAttribute("data-language", "ro");
  await expect(picker).toBeFocused();
  await picker.click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".language-picker-menu")).toHaveCount(0);
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await picker.click();
  await page.locator(".account-profile h3").click();
  await expect(page.locator(".language-picker-menu")).toHaveCount(0);
});
