/* =========================================================================
 * POST /api/generate — free built-in AI (NVIDIA Nemotron) for signed-in students.
 *
 * Used when a student has no Gemini key or their key stops working.
 * The NVIDIA keys live ONLY in Vercel's environment variables
 * (NVIDIA_API_KEYS, comma separated) and never reach the browser.
 *
 * Abuse protection:
 *   - only requests from the site itself (Origin check)
 *   - only students signed in with Google (Supabase token checked)
 *   - only NCERT notes: the server builds the prompts itself from a chapter id,
 *     so it can't be used as a general-purpose chatbot
 *   - per-student hourly limit
 *
 * Body: { mode: "outline", chapterId }                    -> JSON { chunks: [...] }
 *       { mode: "chunk", chapterId, outline, index }      -> Server-Sent Events:
 *         data: {"thinking":true} | {"t":"text"} | {"done":true,"finish":"stop"} | {"error":"..."}
 * ========================================================================= */
const { NCERT_CHAPTERS } = require('../js/curriculum.js');
const P = require('../js/prompts.js');

const NV_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
// Speed: models write straight away with "thinking" off (Nemotron reasons for 5-60 s first otherwise).
// All adjustable in Vercel → Settings → Environment Variables, no code change needed.
// Measured on a real NCERT part: Nemotron 3.5 Super 120B shows text after ~2 s and writes ~84 words/s
// (a 2,000-word part in ~27 s). The 550B Ultra writes ~31 words/s; set NVIDIA_MODEL to
// 'nvidia/nemotron-3-ultra-550b-a55b' to use it instead.
const MODEL = process.env.NVIDIA_MODEL || 'nvidia/nemotron-3.5-super-vl-120b-a12b';
const OUTLINE_MODEL = process.env.NVIDIA_OUTLINE_MODEL || MODEL;
const THINKING = (process.env.NVIDIA_THINKING || 'off') === 'on';
const thinking = (model, on) => (/nemotron/i.test(model) ? { chat_template_kwargs: { enable_thinking: on } } : {});
const KEYS = (process.env.NVIDIA_API_KEYS || '').split(/[\s,]+/).filter(Boolean);
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xvjaigzelvitfwxkpezy.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_jYtiSpqylPmNtQKZmM7adQ_NeYAoeP3';
const ORIGIN_OK = /^(https:\/\/cbsenotesgeneration(-[a-z0-9-]+)?\.vercel\.app|http:\/\/localhost(:\d+)?)$/;
const HOURLY_LIMIT = +(process.env.FREE_AI_HOURLY_LIMIT || 60);   // includes the next part written in the background
const RETRY = new Set([401, 403, 408, 429, 500, 502, 503, 504]);

const usage = new Map();   // userId -> request timestamps (per running instance)

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  let raw = '';
  for await (const c of req) { raw += c; if (raw.length > 200000) throw new Error('too large'); }
  return JSON.parse(raw || '{}');
}

