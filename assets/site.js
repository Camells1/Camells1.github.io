// Fade sections in as they scroll into view
const io = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}, { threshold: 0.12 }) : null;
document.querySelectorAll('.reveal').forEach(el => (io ? io.observe(el) : el.classList.add('in')));
// Year in the footer
document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });

// Mark the nav tab for the page you are on
(function () {
  let here = location.pathname.replace(/index\.html$/, '');
  // a game page, or a browser build, counts as being under Games
  if (/^\/(play\/|riftline\/|shattercrown\/|hollowtide\/|dontwakegrandpa\/|nightshiftzoo\/)/.test(here)) here = '/games/';
  const norm = p => { try { return new URL(p, location.href).pathname.replace(/index\.html$/, ''); } catch (e) { return p; } };
  document.querySelectorAll('.nav .links a[href]').forEach(a => {
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || /^(https?:|mailto:)/.test(href)) return;
    const path = norm(href);
    const match = path === '/' ? here === '/' : here === path || here.startsWith(path);
    if (match) a.setAttribute('aria-current', 'page');
  });
})();

// Mobile menu
(function () {
  const burger = document.querySelector('[data-burger]');
  const links = document.querySelector('[data-links]');
  if (!burger || !links) return;
  const close = () => { links.removeAttribute('data-open'); burger.setAttribute('aria-expanded', 'false'); };
  burger.addEventListener('click', () => {
    const open = links.hasAttribute('data-open');
    if (open) close();
    else { links.setAttribute('data-open', ''); burger.setAttribute('aria-expanded', 'true'); }
  });
  links.addEventListener('click', e => { if (e.target.closest('a')) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  window.addEventListener('resize', () => { if (window.innerWidth > 900) close(); });
})();

// Highlight the section you are reading in a game page's sub-nav
(function () {
  const bar = document.querySelector('.subnav');
  if (!bar || !('IntersectionObserver' in window)) return;
  const links = [...bar.querySelectorAll('a[href^="#"]')];
  const map = new Map();
  links.forEach(a => { const el = document.getElementById(a.getAttribute('href').slice(1)); if (el) map.set(el, a); });
  if (!map.size) return;
  const seen = new Set();
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => e.isIntersecting ? seen.add(e.target) : seen.delete(e.target));
    let top = null;
    for (const el of map.keys()) if (seen.has(el)) { top = el; break; }
    links.forEach(a => a.classList.remove('sel'));
    if (top) map.get(top).classList.add('sel');
  }, { rootMargin: '-120px 0px -65% 0px' });
  map.forEach((a, el) => obs.observe(el));
})();
