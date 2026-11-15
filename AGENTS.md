# Repository housekeeping

- Keep the root for README, required tool configuration and entry points.
- Put project guides in `docs/`, reusable automation in `scripts/`, and tests in `tests/`.
- Save screenshots and recordings under `artifacts/screenshots/`, APK copies under `artifacts/android/`, and design experiments under `artifacts/design/`.
- Keep unrelated historical work under `archive/`; do not add it to application builds or deployment uploads.
- Keep application assets in `web/public/` and native icons in `src-tauri/icons/`.
- Do not put screenshots, logs, temporary scripts or exported documents in the root.
- Use `npm run clean` for reproducible frontend build outputs. Preserve `.env.local`, `.vercel/`, native SDKs, signing material, generated native projects and release copies.
- Update references when moving files. Run typecheck, tests and a production build after structural changes affecting the app.
