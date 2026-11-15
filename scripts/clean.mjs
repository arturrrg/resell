import { lstat, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Only reproducible frontend outputs. Keep native projects, SDKs, keys and releases.
for (const relative of ["web/dist", "web/offer-dist", "src-tauri/offer-sandbox-assets"]) {
  const target = new URL(`../${relative}`, import.meta.url);
  try {
    const stat = await lstat(target);
    if (stat.isSymbolicLink()) throw new Error(`Refusing to clean a symlink: ${relative}`);
    await rm(fileURLToPath(target), { recursive: true });
    console.log(`Removed ${relative}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
