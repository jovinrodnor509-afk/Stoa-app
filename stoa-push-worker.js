// STOA push — Cloudflare Worker
// Sekrè ki bezwen (Settings → Variables and Secrets): ONESIGNAL_REST_KEY  (tip: Secret)

const DB = 'https://stoa-1b15e-default-rtdb.firebaseio.com';
const ORIGIN = 'https://jovinrodnor509-afk.github.io';
const APP_URL = ORIGIN + '/Stoa-app/';
const OS_APP_ID = '332143af-0e0c-4979-b52c-7f0bda021938';
const ADMIN_UID = 'n5bkCTDFA1MYxpAbdTKWVXqECg72';
const FIREBASE_API_KEY = 'AIzaSyAyAYIM7Qkt4jzq0CCIqBRlmH9tYxOA9RU';
const PHONE = /^\d{8,15}$/;

const cors = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Vary': 'Origin'
};
const reply = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const getJSON = async (path, query = '') => {
  const r = await fetch(`${DB}/${path}.json${query}`);
  return r.ok ? r.json() : null;
};
const patch = (path, data) =>
  fetch(`${DB}/${path}.json`, { method: 'PATCH', body: JSON.stringify(data) }).catch(() => {});

async function sendPush(env, body) {
  for (const url of ['https://api.onesignal.com/notifications', 'https://onesignal.com/api/v1/notifications']) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Authorization': 'Key ' + env.ONESIGNAL_REST_KEY },
      body: JSON.stringify({ app_id: OS_APP_ID, url: APP_URL, ...body })
    });
    if (r.ok) return true;
    if (r.status !== 401 && r.status !== 404) return false;
  }
  return false;
}

async function senderName(phone) {
  const u = await getJSON('ayitiUsers/' + phone);
  return (u && [u.firstName, u.lastName].filter(Boolean).join(' ')) || 'Yon moun';
}

async function handleMessage(b, env) {
  const { from, to } = b;
  const chatId = [from, to].sort().join('_');
  const data = await getJSON(`ayitiChats/${chatId}/messages`, '?orderBy=' + encodeURIComponent('"$key"') + '&limitToLast=1');
  const key = data && Object.keys(data)[0];
  const m = key && data[key];
  if (!m || m.from !== from || m.deleted) return reply({ error: 'no message' }, 403);
  if (Math.abs(Date.now() - m.timestamp) > 60000) return reply({ error: 'too old' }, 403);
  if (m.pushed) return reply({ ok: true, skipped: 'dup' });
  await patch(`ayitiChats/${chatId}/messages/${key}`, { pushed: true });
  const name = await senderName(from);
  const preview = m.text ? String(m.text).slice(0, 80)
    : m.sticker ? 'Stiker' : m.voice ? '🎤 Mesaj vokal' : m.file ? '📎 Fichye' : 'Nouvo mesaj';
  const ok = await sendPush(env, {
    include_aliases: { external_id: [to] }, target_channel: 'push',
    headings: { en: '💬 ' + name }, contents: { en: preview }
  });
  return reply({ ok });
}

async function handleCall(b, env) {
  const { from, to, callId } = b;
  if (!/^[-\w]{10,40}$/.test(callId || '')) return reply({ error: 'bad id' }, 400);
  const c = await getJSON(`ayitiCalls/${to}/${callId}`);
  if (!c || c.from !== from || c.status !== 'ringing') return reply({ error: 'no call' }, 403);
  if (Math.abs(Date.now() - c.ts) > 90000) return reply({ error: 'too old' }, 403);
  if (c.pushed) return reply({ ok: true, skipped: 'dup' });
  await patch(`ayitiCalls/${to}/${callId}`, { pushed: true });
  const name = await senderName(from);
  const ok = await sendPush(env, {
    include_aliases: { external_id: [to] }, target_channel: 'push',
    headings: { en: (c.type === 'video' ? '📹 Apèl videyo' : '📞 Apèl vokal') + ' — ' + name },
    contents: { en: 'Louvri STOA pou reponn.' }
  });
  return reply({ ok });
}

async function handleBroadcast(b, request, env) {
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer /, '');
  if (!token) return reply({ error: 'auth' }, 401);
  const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + FIREBASE_API_KEY, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token })
  });
  const j = r.ok ? await r.json() : null;
  if (!j || !j.users || j.users[0].localId !== ADMIN_UID) return reply({ error: 'not admin' }, 403);
  const ok = await sendPush(env, {
    included_segments: ['Subscribed Users'],
    headings: { en: String(b.title || '').slice(0, 80) }, contents: { en: String(b.message || '').slice(0, 160) }
  });
  return reply({ ok });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply({ error: 'method' }, 405);
    if (request.headers.get('Origin') !== ORIGIN) return reply({ error: 'origin' }, 403);
    let b;
    try { b = await request.json(); } catch (e) { return reply({ error: 'json' }, 400); }
    try {
      if (b.type === 'broadcast') return await handleBroadcast(b, request, env);
      if (!PHONE.test(b.from || '') || !PHONE.test(b.to || '') || b.from === b.to) return reply({ error: 'phones' }, 400);
      if (b.type === 'message') return await handleMessage(b, env);
      if (b.type === 'call') return await handleCall(b, env);
    } catch (e) { return reply({ error: 'server' }, 500); }
    return reply({ error: 'type' }, 400);
  }
};
