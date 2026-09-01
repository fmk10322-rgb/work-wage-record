const config = window.WORK_LOG_CLOUD_CONFIG || {};

export const isCloudConfigured = Boolean(config.supabaseUrl && config.supabaseAnonKey);

let client;
async function getClient() {
  if (!isCloudConfigured) return null;
  if (!client) {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    client = createClient(config.supabaseUrl, config.supabaseAnonKey);
  }
  return client;
}

export async function getCloudUser() {
  const supabase = await getClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function sendMagicLink(email) {
  const supabase = await getClient();
  if (!supabase) throw new Error('クラウド同期の設定がまだ完了していません。');
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href } });
  if (error) throw error;
}

export async function signOut() { const supabase = await getClient(); if (supabase) await supabase.auth.signOut(); }

export async function loadCloudData() {
  const supabase = await getClient();
  if (!supabase) return null;
  const [recordsResult, settingsResult] = await Promise.all([
    supabase.from('work_records').select('*').order('work_date', { ascending: false }).order('start_time', { ascending: false }),
    supabase.from('user_settings').select('*').maybeSingle(),
  ]);
  if (recordsResult.error) throw recordsResult.error;
  if (settingsResult.error) throw settingsResult.error;
  return {
    records: recordsResult.data.map((row) => ({ id: row.id, date: row.work_date, type: row.work_type, startTime: row.start_time.slice(0, 5), endTime: row.end_time.slice(0, 5), breakMinutes: row.break_minutes, memo: row.memo || '', workMinutes: row.work_minutes, createdAt: row.created_at })),
    settings: settingsResult.data ? { hourlyWage: settingsResult.data.hourly_wage, attendanceAllowance: settingsResult.data.attendance_allowance } : null,
  };
}

function toCloudRecord(record) { return { id: record.id, work_date: record.date, work_type: record.type, start_time: record.startTime, end_time: record.endTime, break_minutes: record.breakMinutes, memo: record.memo, work_minutes: record.workMinutes }; }
export async function saveCloudRecord(record) { const supabase = await getClient(); if (!supabase) return; const { error } = await supabase.from('work_records').upsert(toCloudRecord(record)); if (error) throw error; }
export async function deleteCloudRecord(id) { const supabase = await getClient(); if (!supabase) return; const { error } = await supabase.from('work_records').delete().eq('id', id); if (error) throw error; }
export async function saveCloudSettings(settings) { const supabase = await getClient(); if (!supabase) return; const { error } = await supabase.from('user_settings').upsert({ user_id: (await getCloudUser()).id, hourly_wage: settings.hourlyWage, attendance_allowance: settings.attendanceAllowance }); if (error) throw error; }
export async function importLocalData(records, settings) { await Promise.all([...records.map(saveCloudRecord), saveCloudSettings(settings)]); }
