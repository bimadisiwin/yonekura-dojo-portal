/* 保育園勤務表 — 定数・シフト定義 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'kinmuhyo-state-v2';

  /** 早番: Aのみ  遅番: Dのみ */
  const EARLY_SHIFTS = ['A'];
  const LATE_SHIFTS = ['D'];

  const SHIFT_TYPES = {
    A: { label: 'A (7:00-16:00)', short: 'A', className: 'shift-a', start: 7, end: 16, isWork: true, band: 'early' },
    B: { label: 'B (8:00-17:00)', short: 'B', className: 'shift-b', start: 8, end: 17, isWork: true, band: 'early' },
    C: { label: 'C (9:00-18:00)', short: 'C', className: 'shift-c', start: 9, end: 18, isWork: true, band: 'late' },
    D: { label: 'D (10:00-19:00)', short: 'D', className: 'shift-d', start: 10, end: 19, isWork: true, band: 'late' },
    off:  { label: '休日', short: '休', className: 'shift-off',  isWork: false },
    paid: { label: '有給', short: '有', className: 'shift-paid', isWork: false, countsAsPaid: true },
  };

  const CONSTRAINTS = {
    minChildcareWorkersWeekday: 10,
    minNurseryTeachersDaily: 7,
  };

  const ROLES = {
    nursery_teacher: { label: '保育士', isChildcareWorker: true },
    childcare_staff: { label: '保育従事者', isChildcareWorker: true },
    nurse: { label: '看護師', isChildcareWorker: false },
  };

  const EMPLOYMENT = {
    fulltime: { label: '常勤', short: '常' },
    parttime: { label: 'パート', short: 'パ' },
  };

  const PARTTIME_RULES = {
    monthly_10: { label: '月10日 (9:00-17:00)', daysPerMonth: 10, defaultShift: 'B' },
    weekly_4:   { label: '週4日 (8:00-17:00)', daysPerWeek: 4, defaultShift: 'B' },
  };

  const DOW = ['日', '月', '火', '水', '木', '金', '土'];

  function createStaff(overrides) {
    const role = overrides.role || 'nursery_teacher';
    const roleDef = ROLES[role] || ROLES.nursery_teacher;
    return {
      id: overrides.id || ('s' + Date.now() + Math.random().toString(36).slice(2, 6)),
      name: overrides.name || '',
      employmentType: overrides.employmentType || 'fulltime',
      role,
      hasNurseryLicense: overrides.hasNurseryLicense ?? (role === 'nursery_teacher'),
      isChildcareWorker: roleDef.isChildcareWorker,
      parttimeRule: overrides.parttimeRule || null,
      preferredShift: overrides.preferredShift || null,
      preferredOff: overrides.preferredOff || {},
    };
  }

  const SEED_DATA = {
    staff: [
      createStaff({ id: 's01', name: '高橋 美咲', employmentType: 'fulltime', role: 'nursery_teacher', hasNurseryLicense: true }),
      createStaff({ id: 's02', name: '田中 由美', employmentType: 'fulltime', role: 'nursery_teacher', hasNurseryLicense: true }),
      createStaff({ id: 's03', name: '佐藤 恵', employmentType: 'fulltime', role: 'nursery_teacher', hasNurseryLicense: true }),
      createStaff({ id: 's04', name: '鈴木 直子', employmentType: 'fulltime', role: 'nursery_teacher', hasNurseryLicense: true }),
      createStaff({ id: 's05', name: '伊藤 真理', employmentType: 'fulltime', role: 'nursery_teacher', hasNurseryLicense: true }),
      createStaff({ id: 's06', name: '渡辺 香織', employmentType: 'fulltime', role: 'nursery_teacher', hasNurseryLicense: true }),
      createStaff({ id: 's07', name: '山本 亜希', employmentType: 'fulltime', role: 'nursery_teacher', hasNurseryLicense: true }),
      createStaff({ id: 's08', name: '中村 智子', employmentType: 'fulltime', role: 'nursery_teacher', hasNurseryLicense: true }),
      createStaff({ id: 's09', name: '小林 奈々', employmentType: 'fulltime', role: 'nursery_teacher', hasNurseryLicense: true }),
      createStaff({ id: 's10', name: '加藤 久美', employmentType: 'fulltime', role: 'nursery_teacher', hasNurseryLicense: true }),
      createStaff({ id: 's11', name: '吉田 さおり', employmentType: 'fulltime', role: 'childcare_staff', hasNurseryLicense: false }),
      createStaff({ id: 's12', name: '山田 健太', employmentType: 'fulltime', role: 'childcare_staff', hasNurseryLicense: false }),
      createStaff({ id: 's13', name: '松本 洋子', employmentType: 'fulltime', role: 'nurse', hasNurseryLicense: false }),
      createStaff({ id: 's14', name: '井上 春子', employmentType: 'parttime', role: 'nursery_teacher', hasNurseryLicense: true, parttimeRule: 'monthly_10', preferredShift: 'B' }),
      createStaff({ id: 's15', name: '木村 幸子', employmentType: 'parttime', role: 'nursery_teacher', hasNurseryLicense: true, parttimeRule: 'weekly_4', preferredShift: 'B' }),
    ],
    schedules: {},
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  };

  global.KinmuhyoConstants = {
    STORAGE_KEY, SHIFT_TYPES, CONSTRAINTS, ROLES, EMPLOYMENT, PARTTIME_RULES, DOW,
    EARLY_SHIFTS, LATE_SHIFTS, createStaff, SEED_DATA,
  };
})(typeof window !== 'undefined' ? window : globalThis);
