(() => {
  'use strict';
  const root = document.documentElement;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const storageKey = 'junwoo-portfolio-page-navigation';
  const localPages = new Set(['index.html', 'about.html']);
  const entry = location.pathname.split('/').pop() || 'index.html';
  if (!localPages.has(entry)) return;

  root.classList.add('page-transition-ready');
  try {
    const pending = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
    sessionStorage.removeItem(storageKey);
    if (pending && pending.path === location.pathname && pending.search === location.search && Date.now() - pending.time < 15000) {
      root.classList.add('is-internal-navigation');
    }
  } catch { /* File URLs and restricted storage still support the visual transition. */ }
  const historyNavigation = performance.getEntriesByType?.('navigation')?.[0]?.type === 'back_forward';
  if (historyNavigation) root.classList.add('is-internal-navigation');
  try {
    if (document.referrer) {
      const previous = new URL(document.referrer);
      const previousPage = previous.pathname.split('/').pop() || 'index.html';
      const sameFolder = previous.pathname.slice(0, previous.pathname.lastIndexOf('/')) === location.pathname.slice(0, location.pathname.lastIndexOf('/'));
      if (previous.origin === location.origin && sameFolder && localPages.has(previousPage) && previous.pathname !== location.pathname) {
        root.classList.add('is-internal-navigation');
      }
    }
  } catch { /* A referrer is optional. */ }

  let leaving = false;
  let navigateTimer;
  let enterFrame;
  function reveal() {
    if (!document.body || document.body.classList.contains('is-loading')) return;
    if (enterFrame) cancelAnimationFrame(enterFrame);
    // Commit the starting position before making the new page visible.
    enterFrame = requestAnimationFrame(() => {
      enterFrame = requestAnimationFrame(() => root.classList.add('is-page-visible'));
    });
  }
  document.addEventListener('DOMContentLoaded', reveal, { once: true });
  addEventListener('portfolio:ready', reveal);
  addEventListener('pageshow', event => {
    clearTimeout(navigateTimer);
    leaving = false;
    root.classList.remove('is-page-leaving');
    if (event.persisted) root.classList.remove('is-page-visible');
    reveal();
  });
  // If another script fails, never leave the site's content permanently hidden.
  setTimeout(() => root.classList.add('is-page-visible'), 2400);

  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target.toLowerCase() !== '_self') || link.closest('[contenteditable]')) return;
    const target = new URL(link.href, location.href);
    const current = new URL(location.href);
    const page = target.pathname.split('/').pop() || 'index.html';
    if (target.origin !== current.origin || !localPages.has(page)) return;
    if (target.pathname.slice(0, target.pathname.lastIndexOf('/')) !== current.pathname.slice(0, current.pathname.lastIndexOf('/'))) return;
    if (target.pathname === current.pathname && target.search === current.search && target.hash) return;
    if (target.href === current.href && !document.body.classList.contains('detail-open') && (entry === 'about.html' || scrollY < 1)) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    if (leaving) return;
    leaving = true;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ path: target.pathname, search: target.search, time: Date.now() }));
    } catch { /* The transition does not require storage. */ }
    // Leave only after the outgoing page has faded away.
    const navigate = () => location.assign(target.href);
    if (reducedMotion.matches) { navigate(); return; }
    root.classList.add('is-page-leaving');
    navigateTimer = setTimeout(navigate, 260);
  });
})();
