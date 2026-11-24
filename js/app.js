/* =========================================================================
 * NCERT NOTES — APP LOGIC
 * Chapter browser + AI notes reader (Gemini, chunk by chunk).
 * ========================================================================= */
(() => {
  'use strict';

  /* ---------------- helpers ---------------- */
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); return true; }
      catch { return false; }
    },
    del(k) { try { localStorage.removeItem(k); } catch {} },
    raw(k) { try { return localStorage.getItem(k); } catch { return null; } },
    setRaw(k, v) { try { localStorage.setItem(k, v); } catch {} }
  };
  const NOTES_KEY = id => `ncert_notes_v2:${id}`;
  const PROGRESS_KEY = 'ncert_progress_v2';
  const chapterLabel = ch => (ch.isPoem ? 'Poem ' : 'Chapter ') + ch.number;

  const SUBJECT_STYLE = {
    'Mathematics': ['fa-square-root-variable', 'emerald'],
    'Science': ['fa-flask', 'indigo'],
    'Physics': ['fa-atom', 'cyan'],
    'Chemistry': ['fa-vial', 'purple'],
    'Biology': ['fa-dna', 'green'],
    'History': ['fa-landmark', 'amber'],
    'Geography': ['fa-earth-asia', 'teal'],
    'Political Science': ['fa-scale-balanced', 'rose'],
    'Economics': ['fa-chart-line', 'orange'],
    'English': ['fa-feather-pointed', 'sky'],
    'Accountancy': ['fa-calculator', 'lime'],
    'Business Studies': ['fa-briefcase', 'fuchsia'],
    'Computer Science': ['fa-laptop-code', 'violet']
  };
  // Full class strings so the Tailwind CDN picks them up.
  const COLOR = {
    emerald: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400',
    indigo: 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400',
    cyan: 'bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400',
    purple: 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400',
    green: 'bg-green-50 dark:bg-green-950/50 text-green-600 dark:text-green-400',
    amber: 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400',
    teal: 'bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400',
    rose: 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400',
    orange: 'bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400',
    sky: 'bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400',
    lime: 'bg-lime-50 dark:bg-lime-950/50 text-lime-600 dark:text-lime-400',
    fuchsia: 'bg-fuchsia-50 dark:bg-fuchsia-950/50 text-fuchsia-600 dark:text-fuchsia-400',
    violet: 'bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400'
  };
  const subjectStyle = s => { const [icon, c] = SUBJECT_STYLE[s] || ['fa-book', 'indigo']; return { icon, cls: COLOR[c] }; };

  /* ---------------- typing animation ---------------- */
  const phrases = ['NCERT Notes…', 'Make Study Better.', 'Every Chapter. Every Topic.', 'Explained in Detail.'];
  let pIdx = 0, cIdx = 0, deleting = false;
  (function typeLoop() {
    const el = $('typing-text'), phrase = phrases[pIdx];
    el.textContent = phrase.substring(0, deleting ? --cIdx : ++cIdx);
    let delay = deleting ? 45 : 95;
    if (!deleting && cIdx === phrase.length) { delay = 1800; deleting = true; }
    else if (deleting && cIdx === 0) { deleting = false; pIdx = (pIdx + 1) % phrases.length; delay = 350; }
    setTimeout(typeLoop, delay);
  })();

  /* ---------------- theme & night light ---------------- */
  const root = document.documentElement;
  const savedTheme = store.raw('ncert_theme');
  if (savedTheme === 'dark' || (!savedTheme && matchMedia('(prefers-color-scheme: dark)').matches)) root.classList.add('dark');
  $('themeToggleBtn').addEventListener('click', () => {
    root.classList.toggle('dark');
    store.setRaw('ncert_theme', root.classList.contains('dark') ? 'dark' : 'light');
  });
  $('nightLightBtn').addEventListener('click', () => {
    const on = document.body.classList.toggle('night-mode-active');
    $('nightLightBtn').classList.toggle('!bg-amber-500', on);
    $('nightLightBtn').classList.toggle('!text-white', on);
  });

  /* ---------------- stats ---------------- */
  $('statChapters').textContent = NCERT_CHAPTERS.length;
  $('statSubjects').textContent = new Set(NCERT_CHAPTERS.map(c => c.subject)).size;

  /* ================================================================
   * CHAPTER BROWSER
   * ================================================================ */
  let currentClass = store.raw('ncert_class') || '10';
  let currentSubject = 'All';
  let searchQuery = '';
  let cloudProgress = {};   // { chapterId: [done, total] } from the signed-in account
  function progress() {
    const local = store.get(PROGRESS_KEY) || {};
    const merged = { ...local };
    for (const [id, p] of Object.entries(cloudProgress)) if (!merged[id] || merged[id][0] < p[0]) merged[id] = p;
    return merged;
  }

  function renderClassTabs() {
    document.querySelectorAll('.class-tab-btn').forEach(b => {
      const active = b.dataset.class === currentClass && !searchQuery;
      b.className = 'class-tab-btn px-5 py-2.5 rounded-xl font-heading font-bold text-sm transition ' +
        (active ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                : 'glass-panel text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white');
    });
  }

  function renderSubjectFilters() {
    const subjects = ['All', ...new Set(NCERT_CHAPTERS.filter(c => c.class === currentClass).map(c => c.subject))];
    $('subjectFilterContainer').innerHTML =
      `<span class="text-slate-400 font-semibold uppercase tracking-wider text-[11px] mr-1">Subject:</span>` +
      subjects.map(s => `<button data-subject="${esc(s)}" class="subject-chip px-3 py-1.5 rounded-lg font-bold text-xs transition ${
        currentSubject === s && !searchQuery ? 'bg-indigo-600 text-white shadow-sm'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}">${esc(s)}</button>`).join('');
  }

  function chapterCard(ch, prog) {
    const p = prog[ch.id];
    const done = p && p[0] >= p[1];
    const shared = !p && Cloud.community() && setting('useShared') && sharedIdx[ch.id];
    const badge = shared ? `<span class="text-[11px] font-bold text-cyan-600 dark:text-cyan-400"><i class="fa-solid fa-users mr-1"></i>Shared notes ready · ${shared[0]}/${shared[1]}</span>`
      : !p ? `<span class="text-[11px] font-semibold text-slate-400"><i class="fa-solid fa-wand-magic-sparkles mr-1"></i>Generate notes</span>`
      : done ? `<span class="text-[11px] font-bold text-emerald-600 dark:text-emerald-400"><i class="fa-solid fa-circle-check mr-1"></i>Notes complete</span>`
      : `<span class="text-[11px] font-bold text-indigo-600 dark:text-indigo-400"><i class="fa-solid fa-book-open mr-1"></i>${p[0]}/${p[1]} parts read</span>`;
    return `
      <button data-chapter="${esc(ch.id)}" class="chapter-card glass-card text-left rounded-2xl p-4 flex flex-col gap-2 group focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
        <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">${searchQuery ? `Class ${ch.class} · ` : ''}${chapterLabel(ch)}</span>
        <span class="font-heading font-bold text-[15px] leading-snug text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">${esc(ch.title)}</span>
        <span class="mt-auto pt-2 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800/80">
          ${badge}<i class="fa-solid fa-arrow-right text-xs text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition"></i>
        </span>
      </button>`;
  }

  function renderChapters() {
    const q = searchQuery.toLowerCase();
    const list = NCERT_CHAPTERS.filter(ch => q
      ? [ch.title, ch.subject, ch.book, `class ${ch.class}`].some(v => v.toLowerCase().includes(q))
      : ch.class === currentClass && (currentSubject === 'All' || ch.subject === currentSubject));

    $('activeSectionTitle').textContent = q ? `Search results for "${searchQuery}"` : `Class ${currentClass} Notes`;
    $('chapterCountBadge').textContent = `${list.length} chapters`;
    $('emptySearchState').classList.toggle('hidden', list.length > 0);

    // group by subject → book
    const groups = new Map();
    for (const ch of list) {
      const key = `${q ? `Class ${ch.class} · ` : ''}${ch.subject}|||${ch.book}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(ch);
    }
    const prog = progress();
    $('chaptersGrid').innerHTML = [...groups].map(([key, chs]) => {
      const [subjectLabel, book] = key.split('|||');
      const st = subjectStyle(chs[0].subject);
      return `
        <div>
          <div class="flex items-center gap-3 mb-3">
            <span class="w-9 h-9 rounded-xl flex items-center justify-center ${st.cls}"><i class="fa-solid ${st.icon}"></i></span>
            <div>
              <h3 class="font-heading font-extrabold text-lg text-slate-900 dark:text-white leading-tight">${esc(subjectLabel)}</h3>
              <p class="text-xs text-slate-500 dark:text-slate-400">${esc(book)} · ${chs.length} chapters</p>
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            ${chs.map(ch => chapterCard(ch, prog)).join('')}
          </div>
        </div>`;
    }).join('');
  }

  function refreshBrowser() { renderClassTabs(); renderSubjectFilters(); renderChapters(); }

  $('classTabs').addEventListener('click', e => {
    const b = e.target.closest('.class-tab-btn'); if (!b) return;
    currentClass = b.dataset.class; currentSubject = 'All';
    store.setRaw('ncert_class', currentClass);
    searchQuery = ''; $('globalSearch').value = ''; $('globalSearchMobile').value = '';
    refreshBrowser();
  });
  $('subjectFilterContainer').addEventListener('click', e => {
    const b = e.target.closest('.subject-chip'); if (!b) return;
    currentSubject = b.dataset.subject;
    searchQuery = ''; $('globalSearch').value = ''; $('globalSearchMobile').value = '';
    refreshBrowser();
  });
  ['globalSearch', 'globalSearchMobile'].forEach(id => $(id).addEventListener('input', e => {
    searchQuery = e.target.value.trim(); refreshBrowser();
  }));
  $('chaptersGrid').addEventListener('click', e => {
    const card = e.target.closest('[data-chapter]');
    if (card) openReader(card.dataset.chapter);
  });

  /* ================================================================
   * API KEY MODAL
   * ================================================================ */
  let afterKeySaved = null;

  function updateKeyUI() {
    const has = !!Gemini.getKey();
    const btn = $('apiKeyBtn');
    btn.className = 'flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-full border transition active:scale-95 ' +
      (has ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/20'
           : 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/25');
    $('apiKeyBtnLabel').textContent = has ? 'API key active' : 'Add API key';
    // Signed-in students can use the free built-in AI, so they don't need the "add a key" banner.
    $('noKeyBanner').classList.toggle('hidden', has || FreeAI.ready());
    $('keyRemoveBtn').classList.toggle('hidden', !has);
    renderSettings();
  }

  function setKeyStatus(msg, kind) {
    const el = $('keyStatus');
    el.className = 'text-xs min-h-[1rem] ' + ({ ok: 'text-emerald-600 dark:text-emerald-400', err: 'text-rose-600 dark:text-rose-400', info: 'text-slate-500' }[kind] || '');
    el.innerHTML = msg;
  }

  function fillModels(models, selected) {
    const sel = $('modelSelect'), bad = Gemini.badModels();
    // Best first; models Google refused for this key go last and are labelled.
    const ordered = [...Gemini.rankModels(models, bad), ...models.filter(m => bad.includes(m))];
    sel.innerHTML = ordered.map(m => `<option value="${esc(m)}" ${m === selected ? 'selected' : ''}>${esc(m)}${
      bad.includes(m) ? ' (not available for your key)' : m === ordered[0] ? ' (recommended)' : ''}</option>`).join('');
    $('modelRow').classList.toggle('hidden', models.length === 0);
  }

  function openKeyModal(then) {
    afterKeySaved = then || null;
    $('keyInput').value = Gemini.getKey();
    setKeyStatus('', '');
    const cached = store.get('ncert_gemini_models');
    if (cached?.length) fillModels(cached, Gemini.getModel()); else $('modelRow').classList.add('hidden');
    $('keyModal').classList.add('active');
    setTimeout(() => $('keyInput').focus(), 150);
  }
  function closeKeyModal() { $('keyModal').classList.remove('active'); afterKeySaved = null; }

  $('apiKeyBtn').addEventListener('click', () => openKeyModal());
  document.addEventListener('click', e => {
    if (e.target.closest('[data-open-key]')) openKeyModal(currentChapter ? () => resumeReader() : null);
    if (e.target.closest('[data-close-key]')) closeKeyModal();
  });
  $('keyModal').addEventListener('click', e => { if (e.target === $('keyModal')) closeKeyModal(); });
  $('keyToggleVis').addEventListener('click', () => {
    const i = $('keyInput'); i.type = i.type === 'password' ? 'text' : 'password';
  });
  $('modelSelect').addEventListener('change', e => { Gemini.setModel(e.target.value); setKeyStatus(`Model set to <b>${esc(e.target.value)}</b>.`, 'ok'); });
  $('keyRemoveBtn').addEventListener('click', () => {
    Gemini.clearKey(); store.del('ncert_gemini_models');
    $('keyInput').value = ''; $('modelRow').classList.add('hidden');
    setKeyStatus('API key removed from this browser.', 'info'); updateKeyUI();
  });

  /* Shared by the key modal and the get-started guide. Returns true when saved. */
  async function verifyAndSaveKey(key, btn, setStatus) {
    if (!key) { setStatus('Please paste your API key.', 'err'); return false; }
    btn.disabled = true; btn.querySelector('span').textContent = 'Verifying…';
    setStatus('<i class="fa-solid fa-spinner fa-spin mr-1"></i>Checking your key with Google…', 'info');
    try {
      const models = await Gemini.listModels(key);
      if (key !== Gemini.getKey()) Gemini.clearBad();   // a different key may have different models
      Gemini.setKey(key);
      geminiDown = false;
      store.set('ncert_gemini_models', models);
      const current = Gemini.getModel();
      const model = models.includes(current) && !Gemini.badModels().includes(current) ? current : Gemini.pickBestModel(models);
      Gemini.setModel(model);
      fillModels(models, model);
      setStatus(`<i class="fa-solid fa-circle-check mr-1"></i>Key verified. Using <b>${esc(model)}</b>.`, 'ok');
      updateKeyUI();
      return true;
    } catch (err) {
      const msg = err.kind === 'auth' ? 'That key was rejected by Google. Check you copied the whole key.'
        : err instanceof TypeError ? 'Could not reach Google. Check your internet connection.'
        : esc(err.message);
      setStatus(`<i class="fa-solid fa-circle-exclamation mr-1"></i>${msg}`, 'err');
      return false;
    } finally {
      btn.disabled = false; btn.querySelector('span').textContent = 'Save & verify';
    }
  }

  $('keyForm').addEventListener('submit', async e => {
    e.preventDefault();
    const cb = afterKeySaved;
    if (await verifyAndSaveKey($('keyInput').value.trim(), $('keySaveBtn'), setKeyStatus)) {
      setTimeout(() => { closeKeyModal(); if (cb) cb(); }, 700);
    }
  });

  /* ================================================================
   * GET-STARTED GUIDE (first visit, no key yet)
   * ================================================================ */
  const GUIDE_SEEN = 'ncert_guide_seen';
  let afterGuide = null;

  function setGuideStatus(msg, kind) {
    const el = $('guideKeyStatus');
    el.className = 'text-xs min-h-[1rem] ' + ({ ok: 'text-emerald-600 dark:text-emerald-400', err: 'text-rose-600 dark:text-rose-400', info: 'text-slate-500' }[kind] || '');
    el.innerHTML = msg;
  }

  function renderGuide() {
    const step = $('guideStepSignin');
    const show = Cloud.canSignIn() || !!Cloud.user();
    step.classList.toggle('hidden', !show);
    if (!show) return;
    const p = Cloud.profile();
    step.classList.toggle('done', !!p);
    $('guideSigninBody').innerHTML = p
      ? `<p class="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-sm font-semibold">
           <i class="fa-solid fa-circle-check"></i> Signed in as ${esc(p.email || p.name)}</p>`
      : `<button data-signin class="google-btn"><i class="fa-brands fa-google"></i> Sign in with Google</button>
         <span class="block sm:inline sm:ml-2 mt-2 sm:mt-0 text-xs text-slate-400">Optional. You can skip this and sign in later.</span>`;
    const hasKey = !!Gemini.getKey();
    $('guideKeyForm').querySelector('input').placeholder = hasKey ? 'A key is already saved. Paste a new one to replace it.' : 'Paste your key (AIza…)';
  }

  function openGuide(then) {
    afterGuide = then || null;
    closeKeyModal();
    renderGuide();
    setGuideStatus('', '');
    $('guideKeyInput').value = '';
    $('guideModal').classList.add('active');
    $('guideModal').scrollTop = 0;
  }
  function closeGuide() {
    $('guideModal').classList.remove('active');
    store.setRaw(GUIDE_SEEN, '1');
    afterGuide = null;
  }

  $('guideKeyForm').addEventListener('submit', async e => {
    e.preventDefault();
    const cb = afterGuide;
    if (await verifyAndSaveKey($('guideKeyInput').value.trim(), $('guideKeySaveBtn'), setGuideStatus)) {
      setGuideStatus(`<i class="fa-solid fa-circle-check mr-1"></i>All set! Pick any chapter to start.`, 'ok');
      setTimeout(() => { closeGuide(); if (cb) cb(); }, 900);
    }
  });
  $('guideModal').addEventListener('click', e => { if (e.target === $('guideModal') || e.target === $('guideModal').firstElementChild) closeGuide(); });
  document.addEventListener('click', e => {
    if (e.target.closest('[data-open-guide]')) openGuide(currentChapter ? () => resumeReader() : null);
    if (e.target.closest('[data-close-guide]')) closeGuide();
  });

  /* ================================================================
   * GOOGLE SIGN-IN + CLOUD SYNC (Supabase)
   * ================================================================ */
  const RETURN_KEY = 'ncert_return_chapter';
  let syncState = 'local';   // local | saving | saved | error

  function initials(name) { return (name || '?').trim().charAt(0).toUpperCase(); }

  function renderAccount() {
    const area = $('accountArea');
    const p = Cloud.profile();
    $('signinBanner').classList.toggle('hidden', !Cloud.canSignIn() || !!p);
    if (!p && !Cloud.canSignIn()) { area.classList.add('hidden'); return; }
    area.classList.remove('hidden');
    if (!p) {
      area.innerHTML = `<button data-open-auth title="Sign in to save your notes" class="google-btn !px-3 !py-2 !rounded-full !text-xs"><i class="fa-brands fa-google"></i><span class="hidden sm:inline">Sign in</span></button>`;
      return;
    }
    const saved = Object.keys(cloudProgress).length;
    const avatar = p.avatar
      ? `<img src="${esc(p.avatar)}" alt="" referrerpolicy="no-referrer" class="w-full h-full object-cover" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${esc(initials(p.name))}'}))">`
      : esc(initials(p.name));
    area.innerHTML = `
      <button id="accountBtn" title="${esc(p.name)}" class="w-10 h-10 rounded-full overflow-hidden ring-2 ring-indigo-500/40 hover:ring-indigo-500 bg-indigo-600 text-white font-bold flex items-center justify-center transition">${avatar}</button>
      <div id="accountMenu" class="hidden absolute right-0 top-12 w-72 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl z-50 space-y-3">
        <div class="min-w-0">
          <p class="font-heading font-bold text-slate-900 dark:text-white truncate">${esc(p.name)}</p>
          <p class="text-xs text-slate-500 truncate">${esc(p.email)}</p>
        </div>
        <p class="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
          <i class="fa-solid fa-cloud text-emerald-500 mt-0.5"></i>
          <span><b>${saved}</b> chapter${saved === 1 ? '' : 's'} saved to your account. Notes you generate are saved automatically.</span>
        </p>
        <button data-signout class="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 transition">
          <i class="fa-solid fa-arrow-right-from-bracket"></i> Sign out
        </button>
      </div>`;
  }

  function renderSyncBadge() {
    const el = $('syncBadge');
    if (!Cloud.user() && !Cloud.canSignIn()) { el.className = 'hidden'; return; }
    const base = 'hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold ';
    const states = {
      local: ['bg-slate-200/70 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 cursor-pointer', 'fa-laptop', 'This device only · Sign in'],
      saving: ['bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400', 'fa-spinner fa-spin', 'Saving…'],
      saved: ['bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400', 'fa-cloud', 'Saved to account'],
      error: ['bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400', 'fa-cloud-arrow-up', 'Not synced yet']
    };
    const [cls, icon, label] = states[syncState];
    el.className = base + cls;
    el.title = syncState === 'error' ? 'Could not reach your account. Notes are saved on this device and will sync on the next save.' : '';
    el.toggleAttribute('data-signin', syncState === 'local');
    el.innerHTML = `<i class="fa-solid ${icon}"></i>${label}`;
  }
  function setSync(state) { syncState = state; renderSyncBadge(); }

  async function startSignIn() {
    const btn = $('authGoogleBtn');
    try {
      store.setRaw(AUTH_CHOICE, 'google');
      if (currentChapter) sessionStorage.setItem(RETURN_KEY, currentChapter.id);
      btn.disabled = true;
      btn.querySelector('span').textContent = 'Redirecting to Google…';
      await Cloud.signIn();   // redirects to Google
    } catch (err) {
      btn.disabled = false;
      btn.querySelector('span').textContent = 'Continue with Google';
      showAuthError('Could not start Google sign-in: ' + (err?.message || err));
    }
  }

  /* ---------- sign-in choice screen ---------- */
  const AUTH_CHOICE = 'ncert_auth_choice';   // 'google' | 'guest' once the student has chosen

  function showAuthError(msg) {
    const el = $('authError');
    el.innerHTML = `<i class="fa-solid fa-circle-exclamation mr-1"></i><b>Sign-in didn't work.</b> ${esc(msg)}`;
    el.classList.remove('hidden');
    if (!$('authModal').classList.contains('active')) $('authModal').classList.add('active');
  }
  function openAuth() {
    $('authError').classList.add('hidden');
    const btn = $('authGoogleBtn');
    btn.disabled = false; btn.querySelector('span').textContent = 'Continue with Google';
    $('authModal').classList.add('active');
  }
  function closeAuth() {
    if (!$('authModal').classList.contains('active')) return;
    $('authModal').classList.remove('active');
    if (!store.raw(AUTH_CHOICE)) store.setRaw(AUTH_CHOICE, 'guest');
  }
  $('authGoogleBtn').addEventListener('click', startSignIn);
  $('authGuestBtn').addEventListener('click', () => { store.setRaw(AUTH_CHOICE, 'guest'); closeAuth(); });
  $('authModal').addEventListener('click', e => { if (e.target === $('authModal') || e.target === $('authModal').firstElementChild) closeAuth(); });

  document.addEventListener('click', async e => {
    if (e.target.closest('[data-open-auth]')) { openAuth(); return; }
    if (e.target.closest('[data-close-auth]')) { closeAuth(); return; }
    if (e.target.closest('[data-signin]')) { e.preventDefault(); startSignIn(); return; }
    if (e.target.closest('[data-signout]')) {
      try { await Cloud.signOut(); } catch (err) { alert('Sign out failed: ' + (err?.message || err)); }
      return;
    }
    const menu = $('accountMenu');
    if (e.target.closest('#accountBtn')) menu?.classList.toggle('hidden');
    else if (menu && !e.target.closest('#accountMenu')) menu.classList.add('hidden');
  });

  /* Pull the account's chapter list, and upload chapters that are further along on this device. */
  async function syncAccount() {
    try {
      const rows = await Cloud.listProgress();
      cloudProgress = {};
      rows.forEach(r => { if (r.parts_total > 0) cloudProgress[r.chapter_id] = [r.parts_done, r.parts_total]; });
      const local = store.get(PROGRESS_KEY) || {};
      for (const id of Object.keys(local)) {
        const notes = store.get(NOTES_KEY(id));
        if (!notes?.outline || !NCERT_CHAPTERS.some(c => c.id === id)) continue;
        const remote = cloudProgress[id];
        if (!remote || notes.chunks.length > remote[0]) {
          await Cloud.saveNotes(id, notes);
          cloudProgress[id] = [notes.chunks.length, notes.outline.length];
        }
      }
    } catch (err) {
      console.warn('Cloud sync failed', err);
    }
    renderAccount(); renderChapters();
  }

  Cloud.onChange(async (u, event) => {
    renderAccount(); renderGuide(); updateKeyUI();
    if (event === 'PROVIDERS') {
      // Supabase told us whether Google sign-in is on. First visit: offer the choice.
      if (currentChapter) { renderSyncBadge(); renderActions(); }
      await Cloud.whenReady();
      if (Cloud.canSignIn() && !Cloud.user() && !store.raw(AUTH_CHOICE) && !$('authModal').classList.contains('active')) openAuth();
      return;
    }
    if (u) { store.setRaw(AUTH_CHOICE, 'google'); closeAuth(); }
    if (!u) {
      cloudProgress = {}; myShared = {};
      if (currentChapter) { setSync('local'); renderActions(); }
      renderChapters(); renderSettings();
      return;
    }
    if (currentChapter) setSync('saved');
    mySharedReady = loadMyShared();
    await syncAccount();
    renderSettings();
    const back = sessionStorage.getItem(RETURN_KEY);
    if (back) { sessionStorage.removeItem(RETURN_KEY); if (!currentChapter) openReader(back); }
    else if (currentChapter && !busy) loadFromCloud().then(() => resumeReader());
  });

  /* ================================================================
   * SHARED NOTES LIBRARY + SETTINGS
   * ================================================================ */
  let sharedIdx = {};   // { chapterId: [partsDone, partsTotal] } shared by anyone
  let myShared = {};    // { chapterId: partsDone } shared by this student
  let communityReady = Promise.resolve();   // set at startup to loadCommunity()
  let mySharedReady = Promise.resolve();    // set on sign-in to loadMyShared()

  // [localStorage key, default]. All on by default; students can switch any of them off in Settings.
  const SETTINGS = { useShared: ['ncert_use_shared', true], autoShare: ['ncert_auto_share', true], showName: ['ncert_share_name', true] };
  function setting(k) { const v = store.raw(SETTINGS[k][0]); return v === null ? SETTINGS[k][1] : v === '1'; }
  function setSetting(k, on) { store.setRaw(SETTINGS[k][0], on ? '1' : '0'); }

  async function loadCommunity() {
    if (!Cloud.enabled) return;
    try {
      if (!(await Cloud.checkCommunity())) return;
      const rows = await Cloud.sharedIndex();
      sharedIdx = {};
      rows.forEach(r => { sharedIdx[r.chapter_id] = [r.parts_done, r.parts_total]; });
    } catch (err) { console.warn('Could not load shared notes', err); }
    finally { renderChapters(); renderSettings(); }
  }

  async function loadMyShared() {
    await communityReady;
    if (!Cloud.community() || !Cloud.user()) { myShared = {}; return; }
    try {
      const rows = await Cloud.mySharedChapters();
      myShared = {};
      rows.forEach(r => { myShared[r.chapter_id] = r.parts_done; });
    } catch (err) { console.warn('Could not load my shared notes', err); }
    renderSettings();
    if (currentChapter && !busy) renderActions();
  }

  function renderSettings() {
    if (!$('settingsModal')) return;
    const community = Cloud.community(), signedIn = !!Cloud.user();
    $('communityOffNote').classList.toggle('hidden', community);
    const rows = [['setUseShared', 'useShared', !community], ['setAutoShare', 'autoShare', !community || !signedIn], ['setShowName', 'showName', !community || !signedIn]];
    for (const [elId, key, disabled] of rows) {
      const el = $(elId);
      el.checked = setting(key);
      el.disabled = disabled;
      el.closest('.setting-row').classList.toggle('disabled', disabled);
    }
    $('shareSignInNote').classList.toggle('hidden', !community || signedIn || !Cloud.canSignIn());
    const n = Object.keys(myShared).length;
    $('sharedSummary').classList.toggle('hidden', !signedIn || !n);
    $('sharedSummary').innerHTML = `<i class="fa-solid fa-heart mr-1"></i>You've shared ${n} chapter${n === 1 ? '' : 's'} with other students. Thank you!`;

    const p = Cloud.profile();
    $('settingsAccountSection').classList.toggle('hidden', !p && !Cloud.canSignIn());
    $('settingsAccount').innerHTML = p
      ? `<div class="flex flex-wrap items-center justify-between gap-3">
           <p class="text-sm text-slate-600 dark:text-slate-300 min-w-0 truncate">Signed in as <b class="text-slate-900 dark:text-white">${esc(p.email || p.name)}</b></p>
           <button data-signout class="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-rose-50 hover:text-rose-600 transition">Sign out</button>
         </div>`
      : `<div class="flex flex-wrap items-center justify-between gap-3">
           <p class="text-sm text-slate-600 dark:text-slate-300">Sign in to keep notes on every device and share them.</p>
           <button data-signin class="google-btn !py-2 !text-xs"><i class="fa-brands fa-google"></i> Sign in</button>
         </div>`;

    $('settingsKeyStatus').innerHTML = Gemini.getKey()
      ? `<i class="fa-solid fa-circle-check text-emerald-500 mr-1"></i>Key saved · <b>${esc(Gemini.getModel())}</b>`
      : FreeAI.ready()
        ? `<i class="fa-solid fa-circle-check text-emerald-500 mr-1"></i>No key needed: you're using the free built-in AI (<b>${esc(FreeAI.LABEL)}</b>).`
        : `<i class="fa-solid fa-circle-exclamation text-amber-500 mr-1"></i>No key yet. ${FreeAI.enabled ? 'Sign in for free notes, or add your own key.' : 'You can still read shared notes.'}`;
    const count = Object.keys(store.get(PROGRESS_KEY) || {}).length;
    $('settingsDeviceInfo').textContent = `${count} chapter${count === 1 ? '' : 's'} saved in this browser`;
  }

  function openSettings() { renderSettings(); $('settingsModal').classList.add('active'); }
  function closeSettings() { $('settingsModal').classList.remove('active'); }
  $('settingsBtn').addEventListener('click', openSettings);
  document.addEventListener('click', e => { if (e.target.closest('[data-open-settings]')) openSettings(); });
  $('settingsModal').addEventListener('click', e => {
    if (e.target === $('settingsModal') || e.target === $('settingsModal').firstElementChild || e.target.closest('[data-close-settings]')) closeSettings();
  });
  $('setUseShared').addEventListener('change', e => { setSetting('useShared', e.target.checked); renderChapters(); });
  $('setAutoShare').addEventListener('change', e => { setSetting('autoShare', e.target.checked); });
  $('setShowName').addEventListener('change', e => { setSetting('showName', e.target.checked); });
  $('clearLocalBtn').addEventListener('click', () => {
    if (!confirm('Delete every chapter saved in this browser? Notes saved to your account or shared with everyone are not affected.')) return;
    try { Object.keys(localStorage).filter(k => k.startsWith('ncert_notes_v2:')).forEach(k => localStorage.removeItem(k)); } catch {}
    store.del(PROGRESS_KEY);
    renderChapters(); renderSettings();
  });

  // Saves still uploading, so the badge only says "Saved" once the last one lands.
  let pendingSaves = 0, saveFailed = false;
  function trackSave(promise, id) {
    if (pendingSaves++ === 0) saveFailed = false;
    setSync('saving');
    return promise
      .catch(err => { console.warn('Cloud save failed', err); saveFailed = true; })
      .finally(() => {
        if (--pendingSaves === 0 && currentChapter?.id === id) setSync(saveFailed ? 'error' : 'saved');
      });
  }

  function pushToCloud(id, record) {
    if (!Cloud.user()) return;
    trackSave(Cloud.saveNotes(id, record).then(() => {
      const isNew = !cloudProgress[id];
      if (record.outline) cloudProgress[id] = [record.chunks.length, record.outline.length];
      if (isNew) renderAccount();
    }), id);
  }

  /* When a chapter opens while signed in, use whichever copy (device or account) is further along. */
  let loadingCloud = false;
  async function loadFromCloud() {
    if (!currentChapter || !Cloud.user()) return;
    const my = session, id = currentChapter.id;
    loadingCloud = true;
    if (!data.chunks.length) showStatus('loading', '<i class="fa-solid fa-spinner fa-spin mr-2"></i><b>Checking your account for saved notes…</b>');
    let remote = null, failed = false;
    try { remote = await Cloud.getNotes(id); } catch (err) { failed = true; console.warn('Cloud load failed', err); }
    if (my !== session) return;
    loadingCloud = false;
    clearStatus();
    const localCount = data.chunks.length;
    if (remote?.outline && (remote.chunks.length > localCount || (remote.chunks.length === localCount && remote.updated > (data.updated || 0)))) {
      data = { outline: remote.outline, chunks: remote.chunks, model: remote.model, updated: remote.updated };
      store.set(NOTES_KEY(id), data);
      const prog = store.get(PROGRESS_KEY) || {};
      prog[id] = [data.chunks.length, data.outline.length];
      store.set(PROGRESS_KEY, prog);
      renderAll();
      setSync('saved');
    } else if (!failed && data.outline && (!remote || localCount > remote.chunks.length)) {
      pushToCloud(id, data);
    } else {
      setSync(failed ? 'error' : 'saved');
    }
  }

  /* ================================================================
   * MARKDOWN + MATH RENDERING
   * ================================================================ */
  marked.setOptions({ gfm: true, breaks: false });
  const MATH_RE = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$(?!\s)([^$\n]+?)(?<!\s)\$/g;

  function renderMarkdown(md) {
    const maths = [];
    const protectedMd = md.replace(MATH_RE, (m, d1, d2, i1, i2) => {
      const display = d1 !== undefined || d2 !== undefined;
      maths.push({ tex: d1 ?? d2 ?? i1 ?? i2, display });
      return `@@MATH${maths.length - 1}@@`;
    });
    let html = DOMPurify.sanitize(marked.parse(protectedMd));
    return html.replace(/@@MATH(\d+)@@/g, (_, n) => {
      const { tex, display } = maths[+n];
      if (window.katex) {
        try { return katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: 'ignore' }); } catch {}
      }
      return `<code>${esc(tex)}</code>`;
    });
  }

  /* ================================================================
   * PROMPTS (shared with the /api/generate server function: js/prompts.js)
   * ================================================================ */
  const { SYSTEM, outlinePrompt, chunkPrompt, OUTLINE_SCHEMA } = NcertPrompts;

  /* ================================================================
   * NOTES READER
   * ================================================================ */
  let currentChapter = null;   // chapter object
  let data = null;             // { outline: [...], chunks: [markdown...] }
  let busy = false;
  let controller = null;       // AbortController for in-flight request
  let session = 0;             // increments on open/close to ignore stale results
  let fontSize = +(store.raw('ncert_font') || 16);

  const notesModal = $('notesModal');
  const scroller = $('notesScrollContainer');

  function saveData() {
    if (!currentChapter || !data?.outline) return;
    const id = currentChapter.id;
    data.model = lastModel || Gemini.getModel();
    data.updated = Date.now();
    const record = { outline: data.outline, chunks: data.chunks.slice(), model: data.model, updated: data.updated, shared: data.shared };
    const ok = store.set(NOTES_KEY(id), record);
    const prog = store.get(PROGRESS_KEY) || {};
    prog[id] = [data.chunks.length, data.outline.length];
    store.set(PROGRESS_KEY, prog);
    if (Cloud.user()) pushToCloud(id, record);
    else if (!ok) showStatus('warn', 'Your browser storage is full, so these notes could not be saved on this device. Sign in with Google to save them to your account, or use "Reset" on old chapters to free space.');
  }

  function openReader(id) {
    const ch = NCERT_CHAPTERS.find(c => c.id === id);
    if (!ch) return;
    session++;
    currentChapter = ch;
    data = store.get(NOTES_KEY(id)) || { outline: null, chunks: [] };

    $('modalSubjectBadge').textContent = ch.subject;
    $('modalChapterTitle').textContent = ch.title;
    const bookPart = ch.book === ch.subject ? '' : ` · ${ch.book}`;
    $('modalChapterMeta').textContent = `Class ${ch.class} · ${ch.subject}${bookPart} · ${chapterLabel(ch)}`;
    $('notesHeader').innerHTML = `
      <div class="border-b border-slate-200 dark:border-slate-800 pb-5 mb-2">
        <span class="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">NCERT Class ${esc(ch.class)} · ${esc(ch.subject)}</span>
        <h2 class="text-2xl sm:text-3xl font-heading font-black text-slate-900 dark:text-white mt-1">${esc(ch.title)}</h2>
        <p class="text-xs text-slate-400 mt-1">${ch.book === ch.subject ? '' : `${esc(ch.book)} · `}${chapterLabel(ch)}</p>
      </div>`;
    $('printableNotesArea').style.fontSize = fontSize + 'px';

    notesModal.classList.add('active');
    document.body.classList.add('reader-locked');
    scroller.scrollTop = 0;
    loadingCloud = false;
    syncState = Cloud.user() ? 'saved' : 'local';
    renderSyncBadge();
    if (skipSharedFor !== id) skipSharedFor = null;
    betterShared = null;
    renderAll();
    prepareChapter();
  }

  function closeReader() {
    cancelPrefetch();
    session++;
    if (controller) controller.abort();
    controller = null; busy = false;
    notesModal.classList.remove('active');
    document.body.classList.remove('reader-locked');
    currentChapter = null; data = null;
    renderChapters();
  }

  /* Which AI writes the notes: the student's own Gemini key, or the free built-in AI
     (NVIDIA Nemotron via /api/generate, for signed-in students). */
  let geminiDown = false;   // the student's key failed and we switched to the free AI; reset when a key is saved
  let lastModel = '';       // model that wrote the latest part (saved with the notes)
  function provider() {
    if (Gemini.getKey() && !geminiDown) return 'gemini';
    if (FreeAI.ready()) return 'free';
    return null;
  }

  /* No AI available yet: ask to sign in (free AI) or add a key. Returns true when generation has to wait. */
  function needKey(then) {
    if (provider()) return false;
    showNeedKey();
    if (!store.raw(GUIDE_SEEN)) openGuide(then);
    else if (!(FreeAI.enabled && Cloud.canSignIn())) openKeyModal(then);
    return true;
  }

  /* Decide what to do next for the open chapter. Notes that already exist (own or shared) need no key to read. */
  function resumeReader() {
    if (!currentChapter || busy || loadingCloud) return;
    if (data.outline && data.chunks.length) { renderActions(); return; }
    if (needKey(() => resumeReader())) return;
    if (!data.outline) generateOutline(); else generateChunk(0);
  }

  /* Own copy first (device, then account), then shared notes from other students. */
  async function prepareChapter() {
    const my = session;
    if (Cloud.user()) await loadFromCloud();
    if (my !== session) return;
    await offerShared(my);
    if (my !== session) return;
    resumeReader();
    maybeAutoShare(my);
  }

  /* Another student's shared copy of this chapter is complete, so it can't be replaced (supabase/shared_notes.sql). */
  const othersComplete = id => !myShared[id] && !!sharedIdx[id] && sharedIdx[id][0] >= sharedIdx[id][1];

  /* Auto-share also covers parts written earlier (e.g. before sharing was switched on, or offline). */
  async function maybeAutoShare(my) {
    await mySharedReady;
    if (my !== session || !currentChapter || busy || !data?.outline || !data.chunks.length) return;
    if (!setting('autoShare') || !Cloud.user() || !Cloud.community()) return;
    const id = currentChapter.id, done = data.chunks.length;
    if ((myShared[id] || 0) >= done || (sharedIdx[id]?.[0] || 0) >= done || othersComplete(id)) return;
    shareCurrent(true);
  }

  /* ---------- shared (community) notes in the reader ---------- */
  let betterShared = null;     // a more complete shared copy than the student's own
  let skipSharedFor = null;    // chapter the student chose to generate themselves
  let shareBusy = false;

  async function offerShared(my) {
    betterShared = null;
    await communityReady;
    if (my !== session || !currentChapter || !Cloud.community() || !setting('useShared') || skipSharedFor === currentChapter.id) return;
    const id = currentChapter.id, own = data.chunks.length;
    if (data.outline && own >= data.outline.length) return;
    loadingCloud = true;
    if (!own) showStatus('loading', '<i class="fa-solid fa-spinner fa-spin mr-2"></i><b>Looking for notes other students have shared…</b>');
    let shared = null;
    try { shared = await Cloud.getShared(id); } catch (err) { console.warn('Shared notes check failed', err); }
    if (my !== session) return;
    loadingCloud = false;
    clearStatus();
    if (!shared?.outline?.length || shared.chunks.length <= own) return;
    sharedIdx[id] = [shared.chunks.length, shared.outline.length];
    if (own === 0) useSharedCopy(shared);
    else {
      betterShared = shared;
      showStatus('warn', `<i class="fa-solid fa-users mr-1"></i>Another student has shared a more complete version of this chapter: <b>${shared.chunks.length} of ${shared.outline.length} parts</b> (you have ${own}).`,
        btnHtml('use-shared', 'Switch to the shared version', 'fa-right-left', true));
    }
  }

  function useSharedCopy(shared) {
    data = { outline: shared.outline, chunks: shared.chunks.slice(), shared: { by: shared.by || '', parts: shared.chunks.length } };
    betterShared = null;
    saveData();
    renderAll();
    scroller.scrollTop = 0;
  }

  function renderCommunityBanner() {
    const el = $('communityBanner');
    if (!data?.shared) { el.innerHTML = ''; return; }
    const by = data.shared.by ? `<b>${esc(data.shared.by)}</b>` : 'another student';
    const extra = data.chunks.length > data.shared.parts ? ` You generated parts ${data.shared.parts + 1}–${data.chunks.length} yourself.` : '';
    el.innerHTML = `
      <div class="mt-4 p-4 rounded-2xl border border-cyan-200 dark:border-cyan-900/70 bg-cyan-50/70 dark:bg-cyan-950/20 text-sm text-slate-700 dark:text-slate-300 flex flex-col sm:flex-row sm:items-center gap-3">
        <div class="flex items-start gap-3 flex-1">
          <span class="w-8 h-8 shrink-0 rounded-xl bg-cyan-500 text-white flex items-center justify-center"><i class="fa-solid fa-users text-xs"></i></span>
          <p><b class="text-slate-900 dark:text-white">Shared notes.</b> Parts 1–${data.shared.parts} were generated by ${by} and shared with everyone, so they opened instantly.${extra} AI notes can contain mistakes, so check with your textbook.</p>
        </div>
        <div class="flex gap-4 shrink-0 pl-11 sm:pl-0">
          <button data-action="own" class="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Generate my own</button>
          <button data-action="report" class="text-xs font-semibold text-slate-500 hover:text-rose-600"><i class="fa-regular fa-flag mr-1"></i>Report</button>
        </div>
      </div>`;
  }

  function shareRowHtml(done) {
    if (!Cloud.community() || !Cloud.user() || done === 0) return '';
    if (shareBusy) return `<span class="text-xs text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-1"></i>Sharing…</span>`;
    const id = currentChapter.id, mine = myShared[id] || 0, publicDone = sharedIdx[id]?.[0] || 0;
    if (mine && mine >= done) {
      return `<span class="text-xs font-semibold text-emerald-600 dark:text-emerald-400"><i class="fa-solid fa-users mr-1"></i>Shared with everyone</span>
        <button data-action="unshare" class="text-xs font-semibold text-slate-500 hover:text-rose-600 transition"><i class="fa-solid fa-eye-slash mr-1"></i>Stop sharing</button>`;
    }
    if (!mine && (publicDone >= done || othersComplete(id))) {
      return `<span class="text-xs text-slate-400"><i class="fa-solid fa-users mr-1"></i>Already shared with everyone by another student</span>`;
    }
    return `<button data-action="share" class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 transition active:scale-95">
        <i class="fa-solid fa-share-nodes"></i>${mine ? `Update shared notes (${done} parts)` : 'Share with everyone'}</button>
      <span class="text-[11px] text-slate-400 max-w-[16rem]">Other students can read ${done === data.outline.length ? 'this chapter' : done === 1 ? 'this part' : `these ${done} parts`} without generating ${done === 1 && done !== data.outline.length ? 'it' : 'them'}.</span>`;
  }

  async function shareCurrent(quiet) {
    if (!currentChapter || !data?.outline || !data.chunks.length || shareBusy) return;
    if (!Cloud.user()) { openAuth(); return; }
    const id = currentChapter.id, done = data.chunks.length, total = data.outline.length, my = session;
    shareBusy = true; renderActions();
    try {
      const res = await Cloud.publishShared(id, { outline: data.outline, chunks: data.chunks, model: data.model }, setting('showName'));
      if (res?.status === 'shared') {
        myShared[id] = done; sharedIdx[id] = [done, total];
        if (!quiet && my === session) showStatus('success', `<i class="fa-solid fa-circle-check mr-1"></i><b>Shared!</b> Every student can now read ${done === total ? 'this chapter' : `parts 1–${done} of this chapter`} without generating it. Thank you!`);
      } else if (res?.status === 'exists') {
        sharedIdx[id] = [res.parts_done, res.parts_total];
        if (!quiet && my === session) showStatus('warn', res.parts_done >= res.parts_total
          ? 'Another student has already shared this <b>complete chapter</b>, so their copy was kept.'
          : `Another student has already shared <b>${res.parts_done} of ${res.parts_total}</b> parts of this chapter, so their copy was kept. Once you have more parts than that, you can share yours.`);
      }
    } catch (err) {
      console.warn('Share failed', err);
      if (my === session && !busy) {
        showStatus(quiet ? 'warn' : 'error', `<i class="fa-solid fa-circle-exclamation mr-1"></i><b>Couldn't share these notes${quiet ? ' automatically' : ''}.</b> ${esc(err?.message || err)}`,
          btnHtml('share', 'Try again', 'fa-rotate-right', true));
      }
    } finally {
      shareBusy = false;
      if (my === session && !busy) renderActions();
      renderSettings();
    }
  }

  async function unshareCurrent() {
    if (!currentChapter || !confirm('Stop sharing this chapter? Other students will no longer see your copy.')) return;
    const id = currentChapter.id;
    try {
      await Cloud.unshare(id);
      delete myShared[id]; delete sharedIdx[id];
      showStatus('success', 'This chapter is no longer shared.');
    } catch (err) {
      showStatus('error', `<b>Couldn't stop sharing.</b> ${esc(err?.message || err)}`);
    }
    renderActions(); renderSettings();
  }

  async function reportCurrent() {
    if (!currentChapter) return;
    if (!Cloud.user()) { openAuth(); return; }
    const reason = prompt('What is wrong with these shared notes? (for example: wrong facts, wrong chapter, spam)');
    if (reason === null) return;
    try {
      const r = await Cloud.reportShared(currentChapter.id, reason.trim());
      showStatus('success', r === 'already' ? 'You have already reported these notes. Thank you!'
        : '<b>Thanks for reporting.</b> Shared notes reported by several students are hidden until they are reviewed.');
    } catch (err) {
      showStatus('error', `<b>Couldn't send the report.</b> ${esc(err?.message || err)}`);
    }
  }

  /* Scroll ONLY the notes panel. (scrollIntoView also scrolls the page and the reader frame
     behind it, which pushed the toolbar off-screen and left a white gap.) */
  function scrollNotesTo(el) {
    if (!el) return;
    const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 8;
    scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }

  /* ---------- rendering ---------- */
  function renderAll() { renderToc(); renderCommunityBanner(); renderChunks(); renderActions(); clearStatus(); }

  function renderToc() {
    const list = $('tocList');
    if (!data.outline) {
      list.innerHTML = `<li class="px-3 py-2 text-xs text-slate-400">${busy ? 'Mapping topics…' : 'Topics appear here once notes start.'}</li>`;
      $('tocProgressText').textContent = '—';
      $('chunkProgress').style.width = '0%';
      return;
    }
    const n = data.outline.length, done = data.chunks.length;
    $('tocProgressText').textContent = `${done} of ${n} parts generated`;
    $('chunkProgress').style.width = `${(done / n) * 100}%`;
    list.innerHTML = data.outline.map((c, i) => {
      const state = i < done ? 'done' : i === done ? 'next' : 'todo';
      const icon = state === 'done' ? '<i class="fa-solid fa-circle-check text-emerald-500"></i>'
        : state === 'next' ? (busy ? '<i class="fa-solid fa-spinner fa-spin text-indigo-500"></i>' : '<i class="fa-solid fa-circle-play text-indigo-500"></i>')
        : '<i class="fa-regular fa-circle text-slate-300 dark:text-slate-600"></i>';
      return `<li>
        <button data-toc="${i}" ${state === 'todo' ? 'disabled' : ''} class="w-full text-left flex gap-2.5 px-3 py-2 rounded-xl transition ${
          state === 'todo' ? 'opacity-60 cursor-not-allowed' : 'hover:bg-white dark:hover:bg-slate-800'}">
          <span class="pt-0.5 shrink-0">${icon}</span>
          <span><span class="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Part ${i + 1}</span>
          <span class="font-semibold text-slate-700 dark:text-slate-200 leading-snug">${esc(c.title)}</span></span>
        </button></li>`;
    }).join('');
  }

  function chunkShell(i) {
    const title = data.outline?.[i]?.title || '';
    return `<section id="chunk-${i}" class="chunk-section">
      <div class="chunk-divider no-print"><span class="text-[11px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">Part ${i + 1} of ${data.outline.length} · ${esc(title)}</span></div>
      <div class="chunk-body notes-md prose prose-slate dark:prose-invert"></div>
    </section>`;
  }

  function renderChunks() {
    const box = $('chunksContainer');
    box.innerHTML = data.chunks.map((_, i) => chunkShell(i)).join('');
    data.chunks.forEach((md, i) => { box.querySelector(`#chunk-${i} .chunk-body`).innerHTML = renderMarkdown(md); });
  }

  function renderActions() {
    const el = $('readerActions');
    if (busy || !data?.outline) { el.innerHTML = ''; return; }
    const n = data.outline.length, done = data.chunks.length;
    const nudge = Cloud.canSignIn() && !Cloud.user() && done > 0
      ? `<p class="text-xs text-slate-500 dark:text-slate-400 text-center"><i class="fa-solid fa-cloud-arrow-up mr-1 text-emerald-500"></i>These notes are only on this device. <button data-signin class="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Sign in with Google</button> to keep them on every device${Cloud.community() ? ' and share them with other students' : ''}.</p>` : '';
    const share = shareRowHtml(done);
    const regen = (done > 0 ? `<button data-action="regen" class="text-xs font-semibold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition"><i class="fa-solid fa-rotate-right mr-1"></i>Rewrite part ${done}</button>` : '')
      + (share ? `<div class="flex flex-wrap items-center justify-center gap-3 text-center">${share}</div>` : '') + nudge;
    if (done < n) {
      el.innerHTML = `
        <button data-action="next" class="group w-full max-w-xl flex items-center justify-between gap-4 px-6 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-500 text-white shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 transition active:scale-[.98]">
          <span class="text-left">
            <span class="block text-[11px] font-bold uppercase tracking-widest opacity-80">${
              prefetch && prefetch.index === done && !prefetch.error
                ? (prefetch.done ? `Ready · Part ${done + 1} of ${n}` : `Being written in the background · Part ${done + 1} of ${n}`)
                : `Generate next chunk · Part ${done + 1} of ${n}`}</span>
            <span class="block font-heading font-bold text-lg leading-snug">${esc(data.outline[done].title)}</span>
          </span>
          <i class="fa-solid fa-wand-magic-sparkles text-xl group-hover:rotate-12 transition"></i>
        </button>${regen}`;
    } else {
      el.innerHTML = `
        <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-sm font-bold">
          <i class="fa-solid fa-circle-check"></i> You have completed all ${n} parts of this chapter!
        </div>
        <div class="flex items-center gap-4">
          <button data-action="pdf" class="text-xs font-semibold text-slate-500 hover:text-rose-600 transition"><i class="fa-solid fa-file-pdf mr-1"></i>Save as PDF</button>${regen}
        </div>`;
    }
  }

  function showStatus(kind, html, buttons = '') {
    const styles = {
      loading: 'border-indigo-200 dark:border-indigo-900 bg-indigo-50/70 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300',
      error: 'border-rose-200 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300',
      warn: 'border-amber-200 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300',
      success: 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
    };
    $('readerStatus').innerHTML = `<div class="my-6 p-4 rounded-2xl border text-sm ${styles[kind]}">
      <div>${html}</div>${buttons ? `<div class="mt-3 flex flex-wrap gap-2">${buttons}</div>` : ''}</div>`;
  }
  function clearStatus() { $('readerStatus').innerHTML = ''; }
  const btnHtml = (action, label, icon, primary) =>
    `<button data-action="${action}" class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${primary
      ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-indigo-400'}"><i class="fa-solid ${icon}"></i>${label}</button>`;

  const signInBtn = `<button data-open-auth class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition"><i class="fa-brands fa-google"></i>Sign in with Google</button>`;
  const freeOffer = () => FreeAI.enabled && !Cloud.user() && Cloud.canSignIn();

  function showNeedKey() {
    if (Gemini.getKey() && geminiDown) {
      showStatus('warn', `<b>Your Gemini key isn't working right now.</b> ${freeOffer() ? 'Sign in with Google to continue with the free built-in AI, or update your key.' : 'Update your key, or try again later.'}`,
        (freeOffer() ? signInBtn : '') + btnHtml('key', 'Update API key', 'fa-key', !freeOffer()));
    } else if (freeOffer()) {
      showStatus('warn', `<b>Sign in with Google to generate notes for free</b> with the built-in AI (${esc(FreeAI.LABEL)}). Or add your own Gemini API key.`,
        signInBtn + btnHtml('key', 'Use my own Gemini key', 'fa-key', false));
    } else {
      showStatus('warn', `<b>Add your Gemini API key</b> to generate notes for this chapter. It's free and takes about a minute.`,
        btnHtml('key', 'Add API key', 'fa-key', true));
    }
  }

  function showError(err, retryAction) {
    if (err?.name === 'AbortError') return;
    const free = err?.provider === 'free';
    let msg, extra = '';
    switch (err?.kind) {
      case 'signin': msg = '<b>Please sign in with Google again</b> to use the free built-in AI.'; extra = signInBtn; break;
      case 'auth': msg = '<b>Your API key was rejected.</b> It may be wrong, deleted or restricted.'; extra = btnHtml('key', 'Update API key', 'fa-key', false); break;
      case 'quota': msg = free ? `<b>Free AI limit reached.</b> ${esc(err.message)}` : '<b>Rate limit reached.</b> Gemini\'s free tier limits requests per minute and per day. Wait a minute, then try again.'; break;
      case 'model': msg = `<b>The model "${esc(Gemini.getModel())}" isn't available for your key.</b> Choose another model in the API key settings.`; extra = btnHtml('key', 'Change model', 'fa-sliders', false); break;
      case 'server': msg = free ? `<b>The free AI had a problem.</b> ${esc(err.message)}` : '<b>Gemini is busy or having problems.</b> Please try again in a moment.'; break;
      default: msg = err instanceof TypeError ? '<b>Network error.</b> Check your internet connection and try again.' : `<b>Something went wrong:</b> ${esc(err?.message || err)}`;
    }
    // Gemini failed and the student isn't signed in: point them at the free AI.
    if (!free && freeOffer() && ['auth', 'quota', 'model', 'server'].includes(err?.kind)) {
      msg += ' Or sign in with Google to use the free built-in AI instead.';
      extra += signInBtn;
    }
    showStatus('error', `<i class="fa-solid fa-circle-exclamation mr-1"></i>${msg}`, btnHtml(retryAction, 'Try again', 'fa-rotate-right', true) + extra);
  }

  /* The student's Gemini key failed in a way the free AI can cover: switch for the rest of this visit. */
  function fallBackToFree(err, prov) {
    if (prov !== 'gemini' || !FreeAI.ready() || !['auth', 'quota', 'model', 'server', 'empty', 'parse'].includes(err?.kind)) return false;
    geminiDown = true;
    const why = { auth: 'was rejected by Google', quota: 'hit its rate limit', model: "can't use any available Gemini model",
                  server: 'ran into a problem at Google', empty: 'returned nothing', parse: 'returned an unreadable answer' }[err.kind];
    modelNotice = `<i class="fa-solid fa-circle-info mr-1"></i>Your Gemini key ${why}, so these notes are being written by NCERT Notes' free built-in AI (<b>${esc(FreeAI.LABEL)}</b>).`;
    modelNoticeFrom = '';
    return true;
  }

  /* ---------- generation ---------- */
  /* Google refused the model (retired, or not offered to this key): remember it, reload the
     model list and switch to the best remaining one. Returns the new model, or null. */
  let modelNotice = '', modelNoticeFrom = '';
  async function switchModelAfter(err) {
    if (err?.kind !== 'model') return null;
    const bad = Gemini.getModel();
    const from = modelNoticeFrom || bad;   // name the model the student had chosen, not one tried in between
    modelNoticeFrom = from;
    Gemini.markBad(bad);
    let models = store.get('ncert_gemini_models') || [];
    try { models = await Gemini.listModels(Gemini.getKey()); store.set('ncert_gemini_models', models); } catch {}
    const next = Gemini.rankModels(models, Gemini.badModels())[0];
    if (!next) return null;
    Gemini.setModel(next);
    fillModels(Gemini.rankModels(models), next);
    renderSettings();
    modelNotice = `<i class="fa-solid fa-circle-info mr-1"></i>The model <b>${esc(from)}</b> isn't available for your key, so NCERT Notes switched to <b>${esc(next)}</b>. You can change it in the API key settings.`;
    return next;
  }
  function showModelNotice() {
    if (modelNotice) showStatus('success', modelNotice);
    modelNotice = ''; modelNoticeFrom = '';
  }

  async function generateOutline(attempt = 0) {
    if (busy || needKey(() => resumeReader())) return;
    const my = session, prov = provider();
    busy = true; renderToc(); renderActions();
    showStatus('loading', `<i class="fa-solid fa-spinner fa-spin mr-2"></i><b>Mapping every topic in this chapter…</b><br><span class="text-xs opacity-80">${prov === 'free'
      ? `The free built-in AI (${esc(FreeAI.LABEL)}) is splitting the chapter into parts. The first part starts right after.`
      : 'Gemini is splitting the chapter into parts. The first part starts right after.'}</span>`);
    controller = new AbortController();
    try {
      const res = prov === 'free'
        ? await FreeAI.outline({ chapterId: currentChapter.id, signal: controller.signal })
        : await Gemini.generateJSON({ system: SYSTEM, prompt: outlinePrompt(currentChapter), schema: OUTLINE_SCHEMA, signal: controller.signal });
      if (my !== session) return;
      const outline = NcertPrompts.normalizeOutline(res);
      if (!outline) {
        throw prov === 'free' ? new FreeAI.FreeAIError('The free AI returned an incomplete topic list. Please try again.', 'server')
          : new Gemini.GeminiError('Gemini returned an incomplete topic list. Please try again.', 'parse');
      }
      data = { outline, chunks: [] };
      saveData();
      busy = false; clearStatus(); renderToc();
      generateChunk(0);
    } catch (err) {
      if (my !== session) return;
      busy = false;
      if (prov === 'gemini' && attempt < 3 && err?.kind === 'model') {
        showStatus('loading', '<i class="fa-solid fa-spinner fa-spin mr-2"></i>That AI model isn\'t available for your key. Finding another one…');
        if (await switchModelAfter(err) && my === session) { generateOutline(attempt + 1); return; }
      }
      if (my !== session) return;
      if (fallBackToFree(err, prov)) { generateOutline(attempt + 1); return; }
      renderToc(); renderActions();
      modelNotice = ''; modelNoticeFrom = '';
      showError(err, 'outline');
    }
  }

  /* ---------- next part in the background ----------
     While the student reads part i, part i+1 is already being written, so
     "Generate next chunk" is instant (or already half-way). */
  let prefetch = null;
  function cancelPrefetch() { if (prefetch) { prefetch.controller.abort(); prefetch = null; } }

  function aiStream(prov, i, outline, signal, onText, onThinking) {
    return prov === 'free'
      ? FreeAI.stream({ chapterId: currentChapter.id, outline, index: i, signal, onText, onThinking })
      : Gemini.stream({ system: SYSTEM, prompt: chunkPrompt(currentChapter, outline, i), signal, onText });
  }

  function startPrefetch(i) {
    cancelPrefetch();
    if (!currentChapter || !data?.outline || i >= data.outline.length || i !== data.chunks.length) return;
    const prov = provider();
    if (!prov) return;
    const pf = { chapterId: currentChapter.id, index: i, outline: data.outline, prov, text: '', thinking: false,
                 done: false, error: null, onText: null, onThinking: null, controller: new AbortController(),
                 model: prov === 'free' ? FreeAI.MODEL : Gemini.getModel() };
    pf.promise = aiStream(prov, i, pf.outline, pf.controller.signal,
      full => { pf.text = full; if (pf.onText) pf.onText(full); },
      () => { pf.thinking = true; if (pf.onThinking) pf.onThinking(); })
      .then(r => { pf.done = true; if (prefetch === pf && !busy) renderActions(); return r; },
            e => { pf.error = e; if (prefetch === pf && !busy) renderActions(); throw e; });
    pf.promise.catch(() => {});
    prefetch = pf;
  }

  /* The background result for part i, if it's for this chapter and outline; otherwise drop it. */
  function takePrefetch(i) {
    const pf = prefetch;
    prefetch = null;
    if (pf && pf.chapterId === currentChapter?.id && pf.index === i && pf.outline === data.outline && pf.error?.name !== 'AbortError') return pf;
    if (pf) pf.controller.abort();
    return null;
  }

  async function generateChunk(i, attempt = 0) {
    if (busy || !data?.outline || i >= data.outline.length) return;
    if (needKey(() => generateChunk(i))) return;
    const my = session, prov = provider();
    busy = true; clearStatus(); renderActions();

    // Drop anything at or after i (used for "rewrite").
    data.chunks = data.chunks.slice(0, i);
    const box = $('chunksContainer');
    box.querySelectorAll('.chunk-section').forEach(s => { if (+s.id.split('-')[1] >= i) s.remove(); });
    box.insertAdjacentHTML('beforeend', chunkShell(i));
    renderToc();
    const section = $(`chunk-${i}`), body = section.querySelector('.chunk-body');
    // Tall enough to scroll to the top while it's still being written; removed when done.
    section.style.minHeight = scroller.clientHeight + 'px';
    body.classList.add('typing-caret');
    body.innerHTML = `<p class="text-sm text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Writing detailed notes for “${esc(data.outline[i].title)}”…</p>`;
    scrollNotesTo(section);

    let pending = null, frame = 0;
    const paint = () => { frame = 0; if (pending !== null) { body.innerHTML = renderMarkdown(pending); pending = null; } };

    const pf = takePrefetch(i);
    let usedProv = pf ? pf.prov : prov;
    controller = pf ? pf.controller : new AbortController();
    try {
      const onText = full => { if (my !== session) return; pending = full; if (!frame) frame = requestAnimationFrame(paint); };
      const onThinking = () => { if (my === session && pending === null && !body.querySelector('h2')) body.innerHTML = `<p class="text-sm text-slate-400"><i class="fa-solid fa-brain fa-beat-fade mr-2"></i>${esc(FreeAI.LABEL)} is writing notes on “${esc(data.outline[i].title)}”…</p>`; };
      let result;
      if (pf) {
        // Already written (or being written) in the background.
        if (pf.error) throw pf.error;
        if (pf.text) onText(pf.text); else if (pf.thinking) onThinking();
        pf.onText = onText; pf.onThinking = onThinking;
        result = await pf.promise;
      } else {
        result = await aiStream(prov, i, data.outline, controller.signal, onText, onThinking);
      }
      const { text, finishReason } = result;
      lastModel = pf ? pf.model : prov === 'free' ? FreeAI.MODEL : Gemini.getModel();
      if (my !== session) return;
      if (frame) cancelAnimationFrame(frame);
      body.classList.remove('typing-caret');
      body.innerHTML = renderMarkdown(text);
      section.style.minHeight = '';
      data.chunks[i] = text;
      saveData();
      busy = false;
      startPrefetch(i + 1);
      renderToc(); renderCommunityBanner(); renderActions();
      showModelNotice();
      if (setting('autoShare') && Cloud.user() && Cloud.community()) shareCurrent(true);
      if (finishReason === 'MAX_TOKENS') showStatus('warn', 'This part hit the AI\'s length limit and may end abruptly. Use "Rewrite" to try again.');
    } catch (err) {
      if (my !== session) return;
      if (frame) cancelAnimationFrame(frame);
      section.remove();
      busy = false;
      if (usedProv === 'gemini' && attempt < 3 && err?.kind === 'model') {
        showStatus('loading', '<i class="fa-solid fa-spinner fa-spin mr-2"></i>That AI model isn\'t available for your key. Finding another one…');
        if (await switchModelAfter(err) && my === session) { generateChunk(i, attempt + 1); return; }
      }
      if (my !== session) return;
      if (fallBackToFree(err, usedProv)) { generateChunk(i, attempt + 1); return; }
      renderToc(); renderActions();
      modelNotice = ''; modelNoticeFrom = '';
      showError(err, 'retry-chunk');
    }
  }

  /* ---------- reader events ---------- */
  $('printableNotesArea').addEventListener('click', e => {
    const b = e.target.closest('[data-action]'); if (!b) return;
    const a = b.dataset.action;
    if (a === 'next' || a === 'retry-chunk') generateChunk(data.chunks.length);
    else if (a === 'regen') generateChunk(data.chunks.length - 1);
    else if (a === 'outline') generateOutline();
    else if (a === 'key') openKeyModal(() => resumeReader());
    else if (a === 'pdf') printNotes();
    else if (a === 'share') shareCurrent(false);
    else if (a === 'unshare') unshareCurrent();
    else if (a === 'report') reportCurrent();
    else if (a === 'use-shared' && betterShared) useSharedCopy(betterShared);
    else if (a === 'own' && confirm('Generate this chapter yourself instead? The shared notes will be replaced by new ones written with your Gemini key.')) resetChapter();
  });

  $('tocList').addEventListener('click', e => {
    const b = e.target.closest('[data-toc]'); if (!b || b.disabled) return;
    const i = +b.dataset.toc;
    if (i < data.chunks.length) scrollNotesTo($(`chunk-${i}`));
    else if (i === data.chunks.length && !busy) generateChunk(i);
    if (innerWidth < 1024) $('readerSidebar').classList.replace('flex', 'hidden');
  });
  $('tocToggleBtn').addEventListener('click', () => {
    const s = $('readerSidebar');
    s.classList.contains('hidden') ? s.classList.replace('hidden', 'flex') : s.classList.replace('flex', 'hidden');
  });

  $('resetChapterBtn').addEventListener('click', () => {
    if (currentChapter && confirm('Delete the saved notes for this chapter and generate them again?')) resetChapter();
  });

  /* Delete this chapter's own copy (device + account) and generate it again with the student's key. */
  function resetChapter() {
    if (!currentChapter) return;
    if (controller) controller.abort();
    cancelPrefetch();
    session++; busy = false; loadingCloud = false; betterShared = null;
    const id = currentChapter.id;
    skipSharedFor = id;
    store.del(NOTES_KEY(id));
    const prog = store.get(PROGRESS_KEY) || {};
    delete prog[id];
    store.set(PROGRESS_KEY, prog);
    delete cloudProgress[id];
    if (Cloud.user()) trackSave(Cloud.deleteNotes(id), id);
    data = { outline: null, chunks: [] };
    renderAll(); resumeReader();
  }

  $('closeReaderBtn').addEventListener('click', closeReader);
  notesModal.addEventListener('click', e => { if (e.target === notesModal) closeReader(); });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    // Close the top-most layer first (same order as their z-index).
    if ($('authModal').classList.contains('active')) closeAuth();
    else if ($('keyModal').classList.contains('active')) closeKeyModal();
    else if ($('guideModal').classList.contains('active')) closeGuide();
    else if ($('settingsModal').classList.contains('active')) closeSettings();
    else if (notesModal.classList.contains('active')) closeReader();
  });

  function setFont(px) {
    fontSize = Math.min(21, Math.max(13, px));
    $('printableNotesArea').style.fontSize = fontSize + 'px';
    store.setRaw('ncert_font', String(fontSize));
  }
  $('fontIncrease').addEventListener('click', () => setFont(fontSize + 1));
  $('fontDecrease').addEventListener('click', () => setFont(fontSize - 1));

  function printNotes() {
    if (!data?.chunks.length) { alert('Generate at least one part of the notes first.'); return; }
    const wasDark = root.classList.contains('dark');
    root.classList.remove('dark');
    const title = document.title;
    document.title = `NCERT Class ${currentChapter.class} ${currentChapter.subject} - ${currentChapter.title}`;
    setTimeout(() => {
      window.print();
      document.title = title;
      if (wasDark) root.classList.add('dark');
    }, 50);
  }
  $('downloadPdfBtn').addEventListener('click', printNotes);

  /* ---------------- init ---------------- */
  communityReady = loadCommunity();
  updateKeyUI();
  renderAccount();
  refreshBrowser();
  // First visit with no key: show the step-by-step guide.
  // (The sign-in choice, when Supabase is set up, opens on top of it.)
  if (!Gemini.getKey() && !store.raw(GUIDE_SEEN)) openGuide();
  // Google or Supabase sent back an error after sign-in: explain it.
  const authErr = Cloud.takeRedirectError();
  if (authErr && Cloud.enabled) showAuthError(authErr);
})();
