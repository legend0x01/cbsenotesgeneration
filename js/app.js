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
    const badge = !p ? `<span class="text-[11px] font-semibold text-slate-400"><i class="fa-solid fa-wand-magic-sparkles mr-1"></i>Generate notes</span>`
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
    $('noKeyBanner').classList.toggle('hidden', has);
    $('keyRemoveBtn').classList.toggle('hidden', !has);
  }

  function setKeyStatus(msg, kind) {
    const el = $('keyStatus');
    el.className = 'text-xs min-h-[1rem] ' + ({ ok: 'text-emerald-600 dark:text-emerald-400', err: 'text-rose-600 dark:text-rose-400', info: 'text-slate-500' }[kind] || '');
    el.innerHTML = msg;
  }

  function fillModels(models, selected) {
    const sel = $('modelSelect');
    sel.innerHTML = models.map(m => `<option value="${esc(m)}" ${m === selected ? 'selected' : ''}>${esc(m)}</option>`).join('');
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
      Gemini.setKey(key);
      store.set('ncert_gemini_models', models);
      const current = Gemini.getModel();
      const model = models.includes(current) ? current : Gemini.pickBestModel(models);
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
    step.classList.toggle('hidden', !Cloud.enabled);
    if (!Cloud.enabled) return;
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
    $('signinBanner').classList.toggle('hidden', !Cloud.enabled || !!Cloud.user());
    if (!Cloud.enabled) { area.classList.add('hidden'); return; }
    area.classList.remove('hidden');
    const p = Cloud.profile();
    if (!p) {
      area.innerHTML = `<button data-signin title="Sign in with Google to save your notes" class="google-btn !px-3 !py-2 !rounded-full !text-xs"><i class="fa-brands fa-google"></i><span class="hidden sm:inline">Sign in</span></button>`;
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
    if (!Cloud.enabled) { el.className = 'hidden'; return; }
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
    try {
      if (currentChapter) sessionStorage.setItem(RETURN_KEY, currentChapter.id);
      await Cloud.signIn();   // redirects to Google
    } catch (err) {
      alert('Could not start Google sign-in: ' + (err?.message || err));
    }
  }

  document.addEventListener('click', async e => {
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

  Cloud.onChange(async u => {
    renderAccount(); renderGuide();
    if (!u) {
      cloudProgress = {};
      if (currentChapter) setSync('local');
      renderChapters();
      return;
    }
    if (currentChapter) setSync('saved');
    await syncAccount();
    const back = sessionStorage.getItem(RETURN_KEY);
    if (back) { sessionStorage.removeItem(RETURN_KEY); if (!currentChapter) openReader(back); }
    else if (currentChapter && !busy) loadFromCloud();
  });

  function pushToCloud(id, record) {
    if (!Cloud.user()) return;
    setSync('saving');
    Cloud.saveNotes(id, record)
      .then(() => {
        const isNew = !cloudProgress[id];
        if (record.outline) cloudProgress[id] = [record.chunks.length, record.outline.length];
        if (isNew) renderAccount();
        if (currentChapter?.id === id) setSync('saved');
      })
      .catch(err => { console.warn('Cloud save failed', err); if (currentChapter?.id === id) setSync('error'); });
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
    resumeReader();
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
   * PROMPTS
   * ================================================================ */
  const SYSTEM = `You are an expert CBSE teacher and NCERT subject specialist who writes outstanding, accurate study notes for Indian school students.
Follow the latest rationalised NCERT textbook closely: its order, terminology, definitions, laws, examples, activities, boxes and in-text questions.
Accuracy is critical. Never invent facts, data, dates or formulas. If something is not in NCERT, keep it brief and clearly mark it as extra.
Write in clear, simple English that a student of that class can follow, but go deep: explain the why and the how, not just the what.
Formatting rules (Markdown):
- Use LaTeX for every formula and equation: $...$ inline and $$...$$ on its own line. Use \\ce{...} for chemical formulas and equations.
- Use tables for comparisons, differences and classifications.
- Use "> **Exam Tip:**", "> **Remember:**" and "> **Common Mistake:**" callouts where useful.
- Describe important diagrams in words, naming every labelled part.
- No preamble such as "Sure" or "Here are the notes".`;

  function chapterRef(ch) {
    return `NCERT Class ${ch.class} ${ch.subject}, book "${ch.book}", ${chapterLabel(ch)}: "${ch.title}"`;
  }
  const isLiterature = ch => ch.subject === 'English';

  function outlinePrompt(ch) {
    const lit = isLiterature(ch);
    return `Create a complete topic map for ${chapterRef(ch)}.
Split the WHOLE ${ch.isPoem ? 'poem' : 'chapter'} into ${lit ? (ch.isPoem ? '3 to 5' : '4 to 6') : '6 to 10'} sequential study parts, in the textbook's order, so that together they cover ${lit
      ? 'everything a student needs: about the author/poet and background, a detailed summary, a section-by-section (or stanza-by-stanza) explanation with difficult words, characters, themes, message, literary devices, and all textbook questions with answers'
      : 'every section, sub-section, concept, definition, law, formula, derivation, solved example, activity and box item in the chapter'}.
Each part must group closely related topics that can be explained in depth in about 1200 to 1800 words.
The final part must be titled "Chapter Summary, Key Points & Exam Practice".
For each part give a short title and the list of topics it covers (use the textbook's section names where possible).`;
  }

  const OUTLINE_SCHEMA = {
    type: 'OBJECT',
    properties: {
      chunks: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: { title: { type: 'STRING' }, topics: { type: 'ARRAY', items: { type: 'STRING' } } },
          required: ['title', 'topics']
        }
      }
    },
    required: ['chunks']
  };

  function chunkPrompt(ch, outline, i) {
    const map = outline.map((c, k) => `${k + 1}. ${c.title}: ${c.topics.join('; ')}`).join('\n');
    const part = outline[i];
    const last = i === outline.length - 1;
    const lit = isLiterature(ch);
    return `Chapter: ${chapterRef(ch)}

Full topic map of the chapter:
${map}

${i > 0 ? `Parts 1 to ${i} have already been written. Do not repeat them; you may refer back briefly.\n` : ''}Now write PART ${i + 1} of ${outline.length}: "${part.title}".
Cover exactly these topics, in this order: ${part.topics.join('; ')}.

Requirements:
- Begin with the heading "## Part ${i + 1}: ${part.title}".
- Use a "###" heading for each topic.
${last ? `- Give a complete chapter summary, all key terms/definitions${lit ? '' : ' and every formula'} in one place, then exam practice: MCQs, short-answer, long-answer${lit ? ' and extract-based' : ''} questions in CBSE board pattern, each with a model answer.`
      : lit ? `- Explain in great detail with quotes from the text, meanings of difficult words, interpretation, characters, themes and literary devices as relevant.
- Answer any textbook questions related to this part.`
      : `- Explain every concept from the basics in great detail: what it is, why it happens, how it works. Put NCERT definitions in **bold**.
- Give every relevant formula with each symbol and its SI unit explained, and step-by-step derivations where NCERT has them.
- Include fully worked examples (NCERT examples and similar exam questions) for any numerical or problem-solving topic.
- Add real-life examples, comparison tables and exam tips where they help.`}
- End with "### Quick Revision" (bullet points) ${last ? '' : 'and "### Check Your Understanding" (3 to 5 questions with short answers)'}.`;
  }

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
    data.model = Gemini.getModel();
    data.updated = Date.now();
    const record = { outline: data.outline, chunks: data.chunks.slice(), model: data.model, updated: data.updated };
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
    renderAll();
    if (Cloud.user()) loadFromCloud(); else resumeReader();
  }

  function closeReader() {
    session++;
    if (controller) controller.abort();
    controller = null; busy = false;
    notesModal.classList.remove('active');
    document.body.classList.remove('reader-locked');
    currentChapter = null; data = null;
    renderChapters();
  }

  /* Decide what to do next for the open chapter. */
  function resumeReader() {
    if (!currentChapter || busy || loadingCloud) return;
    if (!Gemini.getKey()) {
      showNeedKey();
      if (!store.raw(GUIDE_SEEN)) openGuide(() => resumeReader()); else openKeyModal(() => resumeReader());
      return;
    }
    if (!data.outline) generateOutline();
    else if (data.chunks.length === 0) generateChunk(0);
    else renderActions();
  }

  /* ---------- rendering ---------- */
  function renderAll() { renderToc(); renderChunks(); renderActions(); clearStatus(); }

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
    const nudge = Cloud.enabled && !Cloud.user() && done > 0
      ? `<p class="text-xs text-slate-500 dark:text-slate-400 text-center"><i class="fa-solid fa-cloud-arrow-up mr-1 text-emerald-500"></i>These notes are only on this device. <button data-signin class="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Sign in with Google</button> to keep them on every device.</p>` : '';
    const regen = (done > 0 ? `<button data-action="regen" class="text-xs font-semibold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition"><i class="fa-solid fa-rotate-right mr-1"></i>Rewrite part ${done}</button>` : '') + nudge;
    if (done < n) {
      el.innerHTML = `
        <button data-action="next" class="group w-full max-w-xl flex items-center justify-between gap-4 px-6 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-500 text-white shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 transition active:scale-[.98]">
          <span class="text-left">
            <span class="block text-[11px] font-bold uppercase tracking-widest opacity-80">Generate next chunk · Part ${done + 1} of ${n}</span>
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
      warn: 'border-amber-200 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300'
    };
    $('readerStatus').innerHTML = `<div class="my-6 p-4 rounded-2xl border text-sm ${styles[kind]}">
      <div>${html}</div>${buttons ? `<div class="mt-3 flex flex-wrap gap-2">${buttons}</div>` : ''}</div>`;
  }
  function clearStatus() { $('readerStatus').innerHTML = ''; }
  const btnHtml = (action, label, icon, primary) =>
    `<button data-action="${action}" class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${primary
      ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-indigo-400'}"><i class="fa-solid ${icon}"></i>${label}</button>`;

  function showNeedKey() {
    showStatus('warn', `<b>Add your Gemini API key</b> to generate notes for this chapter. It's free and takes about a minute.`,
      btnHtml('key', 'Add API key', 'fa-key', true));
  }

  function showError(err, retryAction) {
    if (err?.name === 'AbortError') return;
    let msg, extra = '';
    switch (err?.kind) {
      case 'auth': msg = '<b>Your API key was rejected.</b> It may be wrong, deleted or restricted.'; extra = btnHtml('key', 'Update API key', 'fa-key', false); break;
      case 'quota': msg = '<b>Rate limit reached.</b> Gemini\'s free tier limits requests per minute and per day. Wait a minute, then try again.'; break;
      case 'model': msg = `<b>The model "${esc(Gemini.getModel())}" isn't available for your key.</b> Choose another model in the API key settings.`; extra = btnHtml('key', 'Change model', 'fa-sliders', false); break;
      case 'server': msg = '<b>Gemini is busy or having problems.</b> Please try again in a moment.'; break;
      default: msg = err instanceof TypeError ? '<b>Network error.</b> Check your internet connection and try again.' : `<b>Something went wrong:</b> ${esc(err?.message || err)}`;
    }
    showStatus('error', `<i class="fa-solid fa-circle-exclamation mr-1"></i>${msg}`, btnHtml(retryAction, 'Try again', 'fa-rotate-right', true) + extra);
  }

  /* ---------- generation ---------- */
  async function generateOutline() {
    const my = session;
    busy = true; renderToc(); renderActions();
    showStatus('loading', `<i class="fa-solid fa-spinner fa-spin mr-2"></i><b>Mapping every topic in this chapter…</b><br><span class="text-xs opacity-80">Gemini is splitting the chapter into parts. The first part starts right after.</span>`);
    controller = new AbortController();
    try {
      const res = await Gemini.generateJSON({ system: SYSTEM, prompt: outlinePrompt(currentChapter), schema: OUTLINE_SCHEMA, signal: controller.signal });
      if (my !== session) return;
      const outline = (res.chunks || [])
        .filter(c => c && c.title)
        .map(c => ({ title: String(c.title).trim(), topics: (c.topics || []).map(t => String(t).trim()).filter(Boolean) }));
      if (outline.length < 2) throw new Gemini.GeminiError('Gemini returned an incomplete topic list. Please try again.', 'parse');
      data = { outline, chunks: [] };
      saveData();
      busy = false; clearStatus(); renderToc();
      generateChunk(0);
    } catch (err) {
      if (my !== session) return;
      busy = false; renderToc(); renderActions();
      showError(err, 'outline');
    }
  }

  async function generateChunk(i) {
    if (busy || !data?.outline || i >= data.outline.length) return;
    const my = session;
    busy = true; clearStatus(); renderActions();

    // Drop anything at or after i (used for "rewrite").
    data.chunks = data.chunks.slice(0, i);
    const box = $('chunksContainer');
    box.querySelectorAll('.chunk-section').forEach(s => { if (+s.id.split('-')[1] >= i) s.remove(); });
    box.insertAdjacentHTML('beforeend', chunkShell(i));
    renderToc();
    const section = $(`chunk-${i}`), body = section.querySelector('.chunk-body');
    body.classList.add('typing-caret');
    body.innerHTML = `<p class="text-sm text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Writing detailed notes for “${esc(data.outline[i].title)}”…</p>`;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });

    let pending = null, frame = 0;
    const paint = () => { frame = 0; if (pending !== null) { body.innerHTML = renderMarkdown(pending); pending = null; } };

    controller = new AbortController();
    try {
      const { text, finishReason } = await Gemini.stream({
        system: SYSTEM, prompt: chunkPrompt(currentChapter, data.outline, i), signal: controller.signal,
        onText: full => { if (my !== session) return; pending = full; if (!frame) frame = requestAnimationFrame(paint); }
      });
      if (my !== session) return;
      if (frame) cancelAnimationFrame(frame);
      body.classList.remove('typing-caret');
      body.innerHTML = renderMarkdown(text);
      data.chunks[i] = text;
      saveData();
      busy = false; renderToc(); renderActions();
      if (finishReason === 'MAX_TOKENS') showStatus('warn', 'This part hit Gemini\'s length limit and may end abruptly. Use "Rewrite" to try again.');
    } catch (err) {
      if (my !== session) return;
      if (frame) cancelAnimationFrame(frame);
      section.remove();
      busy = false; renderToc(); renderActions();
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
  });

  $('tocList').addEventListener('click', e => {
    const b = e.target.closest('[data-toc]'); if (!b || b.disabled) return;
    const i = +b.dataset.toc;
    if (i < data.chunks.length) $(`chunk-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else if (i === data.chunks.length && !busy) generateChunk(i);
    if (innerWidth < 1024) $('readerSidebar').classList.replace('flex', 'hidden');
  });
  $('tocToggleBtn').addEventListener('click', () => {
    const s = $('readerSidebar');
    s.classList.contains('hidden') ? s.classList.replace('hidden', 'flex') : s.classList.replace('flex', 'hidden');
  });

  $('resetChapterBtn').addEventListener('click', () => {
    if (!currentChapter || !confirm('Delete the saved notes for this chapter and generate them again?')) return;
    if (controller) controller.abort();
    session++; busy = false; loadingCloud = false;
    const id = currentChapter.id;
    store.del(NOTES_KEY(id));
    const prog = store.get(PROGRESS_KEY) || {};
    delete prog[id];
    store.set(PROGRESS_KEY, prog);
    delete cloudProgress[id];
    if (Cloud.user()) {
      setSync('saving');
      Cloud.deleteNotes(id).then(() => setSync('saved')).catch(() => setSync('error'));
    }
    data = { outline: null, chunks: [] };
    renderAll(); resumeReader();
  });

  $('closeReaderBtn').addEventListener('click', closeReader);
  notesModal.addEventListener('click', e => { if (e.target === notesModal) closeReader(); });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if ($('guideModal').classList.contains('active')) closeGuide();
    else if ($('keyModal').classList.contains('active')) closeKeyModal();
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
  updateKeyUI();
  renderAccount();
  refreshBrowser();
  // First visit with no key: show the step-by-step guide.
  if (!Gemini.getKey() && !store.raw(GUIDE_SEEN)) openGuide();
})();
