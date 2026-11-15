import { build } from "vite";
import { resolve } from "node:path";
import { prepareAndroidNative } from "./prepare-android-native.mjs";
await build({
  configFile: false,
  logLevel: "warn",
  build: {
    outDir: resolve("src-tauri/offer-sandbox-assets"),
    emptyOutDir: true,
    minify: true,
    lib: {
      entry: resolve("native-offer/prepare.ts"),
      name: "ResellNativePrepare",
      formats: ["iife"],
      fileName: () => "prepare.js",
    },
  },
});
console.log("Native offer preparation bundle is ready.");
await build({
  configFile: false,
  logLevel: "warn",
  build: {
    outDir: resolve("src-tauri/offer-sandbox-assets"),
    emptyOutDir: false,
    minify: true,
    lib: {
      entry: resolve("native-offer/session.ts"),
      name: "ResellMarketplace",
      formats: ["iife"],
      fileName: () => "session.js",
    },
  },
});
await build({ configFile: false, logLevel: "warn", build: {
  outDir: resolve("src-tauri/offer-sandbox-assets"), emptyOutDir: false, minify: true,
  lib: { entry: resolve("native-offer/identity.ts"), name: "ResellIdentity", formats: ["iife"], fileName: () => "identity.js" },
} });
prepareAndroidNative();
