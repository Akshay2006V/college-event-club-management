// public/js/dashboard.js -- home page: billboard, stats, shelves and quick registration
let homeEvents = [];
let homeClubs = [];

document.addEventListener('DOMContentLoaded', () => {
  loadHome();

  document.getElementById('home-reg-close').addEventListener('click', closeHomeRegister);
  document.getElementById('home-reg-cancel').addEventListener('click', closeHomeRegister);
  document.getElementById('home-register-modal').addEventListener('click', (e) => {
    if (e.target.id === 'home-register-modal') closeHomeRegister();
  });
  document.getElementById('home-register-form').addEventListener('submit', submitHomeRegistration);
  document.getElementById('upcoming-row').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-register]');
    if (btn) openHomeRegister(btn.dataset.register);
  });

  // Search from the home page jumps to the event listing.
  document.getElementById('global-search').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const q = e.target.value.trim();
    window.location.href = q ? `events.html?q=${encodeURIComponent(q)}` : 'events.html';
  });
});

async function loadHome() {
  try {
    const [summary, events, clubs] = await Promise.all([
      api('/api/dashboard'),
      api('/api/events'),
      api('/api/clubs'),
    ]);

    homeEvents = events;
    homeClubs = clubs;

    document.getElementById('stat-clubs').textContent = summary.totalClubs;
    document.getElementById('stat-events').textContent = summary.totalEvents;
    document.getElementById('stat-registrations').textContent = summary.totalRegistrations;

    const today = new Date().toISOString().slice(0, 10);
    const upcoming = events
      .filter((e) => e.date >= today && e.status !== 'Completed')
      .sort((a, b) => a.date.localeCompare(b.date));
    document.getElementById('stat-upcoming').textContent = upcoming.length;

    const featured = [...upcoming].sort(
      (a, b) => (b.registrations || 0) - (a.registrations || 0) || a.date.localeCompare(b.date)
    )[0] || events[0];

    renderBillboard(featured);
    renderUpcoming(upcoming);
    renderClubs(clubs);
    wireShelfArrows();
  } catch (err) {
    document.getElementById('upcoming-row').innerHTML =
      `<div class="state">${escapeHtml(err.message)}</div>`;
    document.getElementById('clubs-row').innerHTML =
      `<div class="state">Could not load clubs right now.</div>`;
    showToast(err.message, 'error');
  }
}

function renderBillboard(event) {
  if (!event) return;
  const p = dateParts(event.date);
  const club = event.club ? event.club.name : 'Campus event';
  const registered = event.registrations || 0;
  const seatsLeft = Math.max((event.capacity || 0) - registered, 0);

  document.getElementById('bb-title').textContent = event.title;
  document.getElementById('bb-desc').textContent =
    event.description || 'A campus event organised by the students of the college.';
  document.getElementById('bb-meta').innerHTML = `
    <span class="mi">${icon('calendar')} <b>${p ? p.full : prettyDate(event.date)}</b></span>
    <span class="sep">·</span>
    <span class="mi">${icon('clock')} <b>${prettyTime(event.time)}</b></span>
    <span class="sep">·</span>
    <span class="mi">${icon('pin')} <b>${escapeHtml(event.venue)}</b></span>
    <span class="sep">·</span>
    <span class="mi">${icon('users')} <b>${registered}</b> registered</span>`;

  document.getElementById('bb-label').textContent = club;
  document.getElementById('bb-day').textContent = p ? p.day : '–';
  document.getElementById('bb-month').textContent = p ? p.month : '';
  document.getElementById('bb-poster-title').textContent = event.title;
  document.getElementById('bb-poster-foot').innerHTML =
    `${prettyTime(event.time)} · ${escapeHtml(event.venue)}<br>${registered} registered · ${seatsLeft} seats left`;

  const registerBtn = document.getElementById('bb-register');
  if (seatsLeft === 0 || event.status === 'Completed') {
    registerBtn.disabled = true;
    registerBtn.textContent = seatsLeft === 0 ? 'Event full' : 'Registrations closed';
    registerBtn.onclick = null;
  } else {
    registerBtn.disabled = false;
    registerBtn.textContent = 'Register now';
    registerBtn.onclick = () => openHomeRegister(event._id);
  }
}

