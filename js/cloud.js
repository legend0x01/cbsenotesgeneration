/* =========================================================================
 * CLOUD SYNC (Supabase + Google sign-in)
 * Saves each student's generated notes to their account so they never have
 * to generate the same chapter twice, on any device.
 * Disabled automatically when js/config.js has no Supabase details.
 * ========================================================================= */
const Cloud = (() => {
  const cfg = window.NCERT_CONFIG || {};
  const enabled = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase?.createClient);
  const listeners = new Set();
  let client = null;
  let user = null;
  let ready = !enabled;           // true once the first auth state is known
  let readyResolve;
  const readyPromise = new Promise(r => { readyResolve = r; if (ready) r(); });
  let googleOn = false;           // true once Supabase confirms the Google provider is turned on

  // Error sent back by Supabase/Google after a failed sign-in (?error=…&error_description=…).
  let redirectError = '';
  {
    const params = new URLSearchParams(location.search + '&' + location.hash.replace(/^#/, ''));
    if (params.get('error') || params.get('error_description')) {
      redirectError = (params.get('error_description') || params.get('error')).replace(/\+/g, ' ');
      history.replaceState(null, '', location.pathname);
    }
  }

  if (enabled) {
    // Ask Supabase which sign-in providers are on, so a half-finished setup never sends students to an error page.
    fetch(`${cfg.supabaseUrl.replace(/\/$/, '')}/auth/v1/settings`, { headers: { apikey: cfg.supabaseAnonKey } })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`settings ${r.status}`))))
      .then(s => {
        googleOn = !!s?.external?.google;
        if (!googleOn) console.warn('NCERT Notes: Google sign-in is not turned on in Supabase (Authentication → Sign In / Providers → Google).');
      })
      .catch(err => { console.warn('NCERT Notes: could not read Supabase auth settings', err); googleOn = true; })
      .finally(() => listeners.forEach(fn => fn(user, 'PROVIDERS')));
  }

  if (enabled) {
    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    client.auth.onAuthStateChange((event, session) => {
      const next = session?.user || null;
      const changed = (next?.id || null) !== (user?.id || null);
      user = next;
      // Remove ?code=… left by the Google redirect.
      if (session && /[?&]code=/.test(location.search)) history.replaceState(null, '', location.pathname + location.hash);
      const first = !ready;
      if (first) { ready = true; readyResolve(); }
      // Supabase warns against calling it from inside this callback, so defer.
      if (changed || first) setTimeout(() => listeners.forEach(fn => fn(user, event)), 0);
    });
  }

  function requireUser() {
    if (!user) throw new Error('Not signed in');
  }

  function profile() {
    if (!user) return null;
    const m = user.user_metadata || {};
    return {
      id: user.id,
      email: user.email || '',
      name: m.full_name || m.name || (user.email || 'Student').split('@')[0],
      avatar: m.avatar_url || m.picture || ''
    };
  }

  async function signIn() {
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' } }
    });
    if (error) throw error;
  }

  async function signOut() {
    const { error } = await client.auth.signOut();
    if (error) throw error;
  }

  /* Small list of { chapter_id, parts_done, parts_total, updated_at } for badges. */
  async function listProgress() {
    requireUser();
    const { data, error } = await client.from('notes').select('chapter_id, parts_done, parts_total, updated_at');
    if (error) throw error;
    return data || [];
  }

  async function getNotes(chapterId) {
    requireUser();
    const { data, error } = await client.from('notes')
      .select('outline, chunks, model, updated_at').eq('chapter_id', chapterId).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { outline: data.outline, chunks: data.chunks || [], model: data.model, updated: Date.parse(data.updated_at) || 0 };
  }

  // Saves run one after another so an older save can never overwrite a newer one.
  let queue = Promise.resolve();
  function saveNotes(chapterId, notes) {
    requireUser();
    const uid = user.id;
    const row = {
      user_id: uid,
      chapter_id: chapterId,
      outline: notes.outline,
      chunks: notes.chunks || [],
      parts_done: (notes.chunks || []).length,
      parts_total: notes.outline ? notes.outline.length : 0,
      model: notes.model || null,
      updated_at: new Date(notes.updated || Date.now()).toISOString()
    };
    const job = queue.then(async () => {
      const { error } = await client.from('notes').upsert(row, { onConflict: 'user_id,chapter_id' });
      if (error) throw error;
    });
    queue = job.catch(() => {});
    return job;
  }

  function deleteNotes(chapterId) {
    requireUser();
    const job = queue.then(async () => {
      const { error } = await client.from('notes').delete().eq('chapter_id', chapterId);
      if (error) throw error;
    });
    queue = job.catch(() => {});
    return job;
  }

  return {
    enabled,
    canSignIn: () => enabled && googleOn,
    takeRedirectError: () => { const e = redirectError; redirectError = ''; return e; },
    whenReady: () => readyPromise,
    user: () => user,
    profile,
    onChange: fn => listeners.add(fn),
    signIn, signOut, listProgress, getNotes, saveNotes, deleteNotes
  };
})();
