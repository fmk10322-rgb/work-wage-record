import { DEFAULT_SETTINGS } from './logic.js';

const KEYS = Object.freeze({ records: 'work-wage-records-v1', settings: 'work-wage-settings-v1' });

function safeParse(value, fallback) { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } }
export function loadRecords() { const value = safeParse(localStorage.getItem(KEYS.records), []); return Array.isArray(value) ? value : []; }
export function saveRecords(records) { localStorage.setItem(KEYS.records, JSON.stringify(records)); }
export function loadSettings() { return { ...DEFAULT_SETTINGS, ...safeParse(localStorage.getItem(KEYS.settings), {}) }; }
export function saveSettings(settings) { localStorage.setItem(KEYS.settings, JSON.stringify(settings)); }
// 将来のCSV出力・バックアップは loadRecords/loadSettings を利用して実装できる。
export function exportAppData() { return { version: 1, records: loadRecords(), settings: loadSettings() }; }
