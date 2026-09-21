/* 保育園勤務表 — 自動生成エンジン */
(function (global) {
  'use strict';

  const { SHIFT_TYPES, PARTTIME_RULES, EARLY_SHIFTS, LATE_SHIFTS } = global.KinmuhyoConstants;
  const { getRequiredForDay } = global.KinmuhyoStaffing;

  function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  function isWeekday(year, month, day) {
    const dow = new Date(year, month - 1, day).getDay();
    return dow >= 1 && dow <= 5;
  }

  function monthKey(year, month) {
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  function getPreferredOffDays(staff, year, month) {
    return (staff.preferredOff && staff.preferredOff[monthKey(year, month)]) || [];
  }

  function isWorkingShift(shift) {
    return shift && SHIFT_TYPES[shift] && SHIFT_TYPES[shift].isWork;
  }

  function countDayMetrics(staff, schedule, day) {
    let childcare = 0, teachers = 0, total = 0, early = 0, late = 0;
    staff.forEach(s => {
      const shift = schedule[`${s.id}:${day}`];
      if (!isWorkingShift(shift)) return;
      total++;
      if (s.isChildcareWorker) childcare++;
      if (s.hasNurseryLicense) teachers++;
      if (EARLY_SHIFTS.includes(shift)) early++;
      if (LATE_SHIFTS.includes(shift)) late++;
    });
    return { childcare, teachers, total, early, late };
  }

  function getWorkCount(staffId, schedule, dim) {
    let n = 0;
    for (let d = 1; d <= dim; d++) {
      if (isWorkingShift(schedule[`${staffId}:${d}`])) n++;
    }
    return n;
  }

  function planParttimeDays(staff, year, month) {
    const dim = daysInMonth(year, month);
    const plan = {};

    staff.filter(s => s.employmentType === 'parttime').forEach(s => {
      const offs = new Set(getPreferredOffDays(s, year, month));
      const rule = PARTTIME_RULES[s.parttimeRule];
      if (!rule) return;

      if (s.parttimeRule === 'monthly_10') {
        const candidates = [];
        for (let d = 1; d <= dim; d++) {
          if (!isWeekday(year, month, d)) continue;
          if (offs.has(d)) continue;
          candidates.push(d);
        }
        const step = candidates.length / rule.daysPerMonth;
        for (let i = 0; i < rule.daysPerMonth && i < candidates.length; i++) {
          const idx = Math.min(candidates.length - 1, Math.floor(i * step + step / 2));
          plan[`${s.id}:${candidates[idx]}`] = true;
        }
      }

      if (s.parttimeRule === 'weekly_4') {
        const weekDays = [1, 2, 3, 4, 5];
        for (let d = 1; d <= dim; d++) {
          if (!isWeekday(year, month, d)) continue;
          const dow = new Date(year, month - 1, d).getDay();
          if (!weekDays.slice(0, rule.daysPerWeek).includes(dow)) continue;
          if (offs.has(d)) continue;
          plan[`${s.id}:${d}`] = true;
        }
      }
    });

    return plan;
  }

  function pickShift(staff, dayIndex) {
    const allowed = staff.preferredShift ? [staff.preferredShift] : ['A', 'B', 'C', 'D'];
    const shifts = ['A', 'B', 'C', 'D'];
    const idx = (dayIndex + staff.id.charCodeAt(staff.id.length - 1)) % shifts.length;
    for (let i = 0; i < 4; i++) {
      const s = shifts[(idx + i) % 4];
      if (allowed.includes(s)) return s;
    }
    return allowed[0] || 'B';
  }

  function assignDay(staff, schedule, year, month, day, parttimePlan, dim, appState) {
    const req = getRequiredForDay(appState, year, month, day);
    const needChildcare = req.childcare;
    const needTeachers = req.teachers;

    const ptWorking = staff.filter(s =>
      s.employmentType === 'parttime' && parttimePlan[`${s.id}:${day}`]
    );

    ptWorking.forEach(s => {
      const rule = PARTTIME_RULES[s.parttimeRule];
      schedule[`${s.id}:${day}`] = s.preferredShift || rule?.defaultShift || 'B';
    });

    const ptChildcare = ptWorking.filter(s => s.isChildcareWorker).length;
    const ftChildcare = staff.filter(s => s.employmentType === 'fulltime' && s.isChildcareWorker);
    const ftAll = staff.filter(s => s.employmentType === 'fulltime');

    const requiredFtChildcare = Math.max(0, needChildcare - ptChildcare);
    const maxFtChildcareOff = Math.max(0, ftChildcare.length - requiredFtChildcare);

    const offCandidates = ftChildcare
      .filter(s => !getPreferredOffDays(s, year, month).includes(day))
      .sort((a, b) => getWorkCount(b.id, schedule, dim) - getWorkCount(a.id, schedule, dim));

    const assignedOff = new Set();
    for (const s of offCandidates) {
      if (assignedOff.size >= maxFtChildcareOff) break;
      schedule[`${s.id}:${day}`] = 'off';
      const m = countDayMetrics(staff, schedule, day);
      if (m.teachers < needTeachers || m.childcare < needChildcare) {
        delete schedule[`${s.id}:${day}`];
      } else {
        assignedOff.add(s.id);
      }
    }

    ftAll.forEach(s => {
      if (schedule[`${s.id}:${day}`]) return;
      if (getPreferredOffDays(s, year, month).includes(day)) {
        schedule[`${s.id}:${day}`] = 'off';
        return;
      }
      schedule[`${s.id}:${day}`] = pickShift(s, day);
    });

    let metrics = countDayMetrics(staff, schedule, day);
    if (metrics.teachers < needTeachers) {
      const fixOrder = staff
        .filter(s => schedule[`${s.id}:${day}`] === 'off' && s.hasNurseryLicense)
        .sort((a, b) => getWorkCount(a.id, schedule, dim) - getWorkCount(b.id, schedule, dim));
      for (const s of fixOrder) {
        if (metrics.teachers >= needTeachers) break;
        schedule[`${s.id}:${day}`] = pickShift(s, day);
        metrics = countDayMetrics(staff, schedule, day);
      }
    }

    if (metrics.childcare < needChildcare) {
      const fixOrder = staff
        .filter(s => schedule[`${s.id}:${day}`] === 'off' && s.isChildcareWorker)
        .sort((a, b) => getWorkCount(a.id, schedule, dim) - getWorkCount(b.id, schedule, dim));
      for (const s of fixOrder) {
        if (metrics.childcare >= needChildcare) break;
        schedule[`${s.id}:${day}`] = pickShift(s, day);
        metrics = countDayMetrics(staff, schedule, day);
      }
    }
  }

  function generateSchedule(staff, year, month, appState) {
    const dim = daysInMonth(year, month);
    const schedule = {};

    staff.forEach(s => {
      getPreferredOffDays(s, year, month).forEach(d => {
        schedule[`${s.id}:${d}`] = 'off';
      });
    });

    const parttimePlan = planParttimeDays(staff, year, month);

    for (let d = 1; d <= dim; d++) {
      assignDay(staff, schedule, year, month, d, parttimePlan, dim, appState);
    }

    return schedule;
  }

  function validateSchedule(staff, schedule, year, month, appState) {
    const dim = daysInMonth(year, month);
    const issues = [];
    const daily = [];

    for (let d = 1; d <= dim; d++) {
      const m = countDayMetrics(staff, schedule, d);
      const req = getRequiredForDay(appState, year, month, d);
      const weekday = isWeekday(year, month, d);
      const childcareOk = m.childcare >= req.childcare;
      const teachersOk = m.teachers >= req.teachers;
      daily.push({
        day: d, weekday, ...m,
        reqChildcare: req.childcare,
        reqTeachers: req.teachers,
        totalChildren: req.totalChildren,
        childcareOk, teachersOk,
      });
      if (!childcareOk) {
        issues.push(`${d}日: 保育従事者 ${m.childcare}人（必要 ${req.childcare}人・園児${req.totalChildren}人）`);
      }
      if (!teachersOk) {
        issues.push(`${d}日: 保育士 ${m.teachers}人（必要 ${req.teachers}人）`);
      }
    }

    return { daily, issues, ok: issues.length === 0 };
  }

  global.KinmuhyoScheduler = {
    generateSchedule, validateSchedule, countDayMetrics, isWeekday, daysInMonth, getPreferredOffDays,
  };
})(typeof window !== 'undefined' ? window : globalThis);
