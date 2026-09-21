(function () {
  'use strict';

  const C = window.KinmuhyoConstants;
  const S = window.KinmuhyoScheduler;
  const St = window.KinmuhyoStaffing;
  const { STORAGE_KEY, SHIFT_TYPES, ROLES, EMPLOYMENT, PARTTIME_RULES, DOW, EARLY_SHIFTS, LATE_SHIFTS,
    getAllowedShifts, formatAvailableHours, migrateStaffAvailability, parseTimeToMinutes, createStaff, SEED_DATA } = C;

  let state = loadState();
  let modalContext = null;
  let staffEditId = null;
  let mobileDay = Math.min(new Date().getDate(), S.daysInMonth(state.year, state.month));

  function isMobileLayout() {
    return window.matchMedia('(max-width: 768px)').matches;
  }

  function setMobileTab(tab) {
    document.body.dataset.mobileTab = tab;
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    if (tab === 'day') renderDayView();
  }

  function syncMobileDay() {
    const dim = S.daysInMonth(state.year, state.month);
    if (mobileDay > dim) mobileDay = dim;
    if (mobileDay < 1) mobileDay = 1;
  }

  function changeMobileDay(delta) {
    syncMobileDay();
    mobileDay += delta;
    const dim = S.daysInMonth(state.year, state.month);
    if (mobileDay > dim) {
      changeMonth(1);
      mobileDay = 1;
    } else if (mobileDay < 1) {
      changeMonth(-1);
      mobileDay = S.daysInMonth(state.year, state.month);
    } else {
      renderDayView();
    }
  }

  function renderDayView() {
    const el = document.getElementById('day-view-date');
    const metricsEl = document.getElementById('day-view-metrics');
    const listEl = document.getElementById('day-staff-list');
    if (!el || !listEl) return;

    syncMobileDay();
    const { year, month } = state;
    const schedule = getSchedule(year, month);
    const date = new Date(year, month - 1, mobileDay);
    const dow = DOW[date.getDay()];
    el.textContent = `${month}月${mobileDay}日 (${dow})`;

    const m = S.countDayMetrics(state.staff, schedule, mobileDay);
    const req = St.getRequiredForDay(state, year, month, mobileDay);
    const childcareOk = m.childcare >= req.childcare;
    const teachersOk = m.teachers >= req.teachers;
    metricsEl.className = 'day-view-metrics ' + (childcareOk && teachersOk ? 'ok' : 'ng');
    metricsEl.innerHTML = `園児 <strong>${req.totalChildren}</strong>人 → 必要 従事<strong>${req.childcare}</strong> / 保育士<strong>${req.teachers}</strong><br>配置 従事<strong>${m.childcare}</strong> · 保育士<strong>${m.teachers}</strong> · 早番<strong>${m.early}</strong> · 遅番<strong>${m.late}</strong>`;

    listEl.innerHTML = '';
    state.staff.forEach(staff => {
      const shift = schedule[`${staff.id}:${mobileDay}`];
      const shiftDef = shift && SHIFT_TYPES[shift];
      const li = document.createElement('li');
      li.className = 'day-staff-card';
      li.dataset.staff = staff.id;
      li.innerHTML = `
        <div class="day-staff-card-info">
          <div class="day-staff-card-name">${staffBadge(staff)} ${escapeHtml(staff.name)}</div>
          <div class="day-staff-card-role">${escapeHtml(ROLES[staff.role]?.label || '')}</div>
        </div>
        <div class="day-staff-card-shift ${shiftDef ? shiftDef.className : 'shift-off'}">${shiftDef ? shiftDef.short : '—'}</div>`;
      listEl.appendChild(li);
    });
  }

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

  function normalizeStaffList(staff) {
    (staff || []).forEach(s => migrateStaffAvailability(s));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('kinmuhyo-state-v2');
      if (raw) {
        const data = JSON.parse(raw);
        if (!data.children) data.children = {};
        normalizeStaffList(data.staff);
        return data;
      }
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
    let work = 0, paid = 0, off = 0, early = 0, late = 0;
    for (let d = 1; d <= dim; d++) {
      const shift = getCellShift(staffId, year, month, d);
      if (!shift || !SHIFT_TYPES[shift]) continue;
      if (SHIFT_TYPES[shift].isWork) {
        work++;
        if (EARLY_SHIFTS.includes(shift)) early++;
        if (LATE_SHIFTS.includes(shift)) late++;
      } else if (shift === 'paid') paid++;
      else if (shift === 'off') off++;
    }
    return { work, paid, off, early, late };
  }

  function renderChildrenPanel() {
    const cfg = St.getMonthChildrenConfig(state, state.year, state.month);
    const g = St.normalizeAgeGroups(cfg.default);
    const req = St.calcRequiredStaff(g);
    const elUnder1 = document.getElementById('ch-under1');
    const elAge12 = document.getElementById('ch-age1_2');
    const elAge35 = document.getElementById('ch-age3_5');
    if (!elUnder1) return;
    elUnder1.value = g.under1;
    elAge12.value = g.age1_2;
    elAge35.value = g.age3_5;
    document.getElementById('ch-total').textContent = req.totalChildren;
    document.getElementById('ch-required').textContent =
      `必要: 保育従事者 ${req.childcare}人 · 保育士 ${req.teachers}人`;
  }

  function saveDefaultChildren() {
    St.setDefaultChildren(state, state.year, state.month, {
      under1: document.getElementById('ch-under1').value,
      age1_2: document.getElementById('ch-age1_2').value,
      age3_5: document.getElementById('ch-age3_5').value,
    });
    saveState();
    renderChildrenPanel();
    renderSchedule();
    showToast('園児数を保存しました ✓');
  }

  function openChildrenDayModal(day) {
    document.getElementById('children-modal-title').textContent =
      `${state.year}年${state.month}月${day}日の園児数`;
    document.getElementById('children-modal-day').value = day;
    const g = St.getChildrenForDay(state, state.year, state.month, day);
    const cfg = St.getMonthChildrenConfig(state, state.year, state.month);
    const hasOverride = !!(cfg.byDay && cfg.byDay[String(day)]);
    document.getElementById('cd-under1').value = g.under1;
    document.getElementById('cd-age1_2').value = g.age1_2;
    document.getElementById('cd-age3_5').value = g.age3_5;
    document.getElementById('cd-use-default').checked = !hasOverride;
    ['cd-under1', 'cd-age1_2', 'cd-age3_5'].forEach(id => {
      document.getElementById(id).disabled = !hasOverride;
    });
    updateChildrenDayPreview();
    document.getElementById('children-modal-overlay').classList.remove('hidden');
  }

  function updateChildrenDayPreview() {
    const req = St.calcRequiredStaff({
      under1: document.getElementById('cd-under1').value,
      age1_2: document.getElementById('cd-age1_2').value,
      age3_5: document.getElementById('cd-age3_5').value,
    });
    document.getElementById('cd-preview').textContent =
      `合計 ${req.totalChildren}人 → 必要 従事${req.childcare}人 / 保育士${req.teachers}人`;
  }

  function saveChildrenDayModal() {
    const day = parseInt(document.getElementById('children-modal-day').value, 10);
    if (document.getElementById('cd-use-default').checked) {
      St.clearDayChildren(state, state.year, state.month, day);
    } else {
      St.setDayChildren(state, state.year, state.month, day, {
        under1: document.getElementById('cd-under1').value,
        age1_2: document.getElementById('cd-age1_2').value,
        age3_5: document.getElementById('cd-age3_5').value,
      });
    }
    saveState();
    document.getElementById('children-modal-overlay').classList.add('hidden');
    renderSchedule();
    showToast('日別園児数を保存しました ✓');
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
          <div class="staff-item-dept">${escapeHtml(ROLES[s.role]?.label || '')}${ptLabel ? ' · ' + ptLabel : ''} · ${formatAvailableHours(s)}</div>
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
    headRow += '<th class="col-summary">出勤</th><th class="col-summary">早番</th><th class="col-summary">遅番</th><th class="col-summary">休日</th>';
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
      cells += `<td class="col-summary">${sum.work}</td><td class="col-summary summary-early">${sum.early}</td><td class="col-summary summary-late">${sum.late}</td><td class="col-summary">${sum.off + sum.paid}</td>`;
      tr.innerHTML = cells;
      tbody.appendChild(tr);
    });

    if (tfoot) {
      const validation = S.validateSchedule(state.staff, schedule, year, month, state);
      let footKids = '<td class="col-staff"><strong>園児</strong></td>';
      let footReqC = '<td class="col-staff"><strong>必要従事</strong></td>';
      let footChild = '<td class="col-staff"><strong>保育従事</strong></td>';
      let footReqT = '<td class="col-staff"><strong>必要保育士</strong></td>';
      let footTeacher = '<td class="col-staff"><strong>保育士</strong></td>';
      let footEarly = '<td class="col-staff"><strong>早番</strong></td>';
      let footLate = '<td class="col-staff"><strong>遅番</strong></td>';
      validation.daily.forEach(row => {
        const cc = row.childcareOk ? '' : ' constraint-ng';
        const tc = row.teachersOk ? '' : ' constraint-ng';
        const dayOverride = St.getMonthChildrenConfig(state, year, month).byDay?.[String(row.day)];
        const kidsCls = dayOverride ? ' summary-day-override' : '';
        footKids += `<td class="col-summary${kidsCls} children-cell" data-day="${row.day}" title="クリックで園児数編集">${row.totalChildren}</td>`;
        footReqC += `<td class="col-summary">${row.reqChildcare}</td>`;
        footChild += `<td class="col-summary${cc}">${row.childcare}</td>`;
        footReqT += `<td class="col-summary">${row.reqTeachers}</td>`;
        footTeacher += `<td class="col-summary${tc}">${row.teachers}</td>`;
        footEarly += `<td class="col-summary summary-early">${row.early}</td>`;
        footLate += `<td class="col-summary summary-late">${row.late}</td>`;
      });
      const sumColspan = '<td colspan="4"></td>';
      [footKids, footReqC, footChild, footReqT, footTeacher, footEarly, footLate].forEach(r => { r += sumColspan; });
      tfoot.innerHTML = [
        `<tr class="summary-row summary-row-kids">${footKids}</tr>`,
        `<tr class="summary-row summary-row-req">${footReqC}</tr>`,
        `<tr class="summary-row">${footChild}</tr>`,
        `<tr class="summary-row summary-row-req">${footReqT}</tr>`,
        `<tr class="summary-row">${footTeacher}</tr>`,
        `<tr class="summary-row summary-row-early">${footEarly}</tr>`,
        `<tr class="summary-row summary-row-late">${footLate}</tr>`,
      ].join('');
      renderConstraintPanel(validation);
    }
    if (isMobileLayout()) renderDayView();
  }

  function renderConstraintPanel(validation) {
    const el = document.getElementById('constraint-panel');
    if (!el) return;
    const ngDays = validation.daily.filter(r => !r.childcareOk || !r.teachersOk);
    if (validation.ok) {
      el.className = 'constraint-panel ok';
      el.innerHTML = '✓ すべての制約を満たしています（園児数に基づく必要人数をクリア）';
    } else {
      el.className = 'constraint-panel ng';
      el.innerHTML = `⚠ 制約未達: ${ngDays.length}日 — ${validation.issues.slice(0, 5).join(' / ')}${validation.issues.length > 5 ? ' …' : ''}`;
    }
  }

  function renderLegend() {
    const html = Object.entries(SHIFT_TYPES).map(([, s]) =>
      `<span class="legend-item"><span class="legend-swatch ${s.className}"></span>${s.label}</span>`
    ).join('') + `<span class="legend-item legend-note">早番=A / 遅番=D</span>`;
    const legend = document.getElementById('legend');
    if (legend) legend.innerHTML = html;
    const legendMobile = document.getElementById('legend-mobile');
    if (legendMobile) legendMobile.innerHTML = html;
  }

  function toggleParttimeFields() {
    const emp = document.getElementById('input-employment').value;
    document.getElementById('parttime-fields').style.display = emp === 'parttime' ? 'block' : 'none';
  }

  function openShiftModal(staffId, day) {
    const staff = state.staff.find(s => s.id === staffId);
    if (!staff) return;
    modalContext = { staffId, day };
    const allowed = getAllowedShifts(staff);
    document.getElementById('modal-title').textContent =
      `${staff.name} — ${state.year}年${state.month}月${day}日（入れる時間 ${formatAvailableHours(staff)}）`;
    const opts = document.getElementById('shift-options');
    opts.innerHTML = '';
    Object.entries(SHIFT_TYPES).forEach(([key, s]) => {
      if (s.isWork && !allowed.includes(key)) return;
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
    document.getElementById('sf-available-start').value = staff?.availableStart || '07:00';
    document.getElementById('sf-available-end').value = staff?.availableEnd || '19:00';
    updateAvailablePreview();
    const offs = staff ? (staff.preferredOff[monthKey(state.year, state.month)] || []) : [];
    document.getElementById('sf-preferred-off').value = offs.join(', ');
    toggleStaffParttimeFields();
    document.getElementById('staff-modal-overlay').classList.remove('hidden');
  }

  function closeStaffModal() {
    document.getElementById('staff-modal-overlay').classList.add('hidden');
    staffEditId = null;
  }

  function updateAvailablePreview() {
    const el = document.getElementById('sf-available-preview');
    if (!el) return;
    const start = document.getElementById('sf-available-start').value;
    const end = document.getElementById('sf-available-end').value;
    if (!start || !end) { el.textContent = ''; return; }
    const allowed = getAllowedShifts({ availableStart: start, availableEnd: end });
    el.textContent = allowed.length
      ? `割当可能な勤務: ${allowed.join(' / ')}`
      : 'この時間帯では勤務体系(A〜D)と重なりません';
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
    const availableStart = document.getElementById('sf-available-start').value;
    const availableEnd = document.getElementById('sf-available-end').value;
    if (!availableStart || !availableEnd) { showToast('入れる時間帯を入力してください'); return; }
    if (parseTimeToMinutes(availableStart) >= parseTimeToMinutes(availableEnd)) {
      showToast('終了時刻は開始時刻より後にしてください'); return;
    }
    const tempStaff = { availableStart, availableEnd };
    const allowed = getAllowedShifts(tempStaff);
    if (!allowed.length) { showToast('この時間帯では勤務体系(A〜D)と重なりません'); return; }
    const preferredShift = employmentType === 'parttime' ? (allowed.includes('B') ? 'B' : allowed[0]) : null;
    const offRaw = document.getElementById('sf-preferred-off').value.trim();
    const offDays = offRaw ? offRaw.split(/[,、\s]+/).map(Number).filter(n => n >= 1 && n <= 31) : [];
    const mk = monthKey(state.year, state.month);

    if (staffEditId) {
      const staff = state.staff.find(s => s.id === staffEditId);
      if (!staff) return;
      Object.assign(staff, {
        name, employmentType, role, hasNurseryLicense,
        isChildcareWorker: ROLES[role]?.isChildcareWorker ?? true,
        parttimeRule, preferredShift, availableStart, availableEnd,
      });
      if (!staff.preferredOff) staff.preferredOff = {};
      staff.preferredOff[mk] = offDays;
    } else {
      const s = createStaff({ name, employmentType, role, hasNurseryLicense, parttimeRule, preferredShift, availableStart, availableEnd, preferredOff: { [mk]: offDays } });
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

    const schedule = S.generateSchedule(state.staff, state.year, state.month, state);
    state.schedules[monthKey(state.year, state.month)] = schedule;
    saveState();
    renderSchedule();

    const validation = S.validateSchedule(state.staff, schedule, state.year, state.month, state);
    if (validation.ok) showToast('勤務表を自動生成しました ✓ 制約OK');
    else showToast(`自動生成完了（${validation.issues.length}件の制約未達あり）`);
  }

  function changeMonth(delta) {
    state.month += delta;
    if (state.month > 12) { state.month = 1; state.year++; }
    if (state.month < 1) { state.month = 12; state.year--; }
    syncMobileDay();
    saveState();
    renderChildrenPanel();
    renderSchedule();
  }

  function exportCSV() {
    const { year, month } = state;
    const dim = S.daysInMonth(year, month);
    const headers = ['職員', '区分', '資格', ...Array.from({ length: dim }, (_, i) => `${i + 1}日`), '出勤', '早番', '遅番', '休日'];
    const rows = [headers];
    state.staff.forEach(staff => {
      const row = [staff.name, EMPLOYMENT[staff.employmentType]?.label, staff.hasNurseryLicense ? '保育士' : ''];
      for (let d = 1; d <= dim; d++) {
        const shift = getCellShift(staff.id, year, month, d);
        row.push(shift ? SHIFT_TYPES[shift].label : '');
      }
      const sum = calcSummary(staff.id, year, month);
      row.push(sum.work, sum.early, sum.late, sum.off + sum.paid);
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
    renderChildrenPanel();
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
      mobileDay = now.getDate();
      saveState();
      renderChildrenPanel();
      renderSchedule();
    });
    document.getElementById('btn-generate').addEventListener('click', autoGenerate);
    document.getElementById('btn-generate-mobile')?.addEventListener('click', autoGenerate);
    document.getElementById('fab-generate')?.addEventListener('click', autoGenerate);
    document.getElementById('btn-export').addEventListener('click', exportCSV);
    document.getElementById('btn-export-mobile')?.addEventListener('click', exportCSV);
    document.getElementById('btn-reset-mobile')?.addEventListener('click', resetData);
    document.getElementById('btn-day-prev')?.addEventListener('click', () => changeMobileDay(-1));
    document.getElementById('btn-day-next')?.addEventListener('click', () => changeMobileDay(1));
    document.getElementById('btn-edit-day-children')?.addEventListener('click', () => openChildrenDayModal(mobileDay));
    document.getElementById('btn-save-children')?.addEventListener('click', saveDefaultChildren);
    ['ch-under1', 'ch-age1_2', 'ch-age3_5'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => {
        const req = St.calcRequiredStaff({
          under1: document.getElementById('ch-under1').value,
          age1_2: document.getElementById('ch-age1_2').value,
          age3_5: document.getElementById('ch-age3_5').value,
        });
        document.getElementById('ch-total').textContent = req.totalChildren;
        document.getElementById('ch-required').textContent =
          `必要: 保育従事者 ${req.childcare}人 · 保育士 ${req.teachers}人`;
      });
    });
    ['cd-under1', 'cd-age1_2', 'cd-age3_5'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', updateChildrenDayPreview);
    });
    document.getElementById('cd-use-default')?.addEventListener('change', e => {
      const disabled = e.target.checked;
      ['cd-under1', 'cd-age1_2', 'cd-age3_5'].forEach(id => {
        document.getElementById(id).disabled = disabled;
      });
    });
    document.getElementById('children-modal-save')?.addEventListener('click', saveChildrenDayModal);
    document.getElementById('children-modal-close')?.addEventListener('click', () => {
      document.getElementById('children-modal-overlay').classList.add('hidden');
    });
    document.getElementById('children-modal-overlay')?.addEventListener('click', e => {
      if (e.target.id === 'children-modal-overlay') {
        document.getElementById('children-modal-overlay').classList.add('hidden');
      }
    });
    document.getElementById('schedule-foot')?.addEventListener('click', e => {
      const cell = e.target.closest('.children-cell');
      if (cell) openChildrenDayModal(parseInt(cell.dataset.day, 10));
    });

    document.getElementById('bottom-nav')?.addEventListener('click', e => {
      const btn = e.target.closest('.bottom-nav-item');
      if (btn) setMobileTab(btn.dataset.tab);
    });

    document.getElementById('day-staff-list')?.addEventListener('click', e => {
      const card = e.target.closest('.day-staff-card');
      if (card) openShiftModal(card.dataset.staff, mobileDay);
    });
    document.getElementById('btn-print').addEventListener('click', () => window.print());
    document.getElementById('btn-reset').addEventListener('click', resetData);
    document.getElementById('btn-add-staff').addEventListener('click', () => openStaffModal(null));
    document.getElementById('sf-employment').addEventListener('change', toggleStaffParttimeFields);
    document.getElementById('sf-available-start')?.addEventListener('input', updateAvailablePreview);
    document.getElementById('sf-available-end')?.addEventListener('input', updateAvailablePreview);
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
      if (isMobileLayout() && modalContext.day === mobileDay) renderDayView();
      showToast('更新しました ✓');
    });

    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', e => {
      if (e.target.id === 'modal-overlay') closeModal();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeModal();
        closeStaffModal();
        document.getElementById('children-modal-overlay')?.classList.add('hidden');
      }
    });
  }

  function initMobile() {
    if (isMobileLayout()) {
      document.body.dataset.mobileTab = 'day';
      setMobileTab('day');
    } else {
      delete document.body.dataset.mobileTab;
    }
  }

  function init() {
    renderLegend();
    renderChildrenPanel();
    renderStaffList();
    renderSchedule();
    bindEvents();
    initMobile();
    window.addEventListener('resize', () => {
      initMobile();
      if (isMobileLayout()) renderDayView();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
