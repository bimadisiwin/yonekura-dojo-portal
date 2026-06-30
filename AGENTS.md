# AGENTS.md

## Cursor Cloud specific instructions

### What this is
This repo is a single self-contained static web app: `index.html` (~9k lines, inline CSS + JS) plus `preleague-logo.png`. It is "米倉道場ポータル" (Yonekura Dojo Portal), a karate/kendo dojo league portal (standings 順位表, win-loss grid 星取表, awards 表彰, member progress, etc.). There is **no package manager, no build step, no bundler, and no automated tests or linter** — do not look for `package.json`, a build command, or a test runner; none exist.

### Running it (development)
Serve the file with any static HTTP server and open it in a browser. Example:

```
python3 -m http.server 8000
# then open http://localhost:8000/index.html
```

Opening `index.html` via `file://` mostly works too, but use the HTTP server for parity (the in-app GitHub sync uses `fetch`). `python3` and `node` are preinstalled.

### Lint / test / build
None exist. There is nothing to lint, test, or build. "Verifying" a change means loading the page in a browser and exercising the affected UI manually.

### Data & persistence (non-obvious)
- App state is held in memory and persisted to `localStorage` (keys include a main state key and a GitHub config key). To reset, clear site data / `localStorage` in the browser.
- A seed dataset is embedded inline as `<script id="seed-data" type="application/json">` near the top of the JS; the app loads from `localStorage` first, falling back to this seed.
- Optional cloud sync writes back to GitHub via the GitHub Contents API and requires a token entered in-app (under リーグ設定 / settings). This is not needed for local development or testing.

### Recording a match result (the core flow)
In the 星取表 grid, click an empty cell for two players, then pick a result (一本勝 / 優勢勝 / 引分 / クリア). Standings recalculate immediately and a "更新しました ✓" toast appears.
