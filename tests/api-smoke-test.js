// tests/api-smoke-test.js
// Runs CRUD + validation checks against the live server and writes tests/results.json.
// Usage: npm run test:api   (server must already be running)
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:5000';
const results = [];

function record(name, input, expected, actual, pass) {
  results.push({ name, input, expected, actual, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}`);
}

async function req(url, options = {}) {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  let data = {};
  try { data = await res.json(); } catch { /* ignore */ }
  return { status: res.status, data };
}

(async () => {
  const stamp = Date.now();
  const clubPayload = {
    name: `Test Club ${stamp}`,
    category: 'Technical',
    description: 'Temporary club created by the automated smoke test.',
    coordinator: 'Test Coordinator',
    email: `test${stamp}@example.com`,
    establishedYear: 2020,
    members: 10,
  };
  let clubId = null;
  const createdEventIds = [];

  try {
    // 1. Reject empty club name
    let r = await req('/api/clubs', { method: 'POST', body: JSON.stringify({ ...clubPayload, name: '' }) });
    record('Create club with empty name',
      'name = ""',
      'HTTP 400 + validation message',
      `HTTP ${r.status} - ${r.data.error || 'no error'}`,
      r.status === 400 && !!r.data.error);

    // 2. Reject invalid email
    r = await req('/api/clubs', { method: 'POST', body: JSON.stringify({ ...clubPayload, email: 'abc' }) });
    record('Create club with invalid email',
      'email = "abc"',
      'HTTP 400 + email error',
      `HTTP ${r.status} - ${r.data.error || 'no error'}`,
      r.status === 400 && /email/i.test(r.data.error || ''));

    // 3. Create valid club
    r = await req('/api/clubs', { method: 'POST', body: JSON.stringify(clubPayload) });
    clubId = r.data._id;
    record('Create valid club',
      'all required fields filled',
      'HTTP 201 + club id returned',
      `HTTP ${r.status} - id ${clubId ? 'returned' : 'missing'}`,
      r.status === 201 && !!clubId);

    // 4. Read clubs list
    r = await req('/api/clubs');
    record('Read club list',
      'GET /api/clubs',
      'HTTP 200 + array containing the new club',
      `HTTP ${r.status} - ${Array.isArray(r.data) ? r.data.length + ' clubs' : 'not an array'}`,
      r.status === 200 && Array.isArray(r.data) && r.data.some((c) => c._id === clubId));

    // 5. Update club
    r = await req(`/api/clubs/${clubId}`, {
      method: 'PUT',
      body: JSON.stringify({ ...clubPayload, members: 99 }),
    });
    record('Update club members',
      'members = 99',
      'HTTP 200 + members = 99',
      `HTTP ${r.status} - members = ${r.data.members}`,
      r.status === 200 && r.data.members === 99);

    // 6. Reject invalid event (no club)
    r = await req('/api/events', { method: 'POST', body: JSON.stringify({ title: 'No club event' }) });
    record('Create event without club',
      'clubId = ""',
      'HTTP 400 + validation message',
      `HTTP ${r.status} - ${r.data.error || 'no error'}`,
      r.status === 400 && !!r.data.error);

    // 7. Reject capacity 0
    r = await req('/api/events', {
      method: 'POST',
      body: JSON.stringify({ ...clubPayload, title: 'Zero capacity', clubId, date: '2026-12-20', venue: 'Hall', capacity: 0 }),
    });
    record('Create event with capacity 0',
      'capacity = 0',
      'HTTP 400 + capacity error',
      `HTTP ${r.status} - ${r.data.error || 'no error'}`,
      r.status === 400 && /capacity/i.test(r.data.error || ''));

    // 8. Create valid event linked to club
    r = await req('/api/events', {
      method: 'POST',
      body: JSON.stringify({
        title: `Test Event ${stamp}`,
        clubId,
        date: '2026-12-20',
        time: '11:00',
        venue: 'Test Hall',
        description: 'Temporary event created by the automated smoke test.',
        capacity: 50,
        status: 'Upcoming',
      }),
    });
    const eventId = r.data._id;
    if (eventId) createdEventIds.push(eventId);
    record('Create valid event',
      'title, club, date, venue, capacity filled',
      'HTTP 201 + event id returned',
      `HTTP ${r.status} - id ${eventId ? 'returned' : 'missing'}`,
      r.status === 201 && !!eventId);

    // 9. $lookup join with club
    r = await req('/api/events');
    const joined = Array.isArray(r.data) ? r.data.find((e) => e._id === eventId) : null;
    record('Read events with joined club name ($lookup)',
      'GET /api/events',
      'HTTP 200 + club.name present',
      `HTTP ${r.status} - club = ${joined && joined.club ? joined.club.name : 'missing'}`,
      r.status === 200 && !!joined && !!joined.club && joined.club.name === clubPayload.name);

    // 10. Update event
    r = await req(`/api/events/${eventId}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: `Test Event ${stamp} (updated)`,
        clubId,
        date: '2026-12-21',
        time: '12:00',
        venue: 'Updated Hall',
        description: 'Updated by smoke test.',
        capacity: 55,
        status: 'Upcoming',
      }),
    });
    record('Update event venue and capacity',
      'venue = "Updated Hall", capacity = 55',
      'HTTP 200 + updated values',
      `HTTP ${r.status} - venue = ${r.data.venue}, capacity = ${r.data.capacity}`,
      r.status === 200 && r.data.venue === 'Updated Hall' && r.data.capacity === 55);

    // 11. Register participant
    r = await req(`/api/events/${eventId}/register`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Student', email: 'student@example.com' }),
    });
    record('Register a participant',
      'valid name + email',
      'HTTP 200 + registrations = 1',
      `HTTP ${r.status} - registrations = ${r.data.registrations}`,
      r.status === 200 && r.data.registrations === 1);

    // 12. Capacity limit
    r = await req('/api/events', {
      method: 'POST',
      body: JSON.stringify({
        title: `Full Event ${stamp}`,
        clubId,
        date: '2026-12-22',
        time: '09:00',
        venue: 'Small Room',
        description: 'Capacity test.',
        capacity: 1,
        status: 'Upcoming',
      }),
    });
    const fullEventId = r.data._id;
    if (fullEventId) createdEventIds.push(fullEventId);
    await req(`/api/events/${fullEventId}/register`, {
      method: 'POST',
      body: JSON.stringify({ name: 'First Student', email: 'first@example.com' }),
    });
    r = await req(`/api/events/${fullEventId}/register`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Second Student', email: 'second@example.com' }),
    });
    record('Register when event is full',
      'capacity = 1, second registration',
      'HTTP 400 + "event is full"',
      `HTTP ${r.status} - ${r.data.error || 'no error'}`,
      r.status === 400 && /full/i.test(r.data.error || ''));

    // 13. Not-found handling
    r = await req('/api/clubs/000000000000000000000000');
    record('Read a missing club',
      'id = 000000000000000000000000',
      'HTTP 404 + "Club not found"',
      `HTTP ${r.status} - ${r.data.error || 'no error'}`,
      r.status === 404);

    // 14. Dashboard counts
    r = await req('/api/dashboard');
    record('Dashboard summary',
      'GET /api/dashboard',
      'HTTP 200 + numeric counts',
      `HTTP ${r.status} - clubs=${r.data.totalClubs}, events=${r.data.totalEvents}, registrations=${r.data.totalRegistrations}`,
      r.status === 200 && typeof r.data.totalClubs === 'number' && typeof r.data.totalEvents === 'number');

    // 15. Delete full event
    r = await req(`/api/events/${fullEventId}`, { method: 'DELETE' });
    record('Delete an event',
      'DELETE /api/events/:id',
      'HTTP 200 + success message',
      `HTTP ${r.status} - ${r.data.message || r.data.error}`,
      r.status === 200);

    // 16. Delete main event
    r = await req(`/api/events/${eventId}`, { method: 'DELETE' });
    record('Delete the linked event',
      'DELETE /api/events/:id',
      'HTTP 200 + success message',
      `HTTP ${r.status} - ${r.data.message || r.data.error}`,
      r.status === 200);

    // 17. Delete club
    r = await req(`/api/clubs/${clubId}`, { method: 'DELETE' });
    record('Delete the test club',
      'DELETE /api/clubs/:id',
      'HTTP 200 + success message',
      `HTTP ${r.status} - ${r.data.message || r.data.error}`,
      r.status === 200);

    // 18. Deleted club is gone
    r = await req(`/api/clubs/${clubId}`);
    record('Read a deleted club',
      'GET deleted club id',
      'HTTP 404 + "Club not found"',
      `HTTP ${r.status} - ${r.data.error || 'no error'}`,
      r.status === 404);
  } catch (err) {
    record('Test run completed without exceptions', '-', 'no exception', err.message, false);
  } finally {
    // Best-effort cleanup so the seeded demo data stays clean.
    for (const id of createdEventIds) {
      try { await req(`/api/events/${id}`, { method: 'DELETE' }); } catch { /* ignore */ }
    }
    if (clubId) { try { await req(`/api/clubs/${clubId}`, { method: 'DELETE' }); } catch { /* ignore */ } }
  }

  const passed = results.filter((r) => r.pass).length;
  const summary = { baseUrl: BASE, ranAt: new Date().toISOString(), passed, failed: results.length - passed, results };
  fs.mkdirSync(path.join(__dirname), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(summary, null, 2));
  console.log(`\n${passed}/${results.length} checks passed. Results saved to tests/results.json`);
  process.exit(passed === results.length ? 0 : 1);
})();
