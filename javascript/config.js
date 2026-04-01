// ═══════════════════════════════════════════════════
// SUPABASE CONFIG — Replace with YOUR values
// ═══════════════════════════════════════════════════

const SUPABASE_URL = 'https://qlbfrhhomndgifzflvrn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsYmZyaGhvbW5kZ2lmemZsdnJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5OTU0MjUsImV4cCI6MjA5MDU3MTQyNX0.WDB6m4hPb5tieAX4_ODyaATxld_xmqHW_Xqmqv4qmXo';

// Initialize Supabase client (loaded via CDN in HTML)
function getSupabase() {
  return supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
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
