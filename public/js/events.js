// public/js/events.js -- event listing, filters, search, CRUD and registrations
let allEvents = [];
let eventClubs = [];
let activeStatus = 'All';
let eventQuery = '';

document.addEventListener('DOMContentLoaded', () => {
  Promise.all([loadEvents(), loadClubs()]);

  document.getElementById('add-event-btn').addEventListener('click', () => openModal());
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('cancel-btn').addEventListener('click', closeModal);
  document.getElementById('event-modal').addEventListener('click', (e) => {
    if (e.target.id === 'event-modal') closeModal();
  });
  document.getElementById('event-form').addEventListener('submit', saveEvent);

  document.querySelectorAll('[data-status]').forEach((chip) => {
    chip.addEventListener('click', () => {
      activeStatus = chip.dataset.status;
      document.querySelectorAll('[data-status]').forEach((c) => c.classList.toggle('active', c === chip));
      renderEvents();
    });
  });

  const search = document.getElementById('global-search');
  const initial = qsParam('q');
  if (initial) {
    search.value = initial;
    eventQuery = initial;
  }
  search.addEventListener('input', () => {
    eventQuery = search.value.trim();
    renderEvents();
  });

  document.getElementById('reg-close').addEventListener('click', closeRegister);
  document.getElementById('reg-cancel-btn').addEventListener('click', closeRegister);
  document.getElementById('register-modal').addEventListener('click', (e) => {
    if (e.target.id === 'register-modal') closeRegister();
  });
  document.getElementById('register-form').addEventListener('submit', submitRegistration);
});

async function loadEvents() {
  const wrap = document.getElementById('events-wrap');
  try {
    allEvents = await api('/api/events');
    renderEvents();
  } catch (err) {
    wrap.innerHTML = `<div class="state">${escapeHtml(err.message)}</div>`;
    showToast(err.message, 'error');
  }
}

