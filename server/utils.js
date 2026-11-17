// server/utils.js -- shared validation / response helpers
const { ObjectId } = require('mongodb');

// A string is a usable ObjectId only if MongoDB can parse it AND the
// round-trip matches (prevents 12-byte strings being silently accepted).
function isValidId(id) {
  return ObjectId.isValid(id) && new ObjectId(id).toString() === String(id);
}

function toId(id) {
  return new ObjectId(id);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

module.exports = { isValidId, toId, isEmail, sendError };
