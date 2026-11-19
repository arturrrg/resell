// Run manually against the connected development Android build. Reads existing
// screens and changes only the device-local language preference; creates no offers.
import { chromium, expect } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const adb = args => {
  const result = spawnSync("adb", args, { maxBuffer: 12e6 });
  if (result.status !== 0) throw Error(result.stderr.toString());
  return result.stdout;
};
const pid = adb(["shell", "pidof", "md.maison.reseller"]).toString().trim();
if (!/^\d+$/.test(pid)) throw Error("Open the Resell app on the connected phone first.");
adb(["forward", "tcp:9223", `localabstract:webview_devtools_remote_${pid}`]);
const browser = await chromium.connectOverCDP("http://127.0.0.1:9223");
async function choose(page, language) {
  await page.locator(".language-picker-trigger").click({ force: true });
  await page.locator(`.language-picker-menu [data-language="${language}"]`).click({ force: true });
}
try {
  const page = browser.contexts().flatMap(context => context.pages()).find(page => page.url().includes("tauri.localhost"));
  if (!page) throw Error("Main app WebView not found.");
  for (const [language, account, sales] of [["en", "Account", "Sales."], ["ro", "Cont", "Vânzări."], ["ru", "Аккаунт", "Продажи."]]) {
    if (!await page.locator("dialog[open] .language-picker-trigger").count()) await page.locator(".account-trigger").click({ force: true });
    await choose(page, language);
    await expect(page.locator("dialog[open] h2")).toHaveText(account);
    await expect(page.locator(".sales-page-title")).toHaveText(sales);
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    writeFileSync(`artifacts/screenshots/languages-phone-final-${language}.png`, adb(["exec-out", "screencap", "-p"]));
    await page.locator("dialog[open] .sheet-heading>button").first().click({ force: true });
  }
  await expect(page.locator(".sales-ledger-title>span")).toHaveText(/Завершено: \d+|\d+ без указанной прибыли/);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await page.locator(".account-trigger").click({ force: true });
  await choose(page, "en");
  await page.locator("dialog[open] .sheet-heading>button").first().click({ force: true });
  console.log("Android: all three languages, translated sales count, and persistence verified; restored English.");
} finally { await browser.close(); }
