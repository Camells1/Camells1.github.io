// Fade sections in as they scroll into view
const io = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}, { threshold: 0.12 }) : null;
document.querySelectorAll('.reveal').forEach(el => (io ? io.observe(el) : el.classList.add('in')));
// Year in the footer
document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
