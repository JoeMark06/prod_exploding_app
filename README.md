# App Builder Template

A React + TypeScript + Vite template for in-session mini-apps built by an AI agent inside the App
Builder. It ships **shadcn/ui (new-york, Radix)** + **Tailwind CSS v4** and a small, familiar set of
libraries — no heavy state/form/validation frameworks — so an agent can build a polished app fast and with
few surprises.

## Stack

- **React 19** + **TypeScript** + **Vite 7** (run with **bun**)
- **shadcn/ui** (`new-york`) on **Radix** primitives (the unified `radix-ui` package)
- **Tailwind CSS v4** (CSS-first, no JS config — tokens live in `src/index.css`)
- **react-router-dom 7** for routing
- **TanStack Query 5** for async data, **TanStack Table 8** for grids
- **zustand** for global state (only when needed; `useState` for local)
- **recharts** for charts, **@dnd-kit** for drag & drop, **lucide-react** for icons, **sonner** for toasts
- **Leaflet** plus the protected `SpatialMap` control for connector-backed
  interactive maps without app-owned map credentials. Its public,
  provider-independent API supports stable-id marker collections, controlled
  app-owned selection, center/zoom/bounds commands, and plain viewport events.
- **html2canvas-pro 2.4.2 + jsPDF 4.2.1** for bounded Canvas-style PDF capture of an app-owned screen or container, including modern CSS colors and a small backdrop bleed that preserves rounded edges and shadows (`unpdf` remains the existing-PDF extraction tool); the shared button bounds connector-neutral follow-up callbacks so a stalled save cannot wedge export
- **@microsoft/managed-apps** — the connector runtime for an app that carries a
  data-source binding (Dataverse, SharePoint, Excel, Office 365, SQL, …)

## Scripts

| Script | What it does |
|--------|--------------|
| `bun run check` | Type-check (`tsc`) + Vite build dry-run + ESLint — the required gate before commit |
| `bun run typecheck` | Type-check only (`tsc -p tsconfig.app.json --noEmit`) — the cheap gate the app-builder agent runs before hand-back |
| `bun run lint` | ESLint only |
| `bun run dev` | Vite dev server (managed externally by the runtime — do not run by hand) |
| `bun run build` | Production build (`vite build`) — no type-check |
| `bun run preview` | Preview a production build |

## Project layout

```
src/
  App.tsx        routes + providers
  main.tsx       entry point
  index.css      Tailwind + design tokens (oklch)
  routes.tsx     route + nav manifest (add a page here)
  components/    app-shell, PDF target export button, error-boundary, confirm-dialog, protected spatial-map, states, page-section + ui/ (shadcn, pre-installed)
  hooks/         reusable hooks (use-mobile, use-confirm)
  lib/           cn(), query-client, PDF Blob helper, store (zustand), safe-url, console capture, protected spatial tile bytes, Cowork parent transport
  pages/         route-level screens (home, not-found)
  types/         fixed parent-frame message contract
generated/       typed connector client, present only when the app carries a binding (do not edit)
```

`src/components/spatial-map.tsx` is the generated-app public map module. Its
Leaflet-derived tile scheduler is internal to the protected component and is
not an app-authored or public imperative surface.

Path alias: `@/` → `src/`.

## Agent instructions

The build/iterate rules an agent needs at the per-app level — stack conventions, the Tailwind v4
cheat-sheet, structure, and a one-line Capability controls list (each control's full how-to lives in the App
Builder skill, so it stays current after the app is created) — live in **[AGENTS.md](./AGENTS.md)**, with the
OKLCH presets in its sibling **[THEMING.md](./THEMING.md)** (read on a turn-1 build or recolor/restyle). The file
format is agent-agnostic — any coding agent (Claude Code, Codex, Cursor, …) reads these, and there is
intentionally no `CLAUDE.md`. Within the App Builder, the subagent that builds and iterates apps is
additionally governed by its own always-loaded operating rules — the verification loop and the full "what
not to touch" ban list — which are enforced there and deliberately **not** duplicated into this `AGENTS.md`
(so this per-app file is intentionally not a self-sufficient contract for an external agent running outside
the harness).

