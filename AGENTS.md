# AGENTS.md

## Cursor Cloud specific instructions

### What this is
Single static web app: `index.html`, `css/style.css`, `js/app.js`. No package manager, build step, or automated tests.

### Running it
```bash
python3 -m http.server 8000
# open http://localhost:8000/index.html
```

### Lint / test / build
None. Verify changes by loading the page in a browser and exercising the UI manually.

### Data & persistence
- App state persisted to `localStorage` (key: `kinmuhyo-state-v1`)
- Seed data embedded in `js/app.js` as `SEED_DATA`
- Clear site data / localStorage to reset

### Core flow
Select year/month → click a grid cell → pick shift type (出勤/休日/有給 etc.) → standings update and toast appears.
