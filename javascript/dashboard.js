(() => {
  'use strict';
  console.log('🚀 Emergency Dashboard starting...');

  // ── ERROR HANDLER ────────────────────────────────
  function die(title, msg) {
    const loader = document.getElementById('loadingOverlay');
    if (loader) loader.innerHTML = `
      <div style="padding:40px; text-align:center;">
        <h1 style="color:#ff4757; font-size:24px;">⚠️ ${title}</h1>
        <p style="color:#fff; margin:20px 0; font-family:monospace; background:#000; padding:15px; border-radius:8px;">${msg}</p>
        <button onclick="location.reload()" style="padding:10px 20px; cursor:pointer;">Retry</button>
      </div>`;
    throw new Error(title + ": " + msg);
  }

  // ── INIT ─────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. Check if Supabase Lib exists
    if (typeof supabase === 'undefined') {
      die("Supabase Library Missing", "The Supabase script failed to load from the CDN. Check your internet or ad-blocker.");
    }

    // 2. Check if config.js loaded
    if (typeof getSupabase !== 'function') {
      die("Config Error", "config.js was not loaded properly. Check your file paths in index.html.");
    }

    let db;
    try {
      db = getSupabase();
    } catch (e) {
      die("Config Invalid", e.message);
    }

    // 3. Test Connection
    console.log('🔌 Probing database...');
    const { data, error } = await db.from('sessions').select('id').limit(1);

    if (error) {
      if (error.message.includes("relation")) {
        die("Tables Missing", "The database tables do not exist. Go to Supabase > SQL Editor and run the SQL code I provided.");
      } else {
        die("Supabase Error", error.message + " (Code: " + error.code + ")");
      }
      return;
    }

    // 4. If we got here, it works!
    console.log('✅ Connection verified.');
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'none';

    // 5. Initialize Map
    const map = L.map('map', { center: [20, 0], zoom: 2, attributionControl: false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);

    // 6. Hook up the "Track" button
    const form = document.getElementById('createForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('sessionName').value;
      const id = Math.random().toString(36).substr(2, 9);
      
      const { error: insErr } = await db.from('sessions').insert({ id, name });
      if (insErr) {
        alert("Error creating session: " + insErr.message);
      } else {
        location.reload(); // Refresh to show the new session
      }
    });

    // 7. Load existing sessions
    const { data: list } = await db.from('sessions').select('*').order('created_at', {ascending:false});
    const listEl = document.getElementById('sessionsList');
    if (list && list.length > 0) {
      listEl.innerHTML = list.map(s => `
        <div class="session-card" onclick="alert('Session ID: ${s.id}\\nSend target to: track.html?s=${s.id}')">
          <div class="name">📍 ${s.name}</div>
        </div>
      `).join('');
    }
  });
})();