## Live data

An app that carries a data-source binding has its typed client in `generated/` and its
connection reference in `ms.config.json`; the app-data-connectivity skill governs how the agent
consumes them. Both are managed only by the runtime's typed `appbuilder-DataSourceAdd`,
`appbuilder-DataSourceRefresh` and `appbuilder-DataSourceRemove` tools (a connector's actions, or one
table of any tabular connector — SharePoint list, SQL table, Dataverse table; only a SQL stored
procedure as a data source is not offered) — never by a command in this image or by hand. An
unbound Spatial request fails closed without generating app code. For any other source the app is
not bound to and cannot bind, the agent builds with realistic sample data, identifies each affected
dataset or entity as sample-backed in authoring chat only, and adds no sample/demo/mock/test-data
provenance copy or UI treatment to the app.

## Local SQLite snapshot

Node 24 or newer is required for the built-in SQLite driver. Create a local database from CSV exports with:

```powershell
node database/import-csv-to-sqlite.mjs --part-versions "C:\path\PartVersions.csv" --summary-bom "C:\path\SummaryBOM.csv"
```

The importer accepts a SharePoint `ListSchema` preamble, validates required values and title relationships,
and creates `database/production-exploding.sqlite`. Columns absent from an export are stored as `NULL`;
the script reports them. Use `--replace` only to replace an existing database.

Build and run the standalone app locally:

```powershell
npm ci
npm run build
node server/index.mjs
```

Then open `http://127.0.0.1:4173`. The server binds to loopback only and serves the built app and its SQLite
API from the same origin. The database file is ignored by Git; keep the local copy backed up securely.

## Production Exploding workflows

- Add individual parts with **Add to List**, or use **Import List** to load multiple rows from an Excel
  workbook. List imports require Part No., Product Version, Line No. and Quantity. A workbook filename
  can be imported only once per browser; renaming the file allows another import. The list and visible
  history are stored in that browser. **Clear History** clears them but keeps the imported-filename
  check; saved explosion transactions remain in SQLite.
- **Explode** processes the InProgress list together and opens the total-material results. Parts with no
  BOM lines are marked Not included. Parts already marked Included for the same part/version/line/quantity
  are skipped, with a second SQLite check at save time to prevent repeat inclusion across browser
  histories. Export the results as CSV or Excel from the results window.
- **Generate Summary** exports the saved transactions for a selected production line as an Excel workbook
  with WIP Parts and Material Summary sheets.
- **Import Active BOM** accepts only filenames in the form
  `SNANO Active BOM and PVersion as of MM.DD.YY.xlsx`. The workbook must contain a `PVersion` worksheet;
  every other worksheet with BOM headers is consolidated into the same BOM table. Blank PVersion
  headers are ignored, and all nonblank source columns (including repeated headers) are retained in the
  part version's `attributes_json`. The PVersion sheet's Alternative BOM and BOM Usage select which
  consolidated BOM rows are used during explosion. An unchanged workbook can also be recorded as the
  latest import.
  Active BOM imports compare existing records in parallel 5,000-ID batches and save
  changes in SQLite transactions of up to 1,000 operations, avoiding a separate database
  request for each BOM line.

The local API creates transaction and BOM-import history tables when it starts, so an existing SQLite
snapshot does not need to be re-imported to use these workflows. Back up
`database/production-exploding.sqlite` before replacing or moving it. Avoid `--replace` after transactions
have been saved, because that option creates a fresh database.

## Notes

- The standalone app uses SQLite for BOM data and saved explosion transactions; its InProgress list and
  display log are browser-local.
- `node_modules/` is baked into the orchestrator image and bind-mounted read-only; dependencies are not
  installed or patched per session.