async function loadClubs() {
  try {
    eventClubs = await api('/api/clubs');
    const select = document.getElementById('clubId');
    select.innerHTML = '<option value="">Select a club</option>' +
      eventClubs.map((c) => `<option value="${c._id}">${escapeHtml(c.name)}</option>`).join('');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderEvents() {
  const wrap = document.getElementById('events-wrap');
  const needle = eventQuery.toLowerCase();
  const list = allEvents.filter((event) => {
    if (activeStatus !== 'All' && event.status !== activeStatus) return false;
    if (!needle) return true;
    const haystack = [
      event.title,
      event.venue,
      event.description,
      event.status,
      event.club ? event.club.name : '',
    ].join(' ').toLowerCase();
    return haystack.includes(needle);
  });

  document.getElementById('event-count').textContent =
    list.length === allEvents.length ? `${allEvents.length} events` : `${list.length} of ${allEvents.length} events`;

  if (!list.length) {
    wrap.innerHTML = allEvents.length
      ? '<div class="state">No events match this view. Try another search or status.</div>'
      : '<div class="state">No events yet. Use <b>Add event</b> to publish the first one.</div>';
    return;
  }

  wrap.innerHTML = list.map((event) => {
    const p = dateParts(event.date);
    const club = event.club || {};
    const registered = event.registrations || 0;
    const capacity = event.capacity || 0;
    const left = Math.max(capacity - registered, 0);
    const pct = capacity ? Math.min(Math.round((registered / capacity) * 100), 100) : 0;
    const full = left === 0;
    const closed = full || event.status === 'Completed';
    const label = full ? 'Sold out' : event.status === 'Completed' ? 'Closed' : 'Register';

    return `
      <article class="event-row">
        <div class="date-tile ${event.status === 'Completed' ? 'closed' : ''}">
          <span class="d">${p ? p.day : '–'}</span>
          <span class="m">${p ? p.month : ''}</span>
        </div>
        <div class="event-body">
          <div class="event-title-row">
            <h3>${escapeHtml(event.title)}</h3>
            <span class="status ${escapeHtml(event.status)}">${escapeHtml(event.status)}</span>
          </div>
          <div class="event-sub">
            Organised by <b>${escapeHtml(club.name || 'Unknown club')}</b>
            &nbsp;·&nbsp; ${icon('clock', 12)} ${prettyTime(event.time)}
            &nbsp;·&nbsp; ${icon('pin', 12)} ${escapeHtml(event.venue)}
          </div>
          <p class="event-desc">${escapeHtml(event.description || 'No description provided.')}</p>
          <div class="event-bottom">
            <div class="seat-meter">
              <div class="lbl">
                <span>${registered} / ${capacity} seats filled</span>
                <span>${left} left</span>
              </div>
              <div class="bar"><i class="${full ? 'full' : ''}" style="width:${pct}%"></i></div>
            </div>
            <div class="event-actions">
              <button class="btn ${closed ? 'btn-outline' : 'btn-primary'} btn-sm" type="button" onclick="openRegister('${event._id}')" ${closed ? 'disabled' : ''}>${label}</button>
              <button class="btn btn-outline btn-sm" type="button" onclick="editEvent('${event._id}')">Edit</button>
              <button class="btn btn-danger btn-sm" type="button" onclick="deleteEvent('${event._id}')">Delete</button>
            </div>
          </div>
        </div>
      </article>`;
  }).join('');
}

function openModal(event) {
  const form = document.getElementById('event-form');
  form.reset();
  clearFieldErrors(form);
  document.getElementById('event-id').value = event ? event._id : '';
  document.getElementById('modal-title').textContent = event ? 'Edit event' : 'Add event';
  document.getElementById('save-btn').textContent = event ? 'Update event' : 'Save event';

  if (event) {
    document.getElementById('title').value = event.title || '';
    document.getElementById('clubId').value = event.clubId || '';
    document.getElementById('date').value = event.date || '';
    document.getElementById('time').value = event.time || '';
    document.getElementById('venue').value = event.venue || '';
    document.getElementById('capacity').value = event.capacity || '';
    document.getElementById('status').value = event.status || 'Upcoming';
    document.getElementById('description').value = event.description || '';
  } else {
    document.getElementById('date').value = new Date().toISOString().slice(0, 10);
  }
  document.getElementById('event-modal').classList.add('open');
  document.getElementById('title').focus();
}

function closeModal() { document.getElementById('event-modal').classList.remove('open'); }

function editEvent(id) {
  const event = allEvents.find((e) => e._id === id);
  if (event) openModal(event);
}

// JavaScript validation -- does not rely on browser HTML validation.
function validateEventForm() {
  const form = document.getElementById('event-form');
  clearFieldErrors(form);
  let ok = true;

  const title = document.getElementById('title').value.trim();
  const clubId = document.getElementById('clubId').value;
  const date = document.getElementById('date').value;
  const venue = document.getElementById('venue').value.trim();
  const capacity = Number(document.getElementById('capacity').value);

  if (!title) { setFieldError(document.getElementById('title'), 'Event title is required.'); ok = false; }
  if (!clubId) { setFieldError(document.getElementById('clubId'), 'Select an organising club.'); ok = false; }
  if (!date) { setFieldError(document.getElementById('date'), 'Event date is required.'); ok = false; }
  else if (Number.isNaN(Date.parse(date))) { setFieldError(document.getElementById('date'), 'Enter a valid date.'); ok = false; }
  if (!venue) { setFieldError(document.getElementById('venue'), 'Venue is required.'); ok = false; }
  if (!capacity || capacity <= 0) { setFieldError(document.getElementById('capacity'), 'Capacity must be greater than zero.'); ok = false; }

  return ok;
}

async function saveEvent(e) {
  e.preventDefault();
  if (!validateEventForm()) {
    showToast('Please correct the highlighted fields.', 'error');
    return;
  }

  const id = document.getElementById('event-id').value;
  const payload = {
    title: document.getElementById('title').value,
    clubId: document.getElementById('clubId').value,
    date: document.getElementById('date').value,
    time: document.getElementById('time').value,
    venue: document.getElementById('venue').value,
    capacity: document.getElementById('capacity').value,
    status: document.getElementById('status').value,
    description: document.getElementById('description').value,
  };

  const btn = document.getElementById('save-btn');
  btn.disabled = true;
  try {
    const result = await api(id ? `/api/events/${id}` : '/api/events', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    showToast(result.message, 'success');
    closeModal();
    await loadEvents();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function deleteEvent(id) {
  const event = allEvents.find((e) => e._id === id);
  if (!confirmAction(`Delete "${event ? event.title : 'this event'}"? This cannot be undone.`)) return;
  try {
    const result = await api(`/api/events/${id}`, { method: 'DELETE' });
    showToast(result.message, 'success');
    await loadEvents();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openRegister(id) {
  const event = allEvents.find((e) => e._id === id);
  if (!event) return;

  const left = Math.max((event.capacity || 0) - (event.registrations || 0), 0);
  if (left === 0) {
    showToast('This event is full. No more registrations accepted.', 'error');
    return;
  }

  const p = dateParts(event.date);
  document.getElementById('register-event-id').value = id;
  document.getElementById('reg-day').textContent = p ? p.day : '–';
  document.getElementById('reg-month').textContent = p ? p.month : '';
  document.getElementById('reg-name').textContent = event.title;
  document.getElementById('reg-meta').textContent =
    `${prettyDate(event.date)} · ${prettyTime(event.time)} · ${event.venue} · ${left} seats left`;

  const form = document.getElementById('register-form');
  form.reset();
  clearFieldErrors(form);
  document.getElementById('register-modal').classList.add('open');
  document.getElementById('participant-name').focus();
}

function closeRegister() { document.getElementById('register-modal').classList.remove('open'); }

async function submitRegistration(e) {
  e.preventDefault();
  const form = document.getElementById('register-form');
  clearFieldErrors(form);
  const name = document.getElementById('participant-name').value.trim();
  const email = document.getElementById('participant-email').value.trim();
  let ok = true;
  if (!name) { setFieldError(document.getElementById('participant-name'), 'Name is required.'); ok = false; }
  if (!email) { setFieldError(document.getElementById('participant-email'), 'Email is required.'); ok = false; }
  else if (!isEmail(email)) { setFieldError(document.getElementById('participant-email'), 'Enter a valid email.'); ok = false; }
  if (!ok) return;

  const btn = document.getElementById('reg-submit-btn');
  btn.disabled = true;
  try {
    const id = document.getElementById('register-event-id').value;
    const result = await api(`/api/events/${id}/register`, {
      method: 'POST',
      body: JSON.stringify({ name, email }),
    });
    showToast(result.message, 'success');
    closeRegister();
    await loadEvents();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}
