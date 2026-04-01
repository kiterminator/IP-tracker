// ═══════════════════════════════════════════════════
// SUPABASE CONFIG
// ═══════════════════════════════════════════════════

// ⬇️⬇️⬇️ REPLACE THESE TWO VALUES WITH YOUR OWN ⬇️⬇️⬇️
const SUPABASE_URL = 'https://qlbfrhhomndgifzflvrn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsYmZyaGhvbW5kZ2lmemZsdnJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5OTU0MjUsImV4cCI6MjA5MDU3MTQyNX0.WDB6m4hPb5tieAX4_ODyaATxld_xmqHW_Xqmqv4qmXo';
// ⬆️⬆️⬆️ REPLACE THESE TWO VALUES WITH YOUR OWN ⬆️⬆️⬆️

// Validate config
if (SUPABASE_URL.includes('YOUR_PROJECT_ID')) {
  document.body.innerHTML = `
    <div style="padding:40px;color:#ff4757;font-family:monospace;font-size:18px;background:#111;min-height:100vh">
      <h1>⚠️ CONFIG ERROR</h1>
      <p>You need to edit <strong>js/config.js</strong> and replace the Supabase URL and Key with your real values.</p>
      <p style="margin-top:20px;color:#888">
        Find them at: Supabase Dashboard → Settings → API<br>
        • Project URL → copy into SUPABASE_URL<br>
        • anon public key → copy into SUPABASE_ANON_KEY
      </p>
    </div>`;
  throw new Error('Supabase not configured');
}

let _supabaseClient = null;

function getSupabase() {
  if (!_supabaseClient) {
    if (typeof supabase === 'undefined' || !supabase.createClient) {
      console.error('❌ Supabase JS library not loaded! Check your internet connection.');
      alert('Error: Supabase library failed to load. Check your internet connection and refresh.');
      throw new Error('Supabase library not loaded');
    }
    _supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase client initialized:', SUPABASE_URL);
  }
  return _supabaseClient;
}

// Generate short unique IDs
function generateId(length = 12) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
}

// Time ago helper
function timeAgo(dateStr) {
  if (!dateStr) return 'Never';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 0) return 'Just now';
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// Escape HTML
function escHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
