// server/routes/dashboard.js -- summary numbers for the home page
const express = require('express');
const router = express.Router();
const { getDb } = require('../config/db');

router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const [totalClubs, totalEvents, allEvents] = await Promise.all([
      db.collection('clubs').countDocuments(),
      db.collection('events').countDocuments(),
      db.collection('events').find({}).toArray(),
    ]);

    const totalRegistrations = allEvents.reduce((sum, e) => sum + (e.registrations || 0), 0);
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = allEvents
      .filter((e) => e.date >= today && e.status !== 'Completed')
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5)
      .map((e) => ({
        _id: e._id,
        title: e.title,
        date: e.date,
        venue: e.venue,
        registrations: e.registrations || 0,
      }));

    res.json({
      totalClubs,
      totalEvents,
      totalRegistrations,
      upcomingEvents: upcoming,
    });
  } catch (err) {
    res.status(500).json({ error: 'Could not load dashboard data.' });
  }
});

module.exports = router;
