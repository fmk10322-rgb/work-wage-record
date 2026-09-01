export const DEFAULT_SETTINGS = Object.freeze({ hourlyWage: 200, attendanceAllowance: 5000 });

export function minutesFromTime(value) {
  if (!/^\d{2}:\d{2}$/.test(value || '')) return null;
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

export function calculateWorkMinutes(startTime, endTime, breakMinutes) {
  const start = minutesFromTime(startTime);
  const end = minutesFromTime(endTime);
  const rest = Number(breakMinutes);
  if (start === null || end === null || !Number.isInteger(rest) || rest < 0) return { valid: false, message: '時刻と休憩時間を正しく入力してください。' };
  if (end <= start) return { valid: false, message: '終了時刻は開始時刻より後にしてください。' };
  const elapsed = end - start;
  if (rest > elapsed) return { valid: false, message: '休憩時間は開始から終了までの時間を超えないようにしてください。' };
  return { valid: true, minutes: elapsed - rest };
}

export function calculateWage(workMinutes, hourlyWage) {
  const wage = Number(hourlyWage);
  if (!Number.isFinite(workMinutes) || !Number.isFinite(wage) || workMinutes < 0 || wage < 0) return 0;
  return Math.round((workMinutes / 60) * wage);
}

export function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours === 0) return `${remaining}分`;
  if (remaining === 0) return `${hours}時間`;
  return `${hours}時間${remaining}分`;
}

export function formatYen(amount) { return `${Math.round(amount).toLocaleString('ja-JP')}円`; }

export function monthKey(dateString) { return (dateString || '').slice(0, 7); }

function dateKey(year, month, day) { return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`; }

/** 土日だけを休業日とし、祝日は平日として営業日に含める。 */
export function businessDaysInMonth(selectedMonth) {
  const [year, month] = selectedMonth.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days = [];
  for (let day = 1; day <= lastDay; day += 1) {
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (weekday !== 0 && weekday !== 6) days.push(dateKey(year, month, day));
  }
  return days;
}

export function getAttendanceAllowance(records, settings, selectedMonth, todayKey) {
  const businessDays = businessDaysInMonth(selectedMonth);
  const attendedDays = new Set(records.filter((record) => monthKey(record.date) === selectedMonth).map((record) => record.date));
  const lastBusinessDay = businessDays[businessDays.length - 1];
  const monthIsComplete = todayKey >= lastBusinessDay;
  // 月途中の当日はまだ出席できるため、欠席判定は翌日以降に行う。
  const daysThatMustBeAttended = monthIsComplete ? businessDays : businessDays.filter((day) => day < todayKey);
  const missedDays = daysThatMustBeAttended.filter((day) => !attendedDays.has(day));
  if (missedDays.length > 0) return { status: 'lost', amount: 0, businessDays, missedDays, lastBusinessDay };
  if (!monthIsComplete) return { status: 'pending', amount: 0, businessDays, missedDays: [], lastBusinessDay };
  return { status: 'earned', amount: settings.attendanceAllowance, businessDays, missedDays: [], lastBusinessDay };
}

export function getMonthlySummary(records, settings, selectedMonth, todayKey) {
  const recordsInMonth = records.filter((record) => monthKey(record.date) === selectedMonth);
  const days = new Set(recordsInMonth.map((record) => record.date));
  const workMinutes = recordsInMonth.reduce((total, record) => total + record.workMinutes, 0);
  const hourlyWageTotal = recordsInMonth.reduce((total, record) => total + calculateWage(record.workMinutes, settings.hourlyWage), 0);
  const allowance = getAttendanceAllowance(recordsInMonth, settings, selectedMonth, todayKey);
  return {
    records: recordsInMonth, workDays: days.size,
    attendanceDays: new Set(recordsInMonth.filter((r) => r.type === '通所').map((r) => r.date)).size,
    remoteDays: new Set(recordsInMonth.filter((r) => r.type === '在宅').map((r) => r.date)).size,
    workMinutes, hourlyWageTotal, attendanceAllowance: allowance.amount,
    attendanceAllowanceStatus: allowance.status,
    totalEstimatedWage: allowance.status === 'pending' ? null : hourlyWageTotal + allowance.amount,
  };
}

/** 記録の追加・編集を同じ処理で扱い、画面以外（将来のCSV取込など）からも再利用する。 */
export function upsertRecord(records, record) {
  const index = records.findIndex((item) => item.id === record.id);
  return index === -1 ? [...records, record] : records.map((item) => item.id === record.id ? record : item);
}

export function removeRecord(records, id) { return records.filter((record) => record.id !== id); }
