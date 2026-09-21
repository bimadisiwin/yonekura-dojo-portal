(function () {
  'use strict';

  const STORAGE_KEY = 'kinmuhyo-state-v1';

  const SHIFT_TYPES = {
    work:    { label: '出勤', short: '出', className: 'shift-work',    countsAsWork: 1 },
    holiday: { label: '休日', short: '休', className: 'shift-holiday', countsAsWork: 0 },
    paid:    { label: '有給', short: '有', className: 'shift-paid',    countsAsWork: 0, countsAsPaid: 1 },
    half:    { label: '半休', short: '半', className: 'shift-half',    countsAsWork: 0.5, countsAsPaid: 0.5 },
    absent:  { label: '欠勤', short: '欠', className: 'shift-absent',  countsAsWork: 0 },
    late:    { label: '遅刻', short: '遅', className: 'shift-late',    countsAsWork: 1 },
    early:   { label: '早退', short: '早', className: 'shift-early',   countsAsWork: 0.5 },
  };

  const DOW = ['日', '月', '火', '水', '木', '金', '土'];

  const SEED_DATA = {
    staff: [
      { id: 's1', name: '山田 太郎', department: '営業部' },
      { id: 's2', name: '佐藤 花子', department: '総務部' },
      { id: 's3', name: '鈴木 一郎', department: '開発部' },
    ],
    schedules: {},
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  };

  let state = loadState();
  let modalContext = null;

  // --- Japanese holidays (simplified fixed + calculated for prototype) ---
  function getJapaneseHolidays(year) {
    const fixed = {
      '1-1': '元日', '2-11': '建国記念の日', '2-23': '天皇誕生日',
      '4-29': '昭和の日', '5-3': '憲法記念日', '5-4': 'みどりの日', '5-5': 'こどもの日',
      '8-11': '山の日', '11-3': '文化の日', '11-23': '勤労感謝の日',
    };
    const holidays = {};
    Object.entries(fixed).forEach(([md, name]) => {
      holidays[`${year}-${md}`] = name;
    });

    // Happy Monday (approximation for prototype)
    const happyMondays = [
      [1, 2, '成人の日'], [7, 3, '海の日'], [9, 3, '敬老の日'], [10, 2, 'スポーツの日'],
    ];
    happyMondays.forEach(([m, nth, name]) => {
      const d = nthMonday(year, m, nth);
      holidays[`${year}-${m}-${d}`] = name;
    });

    // Vernal / Autumn equinox (approximation)
    const vernal = Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
    const autumn = Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
    holidays[`${year}-3-${vernal}`] = '春分の日';
    holidays[`${year}-9-${autumn}`] = '秋分の日';

    return holidays;
  }

  function nthMonday(year, month, n) {
    let count = 0;
    for (let d = 1; d <= 31; d++) {
      const date = new Date(year, month - 1, d);
      if (date.getMonth() !== month - 1) break;
      if (date.getDay() === 1) {
        count++;
        if (count === n) return d;
      }
    }
    return 1;
  }

  function monthKey(year, month) {
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  function dayKey(year, month, day) {
    return `${monthKey(year, month)}-${String(day).padStart(2, '0')}`;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) { /* ignore */ }
    return JSON.parse(JSON.stringify(SEED_DATA));
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function showToast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  function getSchedule(year, month) {
    const key = monthKey(year, month);
    if (!state.schedules[key]) state.schedules[key] = {};
    return state.schedules[key];
  }

  function getCellShift(staffId, year, month, day) {
    const schedule = getSchedule(year, month);
    return schedule[`${staffId}:${day}`] || null;
  }

  function setCellShift(staffId, year, month, day, shiftType) {
    const schedule = getSchedule(year, month);
    const key = `${staffId}:${day}`;
    if (shiftType) {
      schedule[key] = shiftType;
    } else {
      delete schedule[key];
    }
    saveState();
  }

  function calcSummary(staffId, year, month) {
    const dim = daysInMonth(year, month);
    let work = 0, paid = 0, holiday = 0;
    for (let d = 1; d <= dim; d++) {
      const shift = getCellShift(staffId, year, month, d);
      if (!shift || !SHIFT_TYPES[shift]) continue;
      const s = SHIFT_TYPES[shift];
      if (s.countsAsWork) work += s.countsAsWork;
      if (s.countsAsPaid) paid += s.countsAsPaid;
      if (shift === 'holiday') holiday++;
    }
    return { work, paid, holiday };
  }

  // --- Render ---
  function renderStaffList() {
    const ul = document.getElementById('staff-list');
    ul.innerHTML = '';
    state.staff.forEach(s => {
      const li = document.createElement('li');
      li.className = 'staff-item';
      li.innerHTML = `
        <div class="staff-item-info">
          <div class="staff-item-name">${escapeHtml(s.name)}</div>
          <div class="staff-item-dept">${escapeHtml(s.department || '')}</div>
        </div>
        <div class="staff-item-actions">
          <button class="btn btn-danger btn-icon" data-action="delete-staff" data-id="${s.id}" title="削除">×</button>
        </div>`;
      ul.appendChild(li);
    });
  }

  function renderSchedule() {
    const { year, month } = state;
    const dim = daysInMonth(year, month);
    const holidays = getJapaneseHolidays(year);
    const tbody = document.getElementById('schedule-body');
    const thead = document.getElementById('schedule-head');
    tbody.innerHTML = '';
    thead.innerHTML = '';

    // Header row
    let headRow = '<th class="col-staff">スタッフ</th>';
    for (let d = 1; d <= dim; d++) {
      const date = new Date(year, month - 1, d);
      const dow = date.getDay();
      const hk = `${year}-${month}-${d}`;
      const isHoliday = holidays[hk];
      let cls = 'day-header';
      if (isHoliday) cls += ' holiday';
      else if (dow === 0) cls += ' sun';
      else if (dow === 6) cls += ' sat';
      headRow += `<th class="${cls}"><div>${d}</div><div class="dow">${DOW[dow]}</div></th>`;
    }
    headRow += '<th class="col-summary">出勤</th><th class="col-summary">有給</th><th class="col-summary">休日</th>';
    thead.innerHTML = `<tr>${headRow}</tr>`;

    document.getElementById('month-label').textContent = `${year}年 ${month}月`;

    state.staff.forEach(staff => {
      const tr = document.createElement('tr');
      let cells = `<td class="col-staff">${escapeHtml(staff.name)}<br><small style="color:var(--text-muted)">${escapeHtml(staff.department || '')}</small></td>`;

      for (let d = 1; d <= dim; d++) {
        const date = new Date(year, month - 1, d);
        const dow = date.getDay();
        const hk = `${year}-${month}-${d}`;
        const isHoliday = holidays[hk];
        const shift = getCellShift(staff.id, year, month, d);

        let cls = 'schedule-cell';
        let text = '';
        if (shift && SHIFT_TYPES[shift]) {
          cls += ' ' + SHIFT_TYPES[shift].className;
          text = SHIFT_TYPES[shift].short;
        } else {
          cls += ' empty';
          if (isHoliday) cls += ' national-holiday-bg';
          else if (dow === 0 || dow === 6) cls += ' weekend-bg';
        }

        cells += `<td class="${cls}" data-staff="${staff.id}" data-day="${d}">${text}</td>`;
      }

      const sum = calcSummary(staff.id, year, month);
      cells += `<td class="col-summary">${sum.work % 1 ? sum.work.toFixed(1) : sum.work}</td>`;
      cells += `<td class="col-summary">${sum.paid % 1 ? sum.paid.toFixed(1) : sum.paid}</td>`;
      cells += `<td class="col-summary">${sum.holiday}</td>`;
      tr.innerHTML = cells;
      tbody.appendChild(tr);
    });
  }

  function renderLegend() {
    const el = document.getElementById('legend');
    el.innerHTML = Object.entries(SHIFT_TYPES).map(([key, s]) =>
      `<span class="legend-item"><span class="legend-swatch ${s.className}"></span>${s.label}</span>`
    ).join('');
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // --- Modal ---
  function openShiftModal(staffId, day) {
    const staff = state.staff.find(s => s.id === staffId);
    if (!staff) return;
    modalContext = { staffId, day };
    const current = getCellShift(staffId, state.year, state.month, day);
    document.getElementById('modal-title').textContent =
      `${staff.name} — ${state.year}年${state.month}月${day}日`;

    const opts = document.getElementById('shift-options');
    opts.innerHTML = '';

    Object.entries(SHIFT_TYPES).forEach(([key, s]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'shift-option ' + s.className + (current === key ? ' selected' : '');
      btn.dataset.shift = key;
      btn.textContent = s.label;
      opts.appendChild(btn);
    });

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'shift-option clear';
    clearBtn.dataset.shift = '';
    clearBtn.textContent = 'クリア（未入力）';
    opts.appendChild(clearBtn);

    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    modalContext = null;
  }

  // --- Actions ---
  function addStaff(name, department) {
    const id = 's' + Date.now();
    state.staff.push({ id, name, department });
    saveState();
    renderStaffList();
    renderSchedule();
    showToast('スタッフを追加しました ✓');
  }

  function deleteStaff(id) {
    if (!confirm('このスタッフを削除しますか？')) return;
    state.staff = state.staff.filter(s => s.id !== id);
    Object.values(state.schedules).forEach(sched => {
      Object.keys(sched).forEach(k => {
        if (k.startsWith(id + ':')) delete sched[k];
      });
    });
    saveState();
    renderStaffList();
    renderSchedule();
    showToast('スタッフを削除しました');
  }

  function changeMonth(delta) {
    state.month += delta;
    if (state.month > 12) { state.month = 1; state.year++; }
    if (state.month < 1) { state.month = 12; state.year--; }
    saveState();
    renderSchedule();
  }

  function exportCSV() {
    const { year, month } = state;
    const dim = daysInMonth(year, month);
    const headers = ['スタッフ', '部署', ...Array.from({ length: dim }, (_, i) => `${i + 1}日`), '出勤日数', '有給日数', '休日数'];
    const rows = [headers];

    state.staff.forEach(staff => {
      const row = [staff.name, staff.department || ''];
      for (let d = 1; d <= dim; d++) {
        const shift = getCellShift(staff.id, year, month, d);
        row.push(shift ? SHIFT_TYPES[shift].label : '');
      }
      const sum = calcSummary(staff.id, year, month);
      row.push(sum.work, sum.paid, sum.holiday);
      rows.push(row);
    });

    const bom = '\uFEFF';
    const csv = bom + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `勤務表_${year}年${month}月.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('CSVをダウンロードしました ✓');
  }

  function resetData() {
    if (!confirm('すべてのデータを初期状態に戻しますか？')) return;
    localStorage.removeItem(STORAGE_KEY);
    state = JSON.parse(JSON.stringify(SEED_DATA));
    saveState();
    renderStaffList();
    renderSchedule();
    showToast('データをリセットしました');
  }

  // --- Events ---
  function bindEvents() {
    document.getElementById('btn-prev-month').addEventListener('click', () => changeMonth(-1));
    document.getElementById('btn-next-month').addEventListener('click', () => changeMonth(1));
    document.getElementById('btn-today').addEventListener('click', () => {
      const now = new Date();
      state.year = now.getFullYear();
      state.month = now.getMonth() + 1;
      saveState();
      renderSchedule();
    });
    document.getElementById('btn-export').addEventListener('click', exportCSV);
    document.getElementById('btn-print').addEventListener('click', () => window.print());
    document.getElementById('btn-reset').addEventListener('click', resetData);

    document.getElementById('btn-add-staff').addEventListener('click', () => {
      const name = document.getElementById('input-staff-name').value.trim();
      const dept = document.getElementById('input-staff-dept').value.trim();
      if (!name) { showToast('名前を入力してください'); return; }
      addStaff(name, dept);
      document.getElementById('input-staff-name').value = '';
      document.getElementById('input-staff-dept').value = '';
    });

    document.getElementById('input-staff-name').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btn-add-staff').click();
    });

    document.getElementById('staff-list').addEventListener('click', e => {
      const btn = e.target.closest('[data-action="delete-staff"]');
      if (btn) deleteStaff(btn.dataset.id);
    });

    document.getElementById('schedule-body').addEventListener('click', e => {
      const cell = e.target.closest('.schedule-cell');
      if (!cell) return;
      openShiftModal(cell.dataset.staff, parseInt(cell.dataset.day, 10));
    });

    document.getElementById('shift-options').addEventListener('click', e => {
      const opt = e.target.closest('.shift-option');
      if (!opt || !modalContext) return;
      const shift = opt.dataset.shift || null;
      setCellShift(modalContext.staffId, state.year, state.month, modalContext.day, shift);
      closeModal();
      renderSchedule();
      showToast('更新しました ✓');
    });

    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', e => {
      if (e.target.id === 'modal-overlay') closeModal();
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeModal();
    });
  }

  // --- Init ---
  function init() {
    renderLegend();
    renderStaffList();
    renderSchedule();
    bindEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
