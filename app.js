import { calculateWorkMinutes, calculateWage, formatDuration, formatYen, getMonthlySummary, monthKey, removeRecord, upsertRecord } from './logic.js';
import { loadRecords, saveRecords, loadSettings, saveSettings } from './storage.js';
import { deleteCloudRecord, getCloudUser, importLocalData, isCloudConfigured, loadCloudData, saveCloudRecord, saveCloudSettings, sendMagicLink, signOut } from './cloud-sync.js';

let records = loadRecords();
let settings = loadSettings();
let selectedMonth = monthKey(localDateString());
let editingId = null;
let cloudUser = null;

const $ = (id) => document.getElementById(id);
const form = $('record-form');
const fields = { date: $('record-date'), type: $('record-type'), startTime: $('start-time'), endTime: $('end-time'), breakMinutes: $('break-minutes'), memo: $('record-memo') };

function localDateString(date = new Date()) { const offset = date.getTimezoneOffset() * 60000; return new Date(date - offset).toISOString().slice(0, 10); }
function formatDate(dateString) { return new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' }).format(new Date(`${dateString}T00:00:00`)); }
function monthTitle(key) { const [year, month] = key.split('-'); return `${year}年${Number(month)}月`; }
function formRecord() { return { date: fields.date.value, type: fields.type.value, startTime: fields.startTime.value, endTime: fields.endTime.value, breakMinutes: Number(fields.breakMinutes.value), memo: fields.memo.value.trim() }; }

function getCalculation() { const record = formRecord(); return calculateWorkMinutes(record.startTime, record.endTime, record.breakMinutes); }
function updatePreview() {
  const result = getCalculation(); const preview = $('calculation-preview');
  if (!fields.startTime.value || !fields.endTime.value) { preview.textContent = '開始時刻と終了時刻を入力すると、実作業時間と工賃を表示します。'; return; }
  preview.textContent = result.valid ? `実作業時間：${formatDuration(result.minutes)}　｜　工賃：${formatYen(calculateWage(result.minutes, settings.hourlyWage))}` : result.message;
}
function resetForm() { form.reset(); fields.date.value = localDateString(); fields.type.value = '通所'; fields.breakMinutes.value = 0; editingId = null; $('save-record').textContent = '記録を登録する'; $('form-heading').textContent = '作業を記録'; $('cancel-edit').classList.add('hidden'); $('form-error').textContent = ''; updatePreview(); }
function render() { renderMonth(); renderToday(); renderMonthSummary(); renderRecords(); $('hourly-wage').value = settings.hourlyWage; $('attendance-allowance').value = settings.attendanceAllowance; }
function renderMonth() { $('month-title').textContent = monthTitle(selectedMonth); }
function renderToday() {
  const today = localDateString(); const todayRecords = records.filter((record) => record.date === today); const minutes = todayRecords.reduce((total, r) => total + r.workMinutes, 0);
  $('today-date').textContent = formatDate(today);
  $('today-summary').innerHTML = todayRecords.length ? `<div><span>今日の作業時間</span><strong>${formatDuration(minutes)}</strong></div><div><span>今日の工賃</span><strong>${formatYen(todayRecords.reduce((t, r) => t + calculateWage(r.workMinutes, settings.hourlyWage), 0))}</strong></div>` : '<p>まだ作業記録がありません</p>';
}
function renderMonthSummary() {
  const s = getMonthlySummary(records, settings, selectedMonth, localDateString());
  const allowanceLabel = s.attendanceAllowanceStatus === 'pending' ? '未確定' : formatYen(s.attendanceAllowance);
  const totalLabel = s.totalEstimatedWage === null ? `未確定（時間工賃 ${formatYen(s.hourlyWageTotal)}）` : formatYen(s.totalEstimatedWage);
  const values = [['今月の作業時間', formatDuration(s.workMinutes)], ['今月の作業日数', `${s.workDays}日`], ['時間工賃の合計', formatYen(s.hourlyWageTotal)], ['皆勤手当', allowanceLabel], ['今月の合計見込み', totalLabel]];
  $('month-summary').innerHTML = values.map(([label, value], i) => `<div class="stat-card ${i === 4 ? 'total-stat' : ''}"><span>${label}</span><strong>${value}</strong></div>`).join('');
}
function renderRecords() {
  const list = $('record-list'); const monthRecords = records.filter((r) => monthKey(r.date) === selectedMonth).sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime));
  $('record-count').textContent = `${monthRecords.length}件`;
  if (!monthRecords.length) { list.innerHTML = '<p class="empty-state">この月の作業記録はまだありません。</p>'; return; }
  list.innerHTML = ''; const template = $('record-template');
  monthRecords.forEach((record) => { const node = template.content.cloneNode(true); node.querySelector('.record-date').textContent = formatDate(record.date); node.querySelector('.type-badge').textContent = record.type; node.querySelector('.record-time').textContent = `${record.startTime} 〜 ${record.endTime}　休憩 ${record.breakMinutes}分`; node.querySelector('.record-duration').textContent = formatDuration(record.workMinutes); node.querySelector('.record-wage').textContent = formatYen(calculateWage(record.workMinutes, settings.hourlyWage)); if (record.memo) { const memo = node.querySelector('.record-memo'); memo.textContent = record.memo; memo.classList.remove('hidden'); } node.querySelector('.edit-button').addEventListener('click', () => startEdit(record.id)); node.querySelector('.delete-button').addEventListener('click', () => deleteRecord(record.id)); list.append(node); });
}
function startEdit(id) { const record = records.find((r) => r.id === id); if (!record) return; editingId = id; Object.entries(record).forEach(([key, value]) => { if (fields[key]) fields[key].value = value; }); $('save-record').textContent = '変更を保存する'; $('form-heading').textContent = '作業記録を編集'; $('cancel-edit').classList.remove('hidden'); $('form-error').textContent = ''; updatePreview(); window.scrollTo({ top: document.querySelector('.panel').offsetTop - 12, behavior: 'smooth' }); }
async function deleteRecord(id) { const record = records.find((r) => r.id === id); if (!record || !window.confirm(`${formatDate(record.date)}の記録を削除しますか？`)) return; records = removeRecord(records, id); saveRecords(records); if (editingId === id) resetForm(); render(); if (cloudUser) { try { await deleteCloudRecord(id); showCloudStatus('削除内容をクラウドへ同期しました。'); } catch { showCloudStatus('この端末では削除しました。クラウド同期は次回試します。'); } } }