function renderUpcoming(upcoming) {
  const row = document.getElementById('upcoming-row');
  if (!upcoming.length) {
    row.innerHTML = '<div class="state">No upcoming events yet. <a href="events.html">Add one from the events page.</a></div>';
    return;
  }

  row.innerHTML = upcoming.map((event) => {
    const p = dateParts(event.date);
    const club = event.club || {};
    const registered = event.registrations || 0;
    const capacity = event.capacity || 0;
    const left = Math.max(capacity - registered, 0);
    const pct = capacity ? Math.min(Math.round((registered / capacity) * 100), 100) : 0;
    const closed = left === 0 || event.status === 'Completed';

    return `
      <article class="event-card ${categoryClass(club.category)}">
        <div class="event-cover" data-initials="${escapeHtml(initials(club.name || event.title))}">
          <div class="cover-date">${p ? p.day : '–'}<small>${p ? p.month : ''}</small></div>
          <span class="status ${escapeHtml(event.status)}">${escapeHtml(event.status)}</span>
        </div>
        <div class="card-body">
          <h3>${escapeHtml(event.title)}</h3>
          <p class="card-club">${escapeHtml(club.name || 'Campus event')}</p>
          <div class="card-meta">
            <span>${icon('clock', 13)} ${prettyTime(event.time)}</span>
            <span>${icon('pin', 13)} ${escapeHtml(event.venue)}</span>
          </div>
          <div class="seats">
            <div class="row"><span>${registered} registered</span><span>${left} left</span></div>
            <div class="bar"><i class="${closed ? 'full' : ''}" style="width:${pct}%"></i></div>
          </div>
        </div>
        <div class="card-foot">
          <span class="left">${capacity} seats</span>
          ${closed
            ? '<span class="left">Sold out</span>'
            : `<button class="link-btn" type="button" data-register="${event._id}">Register →</button>`}
        </div>
      </article>`;
  }).join('');
}

function renderClubs(clubs) {
  const row = document.getElementById('clubs-row');
  if (!clubs.length) {
    row.innerHTML = '<div class="state">No clubs yet. <a href="clubs.html">Add the first club.</a></div>';
    return;
  }

  row.innerHTML = clubs.map((club) => `
    <a class="club-mini ${categoryClass(club.category)}" href="clubs.html">
      <span class="mono">${escapeHtml(initials(club.name))}</span>
      <div class="club-mini-text">
        <h4>${escapeHtml(club.name)}</h4>
        <p>${escapeHtml(club.category)} · ${club.members || 0} members</p>
      </div>
      <span class="go" aria-hidden="true">${icon('chevronRight', 15)}</span>
    </a>`).join('');
}

// ---------------------------------------------------------------------------
// Quick registration from the home page
// ---------------------------------------------------------------------------
function openHomeRegister(id) {
  const event = homeEvents.find((e) => e._id === id);
  if (!event) return;

  const p = dateParts(event.date);
  const left = Math.max((event.capacity || 0) - (event.registrations || 0), 0);
  if (left === 0) {
    showToast('This event is full. No more registrations accepted.', 'error');
    return;
  }

  document.getElementById('home-register-event-id').value = event._id;
  document.getElementById('home-reg-day').textContent = p ? p.day : '–';
  document.getElementById('home-reg-month').textContent = p ? p.month : '';
  document.getElementById('home-reg-name').textContent = event.title;
  document.getElementById('home-reg-meta').textContent =
    `${prettyDate(event.date)} · ${prettyTime(event.time)} · ${event.venue}`;

  const form = document.getElementById('home-register-form');
  form.reset();
  clearFieldErrors(form);
  document.getElementById('home-register-modal').classList.add('open');
  document.getElementById('home-participant-name').focus();
}

function closeHomeRegister() {
  document.getElementById('home-register-modal').classList.remove('open');
}

async function submitHomeRegistration(e) {
  e.preventDefault();
  const form = document.getElementById('home-register-form');
  clearFieldErrors(form);

  const name = document.getElementById('home-participant-name').value.trim();
  const email = document.getElementById('home-participant-email').value.trim();
  let ok = true;
  if (!name) {
    setFieldError(document.getElementById('home-participant-name'), 'Name is required.');
    ok = false;
  }
  if (!email) {
    setFieldError(document.getElementById('home-participant-email'), 'Email is required.');
    ok = false;
  } else if (!isEmail(email)) {
    setFieldError(document.getElementById('home-participant-email'), 'Enter a valid email.');
    ok = false;
  }
  if (!ok) return;

  const id = document.getElementById('home-register-event-id').value;
  const btn = document.getElementById('home-reg-submit');
  btn.disabled = true;
  try {
    const result = await api(`/api/events/${id}/register`, {
      method: 'POST',
      body: JSON.stringify({ name, email }),
    });
    showToast(result.message, 'success');
    closeHomeRegister();
    await loadHome();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}
