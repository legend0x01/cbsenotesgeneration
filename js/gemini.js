/* =========================================================================
 * GEMINI API CLIENT
 * Calls the Google Gemini REST API directly from the browser with the
 * user's own API key (stored only in this browser's localStorage).
 * ========================================================================= */
const Gemini = (() => {
  const BASE = 'https://generativelanguage.googleapis.com/v1beta';
  const KEY_STORE = 'ncert_gemini_key';
  const MODEL_STORE = 'ncert_gemini_model';
  const DEFAULT_MODEL = 'gemini-2.5-flash';
  // Preferred models, best first. The first one the key can use is picked.
  const PREFERRED = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash', 'gemini-2.5-pro', 'gemini-pro-latest'];

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} }
  };

  class GeminiError extends Error {
    constructor(message, kind, status) { super(message); this.kind = kind; this.status = status; }
  }

  function getKey() { return store.get(KEY_STORE) || ''; }
  function setKey(k) { store.set(KEY_STORE, k.trim()); }
  function clearKey() { store.del(KEY_STORE); }
  function getModel() { return store.get(MODEL_STORE) || DEFAULT_MODEL; }
  function setModel(m) { store.set(MODEL_STORE, m); }

  async function toError(res) {
    let msg = `Request failed (${res.status})`;
    try { const j = await res.json(); if (j?.error?.message) msg = j.error.message; } catch {}
    let kind = 'other';
    if (res.status === 400 && /api key|API_KEY/i.test(msg)) kind = 'auth';
    else if (res.status === 401 || res.status === 403) kind = 'auth';
    else if (res.status === 429) kind = 'quota';
    else if (res.status === 404) kind = 'model';
    else if (res.status >= 500) kind = 'server';
    return new GeminiError(msg, kind, res.status);
  }

  function headers(key) {
    return { 'Content-Type': 'application/json', 'x-goog-api-key': key || getKey() };
  }

  /* Validate a key by listing models; returns usable text models. */
  async function listModels(key) {
    const res = await fetch(`${BASE}/models?pageSize=200`, { headers: headers(key) });
    if (!res.ok) throw await toError(res);
    const data = await res.json();
    return (data.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => m.name.replace(/^models\//, ''))
      .filter(n => /^gemini/.test(n) && !/(embedding|image|tts|audio|live|vision|robotics|computer-use)/i.test(n));
  }

  function pickBestModel(models) {
    for (const p of PREFERRED) if (models.includes(p)) return p;
    return models.find(m => /flash/.test(m)) || models[0] || DEFAULT_MODEL;
  }

  /* Non-streaming JSON call (used for the chapter outline). */
  async function generateJSON({ system, prompt, schema, signal }) {
    const body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, responseMimeType: 'application/json', responseSchema: schema }
    };
    const res = await fetch(`${BASE}/models/${getModel()}:generateContent`, {
      method: 'POST', headers: headers(), body: JSON.stringify(body), signal
    });
    if (!res.ok) throw await toError(res);
    const data = await res.json();
    const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    if (!text) throw new GeminiError(blockedReason(data) || 'Gemini returned an empty response.', 'empty');
    try { return JSON.parse(text); }
    catch { throw new GeminiError('Gemini returned an outline that could not be read. Please try again.', 'parse'); }
  }

  function blockedReason(data) {
    const r = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason;
    return r && r !== 'STOP' ? `Response stopped by Gemini (${r}).` : '';
  }

  /* Streaming text call (Server-Sent Events). onText receives the full text so far. */
  async function stream({ system, prompt, signal, onText }) {
    const body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.6 }
    };
    const res = await fetch(`${BASE}/models/${getModel()}:streamGenerateContent?alt=sse`, {
      method: 'POST', headers: headers(), body: JSON.stringify(body), signal
    });
    if (!res.ok) throw await toError(res);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '', full = '', finishReason = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        let json;
        try { json = JSON.parse(payload); } catch { continue; }
        if (json.error) throw new GeminiError(json.error.message || 'Stream error', 'server');
        const cand = json.candidates?.[0];
        const piece = (cand?.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('');
        if (piece) { full += piece; onText(full); }
        if (cand?.finishReason) finishReason = cand.finishReason;
      }
    }
    if (!full) throw new GeminiError(finishReason && finishReason !== 'STOP'
      ? `Gemini stopped without writing notes (${finishReason}). Try regenerating.`
      : 'Gemini returned an empty response.', 'empty');
    return { text: full, finishReason };
  }

  return { getKey, setKey, clearKey, getModel, setModel, listModels, pickBestModel, generateJSON, stream, GeminiError };
})();
