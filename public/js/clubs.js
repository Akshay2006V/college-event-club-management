// public/js/clubs.js -- club listing, category filter, search and CRUD
let allClubs = [];
let allClubEvents = [];
let activeCategory = 'All';
let clubQuery = '';

document.addEventListener('DOMContentLoaded', () => {
  loadClubs();

  document.getElementById('add-club-btn').addEventListener('click', () => openModal());
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('cancel-btn').addEventListener('click', closeModal);
  document.getElementById('club-modal').addEventListener('click', (e) => {
    if (e.target.id === 'club-modal') closeModal();
  });
  document.getElementById('club-form').addEventListener('submit', saveClub);

  document.querySelectorAll('[data-category]').forEach((chip) => {
    chip.addEventListener('click', () => {
      activeCategory = chip.dataset.category;
      document.querySelectorAll('[data-category]').forEach((c) => c.classList.toggle('active', c === chip));
      renderClubs();
    });
  });

  const search = document.getElementById('global-search');
  const initial = qsParam('q');
  if (initial) {
    search.value = initial;
    clubQuery = initial;
  }
  search.addEventListener('input', () => {
    clubQuery = search.value.trim();
    renderClubs();
  });
});

async function loadClubs() {
  const grid = document.getElementById('club-grid');
  try {
    const [clubs, events] = await Promise.all([api('/api/clubs'), api('/api/events')]);
    allClubs = clubs;
    allClubEvents = events;
    renderClubs();
  } catch (err) {
    grid.innerHTML = `<div class="state grid-state">${escapeHtml(err.message)}</div>`;
    showToast(err.message, 'error');
  }
}

function renderClubs() {
  const grid = document.getElementById('club-grid');
  const needle = clubQuery.toLowerCase();
  const list = allClubs.filter((club) => {
    const inCategory = activeCategory === 'All' || club.category === activeCategory;
    const haystack = `${club.name} ${club.category} ${club.coordinator} ${club.description || ''}`.toLowerCase();
    return inCategory && (!needle || haystack.includes(needle));
  });

  document.getElementById('club-count').textContent =
    list.length === allClubs.length ? `${allClubs.length} clubs` : `${list.length} of ${allClubs.length} clubs`;

  if (!list.length) {
    grid.innerHTML = `<div class="state grid-state">No clubs match this view. <a href="clubs.html">Reset the filters.</a></div>`;
    return;
  }

  grid.innerHTML = list.map((club) => {
    const clubEvents = allClubEvents.filter((e) => e.clubId === club._id || (e.club && e.club._id === club._id));
    const registrations = clubEvents.reduce((sum, e) => sum + (e.registrations || 0), 0);
    return `
      <article class="club-card ${categoryClass(club.category)}">
        <div class="club-cover">
          <span class="mono-lg">${escapeHtml(initials(club.name))}</span>
          <span class="cat-tag">${escapeHtml(club.category)}</span>
        </div>
        <div class="club-body">
          <h3>${escapeHtml(club.name)}</h3>
          <p class="club-coord">${escapeHtml(club.coordinator)} · Est. ${club.establishedYear || '—'}</p>
          <p class="club-desc">${escapeHtml(club.description || 'No description provided yet.')}</p>
          <div class="club-stats">
            <span><b>${club.members || 0}</b> members</span>
            <span><b>${clubEvents.length}</b> ${clubEvents.length === 1 ? 'event' : 'events'}</span>
            <span><b>${registrations}</b> registrations</span>
          </div>
          <div class="club-foot">
            <a class="club-mail" href="mailto:${escapeHtml(club.email)}">${escapeHtml(club.email)}</a>
            <div class="club-actions">
              <button class="link-btn" type="button" onclick="editClub('${club._id}')">Edit</button>
              <button class="link-btn danger" type="button" onclick="deleteClub('${club._id}')">Delete</button>
            </div>
          </div>
        </div>
      </article>`;
  }).join('');
}

function openModal(club) {
  const form = document.getElementById('club-form');
  form.reset();
  clearFieldErrors(form);
  document.getElementById('club-id').value = club ? club._id : '';
  document.getElementById('modal-title').textContent = club ? 'Edit club' : 'Add club';
  document.getElementById('save-btn').textContent = club ? 'Update club' : 'Save club';

  if (club) {
    document.getElementById('name').value = club.name || '';
    document.getElementById('category').value = club.category || '';
    document.getElementById('description').value = club.description || '';
    document.getElementById('coordinator').value = club.coordinator || '';
    document.getElementById('email').value = club.email || '';
    document.getElementById('establishedYear').value = club.establishedYear || '';
    document.getElementById('members').value = club.members || '';
  }
  document.getElementById('club-modal').classList.add('open');
  document.getElementById('name').focus();
}

function closeModal() {
  document.getElementById('club-modal').classList.remove('open');
}

function editClub(id) {
  const club = allClubs.find((c) => c._id === id);
  if (club) openModal(club);
}

// JavaScript validation -- does not rely on the browser's HTML validation.
function validateForm() {
  const form = document.getElementById('club-form');
  clearFieldErrors(form);
  let ok = true;

  const name = document.getElementById('name').value.trim();
  const category = document.getElementById('category').value;
  const coordinator = document.getElementById('coordinator').value.trim();
  const email = document.getElementById('email').value.trim();
  const year = Number(document.getElementById('establishedYear').value);
  const members = Number(document.getElementById('members').value);
  const thisYear = new Date().getFullYear();

  if (!name) { setFieldError(document.getElementById('name'), 'Club name is required.'); ok = false; }
  if (!category) { setFieldError(document.getElementById('category'), 'Choose a category.'); ok = false; }
  if (!coordinator) { setFieldError(document.getElementById('coordinator'), 'Coordinator is required.'); ok = false; }
  if (!email) { setFieldError(document.getElementById('email'), 'Email is required.'); ok = false; }
  else if (!isEmail(email)) { setFieldError(document.getElementById('email'), 'Enter a valid email address.'); ok = false; }
  if (document.getElementById('establishedYear').value && (year < 1900 || year > thisYear + 1)) {
    setFieldError(document.getElementById('establishedYear'), `Year must be between 1900 and ${thisYear + 1}.`); ok = false;
  }
  if (members < 0) { setFieldError(document.getElementById('members'), 'Members cannot be negative.'); ok = false; }

  return ok;
}

async function saveClub(e) {
  e.preventDefault();
  if (!validateForm()) {
    showToast('Please correct the highlighted fields.', 'error');
    return;
  }

  const id = document.getElementById('club-id').value;
  const payload = {
    name: document.getElementById('name').value,
    category: document.getElementById('category').value,
    description: document.getElementById('description').value,
    coordinator: document.getElementById('coordinator').value,
    email: document.getElementById('email').value,
    establishedYear: document.getElementById('establishedYear').value,
    members: document.getElementById('members').value,
  };

  const btn = document.getElementById('save-btn');
  btn.disabled = true;
  try {
    const result = await api(id ? `/api/clubs/${id}` : '/api/clubs', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    showToast(result.message, 'success');
    closeModal();
    await loadClubs();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function deleteClub(id) {
  const club = allClubs.find((c) => c._id === id);
  if (!confirmAction(`Delete "${club ? club.name : 'this club'}"? Events linked to it will also be removed.`)) return;
  try {
    const result = await api(`/api/clubs/${id}`, { method: 'DELETE' });
    showToast(result.message, 'success');
    await loadClubs();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
