# Project structure

| Path | Contents |
| --- | --- |
| `web/` | React frontend, styles and public assets |
| `api/` | Vercel server functions |
| `server/` | Server implementation |
| `shared/` | Shared application code |
| `native-offer/` | Native marketplace automation |
| `src-tauri/` | Rust app, native configuration and icons |
| `supabase/` | Database migrations and configuration |
| `tests/` | Automated tests and fixtures |
| `scripts/` | Build and maintenance automation |
| `docs/` | Project guides and audits |
| `artifacts/` | Local screenshots, design experiments and release copies (ignored) |
| `.native-tools/` | Local native tooling and device diagnostics (ignored) |

Run `npm run clean` to remove reproducible frontend build outputs. It preserves
dependencies, native build caches, device tooling, credentials and APK copies.
Use `npm run build` to recreate the website afterwards.

Keep tool configuration and `server.local.ts` in the root because build and hosting
tools use those paths. Put new modules in their existing functional directory.
