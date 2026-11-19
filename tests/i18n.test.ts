import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { translate, messages, setLanguage, getLanguage } from "../web/i18n";
import { jsx, jsxs } from "../web/localized/jsx-runtime";
import { readdirSync, readFileSync } from "node:fs";
import ts from "typescript";

test("all catalog messages have three complete versions and matching placeholders", () => {
  for (const [source, values] of Object.entries(messages)) {
    assert.equal(values.length, 2, source);
    const placeholders = (value: string) => [...value.matchAll(/\{\d+\}/g)].map(m => m[0]).sort();
    for (const value of values) {
      assert.ok(value?.trim(), source);
      assert.deepEqual(placeholders(value), placeholders(source), source);
      assert.ok(!value.includes("undefined"), source);
    }
  }
});
test("imported Romanian and Russian specification labels and values normalize in all languages", () => {
  assert.equal(translate("Tip dispozitiv", "en"), "Device type");
  assert.equal(translate("Tipul dispozitivului", "ru"), "Тип устройства");
  assert.equal(translate("Culoare", "ru"), "Цвет");
  assert.equal(translate("Negru", "en"), "Black");
  assert.equal(translate("Чёрный", "ro"), "Negru");
  assert.equal(translate("Smartphone-uri", "en"), "Smartphones");
  assert.equal(translate("Magazin", "ru"), "Магазин");
});
test("dynamic messages, metadata, accessible names, and validation summaries translate", () => {
  assert.equal(translate("Remove photo 3", "ru"), "Удалить фото 3");
  assert.equal(translate("256 GB · Negru · Used · 94% battery", "ro"), "256 GB · Negru · Utilizat · 94% baterie");
  assert.equal(translate("Add a title. Add a description.", "ru"), "Добавьте заголовок. Добавьте описание.");
  assert.equal(translate("30 days", "ro"), "30 zile");
  assert.equal(translate("3 completed", "ru"), "Завершено: 3");
  assert.equal(translate("  Save  ", "ru"), "  Сохранить  ");
  assert.equal(translate("iPhone 15 Pro", "ru"), "iPhone 15 Pro");
});
test("React boundary translates text and accessibility props while preserving input values and user content", () => {
  // Server snapshots intentionally use English; imported source text still normalizes.
  const markup = renderToStaticMarkup(jsxs("section", { children: [
    jsx("label", { children: "Tip dispozitiv" }),
    jsx("input", { value: "Negru", readOnly: true, placeholder: "Culoare", "aria-label": "Culoare" }),
    jsx("p", { translate: "no", children: "Nou" }),
    jsx("option", { children: "Negru" }),
  ] }));
  assert.match(markup, /Device type/);
  assert.match(markup, /value="Negru"/);
  assert.match(markup, /aria-label="Color"/);
  assert.match(markup, />Nou<\/p>/);
  assert.match(markup, /<option value="Negru">Black<\/option>/);
});
test("capitalized section labels and lowercase counters keep their casing", () => {
  assert.equal(translate("Photos", "en"), "Photos");
  assert.equal(translate("Photos", "ro"), "Fotografii");
  assert.equal(translate("photos", "ro"), "fotografii");
  assert.equal(translate("Remove photo 2", "ro"), "Elimină fotografia 2");
});
test("language changes and invalid persisted values resolve safely", () => {
  setLanguage("ru"); assert.equal(getLanguage(), "ru");
  setLanguage("ro"); assert.equal(getLanguage(), "ro");
  setLanguage("de" as any); assert.equal(getLanguage(), "en");
});
test("every static JSX interface label has catalog coverage", () => {
  const identities = new Set(["English", "Română", "Русский", "Resell", "Resell.", "999.md", ".md", "MDL", "MB"]);
  const missing = new Set<string>();
  function check(text: string) {
    text = text.replace(/\s+/g, " ").trim();
    if (!/[a-zA-Z]/.test(text) || identities.has(text) || Object.hasOwn(messages, text)) return;
    if (translate(text, "ro") !== text || translate(text, "ru") !== text) return;
    missing.add(text);
  }
  function scan(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (["dist", "offer-dist", "public"].includes(entry.name)) continue;
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) scan(path);
      else if (path.endsWith(".tsx")) {
        const file = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
        function visit(node: ts.Node) {
          if (ts.isJsxText(node)) check(node.text);
          if (ts.isJsxAttribute(node) && ["aria-label", "title", "placeholder", "alt"].includes(node.name.getText(file)) && node.initializer && ts.isStringLiteral(node.initializer)) check(node.initializer.text);
          ts.forEachChild(node, visit);
        }
        visit(file);
      }
    }
  }
  scan("web");
  assert.deepEqual([...missing], []);
});
