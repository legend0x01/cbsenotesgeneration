/* =========================================================================
 * FREE BUILT-IN AI (NVIDIA Nemotron via /api/generate)
 * Used for signed-in students who have no Gemini key, or whose key stops
 * working. The NVIDIA keys stay on the server; the browser only sends the
 * student's sign-in token and which chapter/part to write.
 * ========================================================================= */
const FreeAI = (() => {
  const cfg = window.NCERT_CONFIG || {};
  const enabled = cfg.freeAI !== false && !!Cloud.enabled;
  const ENDPOINT = cfg.freeAIEndpoint || '/api/generate';
  const LABEL = 'NVIDIA Nemotron 3 Ultra';
  const MODEL = 'nvidia/nemotron-3-ultra-550b-a55b';

  class FreeAIError extends Error {
    constructor(message, kind, status) { super(message); this.kind = kind; this.status = status; this.provider = 'free'; }
  }

  /* Usable right now: switched on and the student is signed in. */
  const ready = () => enabled && !!Cloud.user();

  async function post(body, signal) {
    const token = await Cloud.accessToken();
    if (!token) throw new FreeAIError('Sign in with Google to use the free AI.', 'signin', 401);
    const res = await fetch(ENDPOINT, {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      let msg = `The free AI is unavailable (${res.status}).`;
      try { const j = await res.json(); if (j.error) msg = j.error; } catch {}
      const kind = res.status === 401 ? 'signin' : res.status === 429 ? 'quota' : res.status >= 500 ? 'server' : 'other';
      throw new FreeAIError(msg, kind, res.status);
    }
    return res;
  }

  /* -> { chunks: [{ title, topics[] }] } (same shape as Gemini's outline) */
  async function outline({ chapterId, signal }) {
    const res = await post({ mode: 'outline', chapterId }, signal);
    return res.json();
  }

  /* Streams one part. onText gets the full text so far; onThinking fires while the model reasons. */
  async function stream({ chapterId, outline, index, signal, onText, onThinking }) {
    const res = await post({ mode: 'chunk', chapterId, outline, index }, signal);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '', full = '', finishReason = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 2);
        if (!block.startsWith('data:')) continue;
        let ev; try { ev = JSON.parse(block.slice(5)); } catch { continue; }
        if (ev.error) throw new FreeAIError(ev.error, 'server', 502);
        if (ev.thinking && onThinking) onThinking();
        if (ev.t) { full += ev.t; onText(full); }
        if (ev.done) finishReason = ev.finish === 'length' ? 'MAX_TOKENS' : 'STOP';
      }
    }
    if (!full) throw new FreeAIError('The free AI returned an empty answer. Please try again.', 'empty');
    return { text: full, finishReason };
  }

  return { enabled, ready, outline, stream, LABEL, MODEL, FreeAIError };
})();
