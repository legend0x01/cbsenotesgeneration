/* Fills in the public contact email on the Privacy Policy and Terms pages from js/config.js. */
(() => {
  const email = (window.NCERT_CONFIG && window.NCERT_CONFIG.contactEmail || '').trim();
  document.querySelectorAll('[data-contact]').forEach(el => {
    if (email) {
      const a = document.createElement('a');
      a.href = 'mailto:' + email;
      a.textContent = email;
      el.replaceChildren(a);
    } else {
      el.textContent = 'contact details coming soon.';
    }
  });
})();
