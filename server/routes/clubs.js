// server/routes/clubs.js -- CRUD for the "clubs" collection
const express = require('express');
const router = express.Router();
const { getDb } = require('../config/db');
const { isValidId, toId, isEmail, sendError } = require('../utils');

const COLLECTION = 'clubs';

// Build a sanitised document from request body.
function buildClub(body) {
  return {
    name: String(body.name || '').trim(),
    category: String(body.category || '').trim(),
    description: String(body.description || '').trim(),
    coordinator: String(body.coordinator || '').trim(),
    email: String(body.email || '').trim(),
    establishedYear: Number(body.establishedYear) || new Date().getFullYear(),
    members: Number(body.members) || 0,
  };
}

function validateClub(club) {
  if (!club.name) return 'Club name is required.';
  if (!club.category) return 'Category is required.';
  if (!club.coordinator) return 'Coordinator is required.';
  if (!club.email) return 'Email is required.';
  if (!isEmail(club.email)) return 'Enter a valid email address.';
  if (club.establishedYear < 1900 || club.establishedYear > new Date().getFullYear() + 1)
    return 'Enter a valid established year.';
  if (club.members < 0) return 'Members cannot be negative.';
  return null;
}

// READ all
router.get('/', async (req, res) => {
  try {
    const clubs = await getDb().collection(COLLECTION).find({}).sort({ name: 1 }).toArray();
    res.json(clubs);
  } catch (err) {
    sendError(res, 500, 'Could not retrieve clubs.');
  }
});

// READ one
router.get('/:id', async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid club id.');
  try {
    const club = await getDb().collection(COLLECTION).findOne({ _id: toId(req.params.id) });
    if (!club) return sendError(res, 404, 'Club not found.');
    res.json(club);
  } catch (err) {
    sendError(res, 500, 'Could not retrieve the club.');
  }
});

// CREATE
router.post('/', async (req, res) => {
  const club = buildClub(req.body);
  const problem = validateClub(club);
  if (problem) return sendError(res, 400, problem);

  try {
    club.createdAt = new Date();
    const result = await getDb().collection(COLLECTION).insertOne(club);
    res.status(201).json({ ...club, _id: result.insertedId, message: 'Club created successfully.' });
  } catch (err) {
    sendError(res, 500, 'Could not create the club.');
  }
});

// UPDATE
router.put('/:id', async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid club id.');
  const club = buildClub(req.body);
  const problem = validateClub(club);
  if (problem) return sendError(res, 400, problem);

  try {
    club.updatedAt = new Date();
    const result = await getDb().collection(COLLECTION).findOneAndUpdate(
      { _id: toId(req.params.id) },
      { $set: club },
      { returnDocument: 'after' }
    );
    // mongodb v6 returns the document directly (not { value })
    const updated = result && result.value !== undefined ? result.value : result;
    if (!updated) return sendError(res, 404, 'Club not found. It may have been deleted.');
    res.json({ ...updated, message: 'Club updated successfully.' });
  } catch (err) {
    sendError(res, 500, 'Could not update the club.');
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid club id.');
  try {
    const result = await getDb().collection(COLLECTION).deleteOne({ _id: toId(req.params.id) });
    if (result.deletedCount === 0) return sendError(res, 404, 'Club not found. It may have been deleted already.');

    // Keep data tidy: remove events that referenced the deleted club.
    await getDb().collection('events').deleteMany({ clubId: toId(req.params.id) });
    res.json({ message: 'Club deleted successfully.' });
  } catch (err) {
    sendError(res, 500, 'Could not delete the club.');
  }
});

module.exports = router;
