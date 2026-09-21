(function () {
  'use strict';

  const C = window.KinmuhyoConstants;
  const S = window.KinmuhyoScheduler;
  const { STORAGE_KEY, SHIFT_TYPES, CONSTRAINTS, ROLES, EMPLOYMENT, PARTTIME_RULES, DOW, createStaff, SEED_DATA } = C;

  let state = loadState();
  let modalContext = null;
  let staffEditId = null;

  function getJapaneseHolidays(year) {
    const fixed = {
      '1-1': '元日', '2-11': '建国記念の日', '2-23': '天皇誕生日',
      '4-29': '昭和の日', '5-3': '憲法記念日', '5-4': 'みどりの日', '5-5': 'こどもの日',
      '8-11': '山の日', '11-3': '文化の日', '11-23': '勤労感謝の日',
    };
    const holidays = {};
    Object.entries(fixed).forEach(([md, name]) => { holidays[`${year}-${md}`] = name; });
    [[1, 2, '成人の日'], [7, 3, '海の日'], [9, 3, '敬老の日'], [10, 2, 'スポーツの日']].forEach(([m, nth]) => {
      holidays[`${year}-${m}-${nthMonday(year, m, nth)}`] = '';
    });
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
      if (date.getDay() === 1 && ++count === n) return d;
    }
    return 1;
  }

  function monthKey(year, month) {
    return `${year}-${String(month).padStart(2, '0')}`;
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
    showToast._timer = setTimeout(() => el.classList.remove('show'), 2800);
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function getSchedule(year, month) {
    const key = monthKey(year, month);
    if (!state.schedules[key]) state.schedules[key] = {};
    return state.schedules[key];
  }

  function getCellShift(staffId, year, month, day) {
    return getSchedule(year, month)[`${staffId}:${day}`] || null;
  }

  function setCellShift(staffId, year, month, day, shiftType) {
    const schedule = getSchedule(year, month);
    const key = `${staffId}:${day}`;
    if (shiftType) schedule[key] = shiftType;
    else delete schedule[key];
    saveState();
  }

  function staffBadge(staff) {
    const emp = EMPLOYMENT[staff.employmentType]?.short || '';
    const role = staff.role === 'nurse' ? '看' : (staff.hasNurseryLicense ? '保' : '従');
    return `<span class="badge badge-${staff.employmentType}">${emp}</span><span class="badge badge-role">${role}</span>`;
  }

  function calcSummary(staffId, year, month) {
    const dim = S.daysInMonth(year, month);
    let work = 0, paid = 0, off = 0;
    for (let d = 1; d <= dim; d++) {
      const shift = getCellShift(staffId, year, month, d);
      if (!shift || !SHIFT_TYPES[shift]) continue;
      if (SHIFT_TYPES[shift].isWork) work++;
      else if (shift === 'paid') paid++;
      else if (shift === 'off') off++;
    }
    return { work, paid, off };
  }

  function renderStaffList() {
    const ul = document.getElementById('staff-list');
    ul.innerHTML = '';
    state.staff.forEach(s => {
      const li = document.createElement('li');
      li.className = 'staff-item';
      const ptLabel = s.parttimeRule ? PARTTIME_RULES[s.parttimeRule]?.label : '';
      li.innerHTML = `
        <div class="staff-item-info" data-action="edit-staff" data-id="${s.id}" style="cursor:pointer;flex:1">
          <div class="staff-item-name">${staffBadge(s)} ${escapeHtml(s.name)}</div>
          <div class="staff-item-dept">${escapeHtml(ROLES[s.role]?.label || '')}${ptLabel ? ' · ' + ptLabel : ''}</div>
        </div>
        <div class="staff-item-actions">
          <button class="btn btn-danger btn-icon" data-action="delete-staff" data-id="${s.id}" title="削除">×</button>
        </div>`;
      ul.appendChild(li);
    });
    document.getElementById('staff-count').textContent = `${state.staff.length}名（常勤${state.staff.filter(x=>x.employmentType==='fulltime').length} / パート${state.staff.filter(x=>x.employmentType==='parttime').length}）`;
  }

  function renderSchedule() {
    const { year, month } = state;
    const dim = S.daysInMonth(year, month);
    const holidays = getJapaneseHolidays(year);
    const schedule = getSchedule(year, month);
    const tbody = document.getElementById('schedule-body');
    const thead = document.getElementById('schedule-head');
    const tfoot = document.getElementById('schedule-foot');
    tbody.innerHTML = '';
    thead.innerHTML = '';
    if (tfoot) tfoot.innerHTML = '';

    let headRow = '<th class="col-staff">職員</th>';
    for (let d = 1; d <= dim; d++) {
      const dow = new Date(year, month - 1, d).getDay();
      const hk = `${year}-${month}-${d}`;
      const isHoliday = holidays[hk];
      let cls = 'day-header';
      if (isHoliday) cls += ' holiday';
      else if (dow === 0) cls += ' sun';
      else if (dow === 6) cls += ' sat';
      headRow += `<th class="${cls}"><div>${d}</div><div class="dow">${DOW[dow]}</div></th>`;
    }
    headRow += '<th class="col-summary">出勤</th><th class="col-summary">休日</th>';
    thead.innerHTML = `<tr>${headRow}</tr>`;
    document.getElementById('month-label').textContent = `${year}年 ${month}月`;

    state.staff.forEach(staff => {
      const tr = document.createElement('tr');
      const roleLabel = ROLES[staff.role]?.label || '';
      let cells = `<td class="col-staff">${escapeHtml(staff.name)}<br><small>${escapeHtml(roleLabel)}</small></td>`;

      for (let d = 1; d <= dim; d++) {
        const dow = new Date(year, month - 1, d).getDay();
        const hk = `${year}-${month}-${d}`;
        const isHoliday = holidays[hk];
        const shift = schedule[`${staff.id}:${d}`];
        const prefOff = S.getPreferredOffDays(staff, year, month).includes(d);

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
        if (prefOff) cls += ' preferred-off';
        cells += `<td class="${cls}" data-staff="${staff.id}" data-day="${d}" title="${prefOff ? '希望休' : ''}">${text}</td>`;
      }

      const sum = calcSummary(staff.id, year, month);
      cells += `<td class="col-summary">${sum.work}</td><td class="col-summary">${sum.off + sum.paid}</td>`;
      tr.innerHTML = cells;
      tbody.appendChild(tr);
    });

    if (tfoot) {
      const validation = S.validateSchedule(state.staff, schedule, year, month);
      let footChild = '<td class="col-staff"><strong>保育従事者</strong></td>';
      let footTeacher = '<td class="col-staff"><strong>保育士</strong></td>';
      validation.daily.forEach(row => {
        const cc = row.childcareOk ? '' : ' constraint-ng';
        const tc = row.teachersOk ? '' : ' constraint-ng';
        footChild += `<td class="col-summary${cc}">${row.childcare}</td>`;
        footTeacher += `<td class="col-summary${tc}">${row.teachers}</td>`;
      });
      footChild += '<td colspan="2"></td>';
      footTeacher += '<td colspan="2"></td>';
      tfoot.innerHTML = `<tr class="summary-row">${footChild}</tr><tr class="summary-row">${footTeacher}</tr>`;
      renderConstraintPanel(validation);
    }
  }

  function renderConstraintPanel(validation) {
    const el = document.getElementById('constraint-panel');
    if (!el) return;
    const ngDays = validation.daily.filter(r => !r.childcareOk || !r.teachersOk);
    if (validation.ok) {
      el.className = 'constraint-panel ok';
      el.innerHTML = `✓ すべての制約を満たしています（平日 保育従事者 ≥ ${CONSTRAINTS.minChildcareWorkersWeekday}人、毎日 保育士 ≥ ${CONSTRAINTS.minNurseryTeachersDaily}人）`;
    } else {
      el.className = 'constraint-panel ng';
      el.innerHTML = `⚠ 制約未達: ${ngDays.length}日 — ${validation.issues.slice(0, 5).join(' / ')}${validation.issues.length > 5 ? ' …' : ''}`;
    }
  }

  function renderLegend() {
    document.getElementById('legend').innerHTML = Object.entries(SHIFT_TYPES).map(([, s]) =>
      `<span class="legend-item"><span class="legend-swatch ${s.className}"></span>${s.label}</span>`
    ).join('');
  }

  function toggleParttimeFields() {
    const emp = document.getElementById('input-employment').value;
    document.getElementById('parttime-fields').style.display = emp === 'parttime' ? 'block' : 'none';
  }

  function openShiftModal(staffId, day) {
    const staff = state.staff.find(s => s.id === staffId);
    if (!staff) return;
    modalContext = { staffId, day };
    document.getElementById('modal-title').textContent = `${staff.name} — ${state.year}年${state.month}月${day}日`;
    const opts = document.getElementById('shift-options');
    opts.innerHTML = '';
    Object.entries(SHIFT_TYPES).forEach(([key, s]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'shift-option ' + s.className + (getCellShift(staffId, state.year, state.month, day) === key ? ' selected' : '');
      btn.dataset.shift = key;
      btn.textContent = s.label;
      opts.appendChild(btn);
    });
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'shift-option clear';
    clearBtn.dataset.shift = '';
    clearBtn.textContent = 'クリア';
    opts.appendChild(clearBtn);
    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    modalContext = null;
  }

  function openStaffModal(staffId) {
    staffEditId = staffId || null;
    const staff = staffId ? state.staff.find(s => s.id === staffId) : null;
    document.getElementById('staff-modal-title').textContent = staff ? `${staff.name} を編集` : '職員を追加';
    document.getElementById('sf-name').value = staff?.name || '';
    document.getElementById('sf-employment').value = staff?.employmentType || 'fulltime';
    document.getElementById('sf-role').value = staff?.role || 'nursery_teacher';
    document.getElementById('sf-license').checked = staff?.hasNurseryLicense ?? true;
    document.getElementById('sf-parttime').value = staff?.parttimeRule || 'monthly_10';
    document.getElementById('sf-shift').value = staff?.preferredShift || 'B';
    const offs = staff ? (staff.preferredOff[monthKey(state.year, state.month)] || []) : [];
    document.getElementById('sf-preferred-off').value = offs.join(', ');
    toggleStaffParttimeFields();
    document.getElementById('staff-modal-overlay').classList.remove('hidden');
  }

  function closeStaffModal() {
    document.getElementById('staff-modal-overlay').classList.add('hidden');
    staffEditId = null;
  }

  function toggleStaffParttimeFields() {
    const emp = document.getElementById('sf-employment').value;
    document.getElementById('sf-parttime-fields').style.display = emp === 'parttime' ? 'block' : 'none';
  }

  function saveStaffFromModal() {
    const name = document.getElementById('sf-name').value.trim();
    if (!name) { showToast('名前を入力してください'); return; }

    const employmentType = document.getElementById('sf-employment').value;
    const role = document.getElementById('sf-role').value;
    const hasNurseryLicense = document.getElementById('sf-license').checked;
    const parttimeRule = employmentType === 'parttime' ? document.getElementById('sf-parttime').value : null;
    const preferredShift = employmentType === 'parttime' ? document.getElementById('sf-shift').value : null;
    const offRaw = document.getElementById('sf-preferred-off').value.trim();
    const offDays = offRaw ? offRaw.split(/[,、\s]+/).map(Number).filter(n => n >= 1 && n <= 31) : [];
    const mk = monthKey(state.year, state.month);

    if (staffEditId) {
      const staff = state.staff.find(s => s.id === staffEditId);
      if (!staff) return;
      Object.assign(staff, {
        name, employmentType, role, hasNurseryLicense,
        isChildcareWorker: ROLES[role]?.isChildcareWorker ?? true,
        parttimeRule, preferredShift,
      });
      if (!staff.preferredOff) staff.preferredOff = {};
      staff.preferredOff[mk] = offDays;
    } else {
      const s = createStaff({ name, employmentType, role, hasNurseryLicense, parttimeRule, preferredShift, preferredOff: { [mk]: offDays } });
      state.staff.push(s);
    }

    saveState();
    closeStaffModal();
    renderStaffList();
    renderSchedule();
    showToast(staffEditId ? '職員情報を更新しました ✓' : '職員を追加しました ✓');
  }

  function deleteStaff(id) {
    if (!confirm('この職員を削除しますか？')) return;
    state.staff = state.staff.filter(s => s.id !== id);
    Object.values(state.schedules).forEach(sched => {
      Object.keys(sched).forEach(k => { if (k.startsWith(id + ':')) delete sched[k]; });
    });
    saveState();
    renderStaffList();
    renderSchedule();
    showToast('職員を削除しました');
  }

  function autoGenerate() {
    if (!confirm(`${state.year}年${state.month}月の勤務表を自動生成します。\n希望休を考慮し、既存の割当は上書きされます。よろしいですか？`)) return;

    const schedule = S.generateSchedule(state.staff, state.year, state.month);
    state.schedules[monthKey(state.year, state.month)] = schedule;
    saveState();
    renderSchedule();

    const validation = S.validateSchedule(state.staff, schedule, state.year, state.month);
    if (validation.ok) showToast('勤務表を自動生成しました ✓ 制約OK');
    else showToast(`自動生成完了（${validation.issues.length}件の制約未達あり）`);
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
    const dim = S.daysInMonth(year, month);
    const headers = ['職員', '区分', '資格', ...Array.from({ length: dim }, (_, i) => `${i + 1}日`), '出勤', '休日'];
    const rows = [headers];
    state.staff.forEach(staff => {
      const row = [staff.name, EMPLOYMENT[staff.employmentType]?.label, staff.hasNurseryLicense ? '保育士' : ''];
      for (let d = 1; d <= dim; d++) {
        const shift = getCellShift(staff.id, year, month, d);
        row.push(shift ? SHIFT_TYPES[shift].label : '');
      }
      const sum = calcSummary(staff.id, year, month);
      row.push(sum.work, sum.off + sum.paid);
      rows.push(row);
    });
    const bom = '\uFEFF';
    const csv = bom + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `保育園勤務表_${year}年${month}月.csv`;
    a.click();
    showToast('CSVをダウンロードしました ✓');
  }

  function resetData() {
    if (!confirm('すべてのデータを初期状態（15名サンプル）に戻しますか？')) return;
    localStorage.removeItem(STORAGE_KEY);
    state = JSON.parse(JSON.stringify(SEED_DATA));
    saveState();
    renderStaffList();
    renderSchedule();
    showToast('データをリセットしました');
  }

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
    document.getElementById('btn-generate').addEventListener('click', autoGenerate);
    document.getElementById('btn-export').addEventListener('click', exportCSV);
    document.getElementById('btn-print').addEventListener('click', () => window.print());
    document.getElementById('btn-reset').addEventListener('click', resetData);
    document.getElementById('btn-add-staff').addEventListener('click', () => openStaffModal(null));
    document.getElementById('sf-employment').addEventListener('change', toggleStaffParttimeFields);
    document.getElementById('staff-modal-save').addEventListener('click', saveStaffFromModal);
    document.getElementById('staff-modal-close').addEventListener('click', closeStaffModal);
    document.getElementById('staff-modal-overlay').addEventListener('click', e => {
      if (e.target.id === 'staff-modal-overlay') closeStaffModal();
    });

    document.getElementById('staff-list').addEventListener('click', e => {
      const del = e.target.closest('[data-action="delete-staff"]');
      if (del) { deleteStaff(del.dataset.id); return; }
      const edit = e.target.closest('[data-action="edit-staff"]');
      if (edit) openStaffModal(edit.dataset.id);
    });

    document.getElementById('schedule-body').addEventListener('click', e => {
      const cell = e.target.closest('.schedule-cell');
      if (cell) openShiftModal(cell.dataset.staff, parseInt(cell.dataset.day, 10));
    });

    document.getElementById('shift-options').addEventListener('click', e => {
      const opt = e.target.closest('.shift-option');
      if (!opt || !modalContext) return;
      setCellShift(modalContext.staffId, state.year, state.month, modalContext.day, opt.dataset.shift || null);
      closeModal();
      renderSchedule();
      showToast('更新しました ✓');
    });

    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', e => {
      if (e.target.id === 'modal-overlay') closeModal();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeStaffModal(); } });
  }

  function init() {
    renderLegend();
    renderStaffList();
    renderSchedule();
    bindEvents();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