form.addEventListener('input', updatePreview);
form.addEventListener('submit', async (event) => { event.preventDefault(); const record = formRecord(); const result = calculateWorkMinutes(record.startTime, record.endTime, record.breakMinutes); if (!record.date || !record.type || !record.startTime || !record.endTime) { $('form-error').textContent = '日付、作業形態、開始時刻、終了時刻を入力してください。'; return; } if (!result.valid) { $('form-error').textContent = result.message; return; } const saved = { ...record, workMinutes: result.minutes, id: editingId || crypto.randomUUID(), createdAt: editingId ? records.find((r) => r.id === editingId)?.createdAt : new Date().toISOString() }; records = upsertRecord(records, saved); saveRecords(records); selectedMonth = monthKey(saved.date); resetForm(); render(); if (cloudUser) { try { await saveCloudRecord(saved); showCloudStatus('クラウドへ同期しました。'); } catch { showCloudStatus('この端末には保存しました。クラウド同期は次回試します。'); } } });
$('settings-form').addEventListener('submit', async (event) => { event.preventDefault(); const hourlyWage = Number($('hourly-wage').value); const attendanceAllowance = Number($('attendance-allowance').value); if (!Number.isInteger(hourlyWage) || hourlyWage < 0 || !Number.isInteger(attendanceAllowance) || attendanceAllowance < 0) { $('settings-error').textContent = '0以上の整数で入力してください。'; return; } settings = { hourlyWage, attendanceAllowance }; saveSettings(settings); $('settings-error').textContent = ''; render(); if (cloudUser) { try { await saveCloudSettings(settings); showCloudStatus('設定をクラウドへ同期しました。'); } catch { showCloudStatus('この端末には保存しました。クラウド同期は次回試します。'); } } });
$('cancel-edit').addEventListener('click', resetForm);
$('previous-month').addEventListener('click', () => { const [year, month] = selectedMonth.split('-').map(Number); selectedMonth = `${month === 1 ? year - 1 : year}-${String(month === 1 ? 12 : month - 1).padStart(2, '0')}`; render(); });
$('next-month').addEventListener('click', () => { const [year, month] = selectedMonth.split('-').map(Number); selectedMonth = `${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, '0')}`; render(); });

function showCloudStatus(message) { $('cloud-status').textContent = message; }
async function initializeCloud() {
  if (!isCloudConfigured) return;
  $('cloud-login-form').classList.remove('hidden');
  try {
    cloudUser = await getCloudUser();
    if (!cloudUser) { showCloudStatus('メールアドレスでログインすると、MacとiPhoneで同期できます。'); return; }
    $('cloud-login-form').classList.add('hidden'); $('cloud-sign-out').classList.remove('hidden');
    const cloudData = await loadCloudData();
    if (cloudData.records.length === 0 && records.length > 0) {
      await importLocalData(records, settings);
      showCloudStatus(`${cloudUser.email} でログイン中。現在の記録をクラウドへ同期しました。`);
    } else {
      records = cloudData.records; settings = cloudData.settings || settings; saveRecords(records); saveSettings(settings); render();
      showCloudStatus(`${cloudUser.email} でログイン中。クラウドと同期済みです。`);
    }
  } catch { showCloudStatus('クラウドへ接続できませんでした。設定内容と通信を確認してください。'); }
}
$('cloud-login-form').addEventListener('submit', async (event) => { event.preventDefault(); const email = $('cloud-email').value.trim(); if (!email) return; try { await sendMagicLink(email); $('cloud-error').textContent = ''; showCloudStatus('ログイン用リンクをメールで送信しました。メールを開いてログインを完了してください。'); } catch (error) { $('cloud-error').textContent = error.message || 'メールを送れませんでした。'; } });
$('cloud-sign-out').addEventListener('click', async () => { await signOut(); cloudUser = null; $('cloud-sign-out').classList.add('hidden'); $('cloud-login-form').classList.remove('hidden'); showCloudStatus('クラウドからログアウトしました。この端末の記録は残っています。'); });

resetForm(); render();
initializeCloud();