async function signedInUser(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${m[1]}` } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? u : null;
}

function overLimit(userId) {
  const now = Date.now(), recent = (usage.get(userId) || []).filter(t => now - t < 3600e3);
  if (recent.length >= HOURLY_LIMIT) { usage.set(userId, recent); return true; }
  recent.push(now); usage.set(userId, recent);
  return false;
}

/* Try the keys in turn (starting at a random one) until one is accepted. */
async function callNvidia(body, signal) {
  if (!KEYS.length) throw Object.assign(new Error('Free AI is not configured.'), { status: 503 });
  const start = Math.floor(Math.random() * KEYS.length);
  let last = null;
  for (let n = 0; n < KEYS.length; n++) {
    const key = KEYS[(start + n) % KEYS.length];
    let r;
    try {
      r = await fetch(NV_URL, {
        method: 'POST', signal,
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: body.stream ? 'text/event-stream' : 'application/json' },
        body: JSON.stringify({ model: MODEL, ...body })   // body.model overrides MODEL when given
      });
    } catch (err) {
      if (signal && signal.aborted) throw err;
      last = { status: 503, text: `network: ${err.message}` };   // network hiccup: try the next key
      continue;
    }
    if (r.ok) return r;
    last = { status: r.status, text: (await r.text().catch(() => '')).slice(0, 300) };
    if (!RETRY.has(r.status)) break;
  }
  const busy = last && (last.status === 429 || last.status >= 500);
  throw Object.assign(new Error(busy ? 'The free AI is busy right now. Please try again in a minute.' : 'The free AI could not answer.'),
    { status: busy ? 429 : 502, detail: last });
}

const stripThink = s => s.replace(/<think>[\s\S]*?(<\/think>|$)/g, '');

async function makeOutline(ch, signal) {
  const messages = [{ role: 'system', content: P.SYSTEM }, { role: 'user', content: P.outlinePrompt(ch) + P.OUTLINE_JSON_HINT }];
  // Fast attempts first (no thinking); if the JSON comes back broken twice, let the model think once.
  for (const think of [THINKING, THINKING, true]) {
    const r = await callNvidia({ model: OUTLINE_MODEL, messages, temperature: 0.3, max_tokens: 6000, ...thinking(OUTLINE_MODEL, think) }, signal);
    const data = await r.json();
    const outline = P.parseOutlineText(stripThink(data?.choices?.[0]?.message?.content || ''));
    if (outline) return outline;
  }
  throw Object.assign(new Error('The free AI returned an unreadable topic list. Please try again.'), { status: 502 });
}

async function streamChunk(ch, outline, index, res, signal) {
  const r = await callNvidia({
    stream: true, temperature: 0.6, max_tokens: 12000, ...thinking(MODEL, THINKING),
    messages: [{ role: 'system', content: P.SYSTEM }, { role: 'user', content: P.chunkPrompt(ch, outline, index) }]
  }, signal);

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  const out = obj => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  out({ thinking: true });

  const decoder = new TextDecoder();
  let buffer = '', finish = '', inThink = false, lastBeat = Date.now(), wrote = false;
  for await (const piece of r.body) {
    buffer += decoder.decode(piece, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      let json; try { json = JSON.parse(payload); } catch { continue; }
      const choice = json.choices && json.choices[0];
      if (!choice) continue;
      let text = (choice.delta && choice.delta.content) || '';
      // Some models put their reasoning inside <think> tags: never send it to students.
      if (text.includes('<think>')) inThink = true;
      if (inThink) { const end = text.indexOf('</think>'); if (end < 0) text = ''; else { text = text.slice(end + 8); inThink = false; } }
      if (text) { out({ t: text }); wrote = true; }
      else if (Date.now() - lastBeat > 4000) { res.write(': thinking\n\n'); lastBeat = Date.now(); }   // keep the connection alive
      if (choice.finish_reason) finish = choice.finish_reason;
    }
  }
  out(wrote ? { done: true, finish: finish || 'stop' } : { error: 'The free AI returned an empty answer. Please try again.' });
  res.end();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.' });
  if (!ORIGIN_OK.test(req.headers.origin || '')) return send(res, 403, { error: 'Not allowed.' });

  let user;
  try { user = await signedInUser(req); } catch { user = null; }
  if (!user) return send(res, 401, { error: 'Sign in with Google to use the free AI.' });
  if (overLimit(user.id)) return send(res, 429, { error: `Free AI limit reached (${HOURLY_LIMIT} requests per hour). Try again later, or add your own Gemini key.` });

  let body;
  try { body = await readBody(req); } catch { return send(res, 400, { error: 'Bad request.' }); }
  const ch = NCERT_CHAPTERS.find(c => c.id === body.chapterId);
  if (!ch) return send(res, 400, { error: 'Unknown chapter.' });

  const controller = new AbortController();
  res.on('close', () => { if (!res.writableEnded) controller.abort(); });

  try {
    if (body.mode === 'outline') return send(res, 200, { chunks: await makeOutline(ch, controller.signal), model: MODEL });
    if (body.mode === 'chunk') {
      const outline = P.normalizeOutline(body.outline);
      const index = Number(body.index);
      if (!outline || !Number.isInteger(index) || index < 0 || index >= outline.length) return send(res, 400, { error: 'Bad outline.' });
      return await streamChunk(ch, outline, index, res, controller.signal);
    }
    return send(res, 400, { error: 'Unknown mode.' });
  } catch (err) {
    if (controller.signal.aborted) return;
    console.error('generate failed', err.message, err.detail || '');
    if (res.headersSent) { res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`); return res.end(); }
    return send(res, err.status || 500, { error: err.message || 'Something went wrong.' });
  }
};
