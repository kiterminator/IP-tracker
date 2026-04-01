// ═══════════════════════════════════════════════════
// SUPABASE CONFIG
// ═══════════════════════════════════════════════════

// ⬇️ PASTE YOUR REAL VALUES HERE ⬇️
const SUPABASE_URL = 'https://qlbfrhhomndgifzflvrn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsYmZyaGhvbW5kZ2lmemZsdnJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5OTU0MjUsImV4cCI6MjA5MDU3MTQyNX0.WDB6m4hPb5tieAX4_ODyaATxld_xmqHW_Xqmqv4qmXo';
// ⬆️ PASTE YOUR REAL VALUES HERE ⬆️

// ── Validation ──────────────────────────────────
if (
  SUPABASE_URL.includes('YOUR_PROJECT_ID') ||
  SUPABASE_ANON_KEY.includes('YOUR_ANON_KEY')
) {
  document.body.innerHTML = `
    <div style="
      padding: 60px 40px;
      color: #ff4757;
      font-family: 'Consolas', monospace;
      font-size: 16px;
      background: #111;
      min-height: 100vh;
      line-height: 1.8;
    ">
      <h1 style="font-size: 28px; margin-bottom: 20px;">⚠️ SUPABASE NOT CONFIGURED</h1>
      <p>Edit the file <strong>js/config.js</strong> and replace the placeholder values:</p>
      <pre style="
        background: #1a1a2e;
        padding: 20px;
        border-radius: 8px;
        margin: 20px 0;
        color: #00d4ff;
        overflow-x: auto;
      ">
const SUPABASE_URL = 'https://abcdefg.supabase.co';      ← Your project URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUz...';           ← Your anon key
      </pre>
      <p style="color: #888;">
        Find these at:<br>
        Supabase Dashboard → Settings → API<br>
        • <strong>Project URL</strong> → SUPABASE_URL<br>
        • <strong>anon public</strong> key → SUPABASE_ANON_KEY
      </p>
    </div>`;
  throw new Error('Supabase not configured — edit js/config.js');
}

// ── Create Supabase Client ──────────────────────
let _supabaseClient = null;

function getSupabase() {
  if (!_supabaseClient) {
    if (typeof supabase === 'undefined' || !supabase.createClient) {
      const msg = 'Supabase JS library not loaded. Check internet connection.';
      console.error('❌ ' + msg);
      alert('Error: ' + msg);
      throw new Error(msg);
    }
    _supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase client created:', SUPABASE_URL);
  }
  return _supabaseClient;
}

// ── Helpers ─────────────────────────────────────
function generateId(length = 12) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, b => chars[b % chars.length]).join('');
}

function timeAgo(dateStr) {
  if (!dateStr) return 'Never';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 0) return 'Just now';
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function escHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

console.log('✅ config.js loaded');
