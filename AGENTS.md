# AGENTS.md

## Cursor Cloud specific instructions

### What this is
Nursery (保育園) work schedule app: `index.html`, `css/style.css`, `js/constants.js`, `js/scheduler.js`, `js/app.js`. No package manager, build step, or automated tests.

### Running it
```bash
python3 -m http.server 8000
# open http://localhost:8000/index.html
```

### Lint / test / build
None. Verify by loading in browser. Optional Node smoke test:
```bash
node -e "global.window=global; require('./js/constants.js'); require('./js/scheduler.js'); const s=global.KinmuhyoScheduler.generateSchedule(global.KinmuhyoConstants.SEED_DATA.staff,2026,9); console.log(global.KinmuhyoScheduler.validateSchedule(global.KinmuhyoConstants.SEED_DATA.staff,s,2026,9));"
```

### Data & persistence
- Key: `kinmuhyo-state-v2` in localStorage
- Seed: 15 staff in `js/constants.js` (`SEED_DATA`)
- Clear localStorage to reset

### Core flow
Edit staff preferred off → click 自動生成 → check constraint panel → manually adjust cells if needed.
