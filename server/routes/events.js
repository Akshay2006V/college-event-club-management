// server/routes/events.js -- CRUD for the "events" collection
const express = require('express');
const router = express.Router();
const { getDb } = require('../config/db');
const { isValidId, toId, sendError } = require('../utils');

const COLLECTION = 'events';

function buildEvent(body) {
  return {
    title: String(body.title || '').trim(),
    clubId: String(body.clubId || '').trim(),
    date: String(body.date || '').trim(),
    time: String(body.time || '').trim(),
    venue: String(body.venue || '').trim(),
    description: String(body.description || '').trim(),
    capacity: Number(body.capacity) || 0,
    status: String(body.status || 'Upcoming').trim(),
  };
}

function validateEvent(event) {
  if (!event.title) return 'Event title is required.';
  if (!event.clubId) return 'Please select an organising club.';
  if (!isValidId(event.clubId)) return 'Invalid club selection.';
  if (!event.date) return 'Event date is required.';
  if (Number.isNaN(Date.parse(event.date))) return 'Enter a valid event date.';
  if (!event.venue) return 'Venue is required.';
  if (event.capacity <= 0) return 'Capacity must be greater than zero.';
  if (!['Upcoming', 'Ongoing', 'Completed'].includes(event.status)) return 'Invalid status.';
  return null;
}

// Aggregation pipeline that joins each event with its club name.
const withClub = [
  {
    $lookup: {
      from: 'clubs',
      localField: 'clubId',
      foreignField: '_id',
      as: 'club',
    },
  },
  { $unwind: { path: '$club', preserveNullAndEmptyArrays: true } },
  {
    $project: {
      'club.description': 0,
      'club.email': 0,
      'club.createdAt': 0,
      'club.updatedAt': 0,
    },
  },
];

// READ all
router.get('/', async (req, res) => {
  try {
    const events = await getDb().collection(COLLECTION).aggregate([
      ...withClub,
      { $sort: { date: 1 } },
    ]).toArray();
    res.json(events);
  } catch (err) {
    sendError(res, 500, 'Could not retrieve events.');
  }
});

// READ one
router.get('/:id', async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid event id.');
  try {
    const [event] = await getDb().collection(COLLECTION).aggregate([
      { $match: { _id: toId(req.params.id) } },
      ...withClub,
    ]).toArray();
    if (!event) return sendError(res, 404, 'Event not found.');
    res.json(event);
  } catch (err) {
    sendError(res, 500, 'Could not retrieve the event.');
  }
});

// CREATE
router.post('/', async (req, res) => {
  const event = buildEvent(req.body);
  const problem = validateEvent(event);
  if (problem) return sendError(res, 400, problem);

  try {
    // Confirm the club exists before storing a reference to it.
    const club = await getDb().collection('clubs').findOne({ _id: toId(event.clubId) });
    if (!club) return sendError(res, 404, 'The selected club no longer exists.');

    event.clubId = toId(event.clubId); // store a real ObjectId so $lookup matches clubs._id
    event.registrations = 0;
    event.createdAt = new Date();
    const result = await getDb().collection(COLLECTION).insertOne(event);
    res.status(201).json({ ...event, _id: result.insertedId, message: 'Event created successfully.' });
  } catch (err) {
    sendError(res, 500, 'Could not create the event.');
  }
});

// UPDATE
router.put('/:id', async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid event id.');
  const event = buildEvent(req.body);
  const problem = validateEvent(event);
  if (problem) return sendError(res, 400, problem);

  try {
    const club = await getDb().collection('clubs').findOne({ _id: toId(event.clubId) });
    if (!club) return sendError(res, 404, 'The selected club no longer exists.');

    event.clubId = toId(event.clubId); // keep the reference type consistent with clubs._id
    event.updatedAt = new Date();
    const result = await getDb().collection(COLLECTION).findOneAndUpdate(
      { _id: toId(req.params.id) },
      { $set: event },
      { returnDocument: 'after' }
    );
    const updated = result && result.value !== undefined ? result.value : result;
    if (!updated) return sendError(res, 404, 'Event not found. It may have been deleted.');
    res.json({ ...updated, message: 'Event updated successfully.' });
  } catch (err) {
    sendError(res, 500, 'Could not update the event.');
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid event id.');
  try {
    const result = await getDb().collection(COLLECTION).deleteOne({ _id: toId(req.params.id) });
    if (result.deletedCount === 0) return sendError(res, 404, 'Event not found. It may have been deleted already.');
    res.json({ message: 'Event deleted successfully.' });
  } catch (err) {
    sendError(res, 500, 'Could not delete the event.');
  }
});

// Register a participant (increments the count, capped at capacity)
router.post('/:id/register', async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid event id.');
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim();
  if (!name) return sendError(res, 400, 'Participant name is required.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendError(res, 400, 'Enter a valid email address.');

  try {
    const id = toId(req.params.id);
    const event = await getDb().collection(COLLECTION).findOne({ _id: id });
    if (!event) return sendError(res, 404, 'Event not found.');
    if ((event.registrations || 0) >= event.capacity)
      return sendError(res, 400, 'This event is full. No more registrations accepted.');

    const result = await getDb().collection(COLLECTION).findOneAndUpdate(
      { _id: id, $expr: { $lt: ['$registrations', '$capacity'] } },
      {
        $inc: { registrations: 1 },
        $push: { participants: { name, email, registeredAt: new Date() } },
      },
      { returnDocument: 'after' }
    );
    const updated = result && result.value !== undefined ? result.value : result;
    if (!updated) return sendError(res, 400, 'This event just became full. Please refresh.');
    res.json({ message: `Registration confirmed for ${name}.`, registrations: updated.registrations });
  } catch (err) {
    sendError(res, 500, 'Could not complete the registration.');
  }
});

module.exports = router;
