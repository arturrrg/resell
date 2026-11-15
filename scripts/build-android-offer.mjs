import { spawn } from "node:child_process";
import {
  existsSync,
  readdirSync,
  readFileSync,
  mkdirSync,
  copyFileSync,
  appendFileSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

if (process.platform !== "win32")
  throw Error("Use offer-sandbox:android:build on macOS/Linux.");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const android = join(root, "src-tauri", "gen", "android");
const androidConfig = join(android, "app", "build.gradle.kts");
const main = process.argv.includes("--main");
const release = process.argv.includes("--release");
const profile = release ? "release" : "debug";
const variant = release ? "Release" : "Debug";
const identifier = main
  ? "md.maison.reseller"
  : "md.maison.reseller.offersandbox";
if (
  !existsSync(androidConfig) ||
  !readFileSync(androidConfig, "utf8").includes(
    `applicationId = "${identifier}"`,
  )
)
  throw Error(
    `Initialize the ${main ? "main Resell" : "isolated sandbox"} Android project first. See docs/OFFER_SANDBOX.md.`,
  );
const local = process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local");
const env = { ...process.env };
if (release) env.ORG_GRADLE_PROJECT_resellLocalReleaseSigning = "true";
if (main) {
  const publicEnv = loadEnv("production", root, "VITE_");
  env.VITE_API_BASE_URL ||=
    publicEnv.VITE_API_BASE_URL || publicEnv.VITE_PUBLIC_APP_URL;
  if (!env.VITE_API_BASE_URL?.startsWith("https://"))
    throw Error(
      "Set an HTTPS VITE_API_BASE_URL or VITE_PUBLIC_APP_URL for the native importer.",
    );
}
env.ANDROID_HOME ||= join(local, "Android", "Sdk");
const javaRoot = join(local, "ResellBuildTools", "java");
if (!env.JAVA_HOME && existsSync(javaRoot)) {
  env.JAVA_HOME = readdirSync(javaRoot)
    .map((name) => join(javaRoot, name))
    .find((path) => existsSync(join(path, "bin", "java.exe")));
}
const ndkRoot = join(env.ANDROID_HOME, "ndk");
if (!env.NDK_HOME && existsSync(ndkRoot)) {
  const versions = readdirSync(ndkRoot).sort((a, b) =>
    b.localeCompare(a, undefined, { numeric: true }),
  );
  env.NDK_HOME = join(
    ndkRoot,
    versions.includes("27.2.12479018") ? "27.2.12479018" : versions[0],
  );
}
if (!env.JAVA_HOME || !env.NDK_HOME)
  throw Error("Install Java and Android SDK/NDK first. See docs/OFFER_SANDBOX.md.");
const pathKey =
  Object.keys(env).find((key) => key.toLowerCase() === "path") || "PATH";
env[pathKey] = [
  join(homedir(), ".cargo", "bin"),
  join(env.JAVA_HOME, "bin"),
  join(env.ANDROID_HOME, "platform-tools"),
  env[pathKey] || "",
].join(";");
env.CARGO_BUILD_JOBS ||= "3";
mkdirSync(join(root, ".native-tools"), { recursive: true });
const log = join(root, ".native-tools", "android-windows-details.log");
writeFileSync(log, "");
async function run(executable, args, cwd = root) {
  let output = "";
  const child = spawn(executable, args, {
    cwd,
    env,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const [stream, destination] of [
    [child.stdout, process.stdout],
    [child.stderr, process.stderr],
  ]) {
    stream.on("data", (data) => {
      output += data;
      destination.write(data);
      appendFileSync(log, data);
    });
  }
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  return { code, output };
}
const nativeScripts = await run(process.execPath, [
  join(root, "scripts", "build-native-offer.mjs"),
]);
if (nativeScripts.code !== 0)
  throw Error("Could not build marketplace scripts.");
const build = await run(process.execPath, [
  join(root, "node_modules", "@tauri-apps", "cli", "tauri.js"),
  "android",
  "build",
  ...(!main
    ? [
        "--config",
        "src-tauri/tauri.offer-sandbox.conf.json",
        "--features",
        "offer-sandbox",
      ]
    : []),
  "--apk",
  ...(!release ? ["--debug"] : []),
  "--target",
  "aarch64",
]);
if (build.code === 0) process.exit(0);
// Package the compiled library normally when Windows denies shortcut links.
// No OS policy or security setting is changed.
if (
  !build.output.includes(
    "Creation symbolic link is not allowed for this system",
  )
)
  throw Error("Android compilation failed. See " + log);
if (
  !readFileSync(androidConfig, "utf8").includes(
    `applicationId = "${identifier}"`,
  )
)
  throw Error("The generated project identifier changed during the build.");
const jni = join(android, "app", "src", "main", "jniLibs", "arm64-v8a");
mkdirSync(jni, { recursive: true });
copyFileSync(
  join(
    root,
    "src-tauri",
    "target",
    "aarch64-linux-android",
    profile,
    "libresell_lib.so",
  ),
  join(jni, "libresell_lib.so"),
);
const strip = await run(
  join(
    env.NDK_HOME,
    "toolchains",
    "llvm",
    "prebuilt",
    "windows-x86_64",
    "bin",
    "llvm-strip.exe",
  ),
  ["--strip-debug", join(jni, "libresell_lib.so")],
);
if (strip.code !== 0)
  throw Error("Could not remove native debug metadata for APK packaging.");
// Recreate this generated APK so incremental ZIP updates do not retain old library bytes.
const apk = join(
  android,
  "app",
  "build",
  "outputs",
  "apk",
  "arm64",
  profile,
  `app-arm64-${profile}.apk`,
);
if (existsSync(apk)) unlinkSync(apk);
const packaged = await run(
  process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe",
  [
    "/d",
    "/s",
    "/c",
    `gradlew.bat :app:assembleArm64${variant} -x :app:rustBuildArm64${variant} --console=plain --max-workers=3`,
  ],
  android,
);
if (packaged.code !== 0) throw Error("Android packaging failed. See " + log);
console.log(
  `Android ${main ? "Resell" : "sandbox"} ${profile} APK: src-tauri/gen/android/app/build/outputs/apk/arm64/${profile}/app-arm64-${profile}.apk`,
);
