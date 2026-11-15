import {
  existsSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  mkdirSync,
  cpSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Keep generated Android projects reproducible on Windows, macOS and Linux.
export function prepareAndroidNative() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const android = join(root, "src-tauri", "gen", "android", "app");
  const config = join(android, "build.gradle.kts");
  if (!existsSync(config)) return;
  const identifier = readFileSync(config, "utf8").match(
    /applicationId\s*=\s*"([^"]+)"/,
  )?.[1];
  if (
    !["md.maison.reseller", "md.maison.reseller.offersandbox"].includes(
      identifier,
    )
  )
    throw Error(
      "Unexpected Android application identifier. Initialize a dedicated Resell project.",
    );
  let gradle = readFileSync(config, "utf8");
  if (!gradle.includes('androidx.exifinterface:exifinterface:')) {
    gradle = gradle.replace('dependencies {', 'dependencies {\n    implementation("androidx.exifinterface:exifinterface:1.4.2")');
    writeFileSync(config, gradle);
  }
  if (!gradle.includes('androidx.camera:camera-camera2:')) {
    gradle = gradle.replace('dependencies {', 'dependencies {\n    implementation("androidx.camera:camera-camera2:1.5.3")\n    implementation("androidx.camera:camera-lifecycle:1.5.3")\n    implementation("androidx.camera:camera-view:1.5.3")');
    writeFileSync(config, gradle);
  }
  if (!gradle.includes("resellLocalReleaseSigning")) {
    gradle = gradle.replace(
      'getByName("release") {',
      'getByName("release") {\n            // Local performance releases retain the installed certificate and app data.\n            if (providers.gradleProperty("resellLocalReleaseSigning").orNull == "true") {\n                signingConfig = signingConfigs.getByName("debug")\n            }\n            isDebuggable = false\n            isJniDebuggable = false\n            isMinifyEnabled = true\n            isShrinkResources = true',
    );
    writeFileSync(config, gradle);
  }
  const main = join(android, "src", "main");
  // Refresh launcher assets even when reusing an existing generated project.
  cpSync(join(root, "src-tauri", "icons", "android"), join(main, "res"), { recursive: true });
  const put = (target, source) => {
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
  };
  const template = join(root, "native-offer", "android");
  put(
    join(android, "resell-proguard-rules.pro"),
    join(template, "resell-proguard-rules.pro"),
  );
  const activity = join(
    main,
    "java",
    ...identifier.split("."),
    "MainActivity.kt",
  );
  mkdirSync(dirname(activity), { recursive: true });
  writeFileSync(
    activity,
    readFileSync(join(template, "MainActivity.kt"), "utf8").replace(
      "package md.maison.reseller.offersandbox",
      `package ${identifier}`,
    ),
  );
  put(
    join(main, "java", "md", "resell", "marketplace", "MarketplacePlugin.kt"),
    join(template, "MarketplacePlugin.kt"),
  );
  put(join(main, "java", "md", "resell", "photos", "OfferPhotoCapture.kt"), join(template, "OfferPhotoCapture.kt"));
  put(join(main, "java", "md", "resell", "photos", "OfferCameraActivity.kt"), join(template, "OfferCameraActivity.kt"));
  for (const name of ["resell_backup_rules.xml", "resell_data_rules.xml"])
    put(join(main, "res", "xml", name), join(template, name));
  put(
    join(main, "assets", "resell-marketplace-session.js"),
    join(root, "src-tauri", "offer-sandbox-assets", "session.js"),
  );
  put(join(main, "assets", "resell-marketplace-identity.js"), join(root, "src-tauri", "offer-sandbox-assets", "identity.js"));
  const manifestPath = join(main, "AndroidManifest.xml");
  let manifest = readFileSync(manifestPath, "utf8");
  if (!manifest.includes('android.permission.CAMERA')) manifest = manifest.replace('<application', '<uses-permission android:name="android.permission.CAMERA" />\n<application');
  if (!manifest.includes('md.resell.photos.OfferCameraActivity')) manifest = manifest.replace('</application>', '<activity android:name="md.resell.photos.OfferCameraActivity" android:exported="false" android:theme="@style/Theme.AppCompat.NoActionBar" />\n</application>');
  if (!manifest.includes('android.media.action.IMAGE_CAPTURE')) {
    manifest = manifest.replace('<application', '<queries><intent><action android:name="android.media.action.IMAGE_CAPTURE" /></intent></queries>\n<application');
  }
  if (!manifest.includes('android.hardware.camera"')) {
    manifest = manifest.replace('<application', '<uses-feature android:name="android.hardware.camera" android:required="false" />\n<application');
  }
  for (const [attribute, value] of Object.entries({
    fullBackupContent: "@xml/resell_backup_rules",
    dataExtractionRules: "@xml/resell_data_rules",
  })) {
    const pattern = new RegExp(`android:${attribute}="[^"]*"`);
    manifest = pattern.test(manifest)
      ? manifest.replace(pattern, `android:${attribute}="${value}"`)
      : manifest.replace(
          "<application",
          `<application android:${attribute}="${value}"`,
        );
  }
  writeFileSync(manifestPath, manifest);
}
