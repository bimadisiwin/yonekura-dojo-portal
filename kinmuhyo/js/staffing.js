/* 園児数に基づく必要配置の計算 */
(function (global) {
  'use strict';

  /** 保育標準時間法に基づく配置基準（1人あたりの園児数） */
  const STAFFING_RATIOS = {
    under1: 3,   // 0歳児: 1:3
    age1_2: 6,   // 1・2歳児: 1:6
    age3_5: 20,  // 3歳以上児: 1:20
    teachersPerAge3_5: 10, // 3歳以上10人ごとに保育士1人
    teacherShareOfStaff: 3, // 保育従事者の1/3以上を保育士
    minTeachers: 2,
  };

  const DEFAULT_AGE_GROUPS = { under1: 9, age1_2: 18, age3_5: 54 };

  function monthKey(year, month) {
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  function normalizeAgeGroups(src) {
    const g = src || DEFAULT_AGE_GROUPS;
    return {
      under1: Math.max(0, parseInt(g.under1, 10) || 0),
      age1_2: Math.max(0, parseInt(g.age1_2, 10) || 0),
      age3_5: Math.max(0, parseInt(g.age3_5, 10) || 0),
    };
  }

  function totalChildren(groups) {
    return groups.under1 + groups.age1_2 + groups.age3_5;
  }

  /** 年齢別園児数から必要人数を算出 */
  function calcRequiredStaff(ageGroups) {
    const g = normalizeAgeGroups(ageGroups);
    const childcare =
      Math.ceil(g.under1 / STAFFING_RATIOS.under1) +
      Math.ceil(g.age1_2 / STAFFING_RATIOS.age1_2) +
      Math.ceil(g.age3_5 / STAFFING_RATIOS.age3_5);

    const teachers = Math.max(
      STAFFING_RATIOS.minTeachers,
      Math.ceil(g.age3_5 / STAFFING_RATIOS.teachersPerAge3_5),
      Math.ceil(childcare / STAFFING_RATIOS.teacherShareOfStaff)
    );

    return {
      childcare,
      teachers,
      totalChildren: totalChildren(g),
      ageGroups: g,
    };
  }

  function getMonthChildrenConfig(state, year, month) {
    const key = monthKey(year, month);
    if (!state.children) state.children = {};
    if (!state.children[key]) {
      state.children[key] = {
        default: { ...DEFAULT_AGE_GROUPS },
        byDay: {},
      };
    }
    return state.children[key];
  }

  function getChildrenForDay(state, year, month, day) {
    const cfg = getMonthChildrenConfig(state, year, month);
    const override = cfg.byDay && cfg.byDay[String(day)];
    return normalizeAgeGroups(override || cfg.default);
  }

  function getRequiredForDay(state, year, month, day) {
    return calcRequiredStaff(getChildrenForDay(state, year, month, day));
  }

  function setDefaultChildren(state, year, month, ageGroups) {
    const cfg = getMonthChildrenConfig(state, year, month);
    cfg.default = normalizeAgeGroups(ageGroups);
  }

  function setDayChildren(state, year, month, day, ageGroups) {
    const cfg = getMonthChildrenConfig(state, year, month);
    if (!cfg.byDay) cfg.byDay = {};
    cfg.byDay[String(day)] = normalizeAgeGroups(ageGroups);
  }

  function clearDayChildren(state, year, month, day) {
    const cfg = getMonthChildrenConfig(state, year, month);
    if (cfg.byDay) delete cfg.byDay[String(day)];
  }

  global.KinmuhyoStaffing = {
    STAFFING_RATIOS, DEFAULT_AGE_GROUPS,
    calcRequiredStaff, getRequiredForDay, getChildrenForDay,
    getMonthChildrenConfig, setDefaultChildren, setDayChildren, clearDayChildren,
    totalChildren, normalizeAgeGroups, monthKey,
  };
})(typeof window !== 'undefined' ? window : globalThis);
