# AGENTS.md

## Cursor Cloud specific instructions

### What this is
Nursery (保育園) work schedule app — standalone repository (`kinmuhyo-app`).
Files: `index.html`, `css/style.css`, `js/constants.js`, `js/staffing.js`, `js/scheduler.js`, `js/app.js`.
No package manager, build step, or automated tests.

### Running it
```bash
python3 -m http.server 8000
# open http://localhost:8000/index.html
```

### Lint / test / build
None. Verify by loading in browser.

### Data & persistence
- Key: `kinmuhyo-state-v3` in localStorage (migrates from v2)
- Seed: 15 staff in `js/constants.js` (`SEED_DATA`)
- Clear localStorage to reset

### Core flow
Edit staff (入れる時間帯・希望休) → set 園児数 → click 自動生成 → check constraint panel → manually adjust cells if needed.
