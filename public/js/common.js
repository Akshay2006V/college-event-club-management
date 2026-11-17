// public/js/common.js -- helpers shared by every page

// ---------------------------------------------------------------------------
// Small inline icon set (stroke icons, sized in JS)
// ---------------------------------------------------------------------------
const ICON_PATHS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>',
  pin: '<path d="M12 21s-7-6.1-7-11a7 7 0 1 1 14 0c0 4.9-7 11-7 11Z"/><circle cx="12" cy="10" r="2.6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  users: '<path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20"/><circle cx="9.5" cy="7.5" r="3.5"/><path d="M17 11a3.5 3.5 0 0 0 0-7M21 20v-1.5a4 4 0 0 0-3-3.9"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  chevronLeft: '<path d="m15 5-7 7 7 7"/>',
  chevronRight: '<path d="m9 5 7 7-7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  ticket: '<path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1a3 3 0 0 0 0 4v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1a3 3 0 0 0 0-4Z"/><path d="M13 7v10" stroke-dasharray="2 3"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16Z"/><path d="m14 6 4 4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  spark: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/>',
};

function icon(name, size = 16) {
  const body = ICON_PATHS[name] || '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

// ---------------------------------------------------------------------------
// Toasts and API wrapper
// ---------------------------------------------------------------------------
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4200);
}

async function api(url, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch (err) {
    throw new Error('Cannot reach the server. Make sure it is running.');
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    throw new Error('The server returned an invalid response.');
  }

  if (!response.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------
function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// "Robotics & Innovation Club" -> "RI"
function initials(name) {
  const skip = ['and', 'of', 'the', 'for', '&'];
  const words = String(name || '')
    .replace(/[^\w\s&]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !skip.includes(w.toLowerCase()));
  return (words.slice(0, 2).map((w) => w[0]).join('') || 'EH').toUpperCase();
}

// "Social Service" -> "SocialService" (used as a colour class)
function categoryClass(category) {
  const clean = String(category || 'Other').replace(/\s+/g, '');
  const known = ['Technical', 'Cultural', 'Sports', 'Literary', 'SocialService', 'Other'];
  return `cat-${known.includes(clean) ? clean : 'Other'}`;
}

function prettyDate(value) {
  const p = dateParts(value);
  return p ? `${p.day} ${p.monthLong} ${p.year}` : '—';
}

function dateParts(value) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return {
    day: String(d.getDate()).padStart(2, '0'),
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    monthLong: d.toLocaleDateString('en-US', { month: 'short' }),
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
    year: d.getFullYear(),
    full: d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
  };
}

// "18:30" -> "6:30 PM"
function prettyTime(value) {
  if (!value) return 'Time to be announced';
  const [h, m] = String(value).split(':').map(Number);
  if (Number.isNaN(h)) return value;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(Number.isNaN(m) ? 0 : m).padStart(2, '0')} ${suffix}`;
}

function daysLeft(value) {
  const p = dateParts(value);
  if (!p) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${value}T00:00:00`);
  return Math.round((target - today) / 86400000);
}

// ---------------------------------------------------------------------------
// Page shell helpers
// ---------------------------------------------------------------------------
function markActiveNav() {
  let current = window.location.pathname.split('/').pop();
  if (!current) current = 'index.html';
  document.querySelectorAll('.nav-links a').forEach((link) => {
    const raw = link.getAttribute('href') || '';
    if (raw.includes('#')) return; // in-page links are not section highlights
    if (raw === current) link.classList.add('active');
  });
}

function qsParam(name) {
  return new URLSearchParams(window.location.search).get(name) || '';
}

// Enable the arrow buttons on each horizontal shelf once its content is in.
function wireShelfArrows() {
  document.querySelectorAll('.row-wrap').forEach((wrap) => {
    const row = wrap.querySelector('.hrow');
    if (!row) return;
    const sync = () => wrap.classList.toggle('no-scroll', row.scrollWidth <= row.clientWidth + 4);
    wrap.querySelectorAll('.row-arrow').forEach((btn) => {
      btn.addEventListener('click', () => {
        const direction = btn.classList.contains('prev') ? -1 : 1;
        row.scrollBy({ left: direction * Math.max(row.clientWidth * 0.8, 300), behavior: 'smooth' });
      });
    });
    row.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    sync();
    setTimeout(sync, 60);
  });
}

// ---------------------------------------------------------------------------
// Form helpers (validation never depends on the browser's HTML validation)
// ---------------------------------------------------------------------------
function setFieldError(input, message) {
  const errorEl = document.getElementById(`${input.id}-error`);
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.add('show');
  }
  input.classList.add('invalid');
}

function clearFieldErrors(form) {
  form.querySelectorAll('.form-control').forEach((el) => el.classList.remove('invalid'));
  form.querySelectorAll('.field-error').forEach((el) => {
    el.textContent = '';
    el.classList.remove('show');
  });
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function confirmAction(message) {
  return window.confirm(message);
}

// Close any open modal with Escape or a click on the dark backdrop.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  document.querySelectorAll('.modal-overlay.open').forEach((modal) => modal.classList.remove('open'));
});

document.addEventListener('DOMContentLoaded', markActiveNav);
