// ═══════════════════════════════════════════════
// PASTE YOUR REAL VALUES BELOW
// ═══════════════════════════════════════════════
const SUPABASE_URL = 'https://qjoyjmjtkcblwfpggzwq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqb3lqbWp0a2NibHdmcGdnendxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMzM0MTMsImV4cCI6MjA4OTgwOTQxM30.C_5BGwZzvs5gLBdz7H-vvDhsHUV83oy2ypSG3jBK6oI';

// ── DO NOT EDIT BELOW THIS LINE ───────────────

console.log('[config] loaded, URL:', SUPABASE_URL);

let _client = null;

function getSupabase() {
  if (_client) return _client;

  // Check if Supabase library loaded
  if (typeof supabase === 'undefined') {
    throw new Error('Supabase JS library did not load. Check internet.');
  }

  _client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('[config] Supabase client created');
  return _client;
}

function generateId(len = 12) {
  const c = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return Array.from(a, b => c[b % c.length]).join('');
}

function timeAgo(d) {
  if (!d) return 'Never';
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 0) return 'Just now';
  if (s < 60) return Math.floor(s) + 's ago';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

function escHtml(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
