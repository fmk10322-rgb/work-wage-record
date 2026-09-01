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

export function getMonthlySummary(records, settings, selectedMonth) {
  const recordsInMonth = records.filter((record) => monthKey(record.date) === selectedMonth);
  const days = new Set(recordsInMonth.map((record) => record.date));
  const workMinutes = recordsInMonth.reduce((total, record) => total + record.workMinutes, 0);
  const hourlyWageTotal = recordsInMonth.reduce((total, record) => total + calculateWage(record.workMinutes, settings.hourlyWage), 0);
  // 皆勤条件を追加する際は、ここで allowanceEligible を判定できるようにしている。
  const attendanceAllowance = settings.attendanceAllowance;
  return {
    records: recordsInMonth, workDays: days.size,
    attendanceDays: new Set(recordsInMonth.filter((r) => r.type === '通所').map((r) => r.date)).size,
    remoteDays: new Set(recordsInMonth.filter((r) => r.type === '在宅').map((r) => r.date)).size,
    workMinutes, hourlyWageTotal, attendanceAllowance,
    totalEstimatedWage: hourlyWageTotal + attendanceAllowance,
  };
}

/** 記録の追加・編集を同じ処理で扱い、画面以外（将来のCSV取込など）からも再利用する。 */
export function upsertRecord(records, record) {
  const index = records.findIndex((item) => item.id === record.id);
  return index === -1 ? [...records, record] : records.map((item) => item.id === record.id ? record : item);
}

export function removeRecord(records, id) { return records.filter((record) => record.id !== id); }
